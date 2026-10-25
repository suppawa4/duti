"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";
import type { BoardStack } from "@/lib/api/types";
import { createStackAction, renameStackAction } from "@/lib/board/actions";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function StackDialog({
  open,
  onOpenChange,
  projectId,
  stack,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  stack?: BoardStack;
}) {
  const router = useRouter();
  const editing = Boolean(stack);
  const [name, setName] = useState(stack?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    const trimmed = name.trim();

    if (!trimmed) {
      setError("Stack name is required.");
      return;
    }

    setPending(true);
    setError(null);

    const result = editing
      ? await renameStackAction({
          projectId,
          stackId: stack!.id,
          name: trimmed,
        })
      : await createStackAction({ projectId, name: trimmed });

    if (!result.ok) {
      setPending(false);
      setError(result.error.message);
      return;
    }

    toast.success(editing ? "Stack renamed" : "Stack created");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-sm"
      isDismissable={!pending}
    >
      <DialogHeader>
        <DialogTitle>{editing ? "Rename stack" : "New stack"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Give this column a clearer name."
            : "Stacks are the columns on this project board."}
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
            <FieldLabel htmlFor="stack-name">Name</FieldLabel>
            <Input
              id="stack-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="In Progress"
              maxLength={80}
              autoFocus
              disabled={pending}
            />
          </Field>
        </FieldGroup>

        <DialogFooter className="mt-4">
          <DialogClose variant="outline" isDisabled={pending}>
            Cancel
          </DialogClose>
          <Button type="submit" isDisabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending
              ? editing
                ? "Saving…"
                : "Creating…"
              : editing
                ? "Save"
                : "Create stack"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
