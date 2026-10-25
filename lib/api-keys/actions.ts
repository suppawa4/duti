"use server";

import type {
  CreateApiKeyInput,
  CreatedApiKey,
} from "@/lib/api/types";
import {
  revalidateWorkspace,
  withApi,
  withApiVoid,
} from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";

export async function createApiKeyAction(
  input: CreateApiKeyInput,
): Promise<ActionResult<CreatedApiKey>> {
  const result = await withApi((api) =>
    api.v1["api-keys"].post({
      name: input.name,
      expiresAt: input.expiresAt ?? null,
    }),
  );

  if (result.ok) {
    revalidateWorkspace();
  }

  return result;
}

export async function revokeApiKeyAction(
  keyId: string,
): Promise<ActionResult<null>> {
  const result = await withApiVoid((api) =>
    api.v1["api-keys"]({ keyId }).delete(),
  );

  if (result.ok) {
    revalidateWorkspace();
  }

  return result;
}
