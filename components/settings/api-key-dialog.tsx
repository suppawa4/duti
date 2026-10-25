"use client";

import { useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";
import type { CreatedApiKey } from "@/lib/api/types";
import { createApiKeyAction } from "@/lib/api-keys/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function ApiKeyCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (created: CreatedApiKey) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    const trimmed = name.trim();

    if (!trimmed) {
      setError("Give the key a name so you can recognize it later.");
      return;
    }

    setPending(true);
    setError(null);

    const result = await createApiKeyAction({ name: trimmed });

    if (!result.ok) {
      setPending(false);
      setError(result.error.message);
      return;
    }

    toast.success("API key created");
    onOpenChange(false);
    onCreated(result.data);
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      isDismissable={!pending}
    >
      <DialogHeader>
        <DialogTitle>New API key</DialogTitle>
        <DialogDescription>
          Name the key after the agent or script that will use it.
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="api-key-name">Name</FieldLabel>
            <Input
              id="api-key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Codex agent"
              maxLength={80}
              autoFocus
              disabled={pending}
            />
            <FieldDescription>
              The secret is shown once. Only a hash is stored.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <DialogFooter className="mt-4">
          <DialogClose variant="outline" isDisabled={pending}>
            Cancel
          </DialogClose>
          <Button type="submit" isDisabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? "Creating…" : "Create key"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
