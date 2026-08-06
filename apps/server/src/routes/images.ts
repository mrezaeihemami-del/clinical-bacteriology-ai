import { randomUUID } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { CaseStatus } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../db";
import { AppError, assertFound } from "../errors";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";
import { uploadRateLimit } from "../middleware/rate-limits";
import {
  assertTransition,
  isCaseMutable,
} from "../domain/workflow";
import { validateAndNormaliseImage } from "../services/image-validation";
import {
  deletePrivateObject,
  getPrivateObject,
  putPrivateObject,
} from "../services/storage";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_UPLOAD_BYTES,
    files: 1,
    fields: 5,
    fieldNameSize: 100,
  },
});

router.use(requireAuth, requirePermission("case:read"));

async function ensureCaseUploadAllowed(
  request: Express.Request,
  _response: Express.Response,
  next: Express.NextFunction,
) {
  try {
    const item = await prisma.case.findFirst({
      where: {
        id: request.params.caseId,
        organisationId: request.auth!.organisationId,
        archivedAt: null,
      },
    });
    assertFound(item, "Case not found");

    if (!isCaseMutable(item.status)) {
      throw new AppError(
        409,
        "CASE_LOCKED",
        `Images cannot be uploaded in status ${item.status}`,
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}

router.post(
  "/cases/:caseId/images",
  requirePermission("image:upload"),
  uploadRateLimit,
  ensureCaseUploadAllowed,
  upload.single("image"),
  async (request, response) => {
    if (!request.file) {
      throw new AppError(
        422,
        "IMAGE_REQUIRED",
        "A multipart field named image is required",
      );
    }

    const auth = request.auth!;
    const item = await prisma.case.findFirst({
      where: {
        id: request.params.caseId,
        organisationId: auth.organisationId,
        archivedAt: null,
      },
    });
    assertFound(item, "Case not found");

    const validated = await validateAndNormaliseImage(request.file.buffer);
    const claimedMimeType = request.file.mimetype.toLowerCase();
    if (
      claimedMimeType &&
      claimedMimeType !== "application/octet-stream" &&
      claimedMimeType !== validated.detectedMimeType
    ) {
      throw new AppError(
        415,
        "MIME_TYPE_MISMATCH",
        `Claimed MIME ${claimedMimeType} does not match detected MIME ${validated.detectedMimeType}`,
      );
    }
    const storageKey = [
      auth.organisationId,
      item.id,
      `${randomUUID()}.${validated.safeExtension}`,
    ].join("/");

    await putPrivateObject({
      key: storageKey,
      body: validated.buffer,
      contentType: validated.detectedMimeType,
      sha256: validated.sha256,
    });

    try {
      const image = await prisma.$transaction(async (tx) => {
        const created = await tx.caseImage.create({
          data: {
            caseId: item.id,
            storageKey,
            originalFileName: path
              .basename(request.file!.originalname)
              .slice(0, 255),
            detectedMimeType: validated.detectedMimeType,
            sizeBytes: validated.sizeBytes,
            width: validated.width,
            height: validated.height,
            sha256: validated.sha256,
            uploadedById: auth.userId,
          },
        });

        if (item.status !== CaseStatus.IMAGE_UPLOADED) {
          assertTransition(item.status, CaseStatus.IMAGE_UPLOADED, auth.role);
          const moved = await tx.case.updateMany({
            where: {
              id: item.id,
              status: item.status,
            },
            data: { status: CaseStatus.IMAGE_UPLOADED },
          });
          if (moved.count === 1) {
            await tx.caseStatusTransition.create({
              data: {
                caseId: item.id,
                fromStatus: item.status,
                toStatus: CaseStatus.IMAGE_UPLOADED,
                actorId: auth.userId,
                reason: "Validated image uploaded",
              },
            });
          }
        }

        await tx.auditEvent.create({
          data: {
            organisationId: auth.organisationId,
            actorId: auth.userId,
            caseId: item.id,
            action: "IMAGE_UPLOAD",
            entityType: "CaseImage",
            entityId: created.id,
            outcome: "SUCCESS",
            requestId: request.requestId,
            metadata: {
              detectedMimeType: validated.detectedMimeType,
              sizeBytes: validated.sizeBytes,
              width: validated.width,
              height: validated.height,
              sha256: validated.sha256,
            },
          },
        });

        return created;
      });

      response.status(201).json({ image });
    } catch (error) {
      await deletePrivateObject(storageKey).catch(() => {});
      throw error;
    }
  },
);

router.get("/images/:imageId/url", async (request, response) => {
  const image = await prisma.caseImage.findFirst({
    where: {
      id: request.params.imageId,
      deletedAt: null,
      case: {
        organisationId: request.auth!.organisationId,
        archivedAt: null,
      },
    },
    select: { id: true },
  });
  assertFound(image, "Image not found");

  // Keep object storage private and expose the image only through the
  // authenticated same-origin API. The browser never needs a MinIO port.
  response.json({
    url: `/api/images/${image.id}/content`,
    expiresInSeconds: 0,
  });
});

router.get("/images/:imageId/content", async (request, response) => {
  const image = await prisma.caseImage.findFirst({
    where: {
      id: request.params.imageId,
      deletedAt: null,
      case: {
        organisationId: request.auth!.organisationId,
        archivedAt: null,
      },
    },
  });
  assertFound(image, "Image not found");

  const body = await getPrivateObject(image.storageKey);
  response.setHeader("Content-Type", image.detectedMimeType);
  response.setHeader("Content-Length", String(body.length));
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.send(body);
});

router.delete(
  "/images/:imageId",
  requirePermission("image:delete"),
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

    if (!isCaseMutable(image.case.status)) {
      throw new AppError(
        409,
        "CASE_LOCKED",
        "Images cannot be removed after review submission",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.caseImage.update({
        where: { id: image.id },
        data: { deletedAt: new Date() },
      });

      const remainingImages = await tx.caseImage.count({
        where: {
          caseId: image.caseId,
          deletedAt: null,
          id: { not: image.id },
        },
      });
      const nextStatus =
        remainingImages === 0
          ? CaseStatus.DRAFT
          : CaseStatus.IMAGE_UPLOADED;

      if (image.case.status !== nextStatus) {
        assertTransition(image.case.status, nextStatus, auth.role);
        const moved = await tx.case.updateMany({
          where: {
            id: image.caseId,
            status: image.case.status,
          },
          data: { status: nextStatus },
        });
        if (moved.count !== 1) {
          throw new AppError(
            409,
            "CONCURRENT_CASE_CHANGE",
            "The case changed while the image was being removed",
          );
        }
        await tx.caseStatusTransition.create({
          data: {
            caseId: image.caseId,
            fromStatus: image.case.status,
            toStatus: nextStatus,
            actorId: auth.userId,
            reason:
              remainingImages === 0
                ? "Last active image removed"
                : "Image set changed; prior analysis invalidated",
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          organisationId: auth.organisationId,
          actorId: auth.userId,
          caseId: image.caseId,
          action: "IMAGE_DELETE",
          entityType: "CaseImage",
          entityId: image.id,
          outcome: "SUCCESS",
          requestId: request.requestId,
          metadata: { sha256: image.sha256 },
        },
      });
    });

    await deletePrivateObject(image.storageKey).catch((error) => {
      request.log?.error?.(
        { err: error, imageId: image.id },
        "Failed to remove object after soft deletion",
      );
    });

    response.status(204).send();
  },
);

export default router;
