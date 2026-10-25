import type { AuthUser } from "@/lib/auth/server";
import { initials } from "@/lib/format";
import { UserMenu } from "./user-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader({ user }: { user: AuthUser }) {
  const displayName = user.name ?? user.email ?? "Your workspace";
  const initial = initials(displayName);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-end border-b bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70 sm:px-6">
      <SidebarTrigger className="mr-auto" />
      <UserMenu
        name={displayName}
        email={user.email}
        avatarUrl={user.avatarUrl}
        initial={initial}
      />
    </header>
  );
}
