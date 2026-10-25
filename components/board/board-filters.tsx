"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import type { BoardFilters, BoardStack, TaskKind } from "@/lib/api/types";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function BoardFiltersBar({
  filters,
  kinds,
  stacks,
}: {
  filters: BoardFilters;
  kinds: TaskKind[];
  stacks: BoardStack[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  const selectedKind = kinds.some((kind) => kind.key === filters.kind)
    ? filters.kind!
    : "all";
  const selectedStack = stacks.some((stack) => stack.id === filters.stack)
    ? filters.stack!
    : "all";
  const hasFilters = Boolean(
    filters.q || filters.priority || filters.kind || filters.stack,
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-2 lg:flex-row lg:items-center",
        pending && "opacity-70",
      )}
      aria-busy={pending}
    >
      <form
        className="flex min-w-0 flex-1 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("q");
          const q = typeof value === "string" ? value.trim() : "";
          updateParams({ q: q || null });
        }}
        role="search"
      >
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            key={filters.q}
            name="q"
            defaultValue={filters.q}
            placeholder="Search tasks by title or description…"
            aria-label="Search tasks"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="outline" isDisabled={pending}>
          Search
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          selectedKey={filters.priority ?? "all"}
          onSelectionChange={(key) =>
            updateParams({
              priority: key === "all" ? null : String(key),
            })
          }
          isDisabled={pending}
          aria-label="Filter by priority"
          className="w-[145px]"
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem id="all" textValue="All priorities">
              All priorities
            </SelectItem>
            {TASK_PRIORITIES.map((priority) => (
              <SelectItem
                key={priority}
                id={priority}
                textValue={TASK_PRIORITY_LABELS[priority]}
              >
                {TASK_PRIORITY_LABELS[priority]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          selectedKey={selectedKind}
          onSelectionChange={(key) =>
            updateParams({
              kind: key === "all" ? null : String(key),
            })
          }
          isDisabled={pending}
          aria-label="Filter by task kind"
          className="w-[145px]"
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem id="all" textValue="All kinds">
              All kinds
            </SelectItem>
            {kinds.map((kind) => (
              <SelectItem key={kind.id} id={kind.key} textValue={kind.name}>
                {kind.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          selectedKey={selectedStack}
          onSelectionChange={(key) =>
            updateParams({
              stack: key === "all" ? null : String(key),
            })
          }
          isDisabled={pending}
          aria-label="Filter by stack"
          className="w-[145px]"
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem id="all" textValue="All stacks">
              All stacks
            </SelectItem>
            {stacks.map((stack) => (
              <SelectItem key={stack.id} id={stack.id} textValue={stack.name}>
                {stack.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onPress={() =>
              updateParams({ q: null, priority: null, kind: null, stack: null })
            }
            isDisabled={pending}
          >
            <XIcon data-icon="inline-start" />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
