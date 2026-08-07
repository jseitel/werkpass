import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@werkpass/auth";
import {
  listCustomers,
  listMachinesForCustomer,
  listDocumentsForOrganization,
  listDocumentVersionsForOrganization,
  getDefaultOrganizationId,
  listUserOrganizations,
  setDefaultOrganization,
} from "@werkpass/core";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@werkpass/ui";
import { CreateOrganizationForm } from "./create-organization-form";
import { AppShell } from "./app-shell";

const revisionDateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function DashboardPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) redirect("/sign-in");

  let organizationId = session.session.activeOrganizationId;

  if (!organizationId) {
    const [memberships, defaultOrganizationId] = await Promise.all([
      listUserOrganizations(session.user.id),
      getDefaultOrganizationId(session.user.id),
    ]);
    const organizationIds = memberships.map(
      ({ organization }) => organization.id,
    );
    const validDefaultOrganizationId =
      defaultOrganizationId && organizationIds.includes(defaultOrganizationId)
        ? defaultOrganizationId
        : null;
    const fallbackOrganizationId =
      validDefaultOrganizationId ??
      (organizationIds.length === 1 ? organizationIds[0] : null);

    if (fallbackOrganizationId) {
      if (!validDefaultOrganizationId && organizationIds.length === 1) {
        await setDefaultOrganization({
          userId: session.user.id,
          organizationId: fallbackOrganizationId,
        });
      }
      await auth.api.setActiveOrganization({
        headers: requestHeaders,
        body: { organizationId: fallbackOrganizationId },
      });
      // Continue with the resolved organization. Redirecting back to this same
      // route can loop when a new SSO session still exposes a stale active
      // organization through a browser-side session cache.
      organizationId = fallbackOrganizationId;
    } else if (memberships.length > 0) {
      return (
        <AppShell
          title="Organisation auswählen"
          description="Wähle links eine Organisation aus und markiere deinen Standard mit dem Stern."
          eyebrow="Organisation"
        >
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Mehrere Organisationen</CardTitle>
              <CardDescription>
                Im Organisationsmenü kannst du den Arbeitsbereich wechseln. Der
                markierte Favorit wird bei der nächsten Anmeldung automatisch geöffnet.
              </CardDescription>
            </CardHeader>
          </Card>
        </AppShell>
      );
    } else {
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
  const statistics: Array<{
    label: string;
    value: number;
    href?: string;
  }> = [
    {
      label: "Kunden",
      value: customers.length,
      href: "/dashboard/customers",
    },
    {
      label: "Maschinenakten",
      value: machineCount,
      href: "/dashboard/customers",
    },
    {
      label: "Dokumenttypen",
      value: documents.length,
    },
    {
      label: "Aktuelle Revisionen",
      value: currentVersions.length,
    },
  ];

  return (
    <AppShell
      title="Dashboard"
      description="Überblick über Kunden, Maschinenakten und laufende Dokumentationsarbeit."
      eyebrow="Übersicht"
    >
      <section className="grid gap-4 md:grid-cols-4">
        {statistics.map((statistic) => {
          const card = (
            <Card
              className={
                statistic.href
                  ? "h-16 transition-colors hover:border-foreground/30 hover:bg-muted/50"
                  : "h-16"
              }
            >
              <CardHeader className="h-full flex-row items-center justify-between gap-3 p-4">
                <CardDescription>{statistic.label}</CardDescription>
                <CardTitle className="text-2xl">{statistic.value}</CardTitle>
              </CardHeader>
            </Card>
          );

          return statistic.href ? (
            <Link
              key={statistic.label}
              href={statistic.href}
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`${statistic.label}: ${statistic.value}`}
            >
              {card}
            </Link>
          ) : (
            <div key={statistic.label}>{card}</div>
          );
        })}
      </section>

      <section id="revisions" className="scroll-mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Letzte Revisionen</CardTitle>
            <CardDescription>
              Neueste Uploads über alle Maschinenakten hinweg.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead>
                  <tr className="border-y">
                    <th className="px-6 py-3 font-medium">Revision</th>
                    <th className="px-4 py-3 font-medium">Dokument</th>
                    <th className="px-4 py-3 font-medium">Maschine</th>
                    <th className="px-4 py-3 font-medium">Kunde</th>
                    <th className="px-4 py-3 font-medium">Hochgeladen am</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVersions.map((version) => (
                    <tr
                      key={version.id}
                      className="border-b last:border-b-0 hover:bg-muted/50"
                    >
                      <td className="whitespace-nowrap px-6 py-4 font-medium">
                        {version.revision}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          className="font-medium hover:underline"
                          href={`/dashboard/machines/${version.document.machineId}/folders/${version.document.folderId}`}
                        >
                          {version.document.title}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          className="text-muted-foreground hover:text-foreground hover:underline"
                          href={`/dashboard/machines/${version.document.machineId}`}
                        >
                          {version.document.machine.name}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          className="text-muted-foreground hover:text-foreground hover:underline"
                          href={`/dashboard/customers/${version.document.machine.customerId}`}
                        >
                          {version.document.machine.customer.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                        {revisionDateFormatter.format(version.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={version.isCurrent ? "default" : "secondary"}>
                          {version.isCurrent ? "Aktuell" : "Archiv"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {recentVersions.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-muted-foreground"
                      >
                        Noch keine Revisionen hochgeladen.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
