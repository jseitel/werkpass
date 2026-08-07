"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "@lingl-docs/auth/client";
import { ThemeToggle } from "../theme-toggle";
import { avatarPresetStyle, userInitials } from "./avatar-presets";

export function AccountMenu() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const user = session?.user;
  const presetStyle = avatarPresetStyle(user?.image);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(false);
    const { error } = await signOut();
    if (error) {
      setSigningOut(false);
      setSignOutError(true);
      return;
    }
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <details className="group relative">
      <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-30 w-full overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Mein Konto</div>
            <div className="truncate text-xs text-muted-foreground">
              {user?.email ?? "Session wird geladen"}
            </div>
          </div>
          <ThemeToggle />
        </div>
        <nav className="flex flex-col p-1.5 text-sm">
          <Link className="rounded-md px-2.5 py-2 hover:bg-accent" href="/dashboard/profile">
            Mein Profil
          </Link>
          <Link className="rounded-md px-2.5 py-2 hover:bg-accent" href="/dashboard/customers">
            Kunden
          </Link>
          <Link className="rounded-md px-2.5 py-2 hover:bg-accent" href="/dashboard/users">
            Nutzerverwaltung
          </Link>
        </nav>
        <div className="border-t p-1.5">
          <button
            type="button"
            className="w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Wird abgemeldet..." : "Abmelden"}
          </button>
          {signOutError && (
            <p className="px-2.5 pb-2 text-xs text-destructive">
              Abmelden fehlgeschlagen.
            </p>
          )}
        </div>
      </div>

      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md p-2 hover:bg-accent">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold">
          {user?.image && !user.image.startsWith("avatar:") ? (
            <img src={user.image} alt="" className="h-full w-full object-cover" />
          ) : presetStyle ? (
            <span
              className="flex h-full w-full items-center justify-center"
              style={presetStyle}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-muted">
              {userInitials(user?.name)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {isPending ? "Account" : user?.name ?? "Account"}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {user?.email ?? ""}
          </div>
        </div>
        <span className="text-xs text-muted-foreground group-open:hidden" aria-hidden="true">
          ^
        </span>
        <span className="hidden text-xs text-muted-foreground group-open:inline" aria-hidden="true">
          v
        </span>
      </summary>
    </details>
  );
}
