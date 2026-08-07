import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@lingl-docs/auth";
import { listCustomers, listMachinesForCustomer } from "@lingl-docs/core";
import { AppShell } from "../app-shell";
import { createCustomerAction } from "../actions";
import { CustomerBrowser } from "./customer-browser";

export default async function CustomersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/dashboard");

  const customers = await listCustomers(organizationId);
  const rows = await Promise.all(
    customers.map(async (customer) => ({
      customer,
      machines: await listMachinesForCustomer(customer.id),
    })),
  );
  const machineCount = rows.reduce((total, row) => total + row.machines.length, 0);

  return (
    <AppShell
      title="Kunden"
      description={`${rows.length} ${rows.length === 1 ? "Kunde" : "Kunden"} · ${machineCount} ${machineCount === 1 ? "Maschinenakte" : "Maschinenakten"}`}
    >
      <section className="space-y-4">
        <CustomerBrowser
          createAction={createCustomerAction}
          rows={rows.map(({ customer, machines }) => ({
            customer: {
              id: customer.id,
              name: customer.name,
              customerNumber: customer.customerNumber,
            },
            machines: machines.map((machine) => ({
              id: machine.id,
              name: machine.name,
              serialNumber: machine.serialNumber,
            })),
          }))}
        />
      </section>
    </AppShell>
  );
}
