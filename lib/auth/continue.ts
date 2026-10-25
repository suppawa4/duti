export const DEFAULT_CONTINUE_PATH = "/";

export function firstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function safeContinuePath(value: string | null | undefined): string {
  if (!value) {
    return DEFAULT_CONTINUE_PATH;
  }

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    /[\u0000-\u001f\u007f\\]/.test(value)
  ) {
    return DEFAULT_CONTINUE_PATH;
  }

  let url: URL;
  try {
    url = new URL(value, "http://duti.local");
  } catch {
    return DEFAULT_CONTINUE_PATH;
  }

  if (url.origin !== "http://duti.local") {
    return DEFAULT_CONTINUE_PATH;
  }

  if (url.pathname === "/auth" || url.pathname.startsWith("/auth/")) {
    return DEFAULT_CONTINUE_PATH;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function loginPath(continueTo?: string | null): string {
  return `/auth/login?continue=${encodeURIComponent(safeContinuePath(continueTo))}`;
}
