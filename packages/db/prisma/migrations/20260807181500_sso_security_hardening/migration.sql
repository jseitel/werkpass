ALTER TABLE "organization"
ADD COLUMN "ssoMode" TEXT NOT NULL DEFAULT 'optional',
ADD COLUMN "ssoBreakGlassUserId" TEXT;

ALTER TABLE "ssoProvider"
ADD COLUMN "domainVerifiedAt" TIMESTAMP(3),
ADD COLUMN "verificationDueAt" TIMESTAMP(3);

UPDATE "ssoProvider"
SET "domainVerifiedAt" = CURRENT_TIMESTAMP,
    "verificationDueAt" = CURRENT_TIMESTAMP + INTERVAL '90 days'
WHERE "domainVerified" = TRUE;

-- Only a currently verified provider may own a domain. Lower-casing prevents
-- a second organization from claiming the same domain with different casing.
CREATE UNIQUE INDEX "ssoProvider_verified_domain_key"
ON "ssoProvider" (LOWER("domain"))
WHERE "domainVerified" = TRUE;

CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,
    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

CREATE TABLE "SecurityAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityAuditLog_organizationId_createdAt_idx"
ON "SecurityAuditLog"("organizationId", "createdAt");
CREATE INDEX "SecurityAuditLog_actorUserId_createdAt_idx"
ON "SecurityAuditLog"("actorUserId", "createdAt");
CREATE INDEX "SecurityAuditLog_action_createdAt_idx"
ON "SecurityAuditLog"("action", "createdAt");
