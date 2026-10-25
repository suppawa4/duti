import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabasePublishableKey, supabaseUrl } from "./config";

let client: SupabaseClient<Database> | undefined;

export function createClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase is not configured.");
  }

  client ??= createBrowserClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
  );

  return client;
}
