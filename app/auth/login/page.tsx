import { Suspense } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AlertCircleIcon } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LoginSkeleton } from "@/components/app/loading-skeletons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  firstSearchParam,
  safeContinuePath,
} from "@/lib/auth/continue";
import { getCurrentUser } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type LoginSearchParams = {
  continue?: string | string[];
  error?: string | string[];
};

type LoginPageProps = {
  searchParams: Promise<LoginSearchParams>;
};

function authErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case undefined:
      return null;
    case "access_denied":
      return "Google sign-in was cancelled.";
    case "exchange_failed":
      return "We couldn't complete sign-in. Please try again.";
    case "missing_code":
      return "The sign-in response was incomplete. Please try again.";
    case "config":
      return "Authentication is not configured.";
    default:
      return "Google sign-in failed. Please try again.";
  }
}

function LoginCard({
  continueTo,
  errorMessage,
}: {
  continueTo: string;
  errorMessage: string | null;
}) {
  return (
    <Card className="w-full max-w-sm shadow-sm">
      <CardHeader className="gap-3">
        <Image
          src="/icons/android-chrome-192x192.png"
          alt=""
          width={40}
          height={40}
          loading="eager"
          className="size-10 rounded-xl ring-1 ring-foreground/10"
        />
        <div className="space-y-1.5">
          <CardTitle className="text-2xl">Sign in to Duti</CardTitle>
          <CardDescription>
            Use your Google account. Your workspace is private to you.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <GoogleSignInButton continueTo={continueTo} />

        <p className="text-xs leading-5 text-muted-foreground">
          Continuing creates a personal workspace for this Google account. You
          can sign out at any time.
        </p>
      </CardContent>
    </Card>
  );
}

async function LoginContent({ searchParams }: LoginPageProps) {
  await connection();
  const params = await searchParams;
  const continueTo = safeContinuePath(firstSearchParam(params.continue));
  const user = await getCurrentUser();

  if (user) {
    redirect(continueTo);
  }

  const configured = isSupabaseConfigured();
  const errorCode = configured ? firstSearchParam(params.error) : "config";
  const errorMessage = authErrorMessage(errorCode);

  return <LoginCard continueTo={continueTo} errorMessage={errorMessage} />;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <div className="flex min-h-svh flex-1 items-center justify-center bg-muted/30 px-4 py-12">
      <Suspense fallback={<LoginSkeleton />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
