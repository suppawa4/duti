import type { BoardFilters, TaskPriority } from "@/lib/api/types";
import { TASK_PRIORITIES } from "@/lib/api/types";
import { firstSearchParam } from "@/lib/auth/continue";

export function parseBoardFilters(
  search: Record<string, string | string[] | undefined>,
): BoardFilters {
  const rawPriority = firstSearchParam(search.priority);
  const priority = TASK_PRIORITIES.includes(rawPriority as TaskPriority)
    ? (rawPriority as TaskPriority)
    : null;

  return {
    q: firstSearchParam(search.q)?.trim() ?? "",
    priority,
    kind: firstSearchParam(search.kind)?.trim() || null,
    stack: firstSearchParam(search.stack)?.trim() || null,
  };
}

export function boardHref(projectId: string, filters: BoardFilters): string {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.priority) {
    params.set("priority", filters.priority);
  }

  if (filters.kind) {
    params.set("kind", filters.kind);
  }

  if (filters.stack) {
    params.set("stack", filters.stack);
  }

  const query = params.toString();
  return `/projects/${projectId}${query ? `?${query}` : ""}`;
}

export function boardQuery(filters: BoardFilters) {
  return {
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.stack ? { stack: filters.stack } : {}),
  };
}
