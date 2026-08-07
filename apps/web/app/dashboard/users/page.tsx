import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@lingl-docs/auth";
import {
  getOrganizationMember,
  listOrganizationInvitations,
  listOrganizationMembers,
} from "@lingl-docs/core";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lingl-docs/ui";
import { AppShell } from "../app-shell";
import {
  cancelInvitationAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "../actions";
import { InviteMemberForm } from "./invite-member-form";
import { InviteLink } from "./invite-link";

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
  member: "Member",
};

function roleList(role: string | null | undefined): string[] {
  return (role ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function canManageOrganizationUsers(role: string | null | undefined): boolean {
  return roleList(role).some((part) => part === "owner" || part === "admin");
}

function formatRole(role: string | null | undefined): string {
  const roles = roleList(role);
  if (roles.length === 0) return "Unbekannt";
  return roles.map((part) => roleLabels[part] ?? part).join(", ");
}

export default async function UsersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/dashboard");

  const [currentMember, members, invitations] = await Promise.all([
    getOrganizationMember(organizationId, session.user.id),
    listOrganizationMembers(organizationId),
    listOrganizationInvitations(organizationId),
  ]);
  const canManageUsers = canManageOrganizationUsers(currentMember?.role);

  return (
    <AppShell
      title="Nutzer"
      description="Personen, die diese Organisation verwalten oder Dokumentation pflegen."
      eyebrow="Organisation"
    >
      <section className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>Mitglieder</CardTitle>
            <CardDescription>
              Admins verwalten Nutzer, Editor laden Dokus hoch, Viewer lesen nur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-md border">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="grid gap-3 p-4 lg:grid-cols-[1fr_11rem_16rem]"
                >
                  <div>
                    <div className="font-medium">{member.user.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {member.user.email}
                    </div>
                  </div>
                  <div>
                    <Badge
                      variant={
                        canManageOrganizationUsers(member.role)
                          ? "default"
                          : "secondary"
                      }
                    >
                      {formatRole(member.role)}
                    </Badge>
                  </div>
                  {canManageUsers && member.userId !== session.user.id ? (
                    <div className="flex flex-wrap gap-2">
                      <form action={updateMemberRoleAction} className="flex gap-2">
                        <input type="hidden" name="memberId" value={member.id} />
                        <select
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                          name="role"
                          defaultValue={
                            roleList(member.role).find((role) =>
                              ["admin", "editor", "viewer"].includes(role),
                            ) ?? "viewer"
                          }
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <Button type="submit" size="sm" variant="outline">
                          Speichern
                        </Button>
                      </form>
                      <form action={removeMemberAction}>
                        <input type="hidden" name="memberId" value={member.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Entfernen
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {member.userId === session.user.id ? "Du" : "Keine Aktion"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Einladen</CardTitle>
              <CardDescription>
                Erstellt einen teilbaren Link. Es wird keine E-Mail versendet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canManageUsers ? (
                <InviteMemberForm />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nur Admins können Einladungen erstellen.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Offene Einladungen</CardTitle>
              <CardDescription>
                Pending-Einladungen laufen nach 7 Tagen ab.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="rounded-md border p-3">
                  <div className="font-medium">{invitation.email}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatRole(invitation.role ?? "viewer")} -
                    bis {invitation.expiresAt.toLocaleDateString("de-DE")}
                  </div>
                  <div className="mt-2">
                    <InviteLink path={`/accept-invitation/${invitation.id}`} />
                  </div>
                  {canManageUsers && (
                    <form action={cancelInvitationAction} className="mt-2">
                      <input
                        type="hidden"
                        name="invitationId"
                        value={invitation.id}
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Stornieren
                      </Button>
                    </form>
                  )}
                </div>
              ))}
              {invitations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Keine offenen Einladungen.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
