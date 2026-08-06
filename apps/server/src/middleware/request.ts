import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const safeRequestId = /^[a-zA-Z0-9._:-]{1,128}$/;

export function requestContext(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const supplied = request.header("x-request-id");
  request.requestId =
    supplied && safeRequestId.test(supplied) ? supplied : randomUUID();
  response.setHeader("x-request-id", request.requestId);
  next();
}
