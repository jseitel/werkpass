import { createHmac, timingSafeEqual } from "node:crypto";

/** How long a folder stays unlocked after the PIN was entered. */
export const FOLDER_UNLOCK_TTL_SECONDS = 60 * 60;

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

function signUnlock(
  slug: string,
  folderId: string,
  pinHash: string,
  expiresAt: number,
): string {
  return createHmac("sha256", cookieSecret())
    .update(`${slug}:${folderId}:${pinHash}:${expiresAt}`)
    .digest("hex");
}

/**
 * The expiry is signed into the token rather than left to the cookie's
 * `maxAge`. A cookie lifetime is only a hint to the browser - the value itself
 * has to stop working, or a copied token grants PIN-free access forever.
 */
export function folderUnlockToken(
  slug: string,
  folderId: string,
  pinHash: string,
  now: number = Date.now(),
): string {
  const expiresAt = Math.floor(now / 1000) + FOLDER_UNLOCK_TTL_SECONDS;
  return `${expiresAt}.${signUnlock(slug, folderId, pinHash, expiresAt)}`;
}

export function isFolderUnlocked(
  slug: string,
  folderId: string,
  pinHash: string | null,
  token?: string,
): boolean {
  if (!pinHash || !token) return false;

  const separator = token.indexOf(".");
  if (separator <= 0) return false;

  const expiryPart = token.slice(0, separator);
  if (!/^\d+$/.test(expiryPart)) return false;
  const expiresAt = Number(expiryPart);
  if (!Number.isSafeInteger(expiresAt) || expiresAt * 1000 <= Date.now()) {
    return false;
  }

  // Compare as bytes: the string lengths matching does not guarantee equal
  // buffer lengths, and timingSafeEqual throws when they differ.
  const provided = Buffer.from(token.slice(separator + 1), "utf8");
  const expected = Buffer.from(
    signUnlock(slug, folderId, pinHash, expiresAt),
    "utf8",
  );
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
