"use client";

import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import type { Project } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BoardHeader({
  project,
  onNewTask,
  onProjectSettings,
  onDeleteProject,
}: {
  project: Project;
  onNewTask: () => void;
  onProjectSettings: () => void;
  onDeleteProject: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-64 truncate">
              {project.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <Badge variant="secondary" className="font-mono">
              {project.key}
            </Badge>
          </div>
          {project.description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {project.description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button onPress={onNewTask}>
            <PlusIcon data-icon="inline-start" />
            New task
          </Button>
          <DropdownMenuTrigger>
            <Button
              variant="outline"
              size="icon"
              aria-label="Project actions"
            >
              <MoreHorizontalIcon />
            </Button>
            <DropdownMenu
              placement="bottom end"
              className="min-w-44"
              onAction={(key) => {
                switch (String(key)) {
                  case "settings":
                    onProjectSettings();
                    break;
                  case "delete":
                    onDeleteProject();
                    break;
                }
              }}
            >
              <DropdownMenuItem id="settings" textValue="Project settings">
                <PencilIcon />
                Project settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                id="delete"
                variant="destructive"
                textValue="Delete project"
              >
                <Trash2Icon />
                Delete project
              </DropdownMenuItem>
            </DropdownMenu>
          </DropdownMenuTrigger>
        </div>
      </div>
    </div>
  );
}
