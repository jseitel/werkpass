"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@werkpass/auth";
import { getOrganizationMember } from "@werkpass/core";
import { prisma } from "@werkpass/db";

export type SsoActionResult = {
  status: "success" | "error";
  message: string;
  verificationToken?: string;
};

const tenantIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const domainPattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const entraOidcMapping = {
  id: "sub",
  email: "preferred_username",
  name: "name",
  extraFields: { entraRoles: "roles" },
} as const;
const microsoftLoginHost = "login.microsoftonline.com";

type OidcDiscoveryDocument = {
  issuer?: unknown;
  authorization_endpoint?: unknown;
  token_endpoint?: unknown;
  jwks_uri?: unknown;
};

function trustedTenantEndpoint(value: unknown, tenantId: string, label: string): URL {
  if (typeof value !== "string") throw new Error(`${label} fehlt in der OIDC-Discovery.`);
  const endpoint = new URL(value);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.hostname.toLowerCase() !== microsoftLoginHost ||
    !endpoint.pathname.toLowerCase().startsWith(`/${tenantId.toLowerCase()}/`)
  ) {
    throw new Error(`${label} verweist nicht auf den konfigurierten Microsoft-Tenant.`);
  }
  return endpoint;
}

async function fetchJson(url: URL, label: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unbekannter Netzwerkfehler";
    throw new Error(`${label} ist nicht erreichbar: ${detail}`);
  }
}

