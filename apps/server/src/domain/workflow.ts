import { CaseStatus, Role } from "@prisma/client";
import { AppError } from "../errors";

const allowedTransitions: Record<CaseStatus, readonly CaseStatus[]> = {
  [CaseStatus.DRAFT]: [CaseStatus.IMAGE_UPLOADED],
  [CaseStatus.IMAGE_UPLOADED]: [CaseStatus.DRAFT, CaseStatus.QC_COMPLETED],
  [CaseStatus.QC_COMPLETED]: [
    CaseStatus.DRAFT,
    CaseStatus.IMAGE_UPLOADED,
    CaseStatus.TRIAGE_COMPLETED,
  ],
  [CaseStatus.TRIAGE_COMPLETED]: [
    CaseStatus.DRAFT,
    CaseStatus.IMAGE_UPLOADED,
    CaseStatus.SUBMITTED_FOR_REVIEW,
  ],
  [CaseStatus.SUBMITTED_FOR_REVIEW]: [
    CaseStatus.APPROVED,
    CaseStatus.REJECTED,
  ],
  [CaseStatus.APPROVED]: [CaseStatus.FINALISED],
  [CaseStatus.REJECTED]: [CaseStatus.DRAFT, CaseStatus.IMAGE_UPLOADED],
  [CaseStatus.FINALISED]: [],
};

export function assertTransition(
  from: CaseStatus,
  to: CaseStatus,
  role: Role,
): void {
  if (!(allowedTransitions[from] ?? []).includes(to)) {
    throw new AppError(
      409,
      "INVALID_WORKFLOW_TRANSITION",
      `Cannot transition case from ${from} to ${to}`,
    );
  }

  if (
    [CaseStatus.APPROVED, CaseStatus.REJECTED].includes(to) &&
    ![Role.MICROBIOLOGIST, Role.SUPERVISOR].includes(role)
  ) {
    throw new AppError(
      403,
      "REVIEW_ROLE_REQUIRED",
      "Only a microbiologist or supervisor can review a case",
    );
  }

  if (to === CaseStatus.FINALISED && role !== Role.SUPERVISOR) {
    throw new AppError(
      403,
      "SUPERVISOR_REQUIRED",
      "Only a laboratory supervisor can finalise a case",
    );
  }
}

export function isCaseMutable(status: CaseStatus): boolean {
  return ![
    CaseStatus.SUBMITTED_FOR_REVIEW,
    CaseStatus.APPROVED,
    CaseStatus.FINALISED,
  ].includes(status);
}
