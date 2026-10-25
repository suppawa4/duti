"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectDialog } from "./project-dialog";

export function NewProjectButton({
  label = "New project",
  variant = "default",
  size = "default",
  className,
}: {
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onPress={() => setOpen(true)}
      >
        <PlusIcon data-icon="inline-start" />
        {label}
      </Button>
      {open ? <ProjectDialog open onOpenChange={setOpen} /> : null}
    </>
  );
}
