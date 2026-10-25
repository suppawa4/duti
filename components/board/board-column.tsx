"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";
import { cn } from "cn";
import type { BoardStack, Task } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StackMenu } from "./stack-menu";
import { TaskCard } from "./task-card";

export function BoardColumn({
  stack,
  stacks,
  index,
  onAddTask,
  onViewTask,
  onEditTask,
  onDeleteTask,
  onMoveTask,
  onRenameStack,
  onMoveStack,
  onDeleteStack,
}: {
  stack: BoardStack;
  stacks: BoardStack[];
  index: number;
  onAddTask: (stackId: string) => void;
  onViewTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onMoveTask: (task: Task, stackId: string) => void;
  onRenameStack: (stack: BoardStack) => void;
  onMoveStack: (stack: BoardStack, direction: -1 | 1) => void;
  onDeleteStack: (stack: BoardStack) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stack:${stack.id}`,
    data: { type: "stack", stackId: stack.id },
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={stack.name}
      className={cn(
        "flex w-[320px] shrink-0 flex-col rounded-xl bg-muted/40 p-2 transition-colors",
        isOver && "bg-muted/70 ring-2 ring-ring/20",
      )}
    >
      <header className="flex items-center gap-2 px-1 py-1.5">
        <h2 className="truncate text-sm font-semibold">{stack.name}</h2>
        <Badge variant="secondary" className="tabular-nums">
          {stack.tasks.length}
        </Badge>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Add task to ${stack.name}`}
            onPress={() => onAddTask(stack.id)}
          >
            <PlusIcon />
          </Button>
          <StackMenu
            stack={stack}
            canMoveLeft={index > 0}
            canMoveRight={index < stacks.length - 1}
            onRename={onRenameStack}
            onMoveLeft={(current) => onMoveStack(current, -1)}
            onMoveRight={(current) => onMoveStack(current, 1)}
            onDelete={onDeleteStack}
          />
        </div>
      </header>

      <SortableContext
        items={stack.tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-24 flex-col gap-2 p-0.5">
          {stack.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              stacks={stacks}
              onView={onViewTask}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onMove={onMoveTask}
            />
          ))}
          {stack.tasks.length === 0 ? (
            <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-border/80 px-3 text-center text-xs text-muted-foreground">
              Drop tasks here or add one.
            </div>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}
