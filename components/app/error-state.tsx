import { AlertCircleIcon, RotateCcwIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";

export function ErrorState({
  title = "Something went wrong",
  description,
  retryHref,
  retryLabel = "Try again",
}: {
  title?: string;
  description: string;
  retryHref?: string;
  retryLabel?: string;
}) {
  return (
    <Alert variant="destructive" className="max-w-2xl">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{description}</p>
        {retryHref ? (
          <LinkButton
            href={retryHref}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <RotateCcwIcon data-icon="inline-start" />
            {retryLabel}
          </LinkButton>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
