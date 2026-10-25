"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import type { BoardData, BoardStack, Task } from "@/lib/api/types";
import {
  deleteTaskAction,
  moveTaskAction,
  reorderStacksAction,
} from "@/lib/board/actions";
import { deleteProjectAction } from "@/lib/projects/actions";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { BoardColumn } from "./board-column";
import { BoardFiltersBar } from "./board-filters";
import { BoardHeader } from "./board-header";
import { DeleteStackDialog } from "./delete-stack-dialog";
import { StackDialog } from "./stack-dialog";
import { TaskCardPreview } from "./task-card";
import { TaskDialog } from "./task-dialog";

type TaskDialogState = {
  task?: Task;
  stackId?: string;
  mode?: "view" | "edit";
};

type StackDialogState = {
  stack?: BoardStack;
};

export function BoardView({ data }: { data: BoardData }) {
  const router = useRouter();
  const [stacks, setStacks] = useState<BoardStack[]>(data.stacks);
  const [serverStacks, setServerStacks] = useState<BoardStack[]>(data.stacks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [taskDialog, setTaskDialog] = useState<TaskDialogState | null>(null);
  const [stackDialog, setStackDialog] = useState<StackDialogState | null>(null);
  const [deleteStack, setDeleteStack] = useState<BoardStack | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [projectDialog, setProjectDialog] = useState(false);
  const [deleteProject, setDeleteProject] = useState(false);

  if (data.stacks !== serverStacks) {
    setServerStacks(data.stacks);
    setStacks(data.stacks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task as Task | undefined;
    setActiveTask(task ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);

    const over = event.over;

    if (!over) {
      return;
    }

    const activeId = String(event.active.id);
    const sourceStack = stacks.find((stack) =>
      stack.tasks.some((task) => task.id === activeId),
    );
    const movedTask = sourceStack?.tasks.find((task) => task.id === activeId);
    const overData = over.data.current as
      { type?: string; stackId?: string } | undefined;

    if (!sourceStack || !movedTask || !overData?.stackId) {
      return;
    }

    const targetStackId = overData.stackId;
    const overTaskId = overData.type === "task" ? String(over.id) : null;

    if (targetStackId === sourceStack.id && overTaskId === activeId) {
      return;
    }

    const targetStack = stacks.find((stack) => stack.id === targetStackId);

    if (!targetStack) {
      return;
    }

    const previous = stacks;
    let next: BoardStack[];
    let beforeTaskId: string | null = null;

    if (sourceStack.id === targetStackId) {
      const oldIndex = targetStack.tasks.findIndex(
        (task) => task.id === activeId,
      );
      const newIndex = overTaskId
        ? targetStack.tasks.findIndex((task) => task.id === overTaskId)
        : targetStack.tasks.length - 1;

      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      const reordered = arrayMove(targetStack.tasks, oldIndex, newIndex);
      const movedIndex = reordered.findIndex((task) => task.id === activeId);
      beforeTaskId = reordered[movedIndex + 1]?.id ?? null;
      next = stacks.map((stack) =>
        stack.id === targetStackId ? { ...stack, tasks: reordered } : stack,
      );
    } else {
      const targetTasks = [...targetStack.tasks];
      const overIndex = overTaskId
        ? targetTasks.findIndex((task) => task.id === overTaskId)
        : -1;
      const insertIndex = overIndex >= 0 ? overIndex : targetTasks.length;

      targetTasks.splice(insertIndex, 0, {
        ...movedTask,
        stackId: targetStackId,
      });
      beforeTaskId = targetTasks[insertIndex + 1]?.id ?? null;
      next = stacks.map((stack) => {
        if (stack.id === sourceStack.id) {
          return {
            ...stack,
            tasks: stack.tasks.filter((task) => task.id !== activeId),
          };
        }

        if (stack.id === targetStackId) {
          return { ...stack, tasks: targetTasks };
        }

        return stack;
      });
    }

    setStacks(next);

    const result = await moveTaskAction({
      taskId: activeId,
      stackId: targetStackId,
      beforeTaskId,
      projectId: data.project.id,
    });

    if (!result.ok) {
      setStacks(previous);
      toast.error(result.error.message);
      return;
    }

    router.refresh();
  }

  async function moveTaskToStack(task: Task, stackId: string) {
    if (task.stackId === stackId) {
      return;
    }

    const previous = stacks;
    const next = stacks.map((stack) => {
      if (stack.id === task.stackId) {
        return {
          ...stack,
          tasks: stack.tasks.filter((item) => item.id !== task.id),
        };
      }

      if (stack.id === stackId) {
        return {
          ...stack,
          tasks: [...stack.tasks, { ...task, stackId }],
        };
      }

      return stack;
    });

    setStacks(next);

    const result = await moveTaskAction({
      taskId: task.id,
      stackId,
      beforeTaskId: null,
      projectId: data.project.id,
    });

    if (!result.ok) {
      setStacks(previous);
      toast.error(result.error.message);
      return;
    }

    router.refresh();
  }

  async function moveStack(stack: BoardStack, direction: -1 | 1) {
    const index = stacks.findIndex((item) => item.id === stack.id);
    const target = index + direction;

    if (index < 0 || target < 0 || target >= stacks.length) {
      return;
    }

    const previous = stacks;
    const next = arrayMove(stacks, index, target);
    setStacks(next);

    const result = await reorderStacksAction({
      projectId: data.project.id,
      stackIds: next.map((item) => item.id),
    });

    if (!result.ok) {
      setStacks(previous);
      toast.error(result.error.message);
      return;
    }

    router.refresh();
  }

  async function removeTask() {
    if (!deleteTask) {
      return;
    }

    const result = await deleteTaskAction(deleteTask.id, data.project.id);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success("Task deleted");
    setDeleteTask(null);
    router.refresh();
  }

  async function removeProject() {
    const result = await deleteProjectAction(data.project.id);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success("Project deleted");
    setDeleteProject(false);
    router.push("/");
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BoardHeader
        project={data.project}
        onNewTask={() => setTaskDialog({ stackId: stacks[0]?.id })}
        onProjectSettings={() => setProjectDialog(true)}
        onDeleteProject={() => setDeleteProject(true)}
      />

      <BoardFiltersBar
        filters={data.filters}
        kinds={data.kinds}
        stacks={stacks}
      />

      <DndContext
        id="board-dnd-context"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragCancel={() => setActiveTask(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 items-start gap-3 overflow-x-auto pb-4">
          {stacks.map((stack, index) => (
            <BoardColumn
              key={stack.id}
              stack={stack}
              stacks={stacks}
              index={index}
              onAddTask={(stackId) => setTaskDialog({ stackId })}
              onViewTask={(task) => setTaskDialog({ task, mode: "view" })}
              onEditTask={(task) => setTaskDialog({ task, mode: "edit" })}
              onDeleteTask={setDeleteTask}
              onMoveTask={moveTaskToStack}
              onRenameStack={(item) => setStackDialog({ stack: item })}
              onMoveStack={moveStack}
              onDeleteStack={setDeleteStack}
            />
          ))}

          <Button
            variant="outline"
            className=""
            onPress={() => setStackDialog({})}
          >
            <PlusIcon />
          </Button>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCardPreview task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {taskDialog ? (
        <TaskDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setTaskDialog(null);
            }
          }}
          projectId={data.project.id}
          task={taskDialog.task}
          mode={taskDialog.mode}
          stacks={stacks}
          kinds={data.kinds}
          defaultStackId={taskDialog.stackId}
        />
      ) : null}

      {stackDialog ? (
        <StackDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setStackDialog(null);
            }
          }}
          projectId={data.project.id}
          stack={stackDialog.stack}
        />
      ) : null}

      {deleteStack ? (
        <DeleteStackDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeleteStack(null);
            }
          }}
          projectId={data.project.id}
          stack={deleteStack}
          stacks={stacks}
        />
      ) : null}

      {deleteTask ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTask(null);
            }
          }}
          title={`Delete “${deleteTask.title}”?`}
          description="This removes the task permanently. This cannot be undone."
          confirmLabel="Delete task"
          pendingLabel="Deleting…"
          onConfirm={removeTask}
        />
      ) : null}

      {projectDialog ? (
        <ProjectDialog
          open
          onOpenChange={setProjectDialog}
          project={data.project}
        />
      ) : null}

      {deleteProject ? (
        <ConfirmDialog
          open
          onOpenChange={setDeleteProject}
          title={`Delete “${data.project.name}”?`}
          description="This deletes the project, its board, stacks, and every task in it. This cannot be undone."
          confirmLabel="Delete project"
          pendingLabel="Deleting…"
          onConfirm={removeProject}
        />
      ) : null}
    </div>
  );
}
