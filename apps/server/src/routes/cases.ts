import { Router } from "express";
import {
  CaseStatus,
  ReviewDecision,
  Role,
  SpecimenType,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { AppError, assertFound } from "../errors";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import {
  assertTransition,
  isCaseMutable,
} from "../domain/workflow";
import { hasPermission } from "../domain/permissions";
import { writeAudit } from "../services/audit";

const router = Router();

const caseInputSchema = z.object({
  caseCode: z
    .string()
    .trim()
    .min(3, "Case code must contain at least 3 characters")
    .max(64, "Case code must contain at most 64 characters"),
  specimenType: z.nativeEnum(SpecimenType),
  collectionDate: z.coerce.date(),
  cultureMedia: z
    .string()
    .trim()
    .min(1, "Culture media is required")
    .max(200, "Culture media must contain at most 200 characters"),
  incubationHours: z.coerce.number().int().min(0).max(240),
  gramStainAvailable: z.boolean().default(false),
  gramStainResult: z.string().trim().max(1000).optional().nullable(),
  microscopyAvailable: z.boolean().default(false),
  microscopyResult: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

const caseUpdateSchema = caseInputSchema.partial().omit({
  caseCode: true,
});

const reviewSchema = z.object({
  decision: z.nativeEnum(ReviewDecision),
  comments: z.string().trim().max(4000).optional(),
  overrideReason: z.string().trim().min(20).max(2000).optional(),
});

router.use(requireAuth, requirePermission("case:read"));

router.get("/", async (request, response) => {
  const status = request.query.status
    ? z.nativeEnum(CaseStatus).parse(request.query.status)
    : undefined;

  const cases = await prisma.case.findMany({
    where: {
      organisationId: request.auth!.organisationId,
      archivedAt: null,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      caseCode: true,
      specimenType: true,
      collectionDate: true,
      cultureMedia: true,
      incubationHours: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          images: {
            where: { deletedAt: null },
          },
        },
      },
    },
  });

  response.json({ cases });
});

router.get("/:caseId", async (request, response) => {
  const item = await prisma.case.findFirst({
    where: {
      id: request.params.caseId,
      organisationId: request.auth!.organisationId,
      archivedAt: null,
    },
    include: {
      images: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: "desc" },
        include: {
          analyses: {
            orderBy: { startedAt: "desc" },
            take: 5,
          },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: {
            select: {
              displayName: true,
              email: true,
            },
          },
        },
      },
      transitions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  assertFound(item, "Case not found");
  response.json({ case: item });
});

router.post(
  "/",
  requirePermission("case:create"),
  async (request, response) => {
    const input = caseInputSchema.parse(request.body);
    const auth = request.auth!;

    const item = await prisma.case.create({
      data: {
        organisationId: auth.organisationId,
        createdById: auth.userId,
        caseCode: input.caseCode,
        specimenType: input.specimenType,
        collectionDate: input.collectionDate,
        cultureMedia: input.cultureMedia,
        incubationHours: input.incubationHours,
        gramStainAvailable: input.gramStainAvailable,
        gramStainResult: input.gramStainAvailable
          ? input.gramStainResult ?? null
          : null,
        microscopyAvailable: input.microscopyAvailable,
        microscopyResult: input.microscopyAvailable
          ? input.microscopyResult ?? null
          : null,
        notes: input.notes ?? null,
      },
    });

    await writeAudit({
      organisationId: auth.organisationId,
      actorId: auth.userId,
      caseId: item.id,
      action: "CASE_CREATE",
      entityType: "Case",
      entityId: item.id,
      outcome: "SUCCESS",
      requestId: request.requestId,
      metadata: {
        caseCode: item.caseCode,
        specimenType: item.specimenType,
      },
    });

    response.status(201).json({ case: item });
  },
);

router.patch(
  "/:caseId",
  requirePermission("case:edit"),
  async (request, response) => {
    const input = caseUpdateSchema.parse(request.body);
    const auth = request.auth!;

    const existing = await prisma.case.findFirst({
      where: {
        id: request.params.caseId,
        organisationId: auth.organisationId,
        archivedAt: null,
      },
    });
    assertFound(existing, "Case not found");

    if (!isCaseMutable(existing.status)) {
      throw new AppError(
        409,
        "CASE_LOCKED",
        `Case cannot be edited in status ${existing.status}`,
      );
    }

    const analysisInvalidated = [
      CaseStatus.QC_COMPLETED,
      CaseStatus.TRIAGE_COMPLETED,
      CaseStatus.REJECTED,
    ].includes(existing.status);
    const nextStatus = analysisInvalidated
      ? CaseStatus.IMAGE_UPLOADED
      : existing.status;

    if (analysisInvalidated) {
      assertTransition(existing.status, nextStatus, auth.role);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const moved = await tx.case.updateMany({
        where: {
          id: existing.id,
          status: existing.status,
          archivedAt: null,
        },
        data: {
          ...(input.specimenType !== undefined
            ? { specimenType: input.specimenType }
            : {}),
          ...(input.collectionDate !== undefined
            ? { collectionDate: input.collectionDate }
            : {}),
          ...(input.cultureMedia !== undefined
            ? { cultureMedia: input.cultureMedia }
            : {}),
          ...(input.incubationHours !== undefined
            ? { incubationHours: input.incubationHours }
            : {}),
          ...(input.gramStainAvailable !== undefined
            ? { gramStainAvailable: input.gramStainAvailable }
            : {}),
          ...(input.gramStainAvailable === false
            ? { gramStainResult: null }
            : input.gramStainResult !== undefined
              ? { gramStainResult: input.gramStainResult }
              : {}),
          ...(input.microscopyAvailable !== undefined
            ? { microscopyAvailable: input.microscopyAvailable }
            : {}),
          ...(input.microscopyAvailable === false
            ? { microscopyResult: null }
            : input.microscopyResult !== undefined
              ? { microscopyResult: input.microscopyResult }
              : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(analysisInvalidated ? { status: nextStatus } : {}),
        },
      });

      if (moved.count !== 1) {
        throw new AppError(
          409,
          "CONCURRENT_CASE_CHANGE",
          "The case changed before the update could be saved",
        );
      }

      if (analysisInvalidated) {
        await tx.caseStatusTransition.create({
          data: {
            caseId: existing.id,
            fromStatus: existing.status,
            toStatus: nextStatus,
            actorId: auth.userId,
            reason: "Case metadata changed; prior AI workflow state invalidated",
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          organisationId: auth.organisationId,
          actorId: auth.userId,
          caseId: existing.id,
          action: "CASE_UPDATE",
          entityType: "Case",
          entityId: existing.id,
          outcome: "SUCCESS",
          requestId: request.requestId,
          metadata: {
            changedFields: Object.keys(input),
            analysisInvalidated,
          },
        },
      });

      return await tx.case.findUniqueOrThrow({
        where: { id: existing.id },
      });
    });

    response.json({ case: updated });
  },
);

router.delete(
  "/:caseId",
  requirePermission("case:delete"),
  async (request, response) => {
    const auth = request.auth!;
    const existing = await prisma.case.findFirst({
      where: {
        id: request.params.caseId,
        organisationId: auth.organisationId,
        archivedAt: null,
      },
      include: {
        images: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });
    assertFound(existing, "Case not found");

    if (existing.status !== CaseStatus.DRAFT || existing.images.length > 0) {
      throw new AppError(
        409,
        "CASE_CANNOT_BE_ARCHIVED",
        "Only an empty draft case can be archived",
      );
    }

    await prisma.case.update({
      where: { id: existing.id },
      data: { archivedAt: new Date() },
    });

    await writeAudit({
      organisationId: auth.organisationId,
      actorId: auth.userId,
      caseId: existing.id,
      action: "CASE_ARCHIVE",
      entityType: "Case",
      entityId: existing.id,
      outcome: "SUCCESS",
      requestId: request.requestId,
    });

    response.status(204).send();
  },
);

router.post(
  "/:caseId/submit",
  requirePermission("case:submit"),
  async (request, response) => {
    const auth = request.auth!;
    const existing = await prisma.case.findFirst({
      where: {
        id: request.params.caseId,
        organisationId: auth.organisationId,
        archivedAt: null,
      },
      include: {
        images: {
          where: { deletedAt: null },
          include: {
            analyses: {
              where: { status: "SUCCESS" },
              orderBy: { completedAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    assertFound(existing, "Case not found");

    if (existing.status !== CaseStatus.TRIAGE_COMPLETED) {
      throw new AppError(
        409,
        "CASE_NOT_READY_FOR_REVIEW",
        "A successful visual analysis is required before submission",
      );
    }

    const hasSuccessfulAnalysis = existing.images.some(
      (image) => image.analyses.length > 0,
    );
    if (!hasSuccessfulAnalysis) {
      throw new AppError(
        409,
        "ANALYSIS_REQUIRED",
        "No successful image analysis is available",
      );
    }

    assertTransition(
      existing.status,
      CaseStatus.SUBMITTED_FOR_REVIEW,
      auth.role,
    );

    await prisma.$transaction(async (tx) => {
      const moved = await tx.case.updateMany({
        where: {
          id: existing.id,
          status: CaseStatus.TRIAGE_COMPLETED,
        },
        data: { status: CaseStatus.SUBMITTED_FOR_REVIEW },
      });
      if (moved.count !== 1) {
        throw new AppError(
          409,
          "CONCURRENT_CASE_CHANGE",
          "The case status changed before submission completed",
        );
      }
      await tx.caseStatusTransition.create({
        data: {
          caseId: existing.id,
          fromStatus: existing.status,
          toStatus: CaseStatus.SUBMITTED_FOR_REVIEW,
          actorId: auth.userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          organisationId: auth.organisationId,
          actorId: auth.userId,
          caseId: existing.id,
          action: "CASE_SUBMIT_FOR_REVIEW",
          entityType: "Case",
          entityId: existing.id,
          outcome: "SUCCESS",
          requestId: request.requestId,
        },
      });
    });

    response.json({ status: CaseStatus.SUBMITTED_FOR_REVIEW });
  },
);

router.post(
  "/:caseId/reviews",
  requirePermission("case:review"),
  async (request, response) => {
    const input = reviewSchema.parse(request.body);
    const auth = request.auth!;

    const existing = await prisma.case.findFirst({
      where: {
        id: request.params.caseId,
        organisationId: auth.organisationId,
        archivedAt: null,
      },
      include: {
        images: {
          where: { deletedAt: null },
          include: {
            analyses: {
              where: { status: "SUCCESS" },
              orderBy: { completedAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    assertFound(existing, "Case not found");

    if (existing.status !== CaseStatus.SUBMITTED_FOR_REVIEW) {
      throw new AppError(
        409,
        "CASE_NOT_AWAITING_REVIEW",
        "Case is not awaiting microbiologist review",
      );
    }

    if (
      input.decision === ReviewDecision.OVERRIDDEN &&
      !hasPermission(auth.role, "case:override")
    ) {
      throw new AppError(
        403,
        "SUPERVISOR_OVERRIDE_REQUIRED",
        "Only a supervisor can override a recommendation",
      );
    }

    if (
      input.decision === ReviewDecision.OVERRIDDEN &&
      !input.overrideReason
    ) {
      throw new AppError(
        422,
        "OVERRIDE_REASON_REQUIRED",
        "A detailed override reason is required",
      );
    }

    const latestAnalysis = existing.images
      .flatMap((image) => image.analyses)
      .sort(
        (a, b) =>
          (b.completedAt?.getTime() ?? 0) -
          (a.completedAt?.getTime() ?? 0),
      )[0];
    assertFound(latestAnalysis, "A successful analysis is required");

    const nextStatus =
      input.decision === ReviewDecision.REJECTED
        ? CaseStatus.REJECTED
        : CaseStatus.APPROVED;

    assertTransition(existing.status, nextStatus, auth.role);

    const review = await prisma.$transaction(async (tx) => {
      const moved = await tx.case.updateMany({
        where: {
          id: existing.id,
          status: CaseStatus.SUBMITTED_FOR_REVIEW,
        },
        data: { status: nextStatus },
      });
      if (moved.count !== 1) {
        throw new AppError(
          409,
          "CONCURRENT_REVIEW",
          "This case has already been reviewed or changed",
        );
      }

      const created = await tx.reviewDecisionRecord.create({
        data: {
          caseId: existing.id,
          reviewerId: auth.userId,
          decision: input.decision,
          comments: input.comments ?? null,
          overrideReason: input.overrideReason ?? null,
          analysisId: latestAnalysis.id,
        },
      });

      await tx.caseStatusTransition.create({
        data: {
          caseId: existing.id,
          fromStatus: existing.status,
          toStatus: nextStatus,
          actorId: auth.userId,
          reason: input.overrideReason ?? input.comments ?? null,
        },
      });

      await tx.auditEvent.create({
        data: {
          organisationId: auth.organisationId,
          actorId: auth.userId,
          caseId: existing.id,
          action: `CASE_REVIEW_${input.decision}`,
          entityType: "ReviewDecisionRecord",
          entityId: created.id,
          outcome: "SUCCESS",
          requestId: request.requestId,
          metadata: {
            analysisId: latestAnalysis.id,
            decision: input.decision,
          },
        },
      });

      return created;
    });

    response.status(201).json({ review, status: nextStatus });
  },
);

router.post(
  "/:caseId/finalise",
  requirePermission("case:override"),
  async (request, response) => {
    const auth = request.auth!;
    if (auth.role !== Role.SUPERVISOR) {
      throw new AppError(
        403,
        "SUPERVISOR_REQUIRED",
        "Only a supervisor can finalise a case",
      );
    }

    const existing = await prisma.case.findFirst({
      where: {
        id: request.params.caseId,
        organisationId: auth.organisationId,
        archivedAt: null,
      },
    });
    assertFound(existing, "Case not found");
    assertTransition(existing.status, CaseStatus.FINALISED, auth.role);

    await prisma.$transaction(async (tx) => {
      const moved = await tx.case.updateMany({
        where: {
          id: existing.id,
          status: CaseStatus.APPROVED,
        },
        data: { status: CaseStatus.FINALISED },
      });
      if (moved.count !== 1) {
        throw new AppError(
          409,
          "CONCURRENT_CASE_CHANGE",
          "The case status changed before finalisation completed",
        );
      }
      await tx.caseStatusTransition.create({
        data: {
          caseId: existing.id,
          fromStatus: existing.status,
          toStatus: CaseStatus.FINALISED,
          actorId: auth.userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          organisationId: auth.organisationId,
          actorId: auth.userId,
          caseId: existing.id,
          action: "CASE_FINALISE",
          entityType: "Case",
          entityId: existing.id,
          outcome: "SUCCESS",
          requestId: request.requestId,
        },
      });
    });

    response.json({ status: CaseStatus.FINALISED });
  },
);

export default router;
