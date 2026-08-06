import { Router } from "express";
import { AiProvider } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { AppError } from "../errors";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "../security/crypto";
import { assertSafeProviderBaseUrl } from "../security/url";
import {
  createVisionProvider,
  verifyVisionProvider,
} from "../services/ai/runtime";
import type { ProviderRuntimeConfig } from "../services/ai/provider";

const GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com";

const router = Router();

const optionalApiKeySchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.string().trim().min(8).max(5000).optional(),
);

const providerSchema = z.object({
  provider: z.nativeEnum(AiProvider),
  baseUrl: z.string().trim().max(500).optional().default(""),
  model: z.string().trim().min(1).max(200),
  apiKey: optionalApiKeySchema,
  enabled: z.boolean(),
  visionEnabled: z.boolean().default(true),
  timeoutMs: z.coerce.number().int().min(5000).max(120000),
  maxImageBytes: z.coerce
    .number()
    .int()
    .min(64 * 1024)
    .max(25 * 1024 * 1024),
});

const testSchema = z.object({
  provider: z.nativeEnum(AiProvider).optional(),
  baseUrl: z.string().trim().max(500).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  apiKey: optionalApiKeySchema,
  timeoutMs: z.coerce.number().int().min(5000).max(120000).optional(),
  useStoredProvider: z.boolean().default(true),
});

const draftTestSchema = z.object({
  provider: z.nativeEnum(AiProvider),
  baseUrl: z.string().trim().max(500).optional().default(""),
  model: z.string().trim().min(1).max(200),
  apiKey: z.string().trim().min(8).max(5000),
  timeoutMs: z.coerce.number().int().min(5000).max(120000),
});

async function normaliseBaseUrl(
  provider: AiProvider,
  suppliedBaseUrl: string | undefined,
): Promise<string> {
  if (provider === AiProvider.GOOGLE_NATIVE) {
    return GOOGLE_BASE_URL;
  }

  const candidate = suppliedBaseUrl?.trim();
  if (!candidate) {
    throw new AppError(
      422,
      "BASE_URL_REQUIRED",
      "A base URL is required for an OpenAI-compatible provider",
    );
  }

  return (await assertSafeProviderBaseUrl(candidate)).toString();
}

function serialiseProvider(item: {
  id: string;
  provider: AiProvider;
  baseUrl: string;
  model: string;
  enabled: boolean;
  visionEnabled: boolean;
  timeoutMs: number;
  maxImageBytes: number;
  apiKeyCiphertext: string | null;
  apiKeyLastFour: string | null;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    provider: item.provider,
    baseUrl: item.baseUrl,
    model: item.model,
    enabled: item.enabled,
    visionEnabled: item.visionEnabled,
    timeoutMs: item.timeoutMs,
    maxImageBytes: item.maxImageBytes,
    hasApiKey: Boolean(item.apiKeyCiphertext),
    apiKeyMasked: maskSecret(item.apiKeyLastFour),
    updatedAt: item.updatedAt,
  };
}

router.use(requireAuth, requirePermission("settings:manage"));

router.get("/ai-providers", async (request, response) => {
  const configs = await prisma.aiProviderConfig.findMany({
    where: { organisationId: request.auth!.organisationId },
    orderBy: { updatedAt: "desc" },
  });

  response.json({
    providers: configs.map(serialiseProvider),
  });
});

