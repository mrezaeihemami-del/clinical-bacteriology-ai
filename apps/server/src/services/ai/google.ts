import { GoogleGenAI } from "@google/genai";
import {
  colourProbeJsonSchema,
  colourProbeSchema,
  visionAnalysisSchema,
  visionJsonSchema,
} from "./schema";
import {
  colourProbePrompt,
  plateObservationPrompt,
  type ImageInput,
  type ProviderRuntimeConfig,
  type VisionProvider,
  withTimeout,
} from "./provider";
import { AppError } from "../../errors";

function extractJsonText(text: string | undefined): unknown {
  if (!text) {
    throw new AppError(
      502,
      "AI_EMPTY_RESPONSE",
      "The AI provider returned an empty response",
    );
  }

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AppError(
      502,
      "AI_INVALID_JSON",
      "The AI provider returned invalid JSON",
    );
  }
}

export class GoogleVisionProvider implements VisionProvider {
  private readonly client: GoogleGenAI;

  constructor(private readonly config: ProviderRuntimeConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async analysePlateImage(input: ImageInput) {
    const response = await withTimeout(
      this.client.models.generateContent({
        model: this.config.model,
        contents: [
          {
            inlineData: {
              mimeType: input.mimeType,
              data: input.bytes.toString("base64"),
            },
          },
          { text: plateObservationPrompt() },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: visionJsonSchema as never,
          temperature: 0,
        },
      }),
      this.config.timeoutMs,
    );

    const raw = extractJsonText(response.text);
    const parsed = visionAnalysisSchema.safeParse(raw);

    if (!parsed.success) {
      throw new AppError(
        502,
        "AI_SCHEMA_VALIDATION_FAILED",
        "The AI response did not match the required schema",
        parsed.error.flatten(),
      );
    }

    return {
      analysis: parsed.data,
      redactedRawResponse: parsed.data,
    };
  }

  async probeDominantColour(input: ImageInput) {
    const response = await withTimeout(
      this.client.models.generateContent({
        model: this.config.model,
        contents: [
          {
            inlineData: {
              mimeType: input.mimeType,
              data: input.bytes.toString("base64"),
            },
          },
          { text: colourProbePrompt() },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: colourProbeJsonSchema as never,
          temperature: 0,
        },
      }),
      this.config.timeoutMs,
    );

    const raw = extractJsonText(response.text);
    const parsed = colourProbeSchema.safeParse(raw);

    if (!parsed.success) {
      throw new AppError(
        502,
        "AI_PROBE_SCHEMA_FAILED",
        "The vision probe returned an invalid response",
      );
    }

    return parsed.data.dominantColour;
  }
}
