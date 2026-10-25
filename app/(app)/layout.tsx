import { Suspense } from "react";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppSplash } from "@/components/app/app-splash";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { ProjectSummary } from "@/lib/api/types";
import { requireUser } from "@/lib/auth/server";
import { createApi, getAccessToken } from "@/lib/eden.server";

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
    <Suspense fallback={<AppSplash />}>
      <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
    </Suspense>
  );
}
