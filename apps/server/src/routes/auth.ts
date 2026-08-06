import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../db";
import { AppError } from "../errors";
import {
  createSession,
  revokeSession,
} from "../auth/session";
import { requireAuth } from "../middleware/auth";
import { loginRateLimit } from "../middleware/rate-limits";
import { config } from "../config";
import { writeAudit } from "../services/audit";

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(256),
});

router.post("/login", loginRateLimit, async (request, response) => {
  const input = loginSchema.parse(request.body);
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      memberships: {
        include: { organisation: true },
      },
    },
  });

  const passwordValid =
    user && !user.disabledAt
      ? await argon2.verify(user.passwordHash, input.password)
      : false;

  if (!user || !passwordValid || user.memberships.length === 0) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect",
    );
  }

  await createSession(user.id, response);
  const membership = user.memberships[0]!;

  await writeAudit({
    organisationId: membership.organisationId,
    actorId: user.id,
    action: "AUTH_LOGIN",
    entityType: "Session",
    outcome: "SUCCESS",
    requestId: request.requestId,
  });

  response.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: membership.role,
      organisationId: membership.organisationId,
      organisationName: membership.organisation.name,
    },
  });
});

router.get("/me", requireAuth, async (request, response) => {
  const auth = request.auth!;
  const organisation = await prisma.organisation.findUnique({
    where: { id: auth.organisationId },
    select: { name: true },
  });

  response.json({
    user: {
      id: auth.userId,
      email: auth.email,
      displayName: auth.displayName,
      role: auth.role,
      organisationId: auth.organisationId,
      organisationName: organisation?.name ?? "Unknown organisation",
    },
  });
});

router.post("/logout", requireAuth, async (request, response) => {
  const token = request.cookies?.[config.SESSION_COOKIE_NAME] as
    | string
    | undefined;

  await revokeSession(token);
  response.clearCookie(config.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  await writeAudit({
    organisationId: request.auth!.organisationId,
    actorId: request.auth!.userId,
    action: "AUTH_LOGOUT",
    entityType: "Session",
    outcome: "SUCCESS",
    requestId: request.requestId,
  });

  response.status(204).send();
});

export default router;
