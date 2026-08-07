const longDateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "long",
});
const shortDateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
});
const sizeFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
});

/** Spelled out - used once, in the header. */
export function formatPublishedAt(value: Date | null): string | null {
  return value ? longDateFormatter.format(value) : null;
}

/** Numeric - used in the per-revision meta line, where space is tight. */
export function formatPublishedAtShort(value: Date | null): string | null {
  return value ? shortDateFormatter.format(value) : null;
}

const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatFileSize(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${sizeFormatter.format(value)} ${SIZE_UNITS[unit]}`;
}

/**
 * "de-DE" -> "Deutsch". The region is dropped on purpose: the full display
 * name ("Deutsch (Deutschland)") pushes the meta line onto a second row on a
 * phone without telling the reader anything they need.
 */
export function formatLanguage(tag: string): string {
  const primary = tag.split("-")[0] ?? tag;
  try {
    const displayNames = new Intl.DisplayNames(["de"], { type: "language" });
    return displayNames.of(primary) ?? tag;
  } catch {
    return tag;
  }
}

const FILE_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
  "image/tiff": "TIFF",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "application/zip": "ZIP",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "PPTX",
};

/**
 * Uploads are stored as `application/octet-stream` unless they match the upload
 * allowlist, so the file extension is the better label in the common case.
 */
export function formatFileType(mimeType: string, fileName: string): string {
  const known = FILE_TYPE_LABELS[mimeType.toLowerCase()];
  if (known) return known;

  const extension = fileName.includes(".")
    ? fileName.split(".").pop()?.slice(0, 5).toUpperCase()
    : null;
  return extension || "Datei";
}
