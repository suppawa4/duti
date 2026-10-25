import { FolderXIcon } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { LinkButton } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <EmptyState
        className="max-w-md"
        icon={<FolderXIcon />}
        title="Project not found"
        description="This project may have been deleted, or it belongs to another workspace."
        action={<LinkButton href="/">Back to projects</LinkButton>}
      />
    </div>
  );
}
