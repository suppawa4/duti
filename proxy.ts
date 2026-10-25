import { NextResponse, type NextRequest } from "next/server";
import { loginPath, safeContinuePath } from "@/lib/auth/continue";
import { updateSession } from "@/lib/supabase/proxy";

const PUBLIC_PATH_PREFIXES = [
  "/auth",
  "/api",
  "/icons",
  "/opengraph-image",
  "/twitter-image",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const session = await updateSession(request);

  if (
    !session.configured ||
    session.user ||
    isPublicPath(request.nextUrl.pathname)
  ) {
    return session.response;
  }

  // Server Actions must verify the session themselves; redirecting their POST
  // would replace the action response with a page navigation.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return session.response;
  }

  const intended = safeContinuePath(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const redirectResponse = NextResponse.redirect(
    new URL(loginPath(intended), request.url),
  );

  session.response.cookies
    .getAll()
    .forEach((cookie) => redirectResponse.cookies.set(cookie));

  redirectResponse.headers.set("Cache-Control", "no-store");

  return redirectResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (Elysia and API-key agents)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - image, font, and manifest files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|webmanifest)$).*)",
  ],
};
