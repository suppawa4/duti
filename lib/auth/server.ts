import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loginPath, safeContinuePath } from "./continue";

export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

type Claims = {
  sub?: string;
  email?: string;
  role?: string;
  user_metadata?: Record<string, unknown>;
};

function toAuthUser(claims: Claims): AuthUser | null {
  if (!claims.sub || claims.role !== "authenticated") {
    return null;
  }

  const metadata = claims.user_metadata ?? {};
  const name =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : null;
  const avatarUrl =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : null;

  return {
    id: claims.sub,
    email: claims.email ?? null,
    name,
    avatarUrl,
  };
}

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data) {
      return null;
    }

    return toAuthUser(data.claims);
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (user) {
    return user;
  }

  const requestHeaders = await headers();
  const intended = safeContinuePath(
    requestHeaders.get("x-duti-pathname") ?? "/",
  );

  redirect(loginPath(intended));
}
