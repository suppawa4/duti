"use client";

import { useState, type ReactNode } from "react";
import { TriangleAlertIcon } from "lucide-react";
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
  destructive = true,
  confirmDisabled = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  pendingLabel?: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}) {
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);

    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setPending(false);
    }

    onOpenChange(nextOpen);
  }

  return (
    <AlertDialogContent
      isOpen={open}
      onOpenChange={handleOpenChange}
      size="sm"
      isDismissable={!pending}
    >
      <AlertDialogHeader>
        <AlertDialogMedia>
          <TriangleAlertIcon />
        </AlertDialogMedia>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      {children}
      <AlertDialogFooter>
        <AlertDialogCancel isDisabled={pending}>Cancel</AlertDialogCancel>
        <Button
          variant={destructive ? "destructive" : "default"}
          onPress={confirm}
          isDisabled={pending || confirmDisabled}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
