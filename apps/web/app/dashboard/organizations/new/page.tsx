import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@werkpass/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@werkpass/ui";
import { AppShell } from "../../app-shell";
import { CreateOrganizationForm } from "../../create-organization-form";

export default async function NewOrganizationPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  return (
    <AppShell
      title="Organisation hinzufügen"
      description="Lege einen weiteren getrennten Arbeitsbereich an."
      eyebrow="Organisation"
    >
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Neue Organisation</CardTitle>
          <CardDescription>
            Die neue Organisation wird geöffnet und als Standard markiert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrganizationForm />
        </CardContent>
      </Card>
    </AppShell>
  );
}
