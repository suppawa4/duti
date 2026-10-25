"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import type { TaskKind } from "@/lib/api/types";
import { deleteTaskKindAction } from "@/lib/task-kinds/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskKindDialog } from "./task-kind-dialog";

type KindDialogState = {
  kind?: TaskKind;
};

export function TaskKindsSettings({ kinds }: { kinds: TaskKind[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<KindDialogState | null>(null);
  const [deleteKind, setDeleteKind] = useState<TaskKind | null>(null);

  async function removeKind() {
    if (!deleteKind) {
      return;
    }

    const result = await deleteTaskKindAction(deleteKind.id);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success("Task kind deleted");
    setDeleteKind(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Task kinds</CardTitle>
            <CardDescription>
              Classify tasks across every project. The default kind is used
              when an API client does not provide one.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onPress={() => setDialog({})}
            className="shrink-0"
          >
            <PlusIcon data-icon="inline-start" />
            New kind
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {kinds.map((kind) => (
            <div
              key={kind.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <TagIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {kind.name}
                  </span>
                  {kind.isDefault ? <Badge>Default</Badge> : null}
                  <Badge variant="outline" className="font-mono">
                    {kind.key}
                  </Badge>
                </div>
              </div>
              <DropdownMenuTrigger>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${kind.name}`}
                >
                  <MoreHorizontalIcon />
                </Button>
                <DropdownMenu
                  placement="bottom end"
                  className="min-w-40"
                  onAction={(key) => {
                    if (String(key) === "edit") {
                      setDialog({ kind });
                    }

                    if (String(key) === "delete") {
                      setDeleteKind(kind);
                    }
                  }}
                >
                  <DropdownMenuItem id="edit" textValue="Edit kind">
                    <PencilIcon />
                    Edit kind
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    id="delete"
                    variant="destructive"
                    textValue="Delete kind"
                    isDisabled={kind.isDefault}
                  >
                    <Trash2Icon />
                    Delete kind
                  </DropdownMenuItem>
                </DropdownMenu>
              </DropdownMenuTrigger>
            </div>
          ))}
        </div>
      </CardContent>

      {dialog ? (
        <TaskKindDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialog(null);
            }
          }}
          kind={dialog.kind}
        />
      ) : null}

      {deleteKind ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeleteKind(null);
            }
          }}
          title={`Delete “${deleteKind.name}”?`}
          description="Tasks using this kind must be reassigned before it can be deleted."
          confirmLabel="Delete kind"
          pendingLabel="Deleting…"
          onConfirm={removeKind}
        />
      ) : null}
    </Card>
  );
}
