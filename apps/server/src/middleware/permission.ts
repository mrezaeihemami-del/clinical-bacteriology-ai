import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors";
import {
  hasPermission,
  type Permission,
} from "../domain/permissions";

export function requirePermission(permission: Permission) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.auth) {
      return next(
        new AppError(401, "AUTHENTICATION_REQUIRED", "Sign in is required"),
      );
    }

    if (!hasPermission(request.auth.role, permission)) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          `Role ${request.auth.role} lacks permission ${permission}`,
        ),
      );
    }

    next();
  };
}
