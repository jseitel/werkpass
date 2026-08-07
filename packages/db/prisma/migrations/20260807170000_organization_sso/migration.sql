-- Better Auth SSO providers are scoped to an organization. Provider secrets
-- are never returned by the management API; production databases must also
-- use encrypted storage and encrypted backups.
CREATE TABLE "ssoProvider" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "oidcConfig" TEXT,
    "samlConfig" TEXT,
    "userId" TEXT,
    "providerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "domain" TEXT NOT NULL,
    "domainVerified" BOOLEAN,

    CONSTRAINT "ssoProvider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ssoProvider_providerId_key" ON "ssoProvider"("providerId");
CREATE INDEX "ssoProvider_organizationId_idx" ON "ssoProvider"("organizationId");

ALTER TABLE "ssoProvider" ADD CONSTRAINT "ssoProvider_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
