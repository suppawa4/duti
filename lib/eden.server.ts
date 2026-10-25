import "server-only";
import { treaty } from "@elysia/eden";
import { app } from "./server";
import { createClient } from "@/lib/supabase/server";

export const publicApi = treaty(app).api;

export async function getAccessToken(): Promise<string | undefined> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token;
}

export function createApi(accessToken?: string) {
  return treaty(app, {
    headers: accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined,
  }).api;
}
