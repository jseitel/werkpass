import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@werkpass/auth";
import { getOrganizationMember } from "@werkpass/core";
import { prisma } from "@werkpass/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@werkpass/ui";
import { AppShell } from "../../app-shell";
import { EntraSsoForm, type EntraProviderView } from "./entra-sso-form";

function appBaseUrl(requestHeaders: Headers): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

export default async function OrganizationSsoPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) redirect("/sign-in");
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/dashboard");

  const member = await getOrganizationMember(organizationId, session.user.id);
  const roles = member?.role.split(",").map((role) => role.trim()) ?? [];
  const canManage = roles.some((role) => role === "owner" || role === "admin");
  const organizationSettings = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ssoMode: true, ssoBreakGlassUserId: true },
  });

  let provider: EntraProviderView | null = null;
  if (canManage) {
    const listed = await auth.api.listSSOProviders({ headers: requestHeaders });
    const existing = listed.providers.find(
      (item) =>
        item.organizationId === organizationId &&
        item.type === "oidc" &&
        item.issuer.startsWith("https://login.microsoftonline.com/"),
    );
    if (existing) {
      provider = {
        providerId: existing.providerId,
        issuer: existing.issuer,
        domain: existing.domain,
        domainVerified: existing.domainVerified,
        clientIdLastFour: existing.oidcConfig?.clientIdLastFour,
      };
    }
  }

  const providerId = provider?.providerId ?? `entra-${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
  const callbackUrl = `${appBaseUrl(requestHeaders)}/api/auth/sso/callback/${providerId}`;

  return (
    <AppShell
      title="Single Sign-on"
      description="Microsoft-Anmeldung für die aktive Organisation verwalten."
      eyebrow="Organisation"
    >
      <Card className="w-full max-w-5xl">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-3 text-xl">
            <ShieldCheck className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            Organisations-SSO
          </CardTitle>
          <CardDescription>
            Einmal durch einen Admin eingerichtet, anschließend für alle berechtigten
            Mitarbeiter dieser Organisation verfügbar.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {canManage ? (
            <EntraSsoForm
              initialProvider={provider}
              callbackUrl={callbackUrl}
              initialSsoMode={organizationSettings?.ssoMode === "required" ? "required" : "optional"}
              isBreakGlassUser={organizationSettings?.ssoBreakGlassUserId === session.user.id}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nur Owner und Admins können die SSO-Verbindung verwalten.
            </p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
