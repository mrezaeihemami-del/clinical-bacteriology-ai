import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../errors";

export const errorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  _next,
) => {
  const requestId = request.requestId;

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const field =
      firstIssue && firstIssue.path.length > 0
        ? firstIssue.path.join(".")
        : "request";
    const message = firstIssue
      ? `${field}: ${firstIssue.message}`
      : "Request validation failed";

    response.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message,
        details: error.flatten(),
        requestId,
      },
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    response.status(409).json({
      error: {
        code: "CONFLICT",
        message: "A record with the same unique value already exists",
        requestId,
      },
    });
    return;
  }

  request.log?.error?.({ err: error, requestId }, "Unhandled request error");
  const detailMessage =
    error instanceof Error ? error.message : "The operation could not be completed";
  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: detailMessage,
      requestId,
    },
  });
};
