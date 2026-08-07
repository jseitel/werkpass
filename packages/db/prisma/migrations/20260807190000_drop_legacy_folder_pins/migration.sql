-- Legacy PINs were hashed with a salted SHA-256 digest (64 hex characters)
-- before scrypt was introduced. A SHA-256 digest cannot be turned into a
-- scrypt hash without the original plaintext PIN, so instead of migrating
-- them in place this clears them outright. Affected folders fall back to
-- their existing "PIN fehlt" state (accessLevel stays 'pin', pinHash is
-- null) until an admin sets a new PIN - the dashboard already supports that
-- state for newly created folders.
UPDATE "MachineFolder"
SET
    "pinHash" = NULL,
    "pinSalt" = NULL,
    "pinChangedAt" = NULL,
    "pinChangedById" = NULL
WHERE "pinHash" IS NOT NULL AND length("pinHash") = 64;

-- Legacy per-document PIN fields mirror the folder; clear them the same way.
UPDATE "Document"
SET "pinHash" = NULL, "pinSalt" = NULL
WHERE "pinHash" IS NOT NULL AND length("pinHash") = 64;
