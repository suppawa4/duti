"use client";

import { useRef, type MouseEvent, type PointerEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarIcon,
  CornerDownRightIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "cn";
import type { BoardStack, Task, TaskPriority } from "@/lib/api/types";
import { TASK_PRIORITY_LABELS } from "@/lib/api/types";
import { formatDate, isOverdue } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const priorityStyles: Record<TaskPriority, string> = {
  low: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  medium:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  critical: "border-destructive/30 bg-destructive/10 text-destructive",
};

const DRAG_DISTANCE = 6;

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1", priorityStyles[priority], className)}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}

function TaskMenu({
  task,
  stacks,
  onView,
  onEdit,
  onDelete,
  onMove,
}: {
  task: Task;
  stacks: BoardStack[];
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMove: (task: Task, stackId: string) => void;
}) {
  const otherStacks = stacks.filter((stack) => stack.id !== task.stackId);

  return (
    <DropdownMenuTrigger>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Actions for ${task.title}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <MoreHorizontalIcon />
      </Button>
      <DropdownMenu
        placement="bottom end"
        className="min-w-44"
        onAction={(key) => {
          const value = String(key);

          if (value === "view") {
            onView(task);
            return;
          }

          if (value === "edit") {
            onEdit(task);
            return;
          }

          if (value === "delete") {
            onDelete(task);
            return;
          }

          if (value.startsWith("move:")) {
            onMove(task, value.slice("move:".length));
          }
        }}
      >
        <DropdownMenuItem id="view" textValue="View task">
          <EyeIcon />
          View task
        </DropdownMenuItem>
        <DropdownMenuItem id="edit" textValue="Edit task">
          <PencilIcon />
          Edit task
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {otherStacks.length === 0 ? (
            <DropdownMenuItem id="move:none" textValue="No other stacks" isDisabled>
              No other stacks
            </DropdownMenuItem>
          ) : (
            otherStacks.map((stack) => (
              <DropdownMenuItem
                key={stack.id}
                id={`move:${stack.id}`}
                textValue={`Move to ${stack.name}`}
              >
                <CornerDownRightIcon />
                {stack.name}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem id="delete" variant="destructive" textValue="Delete task">
          <Trash2Icon />
          Delete task
        </DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}

export function TaskCard({
  task,
  stacks,
  onView,
  onEdit,
  onDelete,
  onMove,
}: {
  task: Task;
  stacks: BoardStack[];
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMove: (task: Task, stackId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", task, stackId: task.stackId },
  });
  const { onKeyDown: keyboardListener, ...pointerListeners } = listeners ?? {};
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    pointerStart.current = { x: event.clientX, y: event.clientY };
    pointerListeners.onPointerDown?.(event);
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;

    if (start) {
      const distance = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y,
      );

      if (distance > DRAG_DISTANCE) {
        return;
      }
    }

    onView(task);
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "touch-manipulation select-none",
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        {...attributes}
        className="sr-only"
        aria-label={`Move ${task.title}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          keyboardListener?.(event);
        }}
      />
      <Card
        size="sm"
        className="cursor-grab gap-0 py-0 shadow-xs active:cursor-grabbing"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
      >
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-1">
            <span className="font-mono text-[11px] font-medium text-muted-foreground">
              {task.key}
            </span>
            <div className="ml-auto">
              <TaskMenu
                task={task}
                stacks={stacks}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
              />
            </div>
          </div>

          <p className="text-sm font-medium leading-snug">{task.title}</p>

          {task.descriptionText ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {task.descriptionText}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <PriorityBadge priority={task.priority} />
            <Badge variant="secondary">{task.kind.name}</Badge>
            {task.dueDate ? (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1",
                  isOverdue(task.dueDate) &&
                    "border-destructive/30 text-destructive",
                )}
              >
                <CalendarIcon className="size-3" />
                {formatDate(task.dueDate)}
              </Badge>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}

export function TaskCardPreview({ task }: { task: Task }) {
  return (
    <Card size="sm" className="w-[300px] gap-0 py-0 shadow-lg ring-2">
      <div className="flex flex-col gap-2 p-3">
        <span className="font-mono text-[11px] font-medium text-muted-foreground">
          {task.key}
        </span>
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
          <Badge variant="secondary">{task.kind.name}</Badge>
        </div>
      </div>
    </Card>
  );
}
