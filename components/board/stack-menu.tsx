"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import type { BoardStack } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function StackMenu({
  stack,
  canMoveLeft,
  canMoveRight,
  onRename,
  onMoveLeft,
  onMoveRight,
  onDelete,
}: {
  stack: BoardStack;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onRename: (stack: BoardStack) => void;
  onMoveLeft: (stack: BoardStack) => void;
  onMoveRight: (stack: BoardStack) => void;
  onDelete: (stack: BoardStack) => void;
}) {
  return (
    <DropdownMenuTrigger>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Actions for ${stack.name}`}
      >
        <MoreHorizontalIcon />
      </Button>
      <DropdownMenu
        placement="bottom end"
        className="min-w-44"
        onAction={(key) => {
          switch (String(key)) {
            case "rename":
              onRename(stack);
              break;
            case "move-left":
              onMoveLeft(stack);
              break;
            case "move-right":
              onMoveRight(stack);
              break;
            case "delete":
              onDelete(stack);
              break;
          }
        }}
      >
        <DropdownMenuItem id="rename" textValue="Rename stack">
          <PencilIcon />
          Rename stack
        </DropdownMenuItem>
        <DropdownMenuItem
          id="move-left"
          textValue="Move left"
          isDisabled={!canMoveLeft}
        >
          <ArrowLeftIcon />
          Move left
        </DropdownMenuItem>
        <DropdownMenuItem
          id="move-right"
          textValue="Move right"
          isDisabled={!canMoveRight}
        >
          <ArrowRightIcon />
          Move right
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          id="delete"
          variant="destructive"
          textValue="Delete stack"
        >
          <Trash2Icon />
          Delete stack
        </DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}
