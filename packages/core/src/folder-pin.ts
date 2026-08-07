import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "@werkpass/db";

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

  const candidate = scryptSync(pin, Buffer.from(pinSalt, "hex"), 64).toString("hex");
  if (candidate.length !== pinHash.length) return false;

  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(pinHash, "hex"));
}

const PIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const PIN_ATTEMPT_LIMIT = 10;

/**
 * Folder PINs have no server-side complexity floor beyond length, so without
 * throttling a 6-digit numeric PIN is brute-forceable in well under the
 * 15-minute window. Attempts are counted per folder + source IP (falling back
 * to a single shared bucket per folder when the IP can't be trusted, see
 * TRUST_PROXY_HEADERS) using the existing security audit log rather than a
 * new table.
 */
export async function tooManyFailedPinAttempts(
  folderId: string,
  ipAddress: string | null,
): Promise<boolean> {
  const count = await prisma.securityAuditLog.count({
    where: {
      action: "folder.pin.failed",
      targetId: folderId,
      ipAddress,
      createdAt: { gte: new Date(Date.now() - PIN_ATTEMPT_WINDOW_MS) },
    },
  });
  return count >= PIN_ATTEMPT_LIMIT;
}

export async function recordFolderPinAttempt(input: {
  folderId: string;
  organizationId: string;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
}): Promise<void> {
  await prisma.securityAuditLog.create({
    data: {
      action: input.success ? "folder.pin.unlocked" : "folder.pin.failed",
      organizationId: input.organizationId,
      targetType: "machineFolder",
      targetId: input.folderId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });
}
