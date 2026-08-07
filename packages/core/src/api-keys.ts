import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@lingl-docs/db";

const API_KEY_PREFIX = "ld_live_";

function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function listOrganizationApiKeys(organizationId: string) {
  return prisma.apiKey.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      tokenLastFour: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createOrganizationApiKey(input: {
  organizationId: string;
  createdById: string;
  name: string;
}) {
  const token = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const apiKey = await prisma.apiKey.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.createdById,
      name: input.name,
      tokenHash: hashApiKey(token),
      tokenPrefix: token.slice(0, 12),
      tokenLastFour: token.slice(-4),
      scopes: "read",
    },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      tokenLastFour: true,
      scopes: true,
      createdAt: true,
    },
  });

  return { apiKey, token };
}

export async function revokeOrganizationApiKey(input: {
  organizationId: string;
  apiKeyId: string;
}) {
  const result = await prisma.apiKey.updateMany({
    where: {
      id: input.apiKeyId,
      organizationId: input.organizationId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw new Error("API-Schlüssel nicht gefunden.");
}

export async function authenticateApiKey(token: string) {
  if (!token.startsWith(API_KEY_PREFIX)) return null;

  const apiKey = await prisma.apiKey.findUnique({
    where: { tokenHash: hashApiKey(token) },
    select: {
      id: true,
      organizationId: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
    },
  });

  if (
    !apiKey ||
    apiKey.revokedAt ||
    (apiKey.expiresAt && apiKey.expiresAt <= new Date())
  ) {
    return null;
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return apiKey;
}
