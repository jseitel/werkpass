"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Factory, Search } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@werkpass/ui";

interface MachineSummary {
  id: string;
  name: string;
  serialNumber: string;
}

export function MachineBrowser({ machines }: { machines: MachineSummary[] }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("de-DE");
  const results = useMemo(
    () =>
      query
        ? machines.filter(
            (machine) =>
              machine.name.toLocaleLowerCase("de-DE").includes(query) ||
              machine.serialNumber.toLocaleLowerCase("de-DE").includes(query),
          )
        : machines,
    [machines, query],
  );

  return (
    <div className="space-y-4">
      {machines.length > 0 && (
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
            placeholder="Maschinenname oder Seriennummer suchen..."
            aria-label="Maschinen durchsuchen"
          />
        </div>
      )}

      {query && (
        <div className="text-sm text-muted-foreground">
          {results.length === 1
            ? "1 Maschine gefunden"
            : `${results.length} Maschinen gefunden`}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {results.map((machine) => (
          <Link
            key={machine.id}
            href={`/dashboard/machines/${machine.id}`}
            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="h-full min-h-28 transition-colors hover:bg-muted/50">
              <CardHeader className="h-full justify-center">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <Factory className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                      <CardTitle className="truncate">{machine.name}</CardTitle>
                      <CardDescription>Seriennummer {machine.serialNumber}</CardDescription>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}

        {machines.length === 0 && (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Noch keine Maschinen für diesen Kunden.
          </div>
        )}
        {machines.length > 0 && results.length === 0 && (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Keine passende Maschine gefunden.
          </div>
        )}
      </div>
    </div>
  );
}
