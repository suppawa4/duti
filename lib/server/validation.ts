import {
  normalizeRichText,
  RichTextValidationError,
  type RichTextDoc,
} from "@/lib/rich-text";
import { isUuid } from "@/lib/ids";
import { fail } from "./errors";

function validationFailure(path: string, message: string): never {
  fail(422, "VALIDATION_ERROR", message, [{ path, message }]);
}

export function ensureProjectId(value: string): string {
  if (!isUuid(value)) {
    fail(404, "NOT_FOUND", "Project not found.");
  }

  return value;
}

export function cleanText(
  value: unknown,
  path: string,
  options: { maxLength: number; label: string },
): string {
  if (typeof value !== "string") {
    validationFailure(path, `${options.label} is required.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    validationFailure(path, `${options.label} is required.`);
  }

  if (trimmed.length > options.maxLength) {
    validationFailure(
      path,
      `${options.label} must be ${options.maxLength} characters or fewer.`,
    );
  }

  return trimmed;
}

export function optionalText(
  value: unknown,
  path: string,
  options: { maxLength: number; label: string },
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    validationFailure(path, `${options.label} must be text.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > options.maxLength) {
    validationFailure(
      path,
      `${options.label} must be ${options.maxLength} characters or fewer.`,
    );
  }

  return trimmed;
}

export function projectName(value: unknown): string {
  return cleanText(value, "name", { maxLength: 120, label: "Project name" });
}

export function projectDescription(value: unknown): string | null {
  return optionalText(value, "description", {
    maxLength: 2_000,
    label: "Project description",
  });
}

export function projectKey(value: unknown): string {
  if (typeof value !== "string") {
    validationFailure("key", "Project key is required.");
  }

  const key = value.trim().toUpperCase();

  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
    validationFailure(
      "key",
      "Use 2–10 letters or numbers, starting with a letter.",
    );
  }

  return key;
}

export function stackName(value: unknown): string {
  return cleanText(value, "name", { maxLength: 80, label: "Stack name" });
}

export function taskTitle(value: unknown): string {
  return cleanText(value, "title", { maxLength: 500, label: "Task title" });
}

export function taskKindKey(value: unknown): string {
  if (typeof value !== "string") {
    validationFailure("key", "Kind key is required.");
  }

  const key = value.trim().toLowerCase();

  if (!/^[a-z][a-z0-9_]{0,31}$/.test(key)) {
    validationFailure(
      "key",
      "Use 1–32 lowercase letters, numbers, or underscores, starting with a letter.",
    );
  }

  return key;
}

export function taskKindName(value: unknown): string {
  return cleanText(value, "name", { maxLength: 80, label: "Kind name" });
}

export function dueDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    validationFailure("dueDate", "Choose a valid due date.");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    validationFailure("dueDate", "Choose a valid due date.");
  }

  return value;
}

export function richTextDescription(value: unknown): RichTextDoc {
  try {
    return normalizeRichText(value);
  } catch (error) {
    if (error instanceof RichTextValidationError) {
      validationFailure("description", error.message);
    }

    validationFailure("description", "The description could not be read.");
  }
}
