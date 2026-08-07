-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- Backfill one customer per organization for machines that existed before the customer model.
INSERT INTO "Customer" ("id", "organizationId", "name", "createdAt", "updatedAt")
SELECT
    'legacy-' || md5("organizationId"),
    "organizationId",
    'Bestehende Maschinen',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Machine"
GROUP BY "organizationId";

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN "customerId" TEXT;

UPDATE "Machine"
SET "customerId" = 'legacy-' || md5("organizationId")
WHERE "customerId" IS NULL;

ALTER TABLE "Machine" ALTER COLUMN "customerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "DocumentVersion"
ADD COLUMN "changeNote" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published',
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "approvedById" TEXT;

UPDATE "DocumentVersion"
SET "publishedAt" = "createdAt"
WHERE "publishedAt" IS NULL;

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");

-- CreateIndex
CREATE INDEX "Machine_customerId_idx" ON "Machine"("customerId");

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
