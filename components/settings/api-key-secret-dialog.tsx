"use client";

import { useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  KeyRoundIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { CreatedApiKey } from "@/lib/api/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ApiKeySecretDialog({
  created,
  onOpenChange,
}: {
  created: CreatedApiKey;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(created.secret);
      setCopied(true);
      toast.success("API key copied");
    } catch {
      toast.error("Could not copy the key. Select it and copy manually.");
    }
  }

  return (
    <Dialog
      isOpen
      onOpenChange={onOpenChange}
      className="sm:max-w-lg"
    >
      <DialogHeader>
        <DialogTitle>Copy your API key</DialogTitle>
        <DialogDescription>
          {created.apiKey.name} is ready to use with the Duti API.
        </DialogDescription>
      </DialogHeader>

      <Alert>
        <TriangleAlertIcon />
        <AlertTitle>This is the only time you will see it</AlertTitle>
        <AlertDescription>
          Store it somewhere safe. Duti keeps only a hash, so a lost key must be
          revoked and replaced.
        </AlertDescription>
      </Alert>

      <Field>
        <FieldLabel htmlFor="api-key-secret">Secret</FieldLabel>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <KeyRoundIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="api-key-secret"
              value={created.secret}
              readOnly
              className="pl-8 font-mono text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
          <Button type="button" variant="outline" onPress={copy}>
            {copied ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </Field>

      <DialogFooter>
        <DialogClose>Done</DialogClose>
      </DialogFooter>
    </Dialog>
  );
}
