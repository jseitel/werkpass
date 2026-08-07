import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Factory, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  getMachineBySlug,
  listDocumentsForMachine,
  listDocumentVersions,
} from "@werkpass/core";
import { Badge } from "@werkpass/ui";
import { FolderSection, type FolderView } from "./folder-section";
import { formatPublishedAt } from "./format";
import { folderPinCookieName, isFolderUnlocked } from "./pin-access";
import { ViewerShell } from "./viewer-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const machine = await getMachineBySlug(slug);

  return {
    title: machine ? `${machine.name} · werkpass` : "werkpass",
    // A machine dossier is meant to be reached from the QR code on the
    // machine, not from a search engine.
    robots: { index: false, follow: false },
  };
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
  const { pin, folder: pinErrorFolderId } = await searchParams;
  const machine = await getMachineBySlug(slug);
  if (!machine) notFound();

  const cookieStore = await cookies();
  const documents = await listDocumentsForMachine(machine.id);
  const versionsByDocument = await Promise.all(
    documents.map((document) => listDocumentVersions(document.id)),
  );

  // Grouped in the order listDocumentsForMachine returns (folder position,
  // then title), so a folder keeps its place in the dossier whether or not it
  // is unlocked.
  const folders = new Map<string, FolderView>();
  const unlockedFolderIds = new Set<string>();
  let publishedAtHigh: Date | null = null;

  documents.forEach((document, index) => {
    const folder = document.folder;
    const unlocked = isFolderUnlocked(
      slug,
      folder.id,
      folder.pinHash,
      cookieStore.get(folderPinCookieName(folder.id))?.value,
    );
    if (unlocked) unlockedFolderIds.add(folder.id);

    // Deny by default, and let the folder be the authority: the document only
    // carries a copy of the access level taken when it was created. Mirrors
    // the check in /api/documents/[versionId]/download.
    const visible =
      (folder.accessLevel === "public" && document.accessLevel === "public") ||
      unlocked;

    const view = folders.get(folder.id) ?? {
      id: folder.id,
      name: folder.name,
      systemKey: folder.systemKey,
      locked: false,
      documents: [],
    };

    if (!visible) {
      // Only a PIN folder can be opened from here - anything else stays hidden
      // without offering a prompt that could not work.
      view.locked = view.locked || folder.accessLevel === "pin";
    } else {
      const versions = versionsByDocument[index]!.filter(
        (version) => version.status === "published",
      );
      const current = versions.find((version) => version.isCurrent);
      if (current) {
        if (
          current.publishedAt &&
          (!publishedAtHigh || current.publishedAt > publishedAtHigh)
        ) {
          publishedAtHigh = current.publishedAt;
        }
        view.documents.push({
          id: document.id,
          title: document.title,
          language: document.language,
          versions,
        });
      }
    }

    folders.set(folder.id, view);
  });

  const folderViews = Array.from(folders.values()).filter(
    (folder) => folder.documents.length > 0 || folder.locked,
  );
  const documentCount = folderViews.reduce(
    (total, folder) => total + folder.documents.length,
    0,
  );
  const lockedFolderCount = folderViews.filter((folder) => folder.locked).length;
  const lastUpdated = formatPublishedAt(publishedAtHigh);
  const pinError =
    pin === "invalid" || pin === "locked" ? (pin as "invalid" | "locked") : undefined;

  return (
    <ViewerShell machineName={machine.name}>
      <div className="flex flex-col gap-6">
        <section className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <div
              className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted sm:flex"
              aria-hidden="true"
            >
              <Factory className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Digitale Maschinenakte
              </p>
              <h1 className="mt-1.5 text-balance text-2xl font-semibold leading-tight sm:text-3xl">
                {machine.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Seriennummer {machine.serialNumber}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <FileText className="h-3 w-3" aria-hidden="true" />
                  {documentCount === 1
                    ? "1 Dokument"
                    : `${documentCount} Dokumente`}
                </Badge>
                {unlockedFolderIds.size > 0 && (
                  <Badge className="gap-1.5">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    {unlockedFolderIds.size === 1
                      ? "1 Ordner freigeschaltet"
                      : `${unlockedFolderIds.size} Ordner freigeschaltet`}
                  </Badge>
                )}
                {lockedFolderCount > 0 && (
                  <Badge variant="outline" className="gap-1.5">
                    <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                    {lockedFolderCount === 1
                      ? "1 Ordner gesperrt"
                      : `${lockedFolderCount} Ordner gesperrt`}
                  </Badge>
                )}
              </div>

              {lastUpdated && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Aktuellste Revision veröffentlicht am {lastUpdated}
                </p>
              )}
            </div>
          </div>
        </section>

        {folderViews.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="px-1">
              <h2 className="text-lg font-medium">Dokumente</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Aktuelle Revisionen stehen direkt bereit; ältere Revisionen sind
                im Archiv je Dokument abrufbar.
              </p>
            </div>
            <div className="mt-3 flex flex-col gap-7">
              {folderViews.map((folder) => (
                <FolderSection
                  key={folder.id}
                  slug={slug}
                  folder={folder}
                  pinError={
                    pinErrorFolderId === folder.id ? pinError : undefined
                  }
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <FileText
              className="mx-auto h-8 w-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium">Noch keine Dokumente</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Für diese Maschine sind noch keine freigegebenen Dokumente
              hinterlegt.
            </p>
          </div>
        )}
      </div>
    </ViewerShell>
  );
}
