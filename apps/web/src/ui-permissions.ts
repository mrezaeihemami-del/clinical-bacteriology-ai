import type { CaseStatus, Role } from "./types";

export function canCreateCase(role: Role): boolean {
  return role === "TECHNICIAN" || role === "SUPERVISOR";
}

export function canReadAudit(role: Role): boolean {
  return (
    role === "MICROBIOLOGIST" ||
    role === "SUPERVISOR" ||
    role === "ADMIN"
  );
}

export function canUploadImage(role: Role, status: CaseStatus): boolean {
  return (
    (role === "TECHNICIAN" || role === "SUPERVISOR") &&
    ["DRAFT", "IMAGE_UPLOADED", "QC_COMPLETED", "TRIAGE_COMPLETED", "REJECTED"].includes(
      status,
    )
  );
}

export function canReviewCase(role: Role, status: CaseStatus): boolean {
  return (
    (role === "MICROBIOLOGIST" || role === "SUPERVISOR") &&
    status === "SUBMITTED_FOR_REVIEW"
  );
}
