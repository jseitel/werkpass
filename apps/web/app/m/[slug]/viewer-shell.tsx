import { ThemeToggle } from "../../theme-toggle";

/**
 * Chrome for the public machine viewer. Deliberately not the dashboard's
 * AppShell: a visitor here has no account, no organization and nowhere to
 * navigate, so the sidebar, org switcher and account menu would be dead
 * weight. Same design tokens and components, a layout built for a phone held
 * in one hand at the machine.
 */
export function ViewerShell({
  machineName,
  children,
}: {
  machineName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              W
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">werkpass</div>
              <div className="truncate text-xs leading-tight text-muted-foreground">
                {machineName}
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 sm:py-8">
        {children}
      </main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-3xl px-4 py-5 text-xs text-muted-foreground">
          Digitale Maschinenakte &middot; bereitgestellt mit werkpass
        </div>
      </footer>
    </div>
  );
}
