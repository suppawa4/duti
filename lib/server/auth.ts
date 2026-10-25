import { Elysia, status } from "elysia";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getAdminClient } from "@/lib/supabase/admin";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import {
  isApiKeyAuthConfigured,
  verifyApiKey,
} from "./api-keys";
import { apiError } from "./errors";

export type ApiAuth = {
  user: { id: string; email: string | null };
  workspace: { id: string; name: string };
  supabase: SupabaseClient<Database>;
  authMode: "session" | "api_key";
  apiKey: { id: string; name: string } | null;
};

export const auth = new Elysia({ name: "supabase-auth" }).macro({
  auth: {
    async derive({ headers }) {
      const token = headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

      if (!token) {
        return status(
          401,
          apiError("UNAUTHORIZED", "Authentication required."),
        );
      }

      if (token.startsWith("duti_live_")) {
        if (!isApiKeyAuthConfigured()) {
          return status(
            500,
            apiError(
              "INTERNAL_ERROR",
              "API key authentication is not configured.",
            ),
          );
        }

        let verified: Awaited<ReturnType<typeof verifyApiKey>>;

        try {
          verified = await verifyApiKey(token);
        } catch {
          return status(
            500,
            apiError(
              "INTERNAL_ERROR",
              "Could not verify the API key.",
            ),
          );
        }

        if (!verified) {
          return status(
            401,
            apiError("UNAUTHORIZED", "Invalid or expired API key."),
          );
        }

        const apiKeyAuth: ApiAuth = {
          user: {
            id: verified.workspace.ownerId,
            email: null,
          },
          workspace: {
            id: verified.workspace.id,
            name: verified.workspace.name,
          },
          supabase: getAdminClient(),
          authMode: "api_key",
          apiKey: verified.apiKey,
        };

        return { auth: apiKeyAuth };
      }

      if (!supabaseUrl || !supabasePublishableKey) {
        return status(
          500,
          apiError("INTERNAL_ERROR", "Authentication is not configured."),
        );
      }

      const supabase = createClient<Database>(
        supabaseUrl,
        supabasePublishableKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
          global: {
            headers: { Authorization: `Bearer ${token}` },
          },
        },
      );

      const result = await supabase.auth
        .getClaims(token)
        .catch(() => null);
      const claims = result?.data?.claims;

      if (!claims?.sub || claims.role !== "authenticated") {
        return status(
          401,
          apiError("UNAUTHORIZED", "Invalid or expired session."),
        );
      }

      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id, name")
        .eq("owner_id", claims.sub)
        .maybeSingle();

      if (workspaceError) {
        return status(
          500,
          apiError("INTERNAL_ERROR", "Could not load the workspace."),
        );
      }

      if (!workspace) {
        return status(404, apiError("NOT_FOUND", "Workspace not found."));
      }

      const sessionAuth: ApiAuth = {
        user: { id: claims.sub, email: claims.email ?? null },
        workspace,
        supabase,
        authMode: "session",
        apiKey: null,
      };

      return { auth: sessionAuth };
    },
  },
});
