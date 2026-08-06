import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../config";

const ALGORITHM = "aes-256-gcm";
const key = Buffer.from(config.AI_CONFIG_MASTER_KEY, "base64");

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  lastFour: string;
};

export function encryptSecret(value: string, context: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    lastFour: value.slice(-4),
  };
}

export function decryptSecret(
  secret: {
    apiKeyCiphertext: string | null;
    apiKeyIv: string | null;
    apiKeyAuthTag: string | null;
  },
  context: string,
): string | null {
  if (
    !secret.apiKeyCiphertext ||
    !secret.apiKeyIv ||
    !secret.apiKeyAuthTag
  ) {
    return null;
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(secret.apiKeyIv, "base64"),
  );
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(secret.apiKeyAuthTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(secret.apiKeyCiphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(lastFour: string | null): string | null {
  return lastFour ? `••••••••${lastFour}` : null;
}
