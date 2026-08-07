import { Badge, Separator } from "@werkpass/ui";
import { ThemeToggle } from "../theme-toggle";
import { AccountMenu } from "./account-menu";
import { DashboardNav } from "./dashboard-nav";
import { DashboardOrganizationSwitcher } from "./dashboard-organization-switcher";

interface AppShellProps {
  title: string;
  description?: string;
  eyebrow?: string;
  children: React.ReactNode;
}

export function AppShell({ title, description, eyebrow, children }: AppShellProps) {
  return (
    <div className="grid min-h-screen w-full bg-muted/30 lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r bg-card lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-3">
            <DashboardOrganizationSwitcher />
          </div>
          <DashboardNav />
          <div className="space-y-3 border-t p-3">
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">MVO Status</span>
                <Badge variant="secondary">Pilot</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                QR-Code, Versionierung, Download und PIN-Ebenen.
              </p>
            </div>
            <AccountMenu />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              LD
            </div>
            <span className="font-semibold">werkpass</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          <div className="flex w-full flex-col gap-5">
            <div className="flex flex-col gap-2">
              {eyebrow && (
                <div className="text-sm font-medium text-muted-foreground">
                  {eyebrow}
                </div>
              )}
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <h1 className="text-2xl font-semibold tracking-normal">
                    {title}
                  </h1>
                  {description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Separator />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
