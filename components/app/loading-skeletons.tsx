import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex flex-1 flex-col gap-8"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading board"
      className="flex flex-1 flex-col gap-6"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex w-[320px] shrink-0 flex-col gap-3 rounded-xl bg-muted/40 p-3"
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoginSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading sign-in"
      className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-8 shadow-sm"
    >
      <Skeleton className="size-10 rounded-xl" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
