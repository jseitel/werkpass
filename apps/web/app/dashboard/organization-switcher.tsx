"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronsUpDown, Plus, Star } from "lucide-react";
import {
  setDefaultOrganizationAction,
  switchOrganizationAction,
} from "./organization-actions";

export type OrganizationSwitcherItem = {
  id: string;
  name: string;
  slug: string;
};

export function OrganizationSwitcher({
  organizations,
  activeOrganizationId,
  initialDefaultOrganizationId,
}: {
  organizations: OrganizationSwitcherItem[];
  activeOrganizationId: string | null;
  initialDefaultOrganizationId: string | null;
}) {
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [defaultOrganizationId, setDefaultOrganizationId] = useState(
    initialDefaultOrganizationId,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const activeOrganization = organizations.find(
    (organization) => organization.id === activeOrganizationId,
  );

  function switchOrganization(organizationId: string) {
    if (organizationId === activeOrganizationId) {
      detailsRef.current?.removeAttribute("open");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await switchOrganizationAction(organizationId);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      detailsRef.current?.removeAttribute("open");
      router.push("/dashboard");
      router.refresh();
    });
  }

  function makeDefault(organizationId: string) {
    if (organizationId === defaultOrganizationId) return;
    setError(null);
    startTransition(async () => {
      const result = await setDefaultOrganizationAction(organizationId);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setDefaultOrganizationId(organizationId);
      router.refresh();
    });
  }

  return (
    <details ref={detailsRef} className="group relative w-full">
      <summary className="flex h-11 cursor-pointer list-none items-center gap-3 rounded-lg border bg-muted/50 px-3 hover:bg-accent [&::-webkit-details-marker]:hidden">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background">
          <Building2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {activeOrganization?.name ?? "Organisation auswählen"}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </summary>

      <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[22rem] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xl">
        <div className="px-3 pb-2 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Organisationen
        </div>
        <div className="max-h-72 overflow-y-auto">
          {organizations.map((organization) => {
            const isActive = organization.id === activeOrganizationId;
            const isDefault = organization.id === defaultOrganizationId;
            return (
              <div
                key={organization.id}
                className="flex items-center gap-1 border-t px-2 py-2 first:border-t-0"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent disabled:opacity-60"
                  disabled={pending}
                  onClick={() => switchOrganization(organization.id)}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{organization.name}</span>
                    {isActive && (
                      <span className="block text-xs text-muted-foreground">Aktiv</span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-accent disabled:opacity-60"
                  disabled={pending || isDefault}
                  onClick={() => makeDefault(organization.id)}
                  aria-label={
                    isDefault
                      ? `${organization.name} ist die Standardorganisation`
                      : `${organization.name} als Standardorganisation festlegen`
                  }
                  title={isDefault ? "Standardorganisation" : "Als Standard festlegen"}
                >
                  <Star
                    className={isDefault ? "h-4 w-4 fill-amber-400 text-amber-500" : "h-4 w-4 text-muted-foreground"}
                    aria-hidden="true"
                  />
                </button>
              </div>
            );
          })}
        </div>
        <Link
          href="/dashboard/organizations/new"
          className="flex items-center gap-3 border-t px-4 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => detailsRef.current?.removeAttribute("open")}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border bg-background">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </span>
          Organisation hinzufügen
        </Link>
        {error && <p className="border-t px-4 py-2 text-xs text-destructive">{error}</p>}
      </div>
    </details>
  );
}
