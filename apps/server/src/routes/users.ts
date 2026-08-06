import { Router } from "express";
import argon2 from "argon2";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { AppError, assertFound } from "../errors";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const router = Router();

const createUserSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(2).max(200),
  password: z.string().min(12).max(256),
  role: z.nativeEnum(Role),
});

const updateUserSchema = z.object({
  displayName: z.string().trim().min(2).max(200).optional(),
  role: z.nativeEnum(Role).optional(),
  disabled: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(12).max(256),
});

router.use(requireAuth, requirePermission("settings:manage"));

router.get("/", async (request, response) => {
  const memberships = await prisma.membership.findMany({
    where: { organisationId: request.auth!.organisationId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          disabledAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: { user: { displayName: "asc" } },
  });

  response.json({
    users: memberships.map((membership) => ({
      ...membership.user,
      role: membership.role,
      disabled: Boolean(membership.user.disabledAt),
    })),
  });
});

router.post("/", async (request, response) => {
  const input = createUserSchema.parse(request.body);
  const auth = request.auth!;
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash,
        memberships: {
          create: {
            organisationId: auth.organisationId,
            role: input.role,
          },
        },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        disabledAt: true,
        createdAt: true,
      },
    });

    await tx.auditEvent.create({
      data: {
        organisationId: auth.organisationId,
        actorId: auth.userId,
        action: "USER_CREATE",
        entityType: "User",
        entityId: created.id,
        outcome: "SUCCESS",
        requestId: request.requestId,
        metadata: {
          email: created.email,
          role: input.role,
        },
      },
    });

    return created;
  });

  response.status(201).json({
    user: {
      ...user,
      role: input.role,
      disabled: false,
    },
  });
});

router.patch("/:userId", async (request, response) => {
  const input = updateUserSchema.parse(request.body);
  const auth = request.auth!;

  if (request.params.userId === auth.userId && input.disabled === true) {
    throw new AppError(
      409,
      "CANNOT_DISABLE_SELF",
      "An administrator cannot disable their own current account",
    );
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: request.params.userId,
      organisationId: auth.organisationId,
    },
    include: { user: true },
  });
  assertFound(membership, "User not found");

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: membership.userId },
      data: {
        ...(input.displayName !== undefined
          ? { displayName: input.displayName }
          : {}),
        ...(input.disabled !== undefined
          ? { disabledAt: input.disabled ? new Date() : null }
          : {}),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        disabledAt: true,
        createdAt: true,
      },
    });

    const updatedMembership =
      input.role !== undefined
        ? await tx.membership.update({
            where: { id: membership.id },
            data: { role: input.role },
          })
        : membership;

    if (input.disabled === true) {
      await tx.session.deleteMany({
        where: { userId: membership.userId },
      });
    }

    await tx.auditEvent.create({
      data: {
        organisationId: auth.organisationId,
        actorId: auth.userId,
        action: "USER_UPDATE",
        entityType: "User",
        entityId: user.id,
        outcome: "SUCCESS",
        requestId: request.requestId,
        metadata: {
          changedFields: Object.keys(input),
          role: updatedMembership.role,
          disabled: Boolean(user.disabledAt),
        },
      },
    });

    return {
      ...user,
      role: updatedMembership.role,
      disabled: Boolean(user.disabledAt),
    };
  });

  response.json({ user: updated });
});

router.post("/:userId/reset-password", async (request, response) => {
  const input = resetPasswordSchema.parse(request.body);
  const auth = request.auth!;
  const membership = await prisma.membership.findFirst({
    where: {
      userId: request.params.userId,
      organisationId: auth.organisationId,
    },
  });
  assertFound(membership, "User not found");

  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: membership.userId },
      data: { passwordHash },
    });
    await tx.session.deleteMany({
      where: { userId: membership.userId },
    });
    await tx.auditEvent.create({
      data: {
        organisationId: auth.organisationId,
        actorId: auth.userId,
        action: "USER_PASSWORD_RESET",
        entityType: "User",
        entityId: membership.userId,
        outcome: "SUCCESS",
        requestId: request.requestId,
      },
    });
  });

  response.status(204).send();
});

export default router;
