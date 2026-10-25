import "server-only";
import { revalidatePath } from "next/cache";
import { createApi, getAccessToken } from "@/lib/eden.server";
import type { ActionResult } from "./types";
import { actionError } from "./types";

type EdenResult<T> = {
  data: T | null;
  error: unknown;
};

type ApiClient = ReturnType<typeof createApi>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorFromApi(error: unknown): ActionResult<never> {
  const value = isRecord(error) && "value" in error ? error.value : error;
  const body = isRecord(value) && "error" in value ? value.error : null;

  if (
    isRecord(body) &&
    typeof body.code === "string" &&
    typeof body.message === "string"
  ) {
    return actionError(body.code, body.message, body.details);
  }

  if (isRecord(error) && error.status === 401) {
    return actionError(
      "UNAUTHORIZED",
      "Your session expired. Sign in again.",
    );
  }

  return actionError(
    "INTERNAL_ERROR",
    "Something went wrong. Please try again.",
  );
}

async function getApi(): Promise<ActionResult<ApiClient>> {
  const token = await getAccessToken();

  if (!token) {
    return actionError(
      "UNAUTHORIZED",
      "Your session expired. Sign in again.",
    );
  }

  return { ok: true, data: createApi(token) };
}

export async function withApi<T>(
  request: (api: ApiClient) => Promise<EdenResult<T>>,
): Promise<ActionResult<T>> {
  const apiResult = await getApi();

  if (!apiResult.ok) {
    return apiResult;
  }

  try {
    const { data, error } = await request(apiResult.data);

    if (error) {
      return errorFromApi(error);
    }

    if (data === null || data === undefined) {
      return actionError(
        "INTERNAL_ERROR",
        "The server returned an empty response.",
      );
    }

    return { ok: true, data };
  } catch {
    return actionError(
      "INTERNAL_ERROR",
      "Something went wrong. Please try again.",
    );
  }
}

export async function withApiVoid(
  request: (api: ApiClient) => Promise<{ error: unknown }>,
): Promise<ActionResult<null>> {
  const apiResult = await getApi();

  if (!apiResult.ok) {
    return apiResult;
  }

  try {
    const { error } = await request(apiResult.data);

    if (error) {
      return errorFromApi(error);
    }

    return { ok: true, data: null };
  } catch {
    return actionError(
      "INTERNAL_ERROR",
      "Something went wrong. Please try again.",
    );
  }
}

export function revalidateWorkspace(projectId?: string) {
  revalidatePath("/");
  revalidatePath("/settings");

  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}
