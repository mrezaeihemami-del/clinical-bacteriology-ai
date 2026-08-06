import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import {
  AnalysisStatus,
  CaseStatus,
} from "@prisma/client";
import { prisma } from "../db";
import { AppError, assertFound } from "../errors";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { analysisRateLimit } from "../middleware/rate-limits";
import { assertTransition } from "../domain/workflow";
import { isSupportedAiSpecimen } from "../domain/specimen-scope";
import { getPrivateObject } from "../services/storage";
import {
  createVisionProvider,
  getProviderRuntimeConfig,
} from "../services/ai/runtime";
import {
  VISION_PROMPT_VERSION,
  VISION_SCHEMA_VERSION,
} from "../services/ai/schema";
import {
  assertObservationSafety,
  assertSufficientVisualDetail,
} from "../services/ai/safety";

const router = Router();

router.use(requireAuth, requirePermission("case:read"));

router.post(
  "/images/:imageId/analyse",
  requirePermission("analysis:run"),
  analysisRateLimit,
  async (request, response) => {
    const auth = request.auth!;
    const image = await prisma.caseImage.findFirst({
      where: {
        id: request.params.imageId,
        deletedAt: null,
        case: {
          organisationId: auth.organisationId,
          archivedAt: null,
        },
      },
      include: { case: true },
    });
    assertFound(image, "Image not found");

    if (
      ![CaseStatus.IMAGE_UPLOADED, CaseStatus.QC_COMPLETED].includes(
        image.case.status,
      )
    ) {
      throw new AppError(
        409,
        "ANALYSIS_NOT_ALLOWED",
        `Analysis cannot run while the case is ${image.case.status}`,
      );
    }

    const runtime = await getProviderRuntimeConfig(auth.organisationId);

    if (!runtime) {
      const record = await prisma.imageAnalysis.create({
        data: {
          imageId: image.id,
          status: AnalysisStatus.NOT_RUN,
          promptVersion: VISION_PROMPT_VERSION,
          schemaVersion: VISION_SCHEMA_VERSION,
          inputImageSha256: image.sha256,
          failureReason: "No enabled vision provider is configured",
          completedAt: new Date(),
        },
      });

      await prisma.auditEvent.create({
        data: {
          organisationId: auth.organisationId,
          actorId: auth.userId,
          caseId: image.caseId,
          action: "IMAGE_ANALYSIS_NOT_RUN",
          entityType: "ImageAnalysis",
          entityId: record.id,
          outcome: "FAILED",
          requestId: request.requestId,
          metadata: { reason: "provider_not_configured" },
        },
      });

      return response.status(424).json({
        analysis: record,
        error: {
          code: "VISION_PROVIDER_NOT_CONFIGURED",
          message: "Configure an AI provider before running analysis",
          requestId: request.requestId,
        },
      });
    }

    const lockToken = randomUUID();
    const lockExpiresAt = new Date(
      Date.now() + Math.max(runtime.timeoutMs * 2, 120_000),
    );
    const acquired = await prisma.caseImage.updateMany({
      where: {
        id: image.id,
        OR: [
          { analysisLockToken: null },
          { analysisLockExpiresAt: { lt: new Date() } },
        ],
      },
      data: {
        analysisLockToken: lockToken,
        analysisLockExpiresAt: lockExpiresAt,
      },
    });

    if (acquired.count !== 1) {
      throw new AppError(
        409,
        "ANALYSIS_ALREADY_RUNNING",
        "An analysis is already running for this image",
      );
    }

    let pendingId: string | null = null;

    try {
      const pending = await prisma.imageAnalysis.create({
        data: {
          imageId: image.id,
          status: AnalysisStatus.PENDING,
          provider: runtime.provider,
          model: runtime.model,
          promptVersion: VISION_PROMPT_VERSION,
          schemaVersion: VISION_SCHEMA_VERSION,
          inputImageSha256: image.sha256,
        },
      });
      pendingId = pending.id;

      const bytes = await getPrivateObject(image.storageKey);
      if (bytes.length > runtime.maxImageBytes) {
        throw new AppError(
          413,
          "AI_INPUT_TOO_LARGE",
          "Stored image exceeds the configured provider input limit",
        );
      }

      const actualHash = createHash("sha256").update(bytes).digest("hex");

      if (actualHash !== image.sha256) {
        throw new AppError(
          409,
          "IMAGE_INTEGRITY_FAILURE",
          "Stored image hash does not match its database record",
        );
      }

      await assertSufficientVisualDetail(bytes);

      const provider = createVisionProvider(runtime);
      const result = await provider.analysePlateImage({
        bytes,
        mimeType: image.detectedMimeType,
      });
      assertObservationSafety(result.analysis);

      const specimenInScope = isSupportedAiSpecimen(
        image.case.specimenType,
      );
      const suitableForTriage =
        specimenInScope &&
        ["adequate", "borderline"].includes(
          result.analysis.imageQuality,
        ) &&
        result.analysis.growthPattern !== "unable_to_assess";

      const completed = await prisma.$transaction(async (tx) => {
        const analysis = await tx.imageAnalysis.update({
          where: { id: pending.id },
          data: {
            status: AnalysisStatus.SUCCESS,
            imageQuality: result.analysis.imageQuality,
            qualityIssues: result.analysis.qualityIssues,
            growthPattern: result.analysis.growthPattern,
            observations: result.analysis.observations,
            confidence: result.analysis.confidence,
            requiresHumanReview: true,
            limitations: result.analysis.limitations,
            rawResponseRedacted: result.redactedRawResponse as never,
            completedAt: new Date(),
          },
        });

        const currentCase = await tx.case.findUnique({
          where: { id: image.caseId },
          select: { status: true },
        });
        assertFound(currentCase, "Case not found during analysis completion");
        let currentStatus = currentCase.status;

        if (currentStatus === CaseStatus.IMAGE_UPLOADED) {
          assertTransition(
            currentStatus,
            CaseStatus.QC_COMPLETED,
            auth.role,
          );
          const moved = await tx.case.updateMany({
            where: {
              id: image.caseId,
              status: CaseStatus.IMAGE_UPLOADED,
            },
            data: { status: CaseStatus.QC_COMPLETED },
          });

          if (moved.count === 1) {
            await tx.caseStatusTransition.create({
              data: {
                caseId: image.caseId,
                fromStatus: CaseStatus.IMAGE_UPLOADED,
                toStatus: CaseStatus.QC_COMPLETED,
                actorId: auth.userId,
                reason: "Image quality analysis completed",
              },
            });
            currentStatus = CaseStatus.QC_COMPLETED;
          } else {
            const refreshed = await tx.case.findUnique({
              where: { id: image.caseId },
              select: { status: true },
            });
            assertFound(refreshed, "Case disappeared during analysis");
            currentStatus = refreshed.status;
          }
        }

        if (
          suitableForTriage &&
          currentStatus === CaseStatus.QC_COMPLETED
        ) {
          assertTransition(
            currentStatus,
            CaseStatus.TRIAGE_COMPLETED,
            auth.role,
          );
          const moved = await tx.case.updateMany({
            where: {
              id: image.caseId,
              status: CaseStatus.QC_COMPLETED,
            },
            data: { status: CaseStatus.TRIAGE_COMPLETED },
          });

          if (moved.count === 1) {
            await tx.caseStatusTransition.create({
              data: {
                caseId: image.caseId,
                fromStatus: CaseStatus.QC_COMPLETED,
                toStatus: CaseStatus.TRIAGE_COMPLETED,
                actorId: auth.userId,
                reason: "Visual growth-pattern observation completed",
              },
            });
            currentStatus = CaseStatus.TRIAGE_COMPLETED;
          } else {
            const refreshed = await tx.case.findUnique({
              where: { id: image.caseId },
              select: { status: true },
            });
            assertFound(refreshed, "Case disappeared during analysis");
            currentStatus = refreshed.status;
          }
        }

        await tx.auditEvent.create({
          data: {
            organisationId: auth.organisationId,
            actorId: auth.userId,
            caseId: image.caseId,
            action: "IMAGE_ANALYSIS_SUCCESS",
            entityType: "ImageAnalysis",
            entityId: analysis.id,
            outcome: "SUCCESS",
            requestId: request.requestId,
            metadata: {
              provider: runtime.provider,
              model: runtime.model,
              imageSha256: image.sha256,
              promptVersion: VISION_PROMPT_VERSION,
              schemaVersion: VISION_SCHEMA_VERSION,
              specimenInScope,
              suitableForTriage,
            },
          },
        });

        return { analysis, caseStatus: currentStatus };
      });

      response.json(completed);
    } catch (error) {
      const reason =
        error instanceof AppError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message.slice(0, 500)
            : "Unknown AI analysis failure";

      if (pendingId) {
        const failed = await prisma.imageAnalysis.update({
          where: { id: pendingId },
          data: {
            status: AnalysisStatus.FAILED,
            failureReason: reason,
            completedAt: new Date(),
          },
        });

        await prisma.auditEvent.create({
          data: {
            organisationId: auth.organisationId,
            actorId: auth.userId,
            caseId: image.caseId,
            action: "IMAGE_ANALYSIS_FAILED",
            entityType: "ImageAnalysis",
            entityId: failed.id,
            outcome: "FAILED",
            requestId: request.requestId,
            metadata: {
              provider: runtime.provider,
              model: runtime.model,
              reason,
            },
          },
        });
      }

      throw error;
    } finally {
      await prisma.caseImage.updateMany({
        where: {
          id: image.id,
          analysisLockToken: lockToken,
        },
        data: {
          analysisLockToken: null,
          analysisLockExpiresAt: null,
        },
      });
    }
  },
);

export default router;
