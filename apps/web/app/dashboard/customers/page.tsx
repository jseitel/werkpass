import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@lingl-docs/auth";
import { listCustomers, listMachinesForCustomer } from "@lingl-docs/core";
import {
  Button,
  Input,
  Label,
} from "@lingl-docs/ui";
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
        <div className="flex justify-end border-b pb-4">
          <form
            action={createCustomerAction}
            className="grid w-full gap-3 sm:grid-cols-[minmax(12rem,1fr)_12rem_auto] lg:w-auto"
          >
            <div className="grid gap-2">
              <Label className="sr-only" htmlFor="customer-name">
                Kundenname
              </Label>
              <Input id="customer-name" name="name" placeholder="Kundenname" required />
            </div>
            <div className="grid gap-2">
              <Label className="sr-only" htmlFor="customer-number">
                Kundennummer
              </Label>
              <Input id="customer-number" name="customerNumber" placeholder="Kundennummer" />
            </div>
            <Button type="submit">Kunde anlegen</Button>
          </form>
        </div>

        <CustomerBrowser
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
