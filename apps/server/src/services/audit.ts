import type { Prisma } from "@prisma/client";
import { prisma } from "../db";

type AuditInput = {
  organisationId: string;
  actorId?: string;
  caseId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  outcome: "SUCCESS" | "DENIED" | "FAILED";
  requestId: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAudit(input: AuditInput) {
  await prisma.auditEvent.create({
    data: {
      organisationId: input.organisationId,
      actorId: input.actorId,
      caseId: input.caseId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      outcome: input.outcome,
      requestId: input.requestId,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}
