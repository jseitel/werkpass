import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MoreHorizontal, Users } from "lucide-react";
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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
      <section className="space-y-6">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-3 text-xl">
              <Users className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              Nutzer
            </CardTitle>
            <CardDescription>
              Verwalte die Nutzer und Berechtigungen deiner Organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto xl:overflow-visible">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-6 py-4 font-medium">E-Mail</th>
                    <th className="px-4 py-4 font-medium">Rolle</th>
                    <th className="px-4 py-4 font-medium">Status</th>
                    <th className="px-4 py-4 font-medium">Verifiziert</th>
                    <th className="px-4 py-4 font-medium">Erstellt am</th>
                    <th className="px-6 py-4 text-right font-medium">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const isCurrentUser = member.userId === session.user.id;

                    return (
                      <tr key={member.id} className="border-b last:border-0">
                        <td className="px-6 py-5">
                          <div className="font-medium">
                            {member.user.email}
                            {isCurrentUser && (
                              <span className="ml-1 font-normal text-muted-foreground">
                                (Du)
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {member.user.name}
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <Badge variant="secondary">{formatRole(member.role)}</Badge>
                        </td>
                        <td className="px-4 py-5">
                          <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" variant="outline">
                            Aktiv
                          </Badge>
                        </td>
                        <td className="px-4 py-5">
                          {member.user.emailVerified ? "Ja" : "Nein"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-5 text-muted-foreground">
                          {formatDate(member.createdAt)}
                        </td>
                        <td className="px-6 py-5 text-right">
                          {canManageUsers && !isCurrentUser ? (
                            <details
                              name="user-actions"
                              className="group relative inline-block text-left"
                            >
                              <summary
                                className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
                                aria-label={`Aktionen für ${member.user.email}`}
                              >
                                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                              </summary>
                              <div className="absolute bottom-full right-0 z-30 mb-2 w-72 rounded-md border bg-card p-3 text-card-foreground shadow-xl">
                                <div className="space-y-3">
                                  <form action={updateMemberRoleAction} className="space-y-2">
                                    <input type="hidden" name="memberId" value={member.id} />
                                    <label className="block text-xs font-medium" htmlFor={`role-${member.id}`}>
                                      Rolle ändern
                                    </label>
                                    <div className="flex gap-2">
                                      <select
                                        id={`role-${member.id}`}
                                        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
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
                                    </div>
                                  </form>
                                  <form action={removeMemberAction} className="border-t pt-3">
                                    <input type="hidden" name="memberId" value={member.id} />
                                    <Button type="submit" size="sm" variant="outline" className="w-full">
                                      Nutzer entfernen
                                    </Button>
                                  </form>
                                </div>
                              </div>
                            </details>
                          ) : (
                            <span
                              className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground/60"
                              aria-label="Keine Aktionen verfügbar"
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
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
