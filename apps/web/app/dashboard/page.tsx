import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@lingl-docs/auth";
import {
  listCustomers,
  listMachinesForCustomer,
  listDocumentsForOrganization,
  listDocumentVersionsForOrganization,
} from "@lingl-docs/core";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lingl-docs/ui";
import { CreateOrganizationForm } from "./create-organization-form";
import { AppShell } from "./app-shell";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const organizationId = session.session.activeOrganizationId;

  if (!organizationId) {
    return (
      <AppShell
        title="Organisation einrichten"
        description="Lege den Hersteller-Mandanten an, bevor Kunden und Maschinen verwaltet werden."
      >
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Erste Organisation</CardTitle>
            <CardDescription>
              Die Organisation ist eure Firma, die Maschinen und Dokumente
              bereitstellt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateOrganizationForm />
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const [customers, documents, versions] = await Promise.all([
    listCustomers(organizationId),
    listDocumentsForOrganization(organizationId),
    listDocumentVersionsForOrganization(organizationId),
  ]);
  const machinesByCustomer = await Promise.all(
    customers.map(async (customer) => ({
      customer,
      machines: await listMachinesForCustomer(customer.id),
    })),
  );
  const machineCount = machinesByCustomer.reduce(
    (sum, entry) => sum + entry.machines.length,
    0,
  );
  const currentVersions = versions.filter((version) => version.isCurrent);
  const recentVersions = versions.slice(0, 5);

  return (
    <AppShell
      title="Dashboard"
      description="Überblick über Kunden, Maschinenakten und laufende Dokumentationsarbeit."
      eyebrow="Übersicht"
    >
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Kunden</CardDescription>
            <CardTitle className="text-3xl">{customers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Maschinenakten</CardDescription>
            <CardTitle className="text-3xl">{machineCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Dokumenttypen</CardDescription>
            <CardTitle className="text-3xl">{documents.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aktuelle Revisionen</CardDescription>
            <CardTitle className="text-3xl">{currentVersions.length}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>Letzte Revisionen</CardTitle>
            <CardDescription>
              Neueste Uploads über alle Maschinenakten hinweg.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-md border">
              {recentVersions.map((version) => (
                <a
                  key={version.id}
                  className="grid gap-2 p-4 text-sm hover:bg-muted/50 md:grid-cols-[10rem_1fr_9rem]"
                  href={`/dashboard/machines/${version.document.machineId}`}
                >
                  <span className="font-medium">{version.revision}</span>
                  <span>
                    {version.document.title}
                    <span className="ml-2 text-muted-foreground">
                      {version.document.machine.name}
                    </span>
                  </span>
                  <Badge variant={version.isCurrent ? "default" : "secondary"}>
                    {version.isCurrent ? "Aktuell" : "Archiv"}
                  </Badge>
                </a>
              ))}
              {recentVersions.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">
                  Noch keine Revisionen hochgeladen.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schnellzugriff</CardTitle>
            <CardDescription>
              Die Hauptnavigation trennt Stammdaten und Arbeit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              className="block rounded-md border p-3 text-sm hover:bg-muted/50"
              href="/dashboard/customers"
            >
              <span className="font-medium">Kunden</span>
              <span className="mt-1 block text-muted-foreground">
                Kunden anlegen und Maschinenlisten öffnen.
              </span>
            </a>
            <a
              className="block rounded-md border p-3 text-sm hover:bg-muted/50"
              href="/dashboard/customers"
            >
              <span className="font-medium">Maschinenakten</span>
              <span className="mt-1 block text-muted-foreground">
                Dokumente, Revisionen, PIN und QR je Maschine.
              </span>
            </a>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
