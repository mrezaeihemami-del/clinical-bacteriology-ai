import { describe, expect, it } from "vitest";
import {
  colourProbeSchema,
  visionAnalysisSchema,
} from "./schema";
import { plateObservationPrompt } from "./provider";

describe("AI schemas and prompt boundaries", () => {
  it("accepts a valid fail-closed visual result", () => {
    const parsed = visionAnalysisSchema.safeParse({
      imageQuality: "inadequate",
      qualityIssues: ["low_resolution"],
      growthPattern: "unable_to_assess",
      observations: [],
      confidence: 0,
      requiresHumanReview: true,
      limitations: ["Image lacks sufficient visible detail"],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects diagnosis-like or structurally invalid output", () => {
    const parsed = visionAnalysisSchema.safeParse({
      imageQuality: "perfect",
      qualityIssues: [],
      growthPattern: "e_coli",
      observations: ["Diagnosis: E. coli"],
      confidence: 1.5,
      requiresHumanReview: false,
      limitations: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("requires actual visual differentiation in the connection probe", () => {
    expect(colourProbeSchema.safeParse({ dominantColour: "red" }).success).toBe(
      true,
    );
    expect(
      colourProbeSchema.safeParse({ dominantColour: "pink_colonies" }).success,
    ).toBe(false);
  });

  it("does not inject filename or clinical notes into the image-only prompt", () => {
    const prompt = plateObservationPrompt().toLowerCase();
    expect(prompt).not.toContain("filename:");
    expect(prompt).not.toContain("clinical notes:");
    expect(prompt).toContain("do not identify an organism");
    expect(prompt).toContain("do not estimate cfu");
  });
});
