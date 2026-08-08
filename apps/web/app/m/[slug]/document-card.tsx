import { ChevronDown, Clock3, Download, FileText } from "lucide-react";
import { Badge, buttonVariants, cn } from "@werkpass/ui";
import {
  formatFileSize,
  formatFileType,
  formatLanguage,
  formatPublishedAtShort,
} from "./format";

export interface DocumentVersionView {
  id: string;
  revision: string;
  changeNote: string | null;
  publishedAt: Date | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  isCurrent: boolean;
}

export interface DocumentView {
  id: string;
  title: string;
  language: string;
  versions: DocumentVersionView[];
}

function versionMeta(version: DocumentVersionView): string[] {
  return [
    formatFileType(version.mimeType, version.fileName),
    formatFileSize(version.fileSizeBytes),
    formatPublishedAtShort(version.publishedAt),
  ].filter((entry): entry is string => Boolean(entry));
}

export function DocumentCard({ document }: { document: DocumentView }) {
  const current = document.versions.find((version) => version.isCurrent);
  if (!current) return null;

  const archive = document.versions.filter((version) => !version.isCurrent);

  return (
    <article className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <FileText
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-medium leading-snug">{document.title}</h4>
            {/* A div, not a p: Badge renders a div, and a div inside a p makes
                the parser close the p early - the resulting DOM no longer
                matches the server output and hydration regenerates the tree. */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <Badge variant="secondary" className="font-normal">
                {current.revision}
              </Badge>
              <span>
                {[...versionMeta(current), formatLanguage(document.language)].join(
                  " · ",
                )}
              </span>
            </div>
          </div>
        </div>

        {current.changeNote && (
          <p className="text-sm text-muted-foreground">{current.changeNote}</p>
        )}

        {/* Full-width on a phone: this is the one thing the visitor came for. */}
        <a
          href={`/api/documents/${current.id}/download`}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-11 w-full gap-2 sm:w-auto sm:self-start",
          )}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Aktuelle Revision laden
        </a>
      </div>

      {archive.length > 0 && (
        <details className="group border-t">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50">
            <span className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Ältere Revisionen ({archive.length})
            </span>
            <ChevronDown
              className="h-4 w-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <ul className="border-t">
            {archive.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{version.revision}</div>
                  <div className="text-xs text-muted-foreground">
                    {versionMeta(version).join(" · ")}
                  </div>
                </div>
                <a
                  href={`/api/documents/${version.id}/download`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-9 gap-1.5",
                  )}
                  aria-label={`${version.revision} von ${document.title} herunterladen`}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Laden
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
