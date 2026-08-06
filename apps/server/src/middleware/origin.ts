import type { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { AppError } from "../errors";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireTrustedOrigin(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  if (safeMethods.has(request.method)) {
    return next();
  }

  const origin = request.header("origin");
  if (!origin) {
    return next();
  }

  if (origin !== config.WEB_ORIGIN) {
    return next(
      new AppError(
        403,
        "UNTRUSTED_ORIGIN",
        "The request origin is not permitted",
      ),
    );
  }

  next();
}
