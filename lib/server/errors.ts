export const API_ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function fail(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): never {
  throw new ApiError(status, code, message, details);
}

export type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function isDatabaseError(value: unknown): value is DatabaseError {
  return (
    typeof value === "object" &&
    value !== null &&
    ("code" in value || "message" in value)
  );
}

export function databaseFailure(
  error: DatabaseError,
  fallbackMessage = "The database request failed.",
): never {
  switch (error.code) {
    case "PGRST116":
      fail(404, "NOT_FOUND", "The requested item was not found.");
    case "23505":
      fail(409, "CONFLICT", "That value is already in use.");
    case "23503":
      fail(409, "CONFLICT", "This item is still in use.");
    case "23514":
      fail(422, "VALIDATION_ERROR", "The request violates a data rule.");
    case "22000":
      fail(
        409,
        "CONFLICT",
        "The request conflicts with the current board state.",
      );
    case "42501":
      fail(403, "FORBIDDEN", "You cannot perform that action.");
    case "22P02":
      fail(422, "VALIDATION_ERROR", "The request contains an invalid value.");
    default:
      fail(500, "INTERNAL_ERROR", fallbackMessage);
  }
}

export function rpcFailure(
  error: DatabaseError,
  fallbackMessage = "The board could not be updated.",
): never {
  const message = error.message ?? "";

  if (
    message.includes("stack has tasks") ||
    message.includes("provide moveTasksTo")
  ) {
    fail(
      409,
      "CONFLICT",
      "Move the tasks to another stack before deleting this stack.",
    );
  }

  if (message.includes("cannot delete the last stack")) {
    fail(409, "CONFLICT", "A board needs at least one stack.");
  }

  if (message.includes("moveTasksTo must be another stack")) {
    fail(
      422,
      "VALIDATION_ERROR",
      "Choose a different stack to receive the tasks.",
    );
  }

  if (message.includes("stack list must contain every stack exactly once")) {
    fail(
      409,
      "CONFLICT",
      "The stack order is out of date. Refresh the board and try again.",
    );
  }

  if (
    message.includes("before task not found") ||
    message.includes("target stack not found") ||
    message.includes("stack not found") ||
    message.includes("task not found") ||
    message.includes("project not found")
  ) {
    fail(404, "NOT_FOUND", "The requested board item was not found.");
  }

  if (message.includes("task cannot be moved before itself")) {
    fail(422, "VALIDATION_ERROR", "A task cannot be placed before itself.");
  }

  if (message.includes("task kind not found")) {
    fail(422, "VALIDATION_ERROR", "That task kind does not exist.");
  }

  if (message.includes("idempotency key already used")) {
    fail(
      409,
      "CONFLICT",
      "That idempotency key was already used for another project.",
    );
  }

  databaseFailure(error, fallbackMessage);
}
