"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BoardStack } from "@/lib/api/types";
import { deleteStackAction } from "@/lib/board/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DeleteStackDialog({
  open,
  onOpenChange,
  projectId,
  stack,
  stacks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  stack: BoardStack;
  stacks: BoardStack[];
}) {
  const router = useRouter();
  const otherStacks = stacks.filter((item) => item.id !== stack.id);
  const [moveTasksTo, setMoveTasksTo] = useState(otherStacks[0]?.id ?? "");

  async function remove() {
    const result = await deleteStackAction({
      projectId,
      stackId: stack.id,
      moveTasksTo: moveTasksTo || null,
    });

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success("Stack deleted");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete “${stack.name}”?`}
      description="This removes the column from the board. This cannot be undone."
      confirmLabel="Delete stack"
      pendingLabel="Deleting…"
      confirmDisabled={otherStacks.length === 0}
      onConfirm={remove}
    >
      {otherStacks.length > 0 ? (
        <Field>
          <FieldLabel id="move-stack-label">Move tasks to</FieldLabel>
          <Select
            selectedKey={moveTasksTo}
            onSelectionChange={(key) => {
              if (key) {
                setMoveTasksTo(String(key));
              }
            }}
            aria-labelledby="move-stack-label"
            className="w-full"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {otherStacks.map((item) => (
                <SelectItem key={item.id} id={item.id} textValue={item.name}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Any tasks in this stack will be moved here.
          </FieldDescription>
        </Field>
      ) : (
        <FieldDescription>
          The board needs at least one stack, so this stack cannot be deleted.
        </FieldDescription>
      )}
    </ConfirmDialog>
  );
}
