import { config as loadDotEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const rootEnvPath =
  process.env.DOTENV_CONFIG_PATH ??
  fileURLToPath(new URL("../../../.env", import.meta.url));

loadDotEnv({ path: rootEnvPath });

const booleanFromString = z
  .string()
  .default("false")
  .transform((value) => value.toLowerCase() === "true");

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  TRUST_PROXY: booleanFromString,
  DATABASE_URL: z.string().min(1),
  AI_CONFIG_MASTER_KEY: z
    .string()
    .min(1)
    .refine((value) => {
      try {
        return Buffer.from(value, "base64").length === 32;
      } catch {
        return false;
      }
    }, "AI_CONFIG_MASTER_KEY must be exactly 32 bytes encoded as base64"),
  SESSION_COOKIE_NAME: z.string().min(1).default("cbai_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanFromString,
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(25 * 1024 * 1024).default(10 * 1024 * 1024),
  MAX_IMAGE_PIXELS: z.coerce.number().int().min(1_000_000).max(100_000_000).default(30_000_000),
  ANALYSIS_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(45000),
  CUSTOM_AI_ALLOWED_HOSTS: z.string().default(""),
  ALLOW_PRIVATE_AI_HOSTS: booleanFromString,
  GOOGLE_GEMINI_API_KEY: z.string().optional(),
  GOOGLE_GEMINI_MODEL: z.string().default("gemini-3.6-flash"),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Environment configuration is invalid");
}

export const config = {
  ...parsed.data,
  customAiAllowedHosts: parsed.data.CUSTOM_AI_ALLOWED_HOSTS.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
};
