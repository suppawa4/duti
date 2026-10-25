import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ErrorState } from "@/components/app/error-state";
import { BoardSkeleton } from "@/components/app/loading-skeletons";
import { BoardView } from "@/components/board/board-view";
import { apiErrorMessage, apiErrorStatus } from "@/lib/api/errors";
import { loginPath } from "@/lib/auth/continue";
import { requireUser } from "@/lib/auth/server";
import { boardHref, boardQuery, parseBoardFilters } from "@/lib/board/filters";
import { createApi, getAccessToken } from "@/lib/eden.server";
import { isUuid } from "@/lib/ids";

export async function generateMetadata({
  params,
}: BoardPageProps): Promise<Metadata> {
  await connection();
  await requireUser();

  const { projectId } = await params;

  if (!isUuid(projectId)) {
    return { title: "Board" };
  }

  const token = await getAccessToken();

  if (!token) {
    return { title: "Board" };
  }

  const { data, error } = await createApi(token)
    .v1.projects({ projectId })
    .board.get({ query: boardQuery(parseBoardFilters({})) });

  if (error || !data) {
    return { title: "Board" };
  }

  return {
    title: `${data.project.name}'s Board`,
  };
}

type BoardPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function BoardContent({ params, searchParams }: BoardPageProps) {
  await connection();
  await requireUser();

  const { projectId } = await params;

  if (!isUuid(projectId)) {
    notFound();
  }

  const filters = parseBoardFilters(await searchParams);
  const currentHref = boardHref(projectId, filters);
  const token = await getAccessToken();

  if (!token) {
    redirect(loginPath(currentHref));
  }

  const { data, error } = await createApi(token)
    .v1.projects({ projectId })
    .board.get({ query: boardQuery(filters) });

  if (error) {
    if (apiErrorStatus(error) === 401) {
      redirect(loginPath(currentHref));
    }

    if (apiErrorStatus(error) === 404) {
      notFound();
    }

    console.error(error);

    return (
      <ErrorState
        title="Could not load board"
        description={
          apiErrorMessage(error) ??
          "The board could not be loaded. Please try again."
        }
        retryHref={currentHref}
      />
    );
  }

  if (!data) {
    return (
      <ErrorState
        title="Could not load board"
        description="The server returned an empty board."
        retryHref={currentHref}
      />
    );
  }

  return <BoardView data={data} />;
}

export default function BoardPage({ params, searchParams }: BoardPageProps) {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
