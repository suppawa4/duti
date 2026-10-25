import { Suspense } from "react";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PageSkeleton } from "@/components/app/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectSummary } from "@/lib/api/types";
import { requireUser } from "@/lib/auth/server";
import { createApi, getAccessToken } from "@/lib/eden.server";

function AppShellFallback() {
  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-60 shrink-0 border-r p-4 md:block">
        <Skeleton className="h-8 w-24" />
        <div className="mt-8 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b px-4">
          <Skeleton className="size-8 rounded-full" />
        </header>
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
          <PageSkeleton />
        </main>
      </div>
    </div>
  );
}

async function AuthenticatedAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const user = await requireUser();
  const token = await getAccessToken();
  let projects: ProjectSummary[] = [];

  if (token) {
    const { data } = await createApi(token).v1.projects.get();
    projects = data ?? [];
  }

  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar projects={projects} />
      <SidebarInset className="min-w-0">
        <AppHeader user={user} />
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellFallback />}>
      <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
    </Suspense>
  );
}