function providerIdForOrganization(organizationId: string): string {
  return `entra-${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

async function requireOrganizationAdmin(options: { requireFresh?: boolean } = {}) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.session.activeOrganizationId) {
    throw new Error("Keine aktive Organisation ausgewählt.");
  }
  if (
    options.requireFresh !== false &&
    Date.now() - new Date(session.session.createdAt).getTime() > 15 * 60 * 1000
  ) {
    throw new Error("Bitte melde dich erneut an, bevor du die SSO-Einstellungen änderst.");
  }

  const organizationId = session.session.activeOrganizationId;
  const member = await getOrganizationMember(organizationId, session.user.id);
  const roles = member?.role.split(",").map((role) => role.trim()) ?? [];
  if (!roles.some((role) => role === "owner" || role === "admin")) {
    throw new Error("Nur Owner und Admins können SSO verwalten.");
  }

  return { organizationId, requestHeaders, userId: session.user.id };
}

function messageFromError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Die SSO-Konfiguration konnte nicht gespeichert werden.";
}

export async function saveEntraSsoAction(
  formData: FormData,
): Promise<SsoActionResult> {
  try {
    const { organizationId, requestHeaders } = await requireOrganizationAdmin();
    const tenantId = String(formData.get("tenantId") ?? "").trim();
    const domain = String(formData.get("domain") ?? "")
      .trim()
      .toLowerCase();
    const clientId = String(formData.get("clientId") ?? "").trim();
    const clientSecret = String(formData.get("clientSecret") ?? "").trim();

    if (!tenantIdPattern.test(tenantId)) {
      return { status: "error", message: "Bitte eine gültige Microsoft-Tenant-ID eingeben." };
    }
    if (!domainPattern.test(domain)) {
      return { status: "error", message: "Bitte eine gültige Unternehmensdomain eingeben." };
    }

    const listed = await auth.api.listSSOProviders({ headers: requestHeaders });
    const existing = listed.providers.find(
      (provider) =>
        provider.organizationId === organizationId &&
        provider.type === "oidc" &&
        provider.issuer.startsWith("https://login.microsoftonline.com/"),
    );
    const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;

    if (existing) {
      const oidcConfig = {
        ...(clientId ? { clientId } : {}),
        ...(clientSecret ? { clientSecret } : {}),
        scopes: ["openid", "profile", "email"],
        pkce: true,
        mapping: entraOidcMapping,
      };

      await auth.api.updateSSOProvider({
        headers: requestHeaders,
        body: {
          providerId: existing.providerId,
          issuer,
          domain,
          oidcConfig,
        },
      });
      revalidatePath("/dashboard/settings/sso");
      return {
        status: "success",
        message: "Microsoft Entra ID wurde aktualisiert.",
      };
    }

    if (!clientId || !clientSecret) {
      return {
        status: "error",
        message: "Client-ID und Client-Secret werden für die erste Einrichtung benötigt.",
      };
    }

    const created = await auth.api.registerSSOProvider({
      headers: requestHeaders,
      body: {
        providerId: providerIdForOrganization(organizationId),
        organizationId,
        issuer,
        domain,
        oidcConfig: {
          clientId,
          clientSecret,
          scopes: ["openid", "profile", "email"],
          pkce: true,
          mapping: entraOidcMapping,
        },
      },
    });

    revalidatePath("/dashboard/settings/sso");
    return {
      status: "success",
      message: "Microsoft Entra ID wurde eingerichtet. Bestätige jetzt die Domain.",
      verificationToken: created.domainVerificationToken,
    };
  } catch (error) {
    return { status: "error", message: messageFromError(error) };
  }
}

async function currentOrganizationProvider(options: { requireFresh?: boolean } = {}) {
  const context = await requireOrganizationAdmin(options);
  const listed = await auth.api.listSSOProviders({ headers: context.requestHeaders });
  const provider = listed.providers.find(
    (item) =>
      item.organizationId === context.organizationId &&
      item.type === "oidc" &&
      item.issuer.startsWith("https://login.microsoftonline.com/"),
  );
  if (!provider) throw new Error("Für diese Organisation ist kein SSO-Provider eingerichtet.");
  return { ...context, provider };
}

export async function requestSsoVerificationTokenAction(): Promise<SsoActionResult> {
  try {
    const { provider, requestHeaders } = await currentOrganizationProvider();
    const result = await auth.api.requestDomainVerification({
      headers: requestHeaders,
      body: { providerId: provider.providerId },
    });
    return {
      status: "success",
      message: "DNS-Prüfeintrag wurde erstellt.",
      verificationToken: result.domainVerificationToken,
    };
  } catch (error) {
    return { status: "error", message: messageFromError(error) };
  }
}

export async function verifySsoDomainAction(): Promise<SsoActionResult> {
  try {
    const { provider, requestHeaders } = await currentOrganizationProvider();
    await auth.api.verifyDomain({
      headers: requestHeaders,
      body: { providerId: provider.providerId },
    });
    revalidatePath("/dashboard/settings/sso");
    return { status: "success", message: "Domain bestätigt. SSO ist jetzt aktiv." };
  } catch (error) {
    return { status: "error", message: messageFromError(error) };
  }
}

export async function testEntraConnectionAction(): Promise<SsoActionResult> {
  try {
    const { provider, organizationId, userId } = await currentOrganizationProvider({
      requireFresh: false,
    });
    const tenantId = provider.issuer.match(
      /^https:\/\/login\.microsoftonline\.com\/([^/]+)\/v2\.0$/i,
    )?.[1];
    if (!tenantId || !tenantIdPattern.test(tenantId)) {
      throw new Error("Der gespeicherte Microsoft-Tenant-Issuer ist ungültig.");
    }

    const discoveryUrl = new URL(`${provider.issuer}/.well-known/openid-configuration`);
    const discovery = (await fetchJson(
      discoveryUrl,
      "Microsoft OIDC-Discovery",
    )) as OidcDiscoveryDocument;
    if (discovery.issuer !== provider.issuer) {
      throw new Error("Der von Microsoft gemeldete Issuer stimmt nicht mit dem Tenant überein.");
    }

    trustedTenantEndpoint(discovery.authorization_endpoint, tenantId, "Authorization-Endpunkt");
    trustedTenantEndpoint(discovery.token_endpoint, tenantId, "Token-Endpunkt");
    const jwksUrl = trustedTenantEndpoint(discovery.jwks_uri, tenantId, "Signaturschlüssel-Endpunkt");
    const jwks = (await fetchJson(jwksUrl, "Microsoft-Signaturschlüssel")) as {
      keys?: unknown;
    };
    if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      throw new Error("Microsoft hat keine Signaturschlüssel für diesen Tenant geliefert.");
    }

    await prisma.securityAuditLog.create({
      data: {
        organizationId,
        actorUserId: userId,
        action: "sso.connection.tested",
        targetType: "ssoProvider",
        targetId: provider.providerId,
        details: { tenantId, status: "success" },
      },
    });
    return {
      status: "success",
      message:
        "Verbindung erfolgreich. Tenant, OIDC-Discovery und Microsoft-Signaturschlüssel sind erreichbar.",
    };
  } catch (error) {
    return { status: "error", message: messageFromError(error) };
  }
}

export async function deleteEntraSsoAction(): Promise<SsoActionResult> {
  try {
    const { provider, requestHeaders, organizationId } = await currentOrganizationProvider();
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ssoMode: true },
    });
    if (organization?.ssoMode === "required") {
      return {
        status: "error",
        message: "Stelle die Anmelderichtlinie zuerst auf ‚Microsoft oder Passwort‘, bevor du SSO trennst.",
      };
    }
    await auth.api.deleteSSOProvider({
      headers: requestHeaders,
      body: { providerId: provider.providerId },
    });
    revalidatePath("/dashboard/settings/sso");
    return { status: "success", message: "Microsoft Entra ID wurde getrennt." };
  } catch (error) {
    return { status: "error", message: messageFromError(error) };
  }
}

export async function saveSsoPolicyAction(mode: "optional" | "required"): Promise<SsoActionResult> {
  try {
    const { organizationId, userId } = await requireOrganizationAdmin();
    if (mode !== "optional" && mode !== "required") {
      return { status: "error", message: "Ungültiger SSO-Modus." };
    }

    if (mode === "required") {
      const provider = await prisma.ssoProvider.findFirst({
        where: { organizationId, domainVerified: true },
        select: { id: true, verificationDueAt: true },
      });
      if (!provider || (provider.verificationDueAt && provider.verificationDueAt <= new Date())) {
        return {
          status: "error",
          message: "SSO kann erst verpflichtend werden, nachdem die Domain bestätigt wurde.",
        };
      }
    }

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: organizationId },
        data: {
          ssoMode: mode,
          ssoBreakGlassUserId: mode === "required" ? userId : null,
        },
      }),
      prisma.securityAuditLog.create({
        data: {
          organizationId,
          actorUserId: userId,
          action: "sso.policy.updated",
          targetType: "organization",
          targetId: organizationId,
          details: { mode, breakGlassUserId: mode === "required" ? userId : null },
        },
      }),
    ]);
    revalidatePath("/dashboard/settings/sso");
    return {
      status: "success",
      message:
        mode === "required"
          ? "Microsoft-Anmeldung ist jetzt verpflichtend. Dein aktuelles Konto bleibt als Notfallzugang erhalten."
          : "Passwort- und Microsoft-Anmeldung sind jetzt beide möglich.",
    };
  } catch (error) {
    return { status: "error", message: messageFromError(error) };
  }
}
