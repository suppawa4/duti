"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  CalendarIcon,
  PencilIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BoardStack,
  Task,
  TaskKind,
  TaskPriority,
} from "@/lib/api/types";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/api/types";
import { emptyRichText, type RichTextDoc } from "@/lib/rich-text";
import { createTaskAction, updateTaskAction } from "@/lib/board/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";

export function TaskDialog({
  open,
  onOpenChange,
  projectId,
  task,
  mode = "edit",
  stacks,
  kinds,
  defaultStackId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task?: Task;
  mode?: "view" | "edit";
  stacks: BoardStack[];
  kinds: TaskKind[];
  defaultStackId?: string | null;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(mode !== "view");
  const viewing = Boolean(task) && !isEditing;
  const editing = Boolean(task) && isEditing;
  const initialKind =
    task?.kind.key ??
    kinds.find((kind) => kind.isDefault)?.key ??
    kinds[0]?.key ??
    "";
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState<RichTextDoc>(
    task?.description ?? emptyRichText(),
  );
  const [kindKey, setKindKey] = useState(initialKind);
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? "medium",
  );
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [stackId, setStackId] = useState(
    task?.stackId ?? defaultStackId ?? stacks[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (viewing) {
      return;
    }

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("Task title is required.");
      return;
    }

    if (!kindKey) {
      setError("Choose a task kind.");
      return;
    }

    if (!editing && !stackId) {
      setError("Choose a stack.");
      return;
    }

    setPending(true);
    setError(null);

    const result = editing
      ? await updateTaskAction({
          taskId: task!.id,
          projectId,
          title: trimmedTitle,
          description,
          kind: kindKey,
          priority,
          dueDate: dueDate || null,
        })
      : await createTaskAction({
          projectId,
          title: trimmedTitle,
          description,
          kind: kindKey,
          priority,
          dueDate: dueDate || null,
          stackId,
        });

    if (!result.ok) {
      setPending(false);
      setError(result.error.message);
      return;
    }

    toast.success(editing ? "Task updated" : "Task created");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
      isDismissable={!pending}
    >
      <DialogHeader>
        <DialogTitle>
          {viewing
            ? `View ${task!.key}`
            : editing
              ? `Edit ${task!.key}`
              : "New task"}
        </DialogTitle>
        <DialogDescription>
          {viewing
            ? "Task details. Choose Edit task to make changes."
            : editing
              ? "Update the details. Move it between stacks from the board."
              : "Add a task to the project board."}
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
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
          <Field>
            <FieldLabel htmlFor="task-title">Title</FieldLabel>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs to be done?"
              maxLength={500}
              autoFocus={!viewing}
              disabled={pending || viewing}
            />
          </Field>

          <Field>
            <FieldLabel>Description</FieldLabel>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              disabled={pending || viewing}
              ariaLabel="Task description"
            />
            <FieldDescription>
              Use the toolbar for formatting. Plain text is searchable too.
            </FieldDescription>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel id="task-kind-label">Kind</FieldLabel>
              <Select
                selectedKey={kindKey}
                onSelectionChange={(key) => {
                  if (key) {
                    setKindKey(String(key));
                  }
                }}
                isDisabled={pending || viewing}
                aria-labelledby="task-kind-label"
                className="w-full"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((kind) => (
                    <SelectItem key={kind.id} id={kind.key} textValue={kind.name}>
                      {kind.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel id="task-priority-label">Priority</FieldLabel>
              <Select
                selectedKey={priority}
                onSelectionChange={(key) => {
                  if (key) {
                    setPriority(String(key) as TaskPriority);
                  }
                }}
                isDisabled={pending || viewing}
                aria-labelledby="task-priority-label"
                className="w-full"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((value) => (
                    <SelectItem
                      key={value}
                      id={value}
                      textValue={TASK_PRIORITY_LABELS[value]}
                    >
                      {TASK_PRIORITY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="task-due-date">Due date</FieldLabel>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <CalendarIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="task-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="pl-8"
                    disabled={pending || viewing}
                  />
                </div>
                {dueDate && !viewing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onPress={() => setDueDate("")}
                    isDisabled={pending}
                    aria-label="Clear due date"
                  >
                    <XIcon />
                  </Button>
                ) : null}
              </div>
            </Field>

            {!task ? (
              <Field>
                <FieldLabel id="task-stack-label">Stack</FieldLabel>
                <Select
                  selectedKey={stackId}
                  onSelectionChange={(key) => {
                    if (key) {
                      setStackId(String(key));
                    }
                  }}
                  isDisabled={pending}
                  aria-labelledby="task-stack-label"
                  className="w-full"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stacks.map((stack) => (
                      <SelectItem
                        key={stack.id}
                        id={stack.id}
                        textValue={stack.name}
                      >
                        {stack.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>
        </FieldGroup>

        <DialogFooter>
          {viewing ? (
            <>
              <DialogClose variant="outline">Close</DialogClose>
              {/* The footer swaps this button for a submit button mid-click. */}
              <Button
                type="button"
                onClick={(event) => event.preventDefault()}
                onPress={() => setIsEditing(true)}
              >
                <PencilIcon data-icon="inline-start" />
                Edit task
              </Button>
            </>
          ) : (
            <>
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
                    : "Create task"}
              </Button>
            </>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}
