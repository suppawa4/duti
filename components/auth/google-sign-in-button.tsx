"use client";

import { useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.94A6 6 0 0 1 6.1 12c0-.67.11-1.33.31-1.94V7.44H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.56l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.44l3.35 2.62C7.2 7.7 9.4 5.94 12 5.94Z"
      />
    </svg>
  );
}

export function GoogleSignInButton({ continueTo }: { continueTo: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);

    if (!isSupabaseConfigured()) {
      setError("Authentication is not configured.");
      setPending(false);
      return;
    }

    try {
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("continue", continueTo);

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.toString(),
          queryParams: { prompt: "select_account" },
        },
      });

      if (signInError) {
        setError("We couldn't start Google sign-in. Please try again.");
        setPending(false);
      }
    } catch {
      setError("We couldn't start Google sign-in. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onPress={signIn}
        isDisabled={pending}
        aria-busy={pending}
      >
        {pending ? <Spinner data-icon="inline-start" /> : <GoogleIcon />}
        {pending ? "Redirecting…" : "Continue with Google"}
      </Button>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
