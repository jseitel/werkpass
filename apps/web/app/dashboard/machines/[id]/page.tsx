import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@werkpass/auth";
import { getMachineById, listMachineFolders } from "@werkpass/core";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@werkpass/ui";
import { createMachineFolderAction } from "../../actions";
import { AppShell } from "../../app-shell";
import { CreateFolderDialog } from "./create-folder-dialog";

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const machine = await getMachineById(id);
  if (!machine || machine.organizationId !== session.session.activeOrganizationId) {
    notFound();
  }

  const folders = await listMachineFolders(machine.id);
  const createFolderForMachine = createMachineFolderAction.bind(null, machine.id);
  const documentCount = folders.reduce(
    (total, folder) => total + folder.documents.length,
    0,
  );

  return (
    <AppShell
      title={machine.name}
      description={`Seriennummer ${machine.serialNumber}`}
      eyebrow="Maschinenakte"
    >
      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-8">
          <div>
            <div className="text-2xl font-semibold">{folders.length}</div>
            <div className="text-xs text-muted-foreground">Ordner</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">{documentCount}</div>
            <div className="text-xs text-muted-foreground">Dokumente</div>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-md border bg-white p-1.5">
            <img
              src={`/api/machines/${machine.id}/qr`}
              alt={`QR-Code für ${machine.name}`}
              className="h-14 w-14"
            />
          </div>
          <div>
            <div className="max-w-72 truncate text-sm font-medium">/m/{machine.slug}</div>
            <div className="mt-1 flex gap-3 text-sm">
              <a className="underline" href={`/m/${machine.slug}`}>Viewer</a>
              <a
                className="underline"
                href={`/api/machines/${machine.id}/qr`}
                download={`${machine.slug}-qr.png`}
              >
                QR herunterladen
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-5 flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold">Ordner</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ordner öffnen, um Dokumente und Revisionen zu bearbeiten.
            </p>
          </div>
          <CreateFolderDialog action={createFolderForMachine} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {folders.map((folder) => (
            <Link
              key={folder.id}
              href={`/dashboard/machines/${machine.id}/folders/${folder.id}`}
            >
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{folder.name}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {folder.documents.length === 1
                          ? "1 Dokument"
                          : `${folder.documents.length} Dokumente`}
                      </p>
                    </div>
                    <Badge variant={folder.accessLevel === "pin" ? "secondary" : "outline"}>
                      {folder.accessLevel === "pin"
                        ? folder.pinHash
                          ? "PIN gesetzt"
                          : "PIN fehlt"
                        : "Offen"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 text-sm text-muted-foreground">
                  Ordner öffnen
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
