import { describe, expect, it } from "vitest";
import {
  canCreateCase,
  canReadAudit,
  canReviewCase,
  canUploadImage,
} from "./ui-permissions";

describe("UI permission guidance", () => {
  it("matches the server role model for common actions", () => {
    expect(canCreateCase("TECHNICIAN")).toBe(true);
    expect(canCreateCase("ADMIN")).toBe(false);
    expect(canReadAudit("ADMIN")).toBe(true);
    expect(canUploadImage("TECHNICIAN", "DRAFT")).toBe(true);
    expect(canUploadImage("TECHNICIAN", "APPROVED")).toBe(false);
    expect(
      canReviewCase("MICROBIOLOGIST", "SUBMITTED_FOR_REVIEW"),
    ).toBe(true);
    expect(canReviewCase("TECHNICIAN", "SUBMITTED_FOR_REVIEW")).toBe(false);
  });
});
