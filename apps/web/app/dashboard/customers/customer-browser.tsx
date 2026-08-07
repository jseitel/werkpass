"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Factory, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@lingl-docs/ui";

interface CustomerBrowserRow {
  customer: {
    id: string;
    name: string;
    customerNumber: string | null;
  };
  machines: Array<{
    id: string;
    name: string;
    serialNumber: string;
  }>;
}

function includesQuery(value: string | null, query: string) {
  return value?.toLocaleLowerCase("de-DE").includes(query) ?? false;
}

export function CustomerBrowser({ rows }: { rows: CustomerBrowserRow[] }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("de-DE");

  const results = useMemo(
    () =>
      rows.flatMap((row) => {
        if (!query) return [{ ...row, matchingMachines: [] }];

        const customerMatches =
          includesQuery(row.customer.name, query) ||
          includesQuery(row.customer.customerNumber, query);
        const matchingMachines = row.machines.filter(
          (machine) =>
            includesQuery(machine.name, query) ||
            includesQuery(machine.serialNumber, query),
        );

        return customerMatches || matchingMachines.length > 0
          ? [{ ...row, matchingMachines }]
          : [];
      }),
    [query, rows],
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-2xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
          placeholder="Kunden, Maschinen oder Seriennummern suchen..."
          aria-label="Kunden und Maschinen durchsuchen"
        />
      </div>

      {query && (
        <div className="text-sm text-muted-foreground">
          {results.length === 1 ? "1 Kunde gefunden" : `${results.length} Kunden gefunden`}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {results.map(({ customer, machines, matchingMachines }) => (
          <Card key={customer.id} className="h-full min-h-36">
            <CardHeader>
              <Link
                href={`/dashboard/customers/${customer.id}`}
                className="group flex items-start justify-between gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex min-w-0 gap-3">
                  <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <CardTitle className="truncate group-hover:underline">
                      {customer.name}
                    </CardTitle>
                    <CardDescription>
                      {customer.customerNumber
                        ? `Kundennummer ${customer.customerNumber}`
                        : "Ohne Kundennummer"}
                    </CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Factory className="h-4 w-4" aria-hidden="true" />
                <span>
                  {machines.length === 1
                    ? "1 Maschinenakte"
                    : `${machines.length} Maschinenakten`}
                </span>
              </div>

              {matchingMachines.length > 0 && (
                <div className="mt-4 divide-y border-t">
                  {matchingMachines.map((machine) => (
                    <Link
                      key={machine.id}
                      href={`/dashboard/machines/${machine.id}`}
                      className="flex items-center justify-between gap-3 py-3 text-sm hover:text-foreground"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{machine.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          Seriennummer {machine.serialNumber}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {rows.length === 0 && (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Noch keine Kunden angelegt.
          </div>
        )}
        {rows.length > 0 && results.length === 0 && (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Keine passenden Kunden oder Maschinen gefunden.
          </div>
        )}
      </div>
    </div>
  );
}
