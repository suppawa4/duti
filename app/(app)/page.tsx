import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { FolderPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { PageSkeleton } from "@/components/app/loading-skeletons";
import { PageHeader } from "@/components/app/page-header";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectCard } from "@/components/projects/project-card";
import { apiErrorMessage, apiErrorStatus } from "@/lib/api/errors";
import type { ProjectSummary } from "@/lib/api/types";
import { loginPath } from "@/lib/auth/continue";
import { requireUser } from "@/lib/auth/server";
import { createApi, getAccessToken } from "@/lib/eden.server";

export const metadata: Metadata = {
  title: "Projects",
};

async function ProjectsContent() {
  await connection();
  await requireUser();

  const token = await getAccessToken();

  if (!token) {
    redirect(loginPath("/"));
  }

  const { data, error } = await createApi(token).v1.projects.get();

  if (error) {
    if (apiErrorStatus(error) === 401) {
      redirect(loginPath("/"));
    }

    return (
      <ErrorState
        title="Could not load projects"
        description={
          apiErrorMessage(error) ??
          "The projects could not be loaded. Please try again."
        }
        retryHref="/"
      />
    );
  }

  const projects: ProjectSummary[] = data ?? [];

  return (
    <div className="flex flex-1 flex-col gap-8">
      <PageHeader
        title="Projects"
        description={
          projects.length === 0
            ? "Create a project to start tracking work on your personal board."
            : `${projects.length} ${
                projects.length === 1 ? "project" : "projects"
              } in your workspace.`
        }
        actions={<NewProjectButton />}
      />

      {projects.length === 0 ? (
        <EmptyState
          className="flex-1 border"
          icon={<FolderPlusIcon />}
          title="No projects yet"
          description="Every project gets its own board with configurable stacks and task kinds."
          action={
            <NewProjectButton
              label="Create your first project"
              variant="outline"
            />
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProjectsContent />
    </Suspense>
  );
}
