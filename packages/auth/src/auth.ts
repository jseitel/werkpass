import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { sso } from "@better-auth/sso";
import { prisma } from "@werkpass/db";
import { encryptedPrismaAdapter } from "./encrypted-prisma-adapter";
import { assertSsoEncryptionConfigured } from "./sso-config-crypto";
import { ac, roles } from "./permissions";

const tenantIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const domainPattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const providerMutationPaths = new Set([
  "/sso/register",
  "/sso/update-provider",
  "/sso/delete-provider",
  "/sso/request-domain-verification",
  "/sso/verify-domain",
]);
const providerAuditActions: Record<string, string> = {
  "/sso/register": "sso.provider.created",
  "/sso/update-provider": "sso.provider.updated",
  "/sso/delete-provider": "sso.provider.deleted",
  "/sso/request-domain-verification": "sso.domain_verification.requested",
  "/sso/verify-domain": "sso.domain.verified",
};
const entraAdminRole = "Werkpass.Admin";
const entraOidcMapping = {
  id: "sub",
  email: "preferred_username",
  name: "name",
  extraFields: { entraRoles: "roles" },
} as const;
type ProviderRecord = {
  organizationId?: string | null;
  providerId: string;
  issuer?: string;
  domain?: string;
  oidcConfig?: string | null;
};

function normalizeEntraOidcConfig(rawConfig: string): string | null {
  const oidcConfig = JSON.parse(rawConfig) as Record<string, unknown>;
  const currentMapping = bodyRecord(oidcConfig.mapping);
  const currentExtraFields = bodyRecord(currentMapping.extraFields);
  const alreadyNormalized =
    oidcConfig.userInfoEndpoint === undefined &&
    currentMapping.id === entraOidcMapping.id &&
    currentMapping.email === entraOidcMapping.email &&
    currentMapping.name === entraOidcMapping.name &&
    currentExtraFields.entraRoles === entraOidcMapping.extraFields.entraRoles;
  if (alreadyNormalized) return null;

  // Entra emits app roles in its signed ID token. Keeping UserInfo disabled
  // makes the role decision depend on the already verified token claims.
  delete oidcConfig.userInfoEndpoint;
  oidcConfig.mapping = entraOidcMapping;
  return JSON.stringify(oidcConfig);
}

function entraOrganizationRole(userInfo: Record<string, unknown>): "admin" | "member" {
  const assertedRoles = userInfo.entraRoles;
  return Array.isArray(assertedRoles) && assertedRoles.includes(entraAdminRole)
    ? "admin"
    : "member";
}

async function synchronizeEntraOrganizationRole(input: {
  user: { id: string; email: string };
  userInfo: Record<string, unknown>;
  provider: {
    providerId: string;
    organizationId?: string | null;
    issuer: string;
    domain: string;
    domainVerified?: boolean;
  };
}) {
  const { user, userInfo, provider } = input;
  const organizationId = provider.organizationId;
  if (
    !organizationId ||
    provider.domainVerified !== true ||
    !provider.issuer.startsWith("https://login.microsoftonline.com/") ||
    provider.providerId !== providerIdForOrganization(organizationId) ||
    emailDomain(user.email) !== provider.domain.trim().toLowerCase()
  ) {
    return;
  }

  const membership = await prisma.member.findFirst({
    where: { organizationId, userId: user.id },
    select: { id: true, role: true },
  });
  if (!membership) return;

  const currentRoles = membership.role.split(",").map((role) => role.trim());
  // The organization owner is managed locally. Entra may grant admin access,
  // but it must never be able to remove ownership accidentally.
  if (currentRoles.includes("owner")) return;

  const desiredRole = entraOrganizationRole(userInfo);
  if (membership.role === desiredRole) return;

  await prisma.member.update({
    where: { id: membership.id },
    data: { role: desiredRole },
  });
  await auditSecurityEvent({
    action: "auth.sso.role_synchronized",
    organizationId,
    actorUserId: user.id,
    targetType: "member",
    targetId: membership.id,
    details: { previousRole: membership.role, role: desiredRole, providerId: provider.providerId },
  });
}

const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Microsoft publishes most tenant-specific OIDC endpoints below the login
// origin, but its official discovery document points UserInfo at Graph.
// Better Auth validates every discovered endpoint against this exact allowlist.
const microsoftOidcOrigins = [
  "https://login.microsoftonline.com",
  "https://graph.microsoft.com",
] as const;
for (const origin of microsoftOidcOrigins) {
  if (!trustedOrigins.includes(origin)) trustedOrigins.push(origin);
}

