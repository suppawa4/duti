import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { KeyRoundIcon, PaletteIcon, TagIcon } from "lucide-react";
import { ErrorState } from "@/components/app/error-state";
import { PageSkeleton } from "@/components/app/loading-skeletons";
import { PageHeader } from "@/components/app/page-header";
import { ApiKeysSettings } from "@/components/settings/api-keys-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { TaskKindsSettings } from "@/components/settings/task-kinds-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiErrorMessage, apiErrorStatus } from "@/lib/api/errors";
import type { ApiKey, TaskKind } from "@/lib/api/types";
import { loginPath } from "@/lib/auth/continue";
import { requireUser } from "@/lib/auth/server";
import { createApi, getAccessToken } from "@/lib/eden.server";

export const metadata: Metadata = {
  title: "Settings",
};

async function SettingsContent() {
  await connection();
  await requireUser();

  const token = await getAccessToken();

  if (!token) {
    redirect(loginPath("/settings"));
  }

  const api = createApi(token);
  const [kindsResult, keysResult] = await Promise.all([
    api.v1["task-kinds"].get(),
    api.v1["api-keys"].get(),
  ]);
  const error = kindsResult.error ?? keysResult.error;

  if (error) {
    if (apiErrorStatus(error) === 401) {
      redirect(loginPath("/settings"));
    }

    return (
      <ErrorState
        title="Could not load settings"
        description={
          apiErrorMessage(error) ??
          "The settings could not be loaded. Please try again."
        }
        retryHref="/settings"
      />
    );
  }

  const kinds: TaskKind[] = kindsResult.data ?? [];
  const keys: ApiKey[] = keysResult.data ?? [];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Manage your appearance, task kinds, and API access."
      />

      <Tabs defaultSelectedKey="appearance" className="max-w-3xl">
        <TabsList>
          <TabsTrigger id="appearance">
            <PaletteIcon data-icon="inline-start" />
            Appearance
          </TabsTrigger>
          <TabsTrigger id="kinds">
            <TagIcon data-icon="inline-start" />
            Task kinds
          </TabsTrigger>
          <TabsTrigger id="api-keys">
            <KeyRoundIcon data-icon="inline-start" />
            API keys
          </TabsTrigger>
        </TabsList>
        <TabsContent id="appearance" className="pt-2">
          <AppearanceSettings />
        </TabsContent>
        <TabsContent id="kinds" className="pt-2">
          <TaskKindsSettings kinds={kinds} />
        </TabsContent>
        <TabsContent id="api-keys" className="pt-2">
          <ApiKeysSettings keys={keys} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
