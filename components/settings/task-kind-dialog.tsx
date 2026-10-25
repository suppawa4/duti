"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";
import type { TaskKind } from "@/lib/api/types";
import { suggestTaskKindKey } from "@/lib/task-kinds/key";
import {
  createTaskKindAction,
  updateTaskKindAction,
} from "@/lib/task-kinds/actions";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

export function TaskKindDialog({
  open,
  onOpenChange,
  kind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind?: TaskKind;
}) {
  const router = useRouter();
  const editing = Boolean(kind);
  const [name, setName] = useState(kind?.name ?? "");
  const [key, setKey] = useState(kind?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(Boolean(kind));
  const [nameError, setNameError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function changeName(value: string) {
    setName(value);
    setNameError(null);

    if (!editing && !keyTouched) {
      setKey(suggestTaskKindKey(value));
      setKeyError(null);
    }
  }

  function changeKey(value: string) {
    setKeyTouched(true);
    setKey(
      value
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 32),
    );
    setKeyError(null);
  }

  async function submit() {
    const trimmedName = name.trim();
    const normalizedKey = key.trim().toLowerCase();
    let invalid = false;

    if (!trimmedName) {
      setNameError("Kind name is required.");
      invalid = true;
    }

    if (!editing && !KEY_PATTERN.test(normalizedKey)) {
      setKeyError(
        "Use 1–32 lowercase letters, numbers, or underscores, starting with a letter.",
      );
      invalid = true;
    }

    if (invalid) {
      return;
    }

    setPending(true);
    setFormError(null);

    const result = editing
      ? await updateTaskKindAction({
          kindId: kind!.id,
          name: trimmedName,
        })
      : await createTaskKindAction({
          key: normalizedKey,
          name: trimmedName,
        });

    if (!result.ok) {
      setPending(false);
      setFormError(result.error.message);
      return;
    }

    toast.success(editing ? "Kind updated" : "Kind created");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      isDismissable={!pending}
    >
      <DialogHeader>
        <DialogTitle>{editing ? "Edit task kind" : "New task kind"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Rename this kind. Its key stays the same."
            : "Kinds let you classify tasks across every project."}
        </DialogDescription>
      </DialogHeader>

      {formError ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FieldGroup className="gap-4">
          <Field data-invalid={Boolean(nameError)}>
            <FieldLabel htmlFor="kind-name">Name</FieldLabel>
            <Input
              id="kind-name"
              value={name}
              onChange={(event) => changeName(event.target.value)}
              placeholder="Bug"
              maxLength={80}
              autoFocus
              disabled={pending}
              aria-invalid={Boolean(nameError)}
            />
            {nameError ? <FieldError>{nameError}</FieldError> : null}
          </Field>

          <Field data-invalid={Boolean(keyError)}>
            <FieldLabel htmlFor="kind-key">Key</FieldLabel>
            <Input
              id="kind-key"
              value={key}
              onChange={(event) => changeKey(event.target.value)}
              placeholder="bug"
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              disabled={pending || editing}
              aria-invalid={Boolean(keyError)}
            />
            <FieldDescription>
              {editing
                ? "Keys are permanent."
                : "Lowercase letters, numbers, and underscores. Used by the API."}
            </FieldDescription>
            {keyError ? <FieldError>{keyError}</FieldError> : null}
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
                ? "Save changes"
                : "Create kind"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
