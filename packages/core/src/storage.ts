import { randomBytes } from "node:crypto";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Talks to the S3 API only - works against Hetzner Object Storage today and
// MinIO or any other S3-compatible provider tomorrow via env vars alone.
const s3 = new S3Client({
  region: process.env.S3_REGION ?? "eu-central",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
  // AWS SDK v3's default flexible-checksum behavior adds a checksum header
  // that most non-AWS S3 implementations (Garage, MinIO, R2, Hetzner) don't
  // support on presigned URLs signed ahead of the actual request.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const bucket = () => {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error("S3_BUCKET is not configured");
  return name;
};

const MAX_STORAGE_FILE_NAME_LENGTH = 120;
const STORAGE_FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Content types a browser may request a presigned upload for. Anything else is
 * stored as an opaque download so the object store can never be talked into
 * serving attacker-authored markup (`text/html`, `image/svg+xml`) from its own
 * origin. The value is part of the signature, so the caller must send back
 * exactly the type returned by `requestUploadUrlAction`.
 */
const ALLOWED_UPLOAD_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/tiff",
  "text/plain",
  "text/csv",
  "application/octet-stream",
]);

export function normalizeUploadContentType(value: string): string {
  const base = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_UPLOAD_CONTENT_TYPES.has(base) ? base : "application/octet-stream";
}

/** Reduces an uploaded file name to something safe to embed in an object key. */
export function safeStorageFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, MAX_STORAGE_FILE_NAME_LENGTH);
  return cleaned || "datei";
}

export function documentStorageKeyPrefix(documentId: string): string {
  return `documents/${documentId}/`;
}

/**
 * Builds the object key for a new document version. The random component keeps
 * keys unpredictable; the caller's file name only ever contributes characters
 * that cannot introduce a new path segment.
 */
export function buildDocumentStorageKey(
  documentId: string,
  fileName: string,
): string {
  return `${documentStorageKeyPrefix(documentId)}${randomBytes(8).toString("hex")}-${safeStorageFileName(fileName)}`;
}

/**
 * Whether a key submitted by a client belongs to exactly this document. The
 * download endpoint hands out a presigned URL for whatever key a version row
 * carries, so a version must never be allowed to point outside its own prefix.
 */
export function isOwnDocumentStorageKey(
  documentId: string,
  storageKey: string,
): boolean {
  const prefix = documentStorageKeyPrefix(documentId);
  if (!storageKey.startsWith(prefix)) return false;
  return STORAGE_FILE_NAME_PATTERN.test(storageKey.slice(prefix.length));
}

/**
 * `attachment` plus a header-safe file name. Non-ASCII is carried by the
 * RFC 5987 form; the quoted fallback keeps printable ASCII only, which also
 * rules out header injection through the stored name.
 */
function downloadContentDisposition(fileName?: string): string {
  const ascii = (fileName ?? "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_")
    .trim();
  const fallback = ascii || "download";
  const encoded = encodeURIComponent(fileName ?? fallback);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/** Presigned, time-limited upload URL - the app never proxies file bytes. */
export function getUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: normalizeUploadContentType(contentType),
  });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Presigned, time-limited download URL - mirrors docks.io's model of never
 * exposing a permanent direct link to the underlying file.
 *
 * The response headers are pinned to an attachment download so that whatever
 * content type an upload was stored with, the object store never renders it as
 * a document in the browser.
 */
export function getDownloadUrl(
  key: string,
  options: { fileName?: string; expiresInSeconds?: number } = {},
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentType: "application/octet-stream",
    ResponseContentDisposition: downloadContentDisposition(options.fileName),
  });
  return getSignedUrl(s3, command, {
    expiresIn: options.expiresInSeconds ?? 300,
  });
}

export interface StoredObjectMetadata {
  contentLength: number;
  contentType: string;
}

/**
 * Reads the authoritative size and content type back from the object store.
 * Returns null when the key does not exist, which is how the version endpoint
 * tells a completed upload apart from a fabricated key.
 */
export async function headStoredObject(
  key: string,
): Promise<StoredObjectMetadata | null> {
  try {
    const result = await s3.send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key }),
    );
    return {
      contentLength: result.ContentLength ?? 0,
      contentType: result.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status === 404 || status === 403) return null;
    throw error;
  }
}
