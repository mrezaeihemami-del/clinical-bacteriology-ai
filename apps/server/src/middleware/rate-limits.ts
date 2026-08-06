import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { AppError } from "../errors";

type DatabaseRateLimitOptions = {
  name: string;
  windowMs: number;
  limit: number;
  key: (request: Request) => string;
};

function normaliseKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9:._@-]/g, "_").slice(0, 300);
}

function createDatabaseRateLimit(options: DatabaseRateLimitOptions) {
  return async (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      const now = Date.now();
      const windowStart =
        Math.floor(now / options.windowMs) * options.windowMs;
      const expiresAt = new Date(windowStart + options.windowMs);
      const bucketKey = normaliseKey(
        `${options.name}:${windowStart}:${options.key(request)}`,
      );

      const rows = await prisma.$queryRaw<Array<{ count: number }>>(
        Prisma.sql`
          INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt", "updatedAt")
          VALUES (${bucketKey}, 1, ${expiresAt}, NOW())
          ON CONFLICT ("key")
          DO UPDATE SET
            "count" = "RateLimitBucket"."count" + 1,
            "updatedAt" = NOW()
          RETURNING "count"
        `,
      );

      const count = rows[0]?.count ?? options.limit + 1;
      const remaining = Math.max(0, options.limit - count);
      response.setHeader("RateLimit-Limit", String(options.limit));
      response.setHeader("RateLimit-Remaining", String(remaining));
      response.setHeader(
        "RateLimit-Reset",
        String(Math.ceil(expiresAt.getTime() / 1000)),
      );

      if (count > options.limit) {
        response.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000))),
        );
        throw new AppError(
          429,
          "RATE_LIMITED",
          "Too many requests. Try again after the current rate-limit window.",
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function requestIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || "unknown";
}

export const loginRateLimit = createDatabaseRateLimit({
  name: "login",
  windowMs: 15 * 60 * 1000,
  limit: 10,
  key: requestIp,
});

export const uploadRateLimit = createDatabaseRateLimit({
  name: "upload",
  windowMs: 5 * 60 * 1000,
  limit: 20,
  key: (request) =>
    `${request.auth?.organisationId ?? "anonymous"}:${request.auth?.userId ?? requestIp(request)}`,
});

export const analysisRateLimit = createDatabaseRateLimit({
  name: "analysis",
  windowMs: 5 * 60 * 1000,
  limit: 10,
  key: (request) =>
    `${request.auth?.organisationId ?? "anonymous"}:${request.auth?.userId ?? requestIp(request)}`,
});
