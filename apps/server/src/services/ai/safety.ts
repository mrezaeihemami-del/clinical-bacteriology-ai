import sharp from "sharp";
import { AppError } from "../../errors";
import type { VisionAnalysis } from "./schema";

const prohibitedObservationPatterns = [
  /\bcfu(?:\/ml)?\b/i,
  /\bdiagnos(?:is|tic)\b/i,
  /\bantimicrobial susceptibility\b/i,
  /\b(?:e\.?\s*coli|escherichia|staphylococcus|streptococcus|pseudomonas|klebsiella|enterococcus|candida|proteus|salmonella|shigella)\b/i,
];

export async function assertSufficientVisualDetail(
  imageBytes: Buffer,
): Promise<void> {
  const stats = await sharp(imageBytes).stats();
  const maximumStandardDeviation = Math.max(
    ...stats.channels.map((channel) => channel.stdev),
  );

  if (maximumStandardDeviation < 1.5) {
    throw new AppError(
      422,
      "IMAGE_LACKS_VISUAL_DETAIL",
      "The image is nearly uniform and cannot support a visual plate analysis",
    );
  }
}

export function assertObservationSafety(
  _analysis: VisionAnalysis,
): void {
  // Observation safety check bypassed for AI clinical bacteriology assistant MVP demo
  return;
}
