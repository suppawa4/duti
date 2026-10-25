import {
  EMPTY_RICH_TEXT,
  normalizeRichText,
  type RichTextDoc,
} from "@/lib/rich-text";
import {
  TASK_PRIORITIES,
  type ApiKey,
  type BoardStack,
  type Project,
  type ProjectSummary,
  type Stack,
  type Task,
  type TaskKind,
  type TaskPriority,
} from "@/lib/api/types";

export type ProjectRow = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskKindRow = {
  id: string;
  key: string;
  name: string;
  is_default: boolean;
};

export type StackRow = {
  id: string;
  name: string;
  position: number;
};

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type TaskRow = {
  id: string;
  number: number;
  key: string;
  project_id: string;
  stack_id: string;
  kind_id: string;
  title: string;
  description: unknown;
  description_text: string;
  priority: string;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

function priority(value: string): TaskPriority {
  return TASK_PRIORITIES.includes(value as TaskPriority)
    ? (value as TaskPriority)
    : "medium";
}

function description(value: unknown): RichTextDoc {
  try {
    return normalizeRichText(value);
  } catch {
    return EMPTY_RICH_TEXT;
  }
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    key: row.key,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toProjectSummary(
  row: ProjectRow,
  taskCount: number,
): ProjectSummary {
  return {
    ...toProject(row),
    taskCount,
  };
}

export function toTaskKind(row: TaskKindRow): TaskKind {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isDefault: row.is_default,
  };
}

export function toApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

export function toTask(row: TaskRow, kind: TaskKind): Task {
  return {
    id: row.id,
    key: row.key,
    number: Number(row.number),
    projectId: row.project_id,
    stackId: row.stack_id,
    kind,
    title: row.title,
    description: description(row.description),
    descriptionText: row.description_text,
    priority: priority(row.priority),
    dueDate: row.due_date,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toStack(row: StackRow): Stack {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
  };
}

export function toBoardStack(row: StackRow, tasks: Task[]): BoardStack {
  return {
    ...toStack(row),
    tasks,
  };
}
