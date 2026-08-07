ALTER TABLE "user" ADD COLUMN "defaultOrganizationId" TEXT;

-- Existing users with exactly one membership get the unsurprising default.
UPDATE "user" AS u
SET "defaultOrganizationId" = single_membership."organizationId"
FROM (
    SELECT "userId", MIN("organizationId") AS "organizationId"
    FROM "member"
    GROUP BY "userId"
    HAVING COUNT(*) = 1
) AS single_membership
WHERE u."id" = single_membership."userId";

-- Repair currently open sessions that lost their active organization.
UPDATE "session" AS s
SET "activeOrganizationId" = u."defaultOrganizationId"
FROM "user" AS u
WHERE s."userId" = u."id"
  AND s."activeOrganizationId" IS NULL
  AND u."defaultOrganizationId" IS NOT NULL;

CREATE INDEX "user_defaultOrganizationId_idx" ON "user"("defaultOrganizationId");

ALTER TABLE "user" ADD CONSTRAINT "user_defaultOrganizationId_fkey"
FOREIGN KEY ("defaultOrganizationId") REFERENCES "organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
