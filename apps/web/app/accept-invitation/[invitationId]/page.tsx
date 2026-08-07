import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@lingl-docs/auth";
import { getOrganizationInvitationById } from "@lingl-docs/core";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lingl-docs/ui";
import { ThemeToggle } from "../../theme-toggle";
import { acceptInvitationAction } from "./actions";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "hinterlegte E-Mail";
  return `${local.slice(0, 2)}***@${domain}`;
}

export default async function AcceptInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ invitationId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { invitationId } = await params;
  const { error } = await searchParams;
  const invitation = await getOrganizationInvitationById(invitationId);
  const session = await auth.api.getSession({ headers: await headers() });
  const invitePath = `/accept-invitation/${invitationId}`;

  const unavailable =
    !invitation ||
    invitation.status !== "pending" ||
    invitation.expiresAt <= new Date();
  const emailMatches =
    invitation &&
    session &&
    invitation.email.toLowerCase() === session.user.email.toLowerCase();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Organisationseinladung</CardTitle>
              <CardDescription className="mt-2">
                {invitation
                  ? `Einladung zu ${invitation.organization.name}`
                  : "Einladung nicht gefunden"}
              </CardDescription>
            </div>
            {invitation?.role && <Badge variant="secondary">{invitation.role}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {unavailable ? (
            <p className="text-sm text-muted-foreground">
              Dieser Einladungslink ist ungültig, abgelaufen oder wurde bereits verwendet.
            </p>
          ) : !session ? (
            <>
              <p className="text-sm text-muted-foreground">
                Melde dich mit {maskEmail(invitation.email)} an oder erstelle dafür ein Konto.
              </p>
              <div className="flex gap-2">
                <Link
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                  href={`/sign-in?redirect=${encodeURIComponent(invitePath)}&email=${encodeURIComponent(invitation.email)}`}
                >
                  Anmelden
                </Link>
                <Link
                  className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium"
                  href={`/sign-up?redirect=${encodeURIComponent(invitePath)}&email=${encodeURIComponent(invitation.email)}`}
                >
                  Konto erstellen
                </Link>
              </div>
            </>
          ) : !emailMatches ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                Diese Einladung ist für eine andere E-Mail-Adresse bestimmt.
              </p>
              <p className="text-sm text-muted-foreground">
                Angemeldet als {session.user.email}, erwartet wird {maskEmail(invitation.email)}.
              </p>
            </div>
          ) : (
            <form action={acceptInvitationAction}>
              <input type="hidden" name="invitationId" value={invitationId} />
              <Button type="submit">Einladung annehmen</Button>
            </form>
          )}
          {error && (
            <p className="text-sm text-destructive">
              Die Einladung konnte nicht angenommen werden. Bitte prüfe den Link und deinen Account.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
