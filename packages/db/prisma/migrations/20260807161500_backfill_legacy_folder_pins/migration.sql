-- Older documents stored access and PIN data directly on the document. When
-- folders were introduced, those migrated folders defaulted to public. Move
-- the latest available legacy PIN to the owning folder and restore its access.
WITH pin_source AS (
    SELECT DISTINCT ON ("folderId")
        "folderId",
        "pinHash",
        "pinSalt",
        "updatedAt"
    FROM "Document"
    WHERE "accessLevel" = 'pin'
    ORDER BY "folderId", "updatedAt" DESC
)
UPDATE "MachineFolder" AS folder
SET
    "accessLevel" = 'pin',
    "pinHash" = COALESCE(folder."pinHash", source."pinHash"),
    "pinSalt" = COALESCE(folder."pinSalt", source."pinSalt"),
    "pinChangedAt" = CASE
        WHEN folder."pinHash" IS NULL AND source."pinHash" IS NOT NULL
            THEN source."updatedAt"
        ELSE folder."pinChangedAt"
    END,
    "updatedAt" = CURRENT_TIMESTAMP
FROM pin_source AS source
WHERE folder."id" = source."folderId";