router.put("/ai-providers", async (request, response) => {
  const input = providerSchema.parse(request.body);
  const auth = request.auth!;
  const baseUrl = await normaliseBaseUrl(input.provider, input.baseUrl);

  const existing = await prisma.aiProviderConfig.findUnique({
    where: {
      organisationId_provider: {
        organisationId: auth.organisationId,
        provider: input.provider,
      },
    },
  });

  const encryptionContext = `${auth.organisationId}:${input.provider}`;
  const encrypted = input.apiKey
    ? encryptSecret(input.apiKey, encryptionContext)
    : null;

  const hasEffectiveKey =
    Boolean(encrypted) || Boolean(existing?.apiKeyCiphertext);

  if (input.enabled && !hasEffectiveKey) {
    throw new AppError(
      422,
      "API_KEY_REQUIRED",
      "Enter an API key before enabling this provider",
    );
  }

  const saved = await prisma.$transaction(async (tx) => {
    if (input.enabled) {
      await tx.aiProviderConfig.updateMany({
        where: {
          organisationId: auth.organisationId,
          provider: { not: input.provider },
        },
        data: { enabled: false },
      });
    }

    const savedConfig = await tx.aiProviderConfig.upsert({
      where: {
        organisationId_provider: {
          organisationId: auth.organisationId,
          provider: input.provider,
        },
      },
      create: {
        organisationId: auth.organisationId,
        provider: input.provider,
        baseUrl,
        model: input.model,
        enabled: input.enabled,
        visionEnabled: input.visionEnabled,
        timeoutMs: input.timeoutMs,
        maxImageBytes: input.maxImageBytes,
        ...(encrypted
          ? {
              apiKeyCiphertext: encrypted.ciphertext,
              apiKeyIv: encrypted.iv,
              apiKeyAuthTag: encrypted.authTag,
              apiKeyLastFour: encrypted.lastFour,
            }
          : {}),
      },
      update: {
        baseUrl,
        model: input.model,
        enabled: input.enabled,
        visionEnabled: input.visionEnabled,
        timeoutMs: input.timeoutMs,
        maxImageBytes: input.maxImageBytes,
        ...(encrypted
          ? {
              apiKeyCiphertext: encrypted.ciphertext,
              apiKeyIv: encrypted.iv,
              apiKeyAuthTag: encrypted.authTag,
              apiKeyLastFour: encrypted.lastFour,
            }
          : {}),
      },
    });

    await tx.auditEvent.create({
      data: {
        organisationId: auth.organisationId,
        actorId: auth.userId,
        action: "AI_PROVIDER_CONFIG_UPDATE",
        entityType: "AiProviderConfig",
        entityId: savedConfig.id,
        outcome: "SUCCESS",
        requestId: request.requestId,
        metadata: {
          provider: savedConfig.provider,
          model: savedConfig.model,
          enabled: savedConfig.enabled,
          visionEnabled: savedConfig.visionEnabled,
          apiKeyChanged: Boolean(encrypted),
        },
      },
    });

    return savedConfig;
  });

  response.json({
    saved: true,
    provider: serialiseProvider(saved),
  });
});

router.post("/ai-providers/test", async (request, response) => {
  const input = testSchema.parse(request.body);
  const auth = request.auth!;

  let runtime: ProviderRuntimeConfig;

  if (!input.useStoredProvider) {
    const draft = draftTestSchema.parse(input);
    const baseUrl = await normaliseBaseUrl(draft.provider, draft.baseUrl);

    runtime = {
      provider: draft.provider,
      baseUrl,
      model: draft.model,
      apiKey: draft.apiKey,
      timeoutMs: draft.timeoutMs,
      maxImageBytes: 25 * 1024 * 1024,
    };
  } else {
    const stored = await prisma.aiProviderConfig.findFirst({
      where: {
        organisationId: auth.organisationId,
        enabled: true,
        visionEnabled: true,
        ...(input.provider ? { provider: input.provider } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!stored) {
      throw new AppError(
        422,
        "PROVIDER_NOT_CONFIGURED",
        "Save and enable an AI provider before testing it",
      );
    }

    const key = decryptSecret(
      stored,
      `${stored.organisationId}:${stored.provider}`,
    );
    if (!key) {
      throw new AppError(
        422,
        "API_KEY_REQUIRED",
        "The stored provider has no API key",
      );
    }

    runtime = {
      provider: stored.provider,
      baseUrl: stored.baseUrl,
      model: stored.model,
      apiKey: key,
      timeoutMs: stored.timeoutMs,
      maxImageBytes: stored.maxImageBytes,
    };
  }

  createVisionProvider(runtime);
  const result = await verifyVisionProvider(runtime);

  await prisma.auditEvent.create({
    data: {
      organisationId: auth.organisationId,
      actorId: auth.userId,
      action: "AI_PROVIDER_VISION_TEST",
      entityType: "AiProviderConfig",
      outcome: "SUCCESS",
      requestId: request.requestId,
      metadata: {
        provider: runtime.provider,
        model: runtime.model,
        ...result,
      },
    },
  });

  response.json({
    status: "verified",
    provider: runtime.provider,
    model: runtime.model,
    schemaValid: true,
    ...result,
  });
});

export default router;
