import { AiProvider } from "@prisma/client";
import sharp from "sharp";
import { prisma } from "../../db";
import { config } from "../../config";
import { AppError } from "../../errors";
import { decryptSecret } from "../../security/crypto";
import { GoogleVisionProvider } from "./google";
import { OpenAiCompatibleVisionProvider } from "./openai-compatible";
import type {
  ProviderRuntimeConfig,
  VisionProvider,
} from "./provider";

export async function getProviderRuntimeConfig(
  organisationId: string,
): Promise<ProviderRuntimeConfig | null> {
  const stored = await prisma.aiProviderConfig.findFirst({
    where: {
      organisationId,
      enabled: true,
      visionEnabled: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (stored) {
    const apiKey = decryptSecret(stored, `${stored.organisationId}:${stored.provider}`);
    if (!apiKey) return null;

    return {
      provider: stored.provider,
      baseUrl: stored.baseUrl,
      model: stored.model,
      apiKey,
      timeoutMs: stored.timeoutMs,
      maxImageBytes: stored.maxImageBytes,
    };
  }

  if (config.GOOGLE_GEMINI_API_KEY) {
    return {
      provider: AiProvider.GOOGLE_NATIVE,
      baseUrl: "https://generativelanguage.googleapis.com",
      model: config.GOOGLE_GEMINI_MODEL,
      apiKey: config.GOOGLE_GEMINI_API_KEY,
      timeoutMs: config.ANALYSIS_TIMEOUT_MS,
      maxImageBytes: config.MAX_UPLOAD_BYTES,
    };
  }

  return null;
}

export function createVisionProvider(
  runtime: ProviderRuntimeConfig,
): VisionProvider {
  switch (runtime.provider) {
    case AiProvider.GOOGLE_NATIVE:
      return new GoogleVisionProvider(runtime);
    case AiProvider.OPENAI_COMPATIBLE:
      return new OpenAiCompatibleVisionProvider(runtime);
    default:
      throw new AppError(
        422,
        "UNSUPPORTED_AI_PROVIDER",
        `Unsupported provider ${String(runtime.provider)}`,
      );
  }
}

async function solidColourPng(
  red: number,
  green: number,
  blue: number,
): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: red, g: green, b: blue },
    },
  })
    .png()
    .toBuffer();
}

export async function verifyVisionProvider(
  runtime: ProviderRuntimeConfig,
): Promise<{
  imageTransportVerified: true;
  visualDifferenceVerified: true;
  redResult: "red";
  blueResult: "blue";
  latencyMs: number;
}> {
  const provider = createVisionProvider(runtime);
  const redImage = await solidColourPng(255, 0, 0);
  const blueImage = await solidColourPng(0, 0, 255);
  const started = Date.now();

  const redResult = await provider.probeDominantColour({
    bytes: redImage,
    mimeType: "image/png",
  });
  const blueResult = await provider.probeDominantColour({
    bytes: blueImage,
    mimeType: "image/png",
  });

  if (redResult !== "red" || blueResult !== "blue") {
    throw new AppError(
      422,
      "VISION_PROBE_FAILED",
      `Provider did not distinguish controlled images: red=${redResult}, blue=${blueResult}`,
    );
  }

  return {
    imageTransportVerified: true,
    visualDifferenceVerified: true,
    redResult,
    blueResult,
    latencyMs: Date.now() - started,
  };
}
