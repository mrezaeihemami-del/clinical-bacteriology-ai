import {
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
} from "./provider";
import { assertSafeProviderBaseUrl } from "../../security/url";
import { AppError } from "../../errors";
import { postJsonWithGuardedDns } from "../../security/safe-http";

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class OpenAiCompatibleVisionProvider implements VisionProvider {
  constructor(private readonly config: ProviderRuntimeConfig) {}

  private async request(
    input: ImageInput,
    prompt: string,
    schemaName: string,
    schema: unknown,
  ): Promise<unknown> {
    const baseUrl = await assertSafeProviderBaseUrl(this.config.baseUrl);
    const endpoint = new URL(
      `${baseUrl.pathname.replace(/\/$/, "")}/chat/completions`,
      baseUrl.origin,
    );

    const result = await postJsonWithGuardedDns<ChatResponse>({
      url: endpoint,
      timeoutMs: this.config.timeoutMs,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: {
        model: this.config.model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${input.mimeType};base64,${input.bytes.toString("base64")}`,
                },
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema,
          },
        },
      },
    });

    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new AppError(
        502,
        "AI_PROVIDER_ERROR",
        `AI provider returned HTTP ${result.statusCode}`,
      );
    }

    const content = result.payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError(
        502,
        "AI_EMPTY_RESPONSE",
        "AI provider returned no message content",
      );
    }

    try {
      return JSON.parse(content);
    } catch {
      throw new AppError(
        502,
        "AI_INVALID_JSON",
        "AI provider returned invalid JSON",
      );
    }
  }

  async analysePlateImage(input: ImageInput) {
    const raw = await this.request(
      input,
      plateObservationPrompt(),
      "vision_analysis",
      visionJsonSchema,
    );
    const parsed = visionAnalysisSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        502,
        "AI_SCHEMA_VALIDATION_FAILED",
        "AI output did not match the required schema",
        parsed.error.flatten(),
      );
    }

    return {
      analysis: parsed.data,
      redactedRawResponse: parsed.data,
    };
  }

  async probeDominantColour(input: ImageInput) {
    const raw = await this.request(
      input,
      colourProbePrompt(),
      "colour_probe",
      {
        type: "object",
        additionalProperties: false,
        required: ["dominantColour"],
        properties: {
          dominantColour: {
            type: "string",
            enum: ["red", "blue", "other", "unable_to_assess"],
          },
        },
      },
    );

    const parsed = colourProbeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        502,
        "AI_PROBE_SCHEMA_FAILED",
        "Vision probe output did not match its schema",
      );
    }

    return parsed.data.dominantColour;
  }
}
