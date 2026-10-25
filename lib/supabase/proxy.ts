import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { supabasePublishableKey, supabaseUrl } from "./config";

export type ProxySession = {
  response: NextResponse;
  user: { id: string; email: string | null } | null;
  configured: boolean;
};

export async function updateSession(
  request: NextRequest,
): Promise<ProxySession> {
  request.headers.set(
    "x-duti-pathname",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  let supabaseResponse = NextResponse.next({ request });

  if (!supabaseUrl || !supabasePublishableKey) {
    return {
      response: supabaseResponse,
      user: null,
      configured: false,
    };
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Keep this call directly after createServerClient. getClaims() validates
  // the token and refreshes the session when it is close to expiring.
  let user: ProxySession["user"] = null;

  try {
    const { data } = await supabase.auth.getClaims();

    if (data?.claims?.sub && data.claims.role === "authenticated") {
      user = {
        id: data.claims.sub,
        email: data.claims.email ?? null,
      };
    }
  } catch {
    user = null;
  }

  return {
    response: supabaseResponse,
    user,
    configured: true,
  };
}
