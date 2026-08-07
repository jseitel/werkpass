import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@lingl-docs/auth";
import {
  getCurrentVersion,
  getMachineById,
  getMachineFolderById,
  getPinChangedByName,
  listDocumentsForFolder,
  listDocumentVersions,
} from "@lingl-docs/core";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@lingl-docs/ui";
import { createDocumentAction } from "../../../../actions";
import { AppShell } from "../../../../app-shell";
import { UploadVersionForm } from "../../upload-version-form";
import { FolderPinForm } from "./folder-pin-form";

function accessLabel(accessLevel: string): string {
  return accessLevel === "pin" ? "PIN-geschützt" : "Öffentlich";
}

export default async function MachineFolderPage({
  params,
}: {
  params: Promise<{ id: string; folderId: string }>;
}) {
  const { id, folderId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const [machine, folder] = await Promise.all([
    getMachineById(id),
    getMachineFolderById(folderId),
  ]);
  if (
    !machine ||
    machine.organizationId !== session.session.activeOrganizationId ||
    !folder ||
    folder.machineId !== machine.id
  ) {
    notFound();
  }

  const documents = await listDocumentsForFolder(folder.id);
  const pinChangedByName = await getPinChangedByName(folder.pinChangedById);
  const currentVersions = await Promise.all(
    documents.map((document) => getCurrentVersion(document.id)),
  );
  const versionsByDocument = await Promise.all(
    documents.map((document) => listDocumentVersions(document.id)),
  );
  const createDocumentForMachine = createDocumentAction.bind(null, machine.id);

  return (
    <AppShell
      title={folder.name}
      description={`${machine.name} - Seriennummer ${machine.serialNumber}`}
      eyebrow="Maschinenakte / Ordner"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/dashboard/machines/${machine.id}`}
          className="text-sm text-muted-foreground underline"
        >
          Zurück zu {machine.name}
        </Link>
        <Badge variant={folder.accessLevel === "pin" ? "secondary" : "outline"}>
          {accessLabel(folder.accessLevel)}
        </Badge>
      </div>

      {folder.accessLevel === "pin" && (
        <FolderPinForm
          machineId={machine.id}
          folderId={folder.id}
          hasPin={Boolean(folder.pinHash)}
          changedAt={folder.pinChangedAt?.toISOString() ?? null}
          changedByName={pinChangedByName}
        />
      )}

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-5 border-b pb-4">
          <h2 className="font-medium">Dokument anlegen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Das Dokument wird direkt in diesem Ordner angelegt.
          </p>
        </div>
        <form
          action={createDocumentForMachine}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_auto] xl:items-end"
        >
          <input type="hidden" name="folderId" value={folder.id} />
          <div className="grid gap-2">
            <Label htmlFor="title">Titel</Label>
            <Input id="title" name="title" placeholder="Betriebsanleitung" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="language">Sprache</Label>
            <Input id="language" name="language" placeholder="de-DE" required />
          </div>
          <div className="text-sm text-muted-foreground">
            {folder.accessLevel === "pin" && !folder.pinHash
              ? "PIN muss zuerst gesetzt werden"
              : accessLabel(folder.accessLevel)}
          </div>
          <Button type="submit" disabled={folder.accessLevel === "pin" && !folder.pinHash}>
            Dokument anlegen
          </Button>
        </form>
      </section>

      <Card>
        <CardHeader className="p-4">
          <CardTitle>Dokumente</CardTitle>
          <CardDescription>
            Uploads erzeugen automatisch die nächste Revision.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="overflow-x-auto rounded-md border">
            <div className="grid min-w-[50rem] grid-cols-[1.3fr_10rem_9rem_12rem] border-b bg-muted/60 px-4 py-2 text-xs font-medium uppercase text-muted-foreground">
              <span>Dokument</span>
              <span>Zugriff</span>
              <span>Revision</span>
              <span>Upload</span>
            </div>
            <div className="divide-y">
              {documents.map((document, index) => {
                const currentVersion = currentVersions[index];
                const versions = versionsByDocument[index];
                return (
                  <div
                    key={document.id}
                    className="grid min-w-[50rem] grid-cols-[1.3fr_10rem_9rem_12rem] gap-4 px-4 py-3"
                  >
                    <div>
                      <div className="font-medium">{document.title}</div>
                      <div className="text-sm text-muted-foreground">{document.language}</div>
                      {currentVersion?.changeNote && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {currentVersion.changeNote}
                        </p>
                      )}
                      {versions.length > 0 && (
                        <details className="mt-2 text-sm">
                          <summary className="cursor-pointer underline">
                            Revisionshistorie ({versions.length})
                          </summary>
                          <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
                            {versions.map((version) => (
                              <li key={version.id}>
                                {version.revision} - {version.publishedAt?.toLocaleDateString("de-DE") ?? version.createdAt.toLocaleDateString("de-DE")} {version.isCurrent ? "(aktuell)" : ""}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                    <div>
                      <Badge variant={document.accessLevel === "pin" ? "secondary" : "outline"}>
                        {accessLabel(document.accessLevel)}
                      </Badge>
                    </div>
                    <div className="text-sm">
                      {currentVersion ? currentVersion.revision : "Leer"}
                    </div>
                    <UploadVersionForm documentId={document.id} />
                  </div>
                );
              })}
              {documents.length === 0 && (
                <div className="px-4 py-10 text-sm text-muted-foreground">
                  Noch keine Dokumente in diesem Ordner.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
