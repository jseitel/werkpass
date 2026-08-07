import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@werkpass/auth";
import { getCustomerById, listMachinesForCustomer } from "@werkpass/core";
import { AppShell } from "../../app-shell";
import { createMachineAction } from "../../actions";
import { CreateMachineDialog } from "./create-machine-dialog";
import { MachineBrowser } from "./machine-browser";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/dashboard");

  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer || customer.organizationId !== organizationId) notFound();

  const machines = await listMachinesForCustomer(customer.id);

  return (
    <AppShell
      title={customer.name}
      description="Maschinen dieses Kunden. Jede Maschine enthält Dokumente, Revisionen, Zugriff und QR-Viewer."
      eyebrow="Kunde"
    >
      <section className="rounded-xl border bg-card p-6">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-xl font-semibold">Maschinen</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {customer.customerNumber
                ? `Kundennummer ${customer.customerNumber}`
                : "Keine Kundennummer hinterlegt"}
            </p>
          </div>
          <CreateMachineDialog
            customerId={customer.id}
            action={createMachineAction}
          />
        </div>

        <MachineBrowser
          machines={machines.map((machine) => ({
            id: machine.id,
            name: machine.name,
            serialNumber: machine.serialNumber,
            slug: machine.slug,
          }))}
        />
      </section>
    </AppShell>
  );
}
