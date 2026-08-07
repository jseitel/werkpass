import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
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

/** Presigned, time-limited upload URL - the app never proxies file bytes. */
export function getUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Presigned, time-limited download URL - mirrors docks.io's model of never
 * exposing a permanent direct link to the underlying file.
 */
export function getDownloadUrl(
  key: string,
  expiresInSeconds = 300,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}
