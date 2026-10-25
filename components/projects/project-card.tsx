import Link from "next/link";
import { ArrowUpRightIcon, ListTodoIcon } from "lucide-react";
import type { ProjectSummary } from "@/lib/api/types";
import { formatRelativeDate, taskCountLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full gap-4 transition-colors group-hover:bg-muted/40">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <Badge variant="secondary" className="font-mono">
              {project.key}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(project.updatedAt)}
            </span>
          </div>
          <CardTitle className="mt-1 flex items-start justify-between gap-3 text-base">
            <span className="line-clamp-2">{project.name}</span>
            <ArrowUpRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </CardTitle>
          <CardDescription className="line-clamp-2 min-h-10">
            {project.description ?? "No description yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-auto">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ListTodoIcon className="size-3.5" />
            {taskCountLabel(project.taskCount)}
          </div>
        </CardContent>
        <CardFooter className="border-t pt-3 text-xs text-muted-foreground">
          Created {formatRelativeDate(project.createdAt)}
        </CardFooter>
      </Card>
    </Link>
  );
}
