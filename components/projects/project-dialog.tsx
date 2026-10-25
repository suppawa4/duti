"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/api/types";
import { suggestProjectKey } from "@/lib/projects/key";
import { createProjectAction, updateProjectAction } from "@/lib/projects/actions";
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
import { Textarea } from "@/components/ui/textarea";

const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

export function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
}) {
  const router = useRouter();
  const editing = Boolean(project);
  const [name, setName] = useState(project?.name ?? "");
  const [key, setKey] = useState(project?.key ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [keyTouched, setKeyTouched] = useState(Boolean(project));
  const [nameError, setNameError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function changeName(value: string) {
    setName(value);
    setNameError(null);

    if (!editing && !keyTouched) {
      setKey(suggestProjectKey(value));
      setKeyError(null);
    }
  }

  function changeKey(value: string) {
    setKeyTouched(true);
    setKey(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
    setKeyError(null);
  }

  async function submit() {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const normalizedKey = key.trim().toUpperCase();
    let invalid = false;

    if (!trimmedName) {
      setNameError("Project name is required.");
      invalid = true;
    }

    if (!editing && !KEY_PATTERN.test(normalizedKey)) {
      setKeyError("Use 2–10 letters or numbers, starting with a letter.");
      invalid = true;
    }

    if (invalid) {
      return;
    }

    setPending(true);
    setFormError(null);

    const result = editing
      ? await updateProjectAction({
          projectId: project!.id,
          name: trimmedName,
          description: trimmedDescription,
        })
      : await createProjectAction({
          name: trimmedName,
          key: normalizedKey,
          description: trimmedDescription,
        });

    if (!result.ok) {
      setPending(false);
      setFormError(result.error.message);
      return;
    }

    toast.success(editing ? "Project updated" : "Project created");
    onOpenChange(false);

    if (editing) {
      router.refresh();
    } else {
      router.push(`/projects/${result.data.id}`);
    }
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-lg"
      isDismissable={!pending}
    >
      <DialogHeader>
        <DialogTitle>{editing ? "Project settings" : "New project"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Rename the project or update its description."
            : "Projects keep their own board, stacks, and task numbering."}
        </DialogDescription>
      </DialogHeader>

      {formError ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FieldGroup className="gap-4">
          <Field data-invalid={Boolean(nameError)}>
            <FieldLabel htmlFor="project-name">Name</FieldLabel>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => changeName(event.target.value)}
              placeholder="Website redesign"
              maxLength={120}
              autoFocus
              aria-invalid={Boolean(nameError)}
              disabled={pending}
            />
            {nameError ? <FieldError>{nameError}</FieldError> : null}
          </Field>

          {!editing ? (
            <Field data-invalid={Boolean(keyError)}>
              <FieldLabel htmlFor="project-key">Key</FieldLabel>
              <Input
                id="project-key"
                value={key}
                onChange={(event) => changeKey(event.target.value)}
                placeholder="WEB"
                maxLength={10}
                autoComplete="off"
                spellCheck={false}
                className="font-mono uppercase"
                aria-invalid={Boolean(keyError)}
                disabled={pending}
              />
              <FieldDescription>
                Used for task IDs like <span className="font-mono">WEB-12</span>.
                This cannot be changed later.
              </FieldDescription>
              {keyError ? <FieldError>{keyError}</FieldError> : null}
            </Field>
          ) : (
            <Field>
              <FieldLabel>Key</FieldLabel>
              <Input value={project!.key} readOnly disabled className="font-mono" />
              <FieldDescription>Project keys are permanent.</FieldDescription>
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="project-description">Description</FieldLabel>
            <Textarea
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this project for?"
              maxLength={2_000}
              rows={3}
              disabled={pending}
            />
            <FieldDescription>
              Optional. {description.length}/2,000 characters.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <DialogFooter>
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
                : "Create project"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
