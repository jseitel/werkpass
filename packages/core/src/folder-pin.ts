import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export function hashFolderPin(pin: string) {
  const pinSalt = randomBytes(16).toString("hex");
  const pinHash = scryptSync(pin, Buffer.from(pinSalt, "hex"), 64).toString("hex");
  return { pinHash, pinSalt };
}

export function verifyFolderPin(
  pin: string,
  pinSalt: string | null,
  pinHash: string | null,
): boolean {
  if (!pinSalt || !pinHash) return false;

  // Legacy PINs used a salted SHA-256 digest (64 hex characters).
  const candidate =
    pinHash.length === 64
      ? createHash("sha256").update(`${pinSalt}:${pin}`).digest("hex")
      : scryptSync(pin, Buffer.from(pinSalt, "hex"), 64).toString("hex");
  if (candidate.length !== pinHash.length) return false;

  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(pinHash, "hex"));
}
