import { CircleAlert, KeyRound, LockKeyhole } from "lucide-react";
import { Badge, Button, Input } from "@werkpass/ui";
import { DocumentCard, type DocumentView } from "./document-card";
import { FolderIcon } from "./folder-visuals";

export interface FolderView {
  id: string;
  name: string;
  systemKey: string | null;
  /** True while the folder still hides documents behind its PIN. */
  locked: boolean;
  documents: DocumentView[];
}

function FolderHeading({
  folder,
  trailing,
}: {
  folder: FolderView;
  trailing: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <h3 className="flex min-w-0 items-center gap-2 font-medium">
        <FolderIcon
          systemKey={folder.systemKey}
          className="h-4 w-4 shrink-0 text-muted-foreground"
        />
        <span className="truncate">{folder.name}</span>
      </h3>
      {trailing}
    </div>
  );
}

/**
 * The PIN prompt lives in the folder's own position in the dossier rather than
 * in a separate block at the bottom of the page, so it is obvious which
 * section it unlocks.
 */
function FolderPinForm({
  slug,
  folder,
  error,
}: {
  slug: string;
  folder: FolderView;
  error?: "invalid" | "locked";
}) {
  return (
    <div className="rounded-lg border border-dashed bg-card/50 p-4">
      <div className="flex items-start gap-3">
        <LockKeyhole
          className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            Dieser Ordner ist per PIN geschützt. Die PIN erhalten Sie vom
            Maschinenhersteller.
          </p>

          <form
            action={`/m/${slug}/unlock`}
            method="post"
            className="mt-3 flex flex-col gap-2 sm:flex-row"
          >
            <input type="hidden" name="folderId" value={folder.id} />
            <label className="sr-only" htmlFor={`pin-${folder.id}`}>
              PIN für {folder.name}
            </label>
            <Input
              id={`pin-${folder.id}`}
              type="password"
              name="pin"
              placeholder="PIN eingeben"
              autoComplete="off"
              className="h-11 sm:max-w-56"
              required
            />
            <Button type="submit" size="lg" className="h-11 gap-2">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Freischalten
            </Button>
          </form>

          {error && (
            <p
              role="alert"
              className="mt-2 flex items-center gap-1.5 text-sm text-destructive"
            >
              <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error === "locked"
                ? "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen."
                : "PIN ist nicht gültig."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function FolderSection({
  slug,
  folder,
  pinError,
}: {
  slug: string;
  folder: FolderView;
  pinError?: "invalid" | "locked";
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <FolderHeading
        folder={folder}
        trailing={
          folder.locked ? (
            <Badge variant="outline" className="shrink-0 gap-1">
              <LockKeyhole className="h-3 w-3" aria-hidden="true" />
              Gesperrt
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {folder.documents.length}
            </Badge>
          )
        }
      />

      {folder.documents.map((document) => (
        <DocumentCard key={document.id} document={document} />
      ))}

      {folder.locked && (
        <FolderPinForm slug={slug} folder={folder} error={pinError} />
      )}
    </section>
  );
}
