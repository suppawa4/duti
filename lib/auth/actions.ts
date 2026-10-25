"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginPath } from "./continue";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(loginPath("/"));
}
