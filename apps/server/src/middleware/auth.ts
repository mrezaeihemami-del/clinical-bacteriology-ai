import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { config } from "../config";
import { resolveSession } from "../auth/session";
import { AppError } from "../errors";

export async function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  try {
    const session = await resolveSession(
      request.cookies?.[config.SESSION_COOKIE_NAME],
    );

    if (!session) {
      throw new AppError(401, "AUTHENTICATION_REQUIRED", "Sign in is required");
    }

    request.auth = {
      userId: session.userId,
      organisationId: session.organisationId,
      role: session.role,
      email: session.email,
      displayName: session.displayName,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Role[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.auth) {
      return next(
        new AppError(401, "AUTHENTICATION_REQUIRED", "Sign in is required"),
      );
    }

    if (!roles.includes(request.auth.role)) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          `Role ${request.auth.role} cannot perform this action`,
        ),
      );
    }

    next();
  };
}
