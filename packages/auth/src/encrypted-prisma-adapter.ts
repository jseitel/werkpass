import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { PrismaClient } from "@werkpass/db";
import { decryptSsoConfig, encryptSsoConfig, isEncryptedSsoConfig } from "./sso-config-crypto";

type PrismaAdapterConfig = Parameters<typeof prismaAdapter>[1];
type Adapter = ReturnType<ReturnType<typeof prismaAdapter>>;
type AdapterRecord = Record<string, unknown>;

const protectedFields = ["oidcConfig", "samlConfig"] as const;

function encryptRecord(model: string, record: AdapterRecord): AdapterRecord {
  if (model !== "ssoProvider") return record;
  const result = { ...record };
  for (const field of protectedFields) {
    if (typeof result[field] === "string") result[field] = encryptSsoConfig(result[field]);
  }
  return result;
}

function decryptRecord(model: string, record: unknown): unknown {
  if (model !== "ssoProvider" || !record || typeof record !== "object") return record;
  const result: AdapterRecord = { ...(record as AdapterRecord) };
  for (const field of protectedFields) {
    if (typeof result[field] === "string") result[field] = decryptSsoConfig(result[field]);
  }
  return result;
}

function containsPlaintextConfig(record: unknown): record is AdapterRecord {
  if (!record || typeof record !== "object") return false;
  return protectedFields.some((field) => {
    const value = (record as AdapterRecord)[field];
    return typeof value === "string" && !isEncryptedSsoConfig(value);
  });
}

async function migratePlaintextRecord(adapter: Adapter, model: string, record: unknown) {
  if (model !== "ssoProvider" || !containsPlaintextConfig(record)) return;
  const id = record.id;
  if (typeof id !== "string") return;
  const update: AdapterRecord = {};
  for (const field of protectedFields) {
    const value = record[field];
    if (typeof value === "string" && !isEncryptedSsoConfig(value)) {
      update[field] = encryptSsoConfig(value);
    }
  }
  await adapter.update({ model, where: [{ field: "id", value: id }], update });
}

/**
 * Better Auth receives decrypted provider JSON while PostgreSQL only receives
 * authenticated AES-256-GCM ciphertext. Existing plaintext rows are upgraded
 * transactionally on their first read.
 */
export function encryptedPrismaAdapter(prisma: PrismaClient, config: PrismaAdapterConfig) {
  const factory = prismaAdapter(prisma, config);
  return (options: BetterAuthOptions): Adapter => {
    const adapter = factory(options);
    return {
      ...adapter,
      create: async (args) =>
        decryptRecord(args.model, await adapter.create({ ...args, data: encryptRecord(args.model, args.data) })) as never,
      update: async (args) =>
        decryptRecord(args.model, await adapter.update({ ...args, update: encryptRecord(args.model, args.update) })) as never,
      updateMany: async (args) =>
        adapter.updateMany({ ...args, update: encryptRecord(args.model, args.update) }),
      findOne: async (args) => {
        const result = await adapter.findOne(args);
        await migratePlaintextRecord(adapter, args.model, result);
        return decryptRecord(args.model, result) as never;
      },
      findMany: async (args) => {
        const results = await adapter.findMany(args);
        await Promise.all(results.map((result) => migratePlaintextRecord(adapter, args.model, result)));
        return results.map((result) => decryptRecord(args.model, result)) as never;
      },
    };
  };
}
