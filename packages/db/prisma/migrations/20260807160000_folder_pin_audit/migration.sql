-- AlterTable
ALTER TABLE "MachineFolder"
ADD COLUMN "pinChangedAt" TIMESTAMP(3),
ADD COLUMN "pinChangedById" TEXT;

-- Existing PINs predate audit metadata. Their last folder update is the best
-- available timestamp; the responsible user cannot be reconstructed.
UPDATE "MachineFolder"
SET "pinChangedAt" = "updatedAt"
WHERE "pinHash" IS NOT NULL;
