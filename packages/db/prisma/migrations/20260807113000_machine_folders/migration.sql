-- CreateTable
CREATE TABLE "MachineFolder" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemKey" TEXT,
    "accessLevel" TEXT NOT NULL DEFAULT 'public',
    "pinHash" TEXT,
    "pinSalt" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineFolder_pkey" PRIMARY KEY ("id")
);

-- Add a folder for every category already used by each machine.
INSERT INTO "MachineFolder" (
    "id", "machineId", "name", "systemKey", "accessLevel", "position", "updatedAt"
)
SELECT
    'fld_' || md5(d."machineId" || ':' || d."category"),
    d."machineId",
    CASE d."category"
        WHEN 'manual' THEN 'Betriebsanleitungen'
        WHEN 'safety' THEN 'Sicherheit'
        WHEN 'maintenance' THEN 'Wartung'
        WHEN 'spare-parts' THEN 'Ersatzteile'
        WHEN 'declaration' THEN 'Konformitaet'
        WHEN 'wiring' THEN 'Elektroplaene'
        WHEN 'cad' THEN 'CAD und Zeichnungen'
        WHEN 'service' THEN 'Service'
        ELSE d."category"
    END,
    d."category",
    'public',
    CASE d."category"
        WHEN 'manual' THEN 10
        WHEN 'safety' THEN 20
        WHEN 'maintenance' THEN 30
        WHEN 'spare-parts' THEN 40
        WHEN 'declaration' THEN 50
        WHEN 'wiring' THEN 60
        WHEN 'cad' THEN 70
        WHEN 'service' THEN 80
        ELSE 100
    END,
    CURRENT_TIMESTAMP
FROM "Document" d
GROUP BY d."machineId", d."category";

-- Machines without documents still receive the standard folders.
INSERT INTO "MachineFolder" (
    "id", "machineId", "name", "systemKey", "accessLevel", "position", "updatedAt"
)
SELECT
    'fld_' || md5(m."id" || ':' || defaults.key),
    m."id",
    defaults.name,
    defaults.key,
    defaults.access,
    defaults.position,
    CURRENT_TIMESTAMP
FROM "Machine" m
CROSS JOIN (VALUES
    ('manual', 'Betriebsanleitungen', 'public', 10),
    ('safety', 'Sicherheit', 'public', 20),
    ('maintenance', 'Wartung', 'public', 30),
    ('spare-parts', 'Ersatzteile', 'public', 40),
    ('declaration', 'Konformitaet', 'public', 50),
    ('wiring', 'Elektroplaene', 'pin', 60),
    ('cad', 'CAD und Zeichnungen', 'pin', 70),
    ('service', 'Service', 'pin', 80)
) AS defaults(key, name, access, position)
WHERE NOT EXISTS (
    SELECT 1
    FROM "MachineFolder" f
    WHERE f."machineId" = m."id" AND f."systemKey" = defaults.key
);

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "folderId" TEXT;

UPDATE "Document" d
SET "folderId" = f."id"
FROM "MachineFolder" f
WHERE f."machineId" = d."machineId" AND f."systemKey" = d."category";

ALTER TABLE "Document" ALTER COLUMN "folderId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MachineFolder_machineId_name_key" ON "MachineFolder"("machineId", "name");
CREATE UNIQUE INDEX "MachineFolder_machineId_systemKey_key" ON "MachineFolder"("machineId", "systemKey");
CREATE INDEX "MachineFolder_machineId_position_idx" ON "MachineFolder"("machineId", "position");
CREATE INDEX "Document_folderId_idx" ON "Document"("folderId");

-- AddForeignKey
ALTER TABLE "MachineFolder" ADD CONSTRAINT "MachineFolder_machineId_fkey"
FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey"
FOREIGN KEY ("folderId") REFERENCES "MachineFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
