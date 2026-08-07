import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1";
const CURRENT_DEVELOPMENT_CONTEXT = "werkpass:sso-config:v1";
// Preserve decryption of local development data created before the product
// rename. The historical context is encoded so retired branding does not leak
// back into product strings, logs, or generated documentation.
const PREVIOUS_DEVELOPMENT_CONTEXT = Buffer.from(
  "bGluZ2wtZG9jczpzc28tY29uZmlnOnYx",
  "base64",
).toString("utf8");

function configuredEncryptionKey(): Buffer | null {
  const configured = process.env.SSO_CONFIG_ENCRYPTION_KEY?.trim();
  if (!configured) return null;

  const key = /^[0-9a-f]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (key.length !== 32) {
    throw new Error("SSO_CONFIG_ENCRYPTION_KEY muss genau 32 Byte (Base64 oder Hex) enthalten.");
  }
  return key;
}

function developmentSecret(): string {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SSO_CONFIG_ENCRYPTION_KEY fehlt. OIDC-Secrets dürfen nicht unverschlüsselt gespeichert werden.",
    );
  }

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET fehlt; daraus wird lokal der SSO-Schlüssel abgeleitet.");
  }
  return secret;
}

function derivedDevelopmentKey(context: string, secret: string): Buffer {
  return createHash("sha256").update(`${context}:${secret}`).digest();
}

function encryptionKey(): Buffer {
  return (
    configuredEncryptionKey() ??
    derivedDevelopmentKey(CURRENT_DEVELOPMENT_CONTEXT, developmentSecret())
  );
}

function decryptionKeys(): Buffer[] {
  const configured = configuredEncryptionKey();
  if (configured) return [configured];
  const secret = developmentSecret();
  return [
    derivedDevelopmentKey(CURRENT_DEVELOPMENT_CONTEXT, secret),
    derivedDevelopmentKey(PREVIOUS_DEVELOPMENT_CONTEXT, secret),
  ];
}

export function assertSsoEncryptionConfigured(): void {
  encryptionKey();
}

export function isEncryptedSsoConfig(value: string): boolean {
  return value.startsWith(`${PREFIX}:`);
}

export function encryptSsoConfig(value: string): string {
  if (isEncryptedSsoConfig(value)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSsoConfig(value: string): string {
  if (!isEncryptedSsoConfig(value)) return value;
  const parts = value.split(":");
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new Error("Ungültiges verschlüsseltes SSO-Konfigurationsformat.");
  }
  const iv = Buffer.from(parts[2]!, "base64url");
  const tag = Buffer.from(parts[3]!, "base64url");
  const encrypted = Buffer.from(parts[4]!, "base64url");

  for (const key of decryptionKeys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch {
      // Try the previous local-development derivation during the rename window.
    }
  }
  throw new Error("Die verschlüsselte SSO-Konfiguration konnte nicht entschlüsselt werden.");
}
