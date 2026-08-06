import { z } from "zod";

export const visionAnalysisSchema = z.object({
  imageQuality: z.enum([
    "adequate",
    "borderline",
    "inadequate",
    "unknown",
  ]),
  qualityIssues: z
    .array(
      z.enum([
        "blur",
        "glare",
        "overexposure",
        "underexposure",
        "cropping",
        "obstruction",
        "low_resolution",
        "unknown",
      ]),
    )
    .max(10),
  growthPattern: z.enum([
    "no_visible_growth",
    "single_morphotype_suspected",
    "multiple_morphotypes_suspected",
    "confluent_growth",
    "unable_to_assess",
  ]),
  gramStainHypothesis: z.enum([
    "gram_negative_suspected",
    "gram_positive_suspected",
    "mixed_flora_suspected",
    "unable_to_assess",
  ]),
  mediumTypeIdentified: z.enum([
    "EMB_agar",
    "Blood_agar",
    "MacConkey_agar",
    "Chromogenic_agar",
    "Nutrient_agar",
    "other_or_unknown",
  ]),
  threeDimensionalMorphology: z.object({
    elevation: z.string().max(100),
    margin: z.string().max(100),
    pigmentation: z.string().max(100),
    opticalProperty: z.string().max(100),
  }),
  observations: z.array(z.string().min(1).max(300)).max(10),
  confidence: z.number().min(0).max(1),
  requiresHumanReview: z.literal(true),
  limitations: z.array(z.string().min(1).max(300)).min(1).max(10),
});

export type VisionAnalysis = z.infer<typeof visionAnalysisSchema>;

export const colourProbeSchema = z.object({
  dominantColour: z.enum(["red", "blue", "other", "unable_to_assess"]),
});

export const VISION_SCHEMA_VERSION = "vision-analysis-v2-gram-bypass";
export const VISION_PROMPT_VERSION = "agar-visual-observation-v3-3d-morphology";

export const visionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "imageQuality",
    "qualityIssues",
    "growthPattern",
    "gramStainHypothesis",
    "mediumTypeIdentified",
    "threeDimensionalMorphology",
    "observations",
    "confidence",
    "requiresHumanReview",
    "limitations",
  ],
  properties: {
    imageQuality: {
      type: "string",
      enum: ["adequate", "borderline", "inadequate", "unknown"],
    },
    qualityIssues: {
      type: "array",
      maxItems: 10,
      items: {
        type: "string",
        enum: [
          "blur",
          "glare",
          "overexposure",
          "underexposure",
          "cropping",
          "obstruction",
          "low_resolution",
          "unknown",
        ],
      },
    },
    growthPattern: {
      type: "string",
      enum: [
        "no_visible_growth",
        "single_morphotype_suspected",
        "multiple_morphotypes_suspected",
        "confluent_growth",
        "unable_to_assess",
      ],
    },
    gramStainHypothesis: {
      type: "string",
      enum: [
        "gram_negative_suspected",
        "gram_positive_suspected",
        "mixed_flora_suspected",
        "unable_to_assess",
      ],
    },
    mediumTypeIdentified: {
      type: "string",
      enum: [
        "EMB_agar",
        "Blood_agar",
        "MacConkey_agar",
        "Chromogenic_agar",
        "Nutrient_agar",
        "other_or_unknown",
      ],
    },
    threeDimensionalMorphology: {
      type: "object",
      additionalProperties: false,
      required: ["elevation", "margin", "pigmentation", "opticalProperty"],
      properties: {
        elevation: { type: "string", maxLength: 100 },
        margin: { type: "string", maxLength: 100 },
        pigmentation: { type: "string", maxLength: 100 },
        opticalProperty: { type: "string", maxLength: 100 },
      },
    },
    observations: {
      type: "array",
      maxItems: 10,
      items: { type: "string", maxLength: 300 },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    requiresHumanReview: { type: "boolean" },
    limitations: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: { type: "string", maxLength: 300 },
    },
  },
} as const;

export const colourProbeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dominantColour"],
  properties: {
    dominantColour: {
      type: "string",
      enum: ["red", "blue", "other", "unable_to_assess"],
    },
  },
} as const;
