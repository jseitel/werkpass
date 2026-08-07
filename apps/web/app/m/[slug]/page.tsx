import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  getMachineBySlug,
  listDocumentsForMachine,
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
} from "@lingl-docs/ui";
import { folderPinCookieName, isFolderUnlocked } from "./pin-access";

function accessLabel(accessLevel: string): string {
  if (accessLevel === "pin") return "PIN";
  if (accessLevel === "login") return "Service";
  return "Öffentlich";
}

// No auth, no account requirement on this route. Public documents are available
// directly from the QR code; confidential drawings can be unlocked with a PIN.
export default async function MachineViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pin?: string; folder?: string }>;
}) {
  const { slug } = await params;
  const { pin, folder: invalidFolderId } = await searchParams;
  const machine = await getMachineBySlug(slug);
  if (!machine) notFound();

  const cookieStore = await cookies();
  const documents = await listDocumentsForMachine(machine.id);
  const versionsByDocument = await Promise.all(
    documents.map((doc) => listDocumentVersions(doc.id)),
  );
  const dossier = documents.map((doc, i) => ({
    doc,
    versions: versionsByDocument[i].filter((version) => version.status === "published"),
    unlocked:
      doc.accessLevel === "pin" &&
      isFolderUnlocked(
        slug,
        doc.folder.id,
        doc.folder.pinHash,
        cookieStore.get(folderPinCookieName(doc.folder.id))?.value,
      ),
  }));
  const visibleDocuments = dossier.filter(
    ({ doc, unlocked }) => doc.accessLevel === "public" || unlocked,
  );
  const lockedFolders = Array.from(
    new Map(
      dossier
        .filter(({ doc, unlocked }) => doc.accessLevel === "pin" && !unlocked)
        .map(({ doc }) => [doc.folder.id, doc.folder]),
    ).values(),
  );
  const unlockedFolderCount = new Set(
    dossier.filter(({ unlocked }) => unlocked).map(({ doc }) => doc.folder.id),
  ).size;
  const visibleFolders = Array.from(
    new Map(
      visibleDocuments.map(({ doc }) => [
        doc.folder.id,
        { id: doc.folder.id, name: doc.folder.name },
      ]),
    ).values(),
  );

  return (
    <main className="min-h-screen bg-muted/30 p-4 lg:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <CardDescription>Digitale Maschinenakte</CardDescription>
                <CardTitle className="mt-2 text-2xl">{machine.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Seriennummer: {machine.serialNumber}
                </p>
              </div>
              <Badge variant={unlockedFolderCount > 0 ? "default" : "secondary"}>
                {unlockedFolderCount > 0
                  ? `${unlockedFolderCount} ${unlockedFolderCount === 1 ? "Ordner" : "Ordner"} freigeschaltet`
                  : "Öffentlicher Zugriff"}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">Dokumente</h2>
          <p className="text-sm text-muted-foreground">
            Aktuelle Revisionen stehen direkt bereit; ältere Revisionen sind im
            Archiv je Dokument abrufbar.
          </p>
        </div>
        <div className="grid gap-5">
          {visibleFolders.map((folder) => (
            <section key={folder.id}>
              <div className="mb-2 flex items-center justify-between border-b pb-2">
                <h3 className="font-medium">{folder.name}</h3>
                <Badge variant="outline">
                  {visibleDocuments.filter(({ doc }) => doc.folderId === folder.id).length}
                </Badge>
              </div>
              <div className="grid gap-3">
              {visibleDocuments
                .filter(({ doc }) => doc.folderId === folder.id)
                .map(({ doc, versions }) => {
                  const current = versions.find((version) => version.isCurrent);
                  if (!current) return null;
                  const archive = versions.filter((version) => !version.isCurrent);
                  return (
                    <Card key={doc.id}>
                <CardContent className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="font-medium">{doc.title}</div>
                    <div className="text-sm text-gray-500">
                      {doc.language} &middot;{" "}
                      {accessLabel(doc.accessLevel)}
                    </div>
                  </div>
                  <a
                    className="text-sm font-medium underline"
                    href={`/api/documents/${current.id}/download`}
                  >
                    Aktuelle Revision
                  </a>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  {current.revision}
                  {current.publishedAt
                    ? ` · veröffentlicht am ${current.publishedAt.toLocaleDateString("de-DE")}`
                    : ""}
                </div>
                {current.changeNote && (
                  <p className="text-sm text-gray-500">{current.changeNote}</p>
                )}
                {archive.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer underline">
                      Ältere Revisionen ({archive.length})
                    </summary>
                    <ul className="mt-2 flex flex-col gap-2">
                      {archive.map((version) => (
                        <li
                          key={version.id}
                          className="flex flex-wrap justify-between gap-2 text-gray-500"
                        >
                          <span>
                            {version.revision}
                            {version.publishedAt
                              ? ` · ${version.publishedAt.toLocaleDateString("de-DE")}`
                              : ""}
                          </span>
                          <a
                            className="underline"
                            href={`/api/documents/${version.id}/download`}
                          >
                            Download
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                </CardContent>
                  </Card>
                  );
                })}
              </div>
            </section>
          ))}
          {visibleDocuments.length === 0 && (
            <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
              Für diese Maschine sind noch keine freigegebenen Dokumente
              hinterlegt.
            </div>
          )}
        </div>
      </section>

      {lockedFolders.map((folder) => (
        <Card key={folder.id}>
          <CardHeader>
            <CardTitle>{folder.name}</CardTitle>
            <CardDescription>Dieser Ordner ist per PIN geschützt.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={`/m/${slug}/unlock`}
              method="post"
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input type="hidden" name="folderId" value={folder.id} />
              <Input type="password" name="pin" placeholder="PIN" required />
              <Button type="submit">Ordner freischalten</Button>
            </form>
            {pin === "invalid" && invalidFolderId === folder.id && (
              <p className="mt-2 text-sm text-red-600">PIN ist nicht gültig.</p>
            )}
          </CardContent>
        </Card>
      ))}
      </div>
    </main>
  );
}
