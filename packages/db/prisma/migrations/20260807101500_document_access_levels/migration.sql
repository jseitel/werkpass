-- DropIndex
DROP INDEX IF EXISTS "Document_machineId_language_key";

-- AlterTable
ALTER TABLE "Document"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "accessLevel" TEXT NOT NULL DEFAULT 'public',
ADD COLUMN "pinHash" TEXT,
ADD COLUMN "pinSalt" TEXT;

-- CreateIndex
CREATE INDEX "Document_machineId_accessLevel_idx" ON "Document"("machineId", "accessLevel");

-- CreateIndex
CREATE UNIQUE INDEX "Document_machineId_title_language_key" ON "Document"("machineId", "title", "language");
