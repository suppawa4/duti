import type { RichTextDoc } from "@/lib/rich-text";

export const TASK_PRIORITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export type TaskKind = {
  id: string;
  key: string;
  name: string;
  isDefault: boolean;
};

export type Task = {
  id: string;
  key: string;
  number: number;
  projectId: string;
  stackId: string;
  kind: TaskKind;
  title: string;
  description: RichTextDoc;
  descriptionText: string;
  priority: TaskPriority;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type Stack = {
  id: string;
  name: string;
  position: number;
};

export type BoardStack = Stack & {
  tasks: Task[];
};

export type Project = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSummary = Project & {
  taskCount: number;
};

export type BoardFilters = {
  q: string;
  priority: TaskPriority | null;
  kind: string | null;
  stack: string | null;
};

export type BoardData = {
  project: Project;
  board: {
    id: string;
    name: string;
  };
  stacks: BoardStack[];
  kinds: TaskKind[];
  filters: BoardFilters;
};

export type CreateProjectInput = {
  name: string;
  key: string;
  description: string;
};

export type UpdateProjectInput = {
  projectId: string;
  name?: string;
  description?: string | null;
};

export type CreateStackInput = {
  projectId: string;
  name: string;
};

export type RenameStackInput = {
  stackId: string;
  name: string;
};

export type DeleteStackInput = {
  stackId: string;
  moveTasksTo: string | null;
};

export type ReorderStacksInput = {
  projectId: string;
  stackIds: string[];
};

export type CreateTaskInput = {
  projectId: string;
  title: string;
  description: RichTextDoc;
  kind: string;
  priority: TaskPriority;
  dueDate: string | null;
  stackId: string | null;
};

export type UpdateTaskInput = {
  taskId: string;
  title?: string;
  description?: RichTextDoc;
  kind?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
};

export type MoveTaskInput = {
  taskId: string;
  stackId: string;
  beforeTaskId: string | null;
};

export type CreateTaskKindInput = {
  key: string;
  name: string;
};

export type UpdateTaskKindInput = {
  kindId: string;
  name: string;
};

export type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type CreatedApiKey = {
  apiKey: ApiKey;
  secret: string;
};

export type CreateApiKeyInput = {
  name: string;
  expiresAt?: string | null;
};
