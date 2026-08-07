// One-time (per fresh garage-data volume) CORS setup for the local dev
// bucket. Needed because presigned uploads/downloads go directly from the
// browser (http://localhost:3000) to Garage (http://localhost:3900), which
// is a different origin - without this, browser uploads fail with a generic
// "Failed to fetch" (the CORS preflight is rejected; curl/node fetch don't
// hit this since they don't enforce CORS).
//
// Usage: node infra/garage/configure-cors.mjs
// Requires the key to have "owner" permission on the bucket:
//   docker exec werkpass-garage /garage bucket allow --owner --key werkpass-web werkpass-dev
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "garage",
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:3900",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const allowedOrigins = (
  process.env.APP_ORIGINS ??
  process.env.APP_ORIGIN ??
  "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

await s3.send(
  new PutBucketCorsCommand({
    Bucket: process.env.S3_BUCKET ?? "werkpass-dev",
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: allowedOrigins,
          AllowedMethods: ["GET", "PUT", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3000,
        },
      ],
    },
  }),
);

console.log("CORS configured on bucket.");
