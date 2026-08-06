import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  assertObservationSafety,
  assertSufficientVisualDetail,
} from "./safety";

describe("AI clinical-scope safety", () => {
  it("rejects nearly uniform images before provider analysis", async () => {
    const solid = await sharp({
      create: {
        width: 128,
        height: 128,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    await expect(assertSufficientVisualDetail(solid)).rejects.toMatchObject({
      code: "IMAGE_LACKS_VISUAL_DETAIL",
    });
  });

  it("rejects model observations containing prohibited CFU or organism claims", () => {
    expect(() =>
      assertObservationSafety({
        imageQuality: "adequate",
        qualityIssues: [],
        growthPattern: "single_morphotype_suspected",
        observations: ["Estimated >10^5 CFU/mL of E. coli"],
        confidence: 0.9,
        requiresHumanReview: true,
        limitations: ["Requires review"],
      }),
    ).toThrow(/prohibited diagnostic or quantitative claims/);
  });
});
