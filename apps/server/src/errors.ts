export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function assertFound<T>(
  value: T | null | undefined,
  message = "Resource not found",
): asserts value is T {
  if (value === null || value === undefined) {
    throw new AppError(404, "NOT_FOUND", message);
  }
}
