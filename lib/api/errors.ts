function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function apiErrorStatus(error: unknown): number | undefined {
  if (isRecord(error) && typeof error.status === "number") {
    return error.status;
  }

  return undefined;
}

export function apiErrorMessage(error: unknown): string | undefined {
  const value = isRecord(error) && "value" in error ? error.value : error;

  if (!isRecord(value) || !isRecord(value.error)) {
    return undefined;
  }

  return typeof value.error.message === "string"
    ? value.error.message
    : undefined;
}
