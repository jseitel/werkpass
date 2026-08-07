"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Home", matches: ["/dashboard"] },
  {
    href: "/dashboard/customers",
    label: "Kunden",
    matches: ["/dashboard/customers", "/dashboard/machines"],
  },
  { href: "/dashboard/users", label: "Nutzer", matches: ["/dashboard/users"] },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Hauptnavigation">
      {navItems.map((item) => {
        const active = item.matches.some((match) =>
          match === "/dashboard"
            ? pathname === match
            : pathname === match || pathname.startsWith(`${match}/`),
        );

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
                : "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