if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl || new URL(baseUrl).protocol !== "https:") {
    throw new Error("BETTER_AUTH_URL muss in Produktion eine HTTPS-URL sein.");
  }
  if (trustedOrigins.some((origin) => new URL(origin).protocol !== "https:")) {
    throw new Error("BETTER_AUTH_TRUSTED_ORIGINS darf in Produktion nur HTTPS-Origins enthalten.");
  }
  assertSsoEncryptionConfigured();
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

function emailDomain(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");
  return separator > 0 ? normalized.slice(separator + 1) : null;
}

function tenantIdFromIssuer(issuer: unknown): string | null {
  if (typeof issuer !== "string") return null;
  const match = issuer.match(/^https:\/\/login\.microsoftonline\.com\/([^/]+)\/v2\.0$/i);
  return match && tenantIdPattern.test(match[1]!) ? match[1]!.toLowerCase() : null;
}

function providerIdForOrganization(organizationId: string): string {
  return `entra-${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

const trustedProxies = (process.env.TRUSTED_PROXIES ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

/**
 * Mirrors `clientIpAddress` in @werkpass/core - duplicated because this package
 * deliberately stays free of a dependency on core. `X-Forwarded-For` is written
 * by the client and only appended to by proxies, so the left-most entry is
 * whatever the caller typed. Counting from the right reads the entry our own
 * proxy wrote; a chain shorter than the proxy count did not come through it.
 */
function forwardedIpAddress(request?: Request): string | null {
  if (process.env.TRUST_PROXY_HEADERS !== "true") return null;

  const forwarded = request?.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const configured = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
    const index =
      hops.length - (Number.isInteger(configured) && configured > 0 ? configured : 1);
    return index >= 0 ? hops[index] ?? null : null;
  }

  return request?.headers.get("x-real-ip")?.trim() || null;
}

function requestMetadata(request?: Request) {
  return {
    ipAddress: forwardedIpAddress(request),
    userAgent: request?.headers.get("user-agent")?.slice(0, 512) ?? null,
  };
}

async function auditSecurityEvent(input: {
  action: string;
  organizationId?: string | null;
  actorUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  request?: Request;
  details?: Record<string, string | number | boolean | null>;
}) {
  try {
    await prisma.securityAuditLog.create({
      data: {
        action: input.action,
        organizationId: input.organizationId ?? null,
        actorUserId: input.actorUserId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        ...requestMetadata(input.request),
        details: input.details,
      },
    });
  } catch (error) {
    console.error("Security audit log could not be persisted", error);
  }
}

async function requiredSsoProviderForDomain(domain: string) {
  const provider = await prisma.ssoProvider.findFirst({
    where: { domain: { equals: domain, mode: "insensitive" } },
    select: { providerId: true, organizationId: true },
  });
  if (!provider?.organizationId) return null;
  const organization = await prisma.organization.findUnique({
    where: { id: provider.organizationId },
    select: { id: true, ssoMode: true, ssoBreakGlassUserId: true },
  });
  return organization?.ssoMode === "required" ? { provider, organization } : null;
}

export const auth = betterAuth({
  trustedOrigins,
  database: encryptedPrismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/sign-in/sso": { window: 60, max: 10 },
      "/sso/register": { window: 300, max: 3 },
      "/sso/update-provider": { window: 300, max: 5 },
      "/sso/request-domain-verification": { window: 300, max: 3 },
      "/sso/verify-domain": { window: 300, max: 5 },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Sensitive Better Auth operations and SSO administration require a login
    // no older than 15 minutes.
    freshAge: 60 * 15,
    // Keep the former encoding strategy during the cache-off migration.
    // Better Auth 1.6.26 still parses an existing session_data cookie even
    // when caching is disabled. Without this hint it treats the old JWE as
    // compact Base64 and fails on the dots separating the JWE segments.
    cookieCache: { enabled: false, strategy: "jwe" },
  },
  account: {
    encryptOAuthTokens: true,
    storeStateStrategy: "cookie",
  },
  advanced: {
    disableCSRFCheck: false,
    disableOriginCheck: false,
    useSecureCookies: process.env.NODE_ENV === "production",
    cookiePrefix: "werkpass",
    defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
    ipAddress: {
      disableIpTracking: false,
      ...(process.env.TRUST_PROXY_HEADERS === "true"
        ? {
            ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
            // Without the proxy CIDRs Better Auth refuses to read a multi-value
            // X-Forwarded-For at all (correctly - the left-most entry is
            // client-written) and collapses every caller into one shared rate
            // limit bucket.
            ...(trustedProxies.length > 0 ? { trustedProxies } : {}),
          }
        : {}),
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (providerMutationPaths.has(ctx.path)) {
          const session = await getSessionFromCtx(ctx);
          if (
            !session?.session.createdAt ||
            Date.now() - new Date(session.session.createdAt).getTime() > 15 * 60 * 1000
          ) {
            throw new APIError("FORBIDDEN", { message: "Bitte melde dich erneut an, bevor du SSO änderst." });
          }
          const body = bodyRecord(ctx.body);
          const requestedOrganizationId =
            typeof body.organizationId === "string" ? body.organizationId : null;
          const requestedProviderId =
            typeof body.providerId === "string" ? body.providerId : null;

          let provider: ProviderRecord | null = null;
          if (requestedProviderId) {
            provider = (await ctx.context.adapter.findOne({
              model: "ssoProvider",
              where: [{ field: "providerId", value: requestedProviderId }],
            })) as ProviderRecord | null;
          }
          const organizationId = requestedOrganizationId ?? provider?.organizationId ?? null;
          if (!session?.user?.id || !organizationId) {
            throw new APIError("FORBIDDEN", { message: "SSO muss einer Organisation zugeordnet sein." });
          }
          if ((session.session as typeof session.session & { activeOrganizationId?: string | null }).activeOrganizationId !== organizationId) {
            throw new APIError("FORBIDDEN", { message: "Bitte wähle die Organisation zuerst als aktiv aus." });
          }

          const membership = await prisma.member.findFirst({
            where: { organizationId, userId: session.user.id },
            select: { role: true },
          });
          const roleList = membership?.role.split(",").map((role) => role.trim()) ?? [];
          if (!roleList.some((role) => role === "owner" || role === "admin")) {
            throw new APIError("FORBIDDEN", { message: "Nur Owner und Admins dürfen SSO verwalten." });
          }

          if (ctx.path === "/sso/register") {
            if (requestedProviderId !== providerIdForOrganization(organizationId)) {
              throw new APIError("BAD_REQUEST", { message: "Ungültige Provider-ID." });
            }
            if (body.samlConfig || !body.oidcConfig || !tenantIdFromIssuer(body.issuer)) {
              throw new APIError("BAD_REQUEST", { message: "Es wird ausschließlich Microsoft Entra OIDC unterstützt." });
            }
            const oidc = bodyRecord(body.oidcConfig);
            if (
              typeof oidc.clientId !== "string" ||
              typeof oidc.clientSecret !== "string" ||
              !oidc.clientId.trim() ||
              !oidc.clientSecret.trim() ||
              oidc.skipDiscovery === true
            ) {
              throw new APIError("BAD_REQUEST", { message: "Client-ID und Client-Secret sind erforderlich; Discovery darf nicht umgangen werden." });
            }
            body.oidcConfig = {
              clientId: oidc.clientId.trim(),
              clientSecret: oidc.clientSecret,
              scopes: ["openid", "profile", "email"],
              pkce: true,
              mapping: entraOidcMapping,
            };
            const existing = await prisma.ssoProvider.findFirst({ where: { organizationId } });
            if (existing) {
              throw new APIError("CONFLICT", { message: "Für diese Organisation existiert bereits ein SSO-Provider." });
            }
          }

          if (provider && provider.organizationId !== organizationId) {
            throw new APIError("FORBIDDEN", { message: "Der Provider gehört nicht zur aktiven Organisation." });
          }
          if (provider && requestedProviderId !== providerIdForOrganization(organizationId)) {
            throw new APIError("BAD_REQUEST", { message: "Ungültige Provider-ID." });
          }

          const requestedDomain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : null;
          if (requestedDomain) {
            if (!domainPattern.test(requestedDomain)) {
              throw new APIError("BAD_REQUEST", { message: "Ungültige Unternehmensdomain." });
            }
            body.domain = requestedDomain;
            const collision = await prisma.ssoProvider.findFirst({
              where: {
                domain: { equals: requestedDomain, mode: "insensitive" },
                ...(requestedProviderId ? { providerId: { not: requestedProviderId } } : {}),
              },
              select: { id: true },
            });
            if (collision) {
              throw new APIError("CONFLICT", { message: "Diese Domain ist bereits einer Organisation zugeordnet." });
            }
          }

          if (body.issuer !== undefined && !tenantIdFromIssuer(body.issuer)) {
            throw new APIError("BAD_REQUEST", { message: "Ungültiger Microsoft-Tenant-Issuer." });
          }
          if (body.samlConfig) {
            throw new APIError("BAD_REQUEST", { message: "SAML ist für Self-Service deaktiviert." });
          }

          if (ctx.path === "/sso/update-provider" && provider) {
            let currentClientId: string | null = null;
            if (typeof provider.oidcConfig === "string") {
              try {
                currentClientId = (JSON.parse(provider.oidcConfig) as { clientId?: string }).clientId ?? null;
              } catch {
                throw new APIError("INTERNAL_SERVER_ERROR", { message: "Gespeicherte OIDC-Konfiguration ist ungültig." });
              }
            }
            const oidc = bodyRecord(body.oidcConfig);
            const identityChanged =
              (typeof body.issuer === "string" && body.issuer !== provider.issuer) ||
              (typeof body.domain === "string" && body.domain !== provider.domain) ||
              (typeof oidc.clientId === "string" && oidc.clientId !== currentClientId);
            if (body.oidcConfig) {
              if (oidc.skipDiscovery === true) {
                throw new APIError("BAD_REQUEST", { message: "OIDC Discovery darf nicht umgangen werden." });
              }
              body.oidcConfig = {
                ...(typeof oidc.clientId === "string" && oidc.clientId.trim()
                  ? { clientId: oidc.clientId.trim() }
                  : {}),
                ...(typeof oidc.clientSecret === "string" && oidc.clientSecret
                  ? { clientSecret: oidc.clientSecret }
                  : {}),
                scopes: ["openid", "profile", "email"],
                pkce: true,
                mapping: entraOidcMapping,
              };
            }
            if (identityChanged) {
              await prisma.ssoProvider.update({
                where: { providerId: provider.providerId },
                data: { domainVerified: false, domainVerifiedAt: null, verificationDueAt: null },
              });
            }
          }
      }

      if (ctx.path === "/sign-in/email" || ctx.path === "/sign-up/email") {
          const body = bodyRecord(ctx.body);
          const domain = emailDomain(body.email);
          if (!domain) return;
          const required = await requiredSsoProviderForDomain(domain);
          if (!required) return;

          if (ctx.path === "/sign-up/email") {
            throw new APIError("FORBIDDEN", { message: "Für diese Domain ist ausschließlich Firmenanmeldung verfügbar." });
          }
          const user = await prisma.user.findUnique({ where: { email: String(body.email).trim().toLowerCase() } });
          if (!user) return;
          const membership = await prisma.member.findFirst({
            where: { organizationId: required.organization.id, userId: user.id },
            select: { id: true },
          });
          if (membership && required.organization.ssoBreakGlassUserId !== user.id) {
            await auditSecurityEvent({
              action: "auth.password.blocked_by_sso",
              organizationId: required.organization.id,
              actorUserId: user.id,
              request: ctx.request,
            });
            throw new APIError("FORBIDDEN", { message: "Für dieses Konto ist ausschließlich Firmenanmeldung verfügbar." });
          }
      }

      if (ctx.path === "/sign-in/sso") {
          const body = bodyRecord(ctx.body);
          const provider = typeof body.providerId === "string"
            ? await prisma.ssoProvider.findUnique({ where: { providerId: body.providerId } })
            : await prisma.ssoProvider.findFirst({
                where: {
                  domain: { equals: emailDomain(body.email) ?? "", mode: "insensitive" },
                  domainVerified: true,
                },
              });
          if (!provider?.domainVerified) return;
          const storedProvider = (await ctx.context.adapter.findOne({
            model: "ssoProvider",
            where: [{ field: "providerId", value: provider.providerId }],
          })) as ProviderRecord | null;
          if (
            storedProvider?.issuer?.startsWith("https://login.microsoftonline.com/") &&
            typeof storedProvider.oidcConfig === "string"
          ) {
            const normalizedConfig = normalizeEntraOidcConfig(storedProvider.oidcConfig);
            if (normalizedConfig) {
              await ctx.context.adapter.update({
                model: "ssoProvider",
                where: [{ field: "providerId", value: provider.providerId }],
                update: { oidcConfig: normalizedConfig },
              });
            }
          }
          if (provider.verificationDueAt && provider.verificationDueAt <= new Date()) {
            await prisma.ssoProvider.update({
              where: { id: provider.id },
              data: { domainVerified: false, domainVerifiedAt: null, verificationDueAt: null },
            });
            throw new APIError("FORBIDDEN", { message: "Die Unternehmensdomain muss erneut bestätigt werden." });
          }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (providerMutationPaths.has(ctx.path)) {
          const body = bodyRecord(ctx.body);
          const providerId = typeof body.providerId === "string" ? body.providerId : null;
          const activeOrganizationId = (
            ctx.context.session?.session as { activeOrganizationId?: string | null } | undefined
          )?.activeOrganizationId;
          const organizationId = typeof body.organizationId === "string"
            ? body.organizationId
            : providerId
              ? (await prisma.ssoProvider.findUnique({ where: { providerId }, select: { organizationId: true } }))?.organizationId ?? activeOrganizationId
              : null;

          if (
            (ctx.path === "/sso/register" || ctx.path === "/sso/update-provider") &&
            providerId
          ) {
            const storedProvider = (await ctx.context.adapter.findOne({
              model: "ssoProvider",
              where: [{ field: "providerId", value: providerId }],
            })) as ProviderRecord | null;
            if (
              storedProvider?.issuer?.startsWith("https://login.microsoftonline.com/") &&
              typeof storedProvider.oidcConfig === "string"
            ) {
              const normalizedConfig = normalizeEntraOidcConfig(storedProvider.oidcConfig);
              if (normalizedConfig) {
                await ctx.context.adapter.update({
                  model: "ssoProvider",
                  where: [{ field: "providerId", value: providerId }],
                  update: { oidcConfig: normalizedConfig },
                });
              }
            }
          }

          if (ctx.path === "/sso/verify-domain" && providerId) {
            const verifiedAt = new Date();
            await prisma.ssoProvider.update({
              where: { providerId },
              data: {
                domainVerifiedAt: verifiedAt,
                verificationDueAt: new Date(verifiedAt.getTime() + 90 * 24 * 60 * 60 * 1000),
              },
            });
          }
          await auditSecurityEvent({
            action: providerAuditActions[ctx.path] ?? "sso.provider.changed",
            organizationId,
            actorUserId: ctx.context.session?.user.id,
            targetType: "ssoProvider",
            targetId: providerId,
            request: ctx.request,
          });
      }
    }),
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { defaultOrganizationId: true, members: { select: { organizationId: true } } },
          });
          const organizationIds = user?.members.map((member) => member.organizationId) ?? [];
          const preferredOrganizationId =
            user?.defaultOrganizationId && organizationIds.includes(user.defaultOrganizationId)
              ? user.defaultOrganizationId
              : organizationIds.length === 1
                ? organizationIds[0]
                : null;
          return { data: { ...session, activeOrganizationId: preferredOrganizationId } };
        },
        after: async (session, ctx) => {
          await auditSecurityEvent({
            action: "auth.session.created",
            actorUserId: session.userId,
            request: ctx?.request,
          });
        },
      },
    },
    account: {
      create: {
        after: async (account, ctx) => {
          await auditSecurityEvent({
            action: "auth.account.linked",
            actorUserId: account.userId,
            targetType: "accountProvider",
            targetId: account.providerId,
            request: ctx?.request,
          });
        },
      },
    },
  },
  plugins: [
    organization({ ac, roles }),
    sso({
      providersLimit: 25,
      provisionUserOnEveryLogin: true,
      provisionUser: async ({ user, userInfo, provider }) => {
        await synchronizeEntraOrganizationRole({ user, userInfo, provider });
      },
      organizationProvisioning: {
        disabled: false,
        defaultRole: "member",
        getRole: async ({ userInfo, provider }) => {
          if (!provider.issuer.startsWith("https://login.microsoftonline.com/")) return "member";
          return entraOrganizationRole(userInfo);
        },
      },
      domainVerification: { enabled: true },
    }),
    nextCookies(),
  ],
});
