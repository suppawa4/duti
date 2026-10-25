"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRoundIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ShieldOffIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { ApiKey, CreatedApiKey } from "@/lib/api/types";
import { revokeApiKeyAction } from "@/lib/api-keys/actions";
import { formatDate, formatRelativeDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiKeyCreateDialog } from "./api-key-dialog";
import { ApiKeySecretDialog } from "./api-key-secret-dialog";

function statusOf(key: ApiKey): "active" | "expired" | "revoked" {
  if (key.revokedAt) {
    return "revoked";
  }

  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }

  return "active";
}

export function ApiKeysSettings({ keys }: { keys: ApiKey[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [revokeKey, setRevokeKey] = useState<ApiKey | null>(null);

  async function revoke() {
    if (!revokeKey) {
      return;
    }

    const result = await revokeApiKeyAction(revokeKey.id);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success("API key revoked");
    setRevokeKey(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>API keys</CardTitle>
            <CardDescription>
              Workspace-scoped credentials for agents and scripts. Keys can
              create and update tasks through the API.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onPress={() => setCreateOpen(true)}
            className="shrink-0"
          >
            <PlusIcon data-icon="inline-start" />
            New key
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {keys.length === 0 ? (
          <div className="m-4 grid min-h-32 place-items-center rounded-lg border border-dashed px-4 text-center">
            <div className="max-w-sm space-y-1.5">
              <KeyRoundIcon className="mx-auto size-5 text-muted-foreground" />
              <p className="text-sm font-medium">No API keys yet</p>
              <p className="text-xs text-muted-foreground">
                Create a key when you are ready to let an agent add tasks to
                your board.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {keys.map((key) => {
              const status = statusOf(key);

              return (
                <div
                  key={key.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <KeyRoundIcon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {key.name}
                      </span>
                      <Badge
                        variant={
                          status === "active"
                            ? "secondary"
                            : status === "revoked"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {status === "active"
                          ? "Active"
                          : status === "revoked"
                            ? "Revoked"
                            : "Expired"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono">{key.keyPrefix}…</span>
                      <span>
                        Last used:{" "}
                        {key.lastUsedAt
                          ? formatRelativeDate(key.lastUsedAt)
                          : "Never"}
                      </span>
                      {key.expiresAt ? (
                        <span>Expires: {formatDate(key.expiresAt)}</span>
                      ) : null}
                      <span>Created: {formatDate(key.createdAt)}</span>
                    </div>
                  </div>
                  {status !== "revoked" ? (
                    <DropdownMenuTrigger>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${key.name}`}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                      <DropdownMenu
                        placement="bottom end"
                        className="min-w-44"
                        onAction={(action) => {
                          if (String(action) === "revoke") {
                            setRevokeKey(key);
                          }
                        }}
                      >
                        <DropdownMenuItem
                          id="revoke"
                          variant="destructive"
                          textValue="Revoke key"
                        >
                          <ShieldOffIcon />
                          Revoke key
                        </DropdownMenuItem>
                      </DropdownMenu>
                    </DropdownMenuTrigger>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {createOpen ? (
        <ApiKeyCreateDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setCreateOpen(false);
            }
          }}
          onCreated={(value) => {
            setCreateOpen(false);
            setCreated(value);
            router.refresh();
          }}
        />
      ) : null}

      {created ? (
        <ApiKeySecretDialog
          created={created}
          onOpenChange={(open) => {
            if (!open) {
              setCreated(null);
            }
          }}
        />
      ) : null}

      {revokeKey ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setRevokeKey(null);
            }
          }}
          title={`Revoke “${revokeKey.name}”?`}
          description="Agents using this key will immediately lose access. This cannot be undone."
          confirmLabel="Revoke key"
          pendingLabel="Revoking…"
          onConfirm={revoke}
        />
      ) : null}
    </Card>
  );
}
