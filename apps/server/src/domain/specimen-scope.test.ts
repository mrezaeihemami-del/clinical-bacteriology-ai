import { describe, expect, it } from "vitest";
import { SpecimenType } from "@prisma/client";
import { isSupportedAiSpecimen } from "./specimen-scope";

describe("AI-assisted workflow specimen scope", () => {
  it("allows only the explicitly supported specimen domains to auto-advance", () => {
    expect(isSupportedAiSpecimen(SpecimenType.URINE)).toBe(true);
    expect(isSupportedAiSpecimen(SpecimenType.STERILE_SITE)).toBe(true);
    expect(isSupportedAiSpecimen(SpecimenType.SPUTUM)).toBe(false);
    expect(isSupportedAiSpecimen(SpecimenType.OTHER)).toBe(false);
  });
});
