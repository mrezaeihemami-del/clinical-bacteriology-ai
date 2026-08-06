import { createHash, randomBytes } from "node:crypto";
import type { Response } from "express";
import { prisma } from "../db";
import { config } from "../config";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, response: Response) {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + config.SESSION_TTL_HOURS * 60 * 60 * 1000,
  );

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  response.cookie(config.SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export async function revokeSession(rawToken: string | undefined) {
  if (!rawToken) return;
  await prisma.session.deleteMany({
    where: { tokenHash: hashToken(rawToken) },
  });
}

export async function resolveSession(rawToken: string | undefined) {
  if (!rawToken) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: {
      user: {
        include: {
          memberships: {
            include: { organisation: true },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || session.user.disabledAt) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }

  const membership = session.user.memberships[0];
  if (!membership) return null;

  void prisma.session
    .update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => {});

  return {
    sessionId: session.id,
    userId: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    organisationId: membership.organisationId,
    organisationName: membership.organisation.name,
    role: membership.role,
    expiresAt: session.expiresAt,
  };
}
