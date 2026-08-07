import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@werkpass/auth";
import { getOrganizationMember, listOrganizationApiKeys } from "@werkpass/core";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@werkpass/ui";
import { AppShell } from "../app-shell";
import { ProfileForm } from "./profile-form";
import { ApiKeyManager } from "./api-key-manager";

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const organizationId = session.session.activeOrganizationId;
  const [member, apiKeys] = organizationId
    ? await Promise.all([
        getOrganizationMember(organizationId, session.user.id),
        listOrganizationApiKeys(organizationId),
      ])
    : [null, []];
  const roles = member?.role.split(",").map((role) => role.trim()) ?? [];
  const canManageApiKeys = roles.includes("owner") || roles.includes("admin");

  return (
    <AppShell
      title="Mein Profil"
      description="Accountdaten und Zugangssicherheit verwalten."
      eyebrow="Account"
    >
      <Card className="w-full max-w-6xl">
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Account</CardTitle>
              <CardDescription>Profil und Passwort</CardDescription>
            </div>
            <Badge variant={session.user.emailVerified ? "default" : "secondary"}>
              {session.user.emailVerified ? "E-Mail bestätigt" : "E-Mail unbestätigt"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <ProfileForm
            initialName={session.user.name}
            email={session.user.email}
            initialImage={session.user.image}
          />
        </CardContent>
      </Card>
      <ApiKeyManager
        hasOrganization={Boolean(organizationId)}
        canManage={canManageApiKeys}
        apiKeys={apiKeys.map((apiKey) => ({
          ...apiKey,
          createdAt: apiKey.createdAt.toISOString(),
          lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
          expiresAt: apiKey.expiresAt?.toISOString() ?? null,
          revokedAt: apiKey.revokedAt?.toISOString() ?? null,
        }))}
      />
    </AppShell>
  );
}
