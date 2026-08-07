import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";

for (const envFile of [".env", "../../apps/web/.env.local"]) {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

const { encryptSsoConfig, isEncryptedSsoConfig } = await import(
  "../../auth/src/sso-config-crypto.ts"
);

const prisma = new PrismaClient();

try {
  const providers = await prisma.ssoProvider.findMany({
    select: { id: true, oidcConfig: true, samlConfig: true },
  });
  let updated = 0;

  for (const provider of providers) {
    const data = {};
    for (const field of ["oidcConfig", "samlConfig"]) {
      const value = provider[field];
      if (typeof value === "string" && !isEncryptedSsoConfig(value)) {
        data[field] = encryptSsoConfig(value);
      }
    }
    if (Object.keys(data).length > 0) {
      await prisma.ssoProvider.update({ where: { id: provider.id }, data });
      updated += 1;
    }
  }

  console.log(`${updated} SSO-Provider verschlüsselt; ${providers.length - updated} waren bereits geschützt.`);
} finally {
  await prisma.$disconnect();
}
