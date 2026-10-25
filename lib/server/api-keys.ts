import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type {
  ApiKey,
  CreateApiKeyInput,
  CreatedApiKey,
} from "@/lib/api/types";
import { getAdminClient } from "@/lib/supabase/admin";
import { supabaseUrl } from "@/lib/supabase/config";
import type { ApiAuth } from "./auth";
import { databaseFailure, fail } from "./errors";
import { toApiKey, type ApiKeyRow } from "./mappers";
import { cleanText } from "./validation";

const API_KEY_PREFIX = "duti_live_";
const KEY_PREFIX_LENGTH = API_KEY_PREFIX.length + 12;
const KEY_COLUMNS =
  "id, name, key_prefix, last_used_at, expires_at, revoked_at, created_at";
const AUTH_COLUMNS = `${KEY_COLUMNS}, key_hash, workspace_id`;

type ApiKeyAuthRow = ApiKeyRow & {
  key_hash: string;
  workspace_id: string;
};

export type VerifiedApiKey = {
  apiKey: { id: string; name: string };
  workspace: { id: string; name: string; ownerId: string };
};

export function isApiKeyAuthConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.API_KEY_PEPPER,
  );
}

function hashApiKey(raw: string): string {
  const pepper = process.env.API_KEY_PEPPER;

  if (!pepper) {
    throw new Error("API_KEY_PEPPER is not configured.");
  }

  return createHmac("sha256", pepper).update(raw).digest("hex");
}

function apiKeyExpiry(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    fail(422, "VALIDATION_ERROR", "Expiration must be a date.");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    fail(422, "VALIDATION_ERROR", "Expiration must be a valid date.");
  }

  if (date.getTime() <= Date.now()) {
    fail(422, "VALIDATION_ERROR", "Expiration must be in the future.");
  }

  return date.toISOString();
}

export async function listApiKeys(auth: ApiAuth): Promise<ApiKey[]> {
  const { data, error } = await auth.supabase
    .from("api_keys")
    .select(KEY_COLUMNS)
    .eq("workspace_id", auth.workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    databaseFailure(error, "Could not load API keys.");
  }

  return (data ?? []).map((row) => toApiKey(row as ApiKeyRow));
}

export async function createApiKey(
  auth: ApiAuth,
  input: CreateApiKeyInput,
): Promise<CreatedApiKey> {
  const name = cleanText(input.name, "name", {
    maxLength: 80,
    label: "Key name",
  });
  const expiresAt = apiKeyExpiry(input.expiresAt);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const raw = `${API_KEY_PREFIX}${randomBytes(9).toString("base64url")}${randomBytes(32).toString("base64url")}`;
    const keyPrefix = raw.slice(0, KEY_PREFIX_LENGTH);

    const { data, error } = await auth.supabase
      .from("api_keys")
      .insert({
        workspace_id: auth.workspace.id,
        name,
        key_prefix: keyPrefix,
        key_hash: hashApiKey(raw),
        expires_at: expiresAt,
      })
      .select(KEY_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        continue;
      }

      databaseFailure(error, "Could not create the API key.");
    }

    return {
      apiKey: toApiKey(data as ApiKeyRow),
      secret: raw,
    };
  }

  fail(500, "INTERNAL_ERROR", "Could not generate a unique API key.");
}

export async function revokeApiKey(
  auth: ApiAuth,
  keyId: string,
): Promise<void> {
  const { data, error } = await auth.supabase
    .from("api_keys")
    .select("id, revoked_at")
    .eq("id", keyId)
    .eq("workspace_id", auth.workspace.id)
    .maybeSingle();

  if (error) {
    databaseFailure(error, "Could not load the API key.");
  }

  if (!data) {
    fail(404, "NOT_FOUND", "API key not found.");
  }

  if (data.revoked_at) {
    return;
  }

  const { error: updateError } = await auth.supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("workspace_id", auth.workspace.id);

  if (updateError) {
    databaseFailure(updateError, "Could not revoke the API key.");
  }
}

export async function verifyApiKey(
  raw: string,
): Promise<VerifiedApiKey | null> {
  if (
    !raw.startsWith(API_KEY_PREFIX) ||
    raw.length <= KEY_PREFIX_LENGTH ||
    !isApiKeyAuthConfigured()
  ) {
    return null;
  }

  const keyPrefix = raw.slice(0, KEY_PREFIX_LENGTH);
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("api_keys")
    .select(AUTH_COLUMNS)
    .eq("key_prefix", keyPrefix)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as unknown as ApiKeyAuthRow;
  const expected = Buffer.from(row.key_hash, "hex");
  const actual = Buffer.from(hashApiKey(raw), "hex");

  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return null;
  }

  if (row.revoked_at) {
    return null;
  }

  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id, name, owner_id")
    .eq("id", row.workspace_id)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return null;
  }

  if (
    !row.last_used_at ||
    Date.now() - new Date(row.last_used_at).getTime() > 60_000
  ) {
    await admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id)
      .then(
        () => undefined,
        () => undefined,
      );
  }

  return {
    apiKey: { id: row.id, name: row.name },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.owner_id,
    },
  };
}
