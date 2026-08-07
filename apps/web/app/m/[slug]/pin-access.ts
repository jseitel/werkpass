import { createHmac, timingSafeEqual } from "node:crypto";

function cookieSecret() {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET or AUTH_SECRET is required for PIN access");
  }
  return "development-only-folder-pin-secret";
}

export function folderPinCookieName(folderId: string) {
  return `folder-pin-${folderId}`;
}

export function folderUnlockToken(
  slug: string,
  folderId: string,
  pinHash: string,
): string {
  return createHmac("sha256", cookieSecret())
    .update(`${slug}:${folderId}:${pinHash}`)
    .digest("hex");
}

export function isFolderUnlocked(
  slug: string,
  folderId: string,
  pinHash: string | null,
  token?: string,
): boolean {
  if (!pinHash || !token) return false;
  const expected = folderUnlockToken(slug, folderId, pinHash);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
