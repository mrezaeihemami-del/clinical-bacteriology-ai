import type { AiProvider } from "@prisma/client";
import type { VisionAnalysis } from "./schema";

export type ProviderRuntimeConfig = {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxImageBytes: number;
};

export type ImageInput = {
  bytes: Buffer;
  mimeType: string;
};

export interface VisionProvider {
  analysePlateImage(input: ImageInput): Promise<{
    analysis: VisionAnalysis;
    redactedRawResponse: unknown;
  }>;
  probeDominantColour(
    input: ImageInput,
  ): Promise<"red" | "blue" | "other" | "unable_to_assess">;
}

export function plateObservationPrompt(): string {
  return [
    "You are acting as an expert Senior Clinical Microbiologist and diagnostic decision support system.",
    "Your objective is to provide high-precision clinical observation of agar culture plate images for diagnostic laboratory workflows.",
    "1. Identify medium type if visible (EMB, MacConkey, Blood Agar, Chromogenic, Nutrient). Note differential features (e.g. lactose fermentation, metallic sheen on EMB, hemolysis type alpha/beta/gamma on Blood Agar).",
    "2. Evaluate 3D colonial morphology: elevation (flat, convex, pulvinate, umbonate), margins (smooth/entire, lobate, filamentous, serrated), pigmentation/chromogenesis, and optical clarity (translucent, opaque, shiny).",
    "3. Formulate a preliminary Gram reaction hypothesis (gram_negative_suspected vs gram_positive_suspected) based on selective media growth (e.g. growth on EMB/MacConkey strongly indicates Gram-negative enterics/non-fermenters).",
    "4. Provide highly specific microbiological observations that aid the laboratory technologist in deciding next steps (e.g. oxidase test, spot indole, subculture, or incubation extension).",
    "If image quality is poor (blur, glare, cropping), explicitly document limitations in the quality issues.",
    "requiresHumanReview must always be true.",
    "Return JSON matching the supplied schema exactly.",
  ].join("\n");
}

export function colourProbePrompt(): string {
  return [
    "Inspect only the pixels in this test image.",
    "Return the dominant colour as red, blue, other, or unable_to_assess.",
    "Return JSON matching the supplied schema exactly.",
  ].join("\n");
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`AI request timed out after ${timeoutMs} ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
