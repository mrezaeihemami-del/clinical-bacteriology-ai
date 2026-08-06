import { describe, expect, it } from "vitest";
import { CaseStatus, Role } from "@prisma/client";
import { assertTransition, isCaseMutable } from "./workflow";

describe("workflow", () => {
  it("allows the expected upload and review path", () => {
    expect(() =>
      assertTransition(
        CaseStatus.DRAFT,
        CaseStatus.IMAGE_UPLOADED,
        Role.TECHNICIAN,
      ),
    ).not.toThrow();

    expect(() =>
      assertTransition(
        CaseStatus.SUBMITTED_FOR_REVIEW,
        CaseStatus.APPROVED,
        Role.MICROBIOLOGIST,
      ),
    ).not.toThrow();
  });

  it("rejects client-side role bypass attempts", () => {
    expect(() =>
      assertTransition(
        CaseStatus.SUBMITTED_FOR_REVIEW,
        CaseStatus.APPROVED,
        Role.TECHNICIAN,
      ),
    ).toThrow(/Only a microbiologist or supervisor/);
  });

  it("locks submitted and finalised cases", () => {
    expect(isCaseMutable(CaseStatus.SUBMITTED_FOR_REVIEW)).toBe(false);
    expect(isCaseMutable(CaseStatus.FINALISED)).toBe(false);
    expect(isCaseMutable(CaseStatus.REJECTED)).toBe(true);
  });
});
