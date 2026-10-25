import { NextResponse, type NextRequest } from "next/server";
import { safeContinuePath } from "@/lib/auth/continue";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function loginRedirect(
  origin: string,
  errorCode: string,
  continueTo: string,
): NextResponse {
  const url = new URL("/auth/login", origin);
  url.searchParams.set("error", errorCode);
  url.searchParams.set("continue", continueTo);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const continueTo = safeContinuePath(searchParams.get("continue"));
  const oauthError = searchParams.get("error");
  const code = searchParams.get("code");

  if (oauthError) {
    return loginRedirect(
      origin,
      oauthError === "access_denied" ? "access_denied" : "oauth_failed",
      continueTo,
    );
  }

  if (!code) {
    return loginRedirect(origin, "missing_code", continueTo);
  }

  if (!isSupabaseConfigured()) {
    return loginRedirect(origin, "config", continueTo);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      return loginRedirect(origin, "exchange_failed", continueTo);
    }
  } catch {
    return loginRedirect(origin, "exchange_failed", continueTo);
  }

  const response = NextResponse.redirect(new URL(continueTo, origin));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
