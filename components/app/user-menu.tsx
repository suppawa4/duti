"use client";

import { LogOutIcon } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  name,
  email,
  avatarUrl,
  initial,
}: {
  name: string;
  email: string | null;
  avatarUrl: string | null;
  initial: string;
}) {
  return (
    <DropdownMenuTrigger>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        aria-label="Open account menu"
      >
        <Avatar>
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </Button>
      <DropdownMenu placement="bottom end" className="min-w-56">
        <DropdownMenuLabel className="px-2 py-2">
          <span className="block truncate text-sm font-medium text-foreground">
            {name}
          </span>
          {email ? (
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          id="sign-out"
          variant="destructive"
          textValue="Sign out"
          onAction={() => {
            void signOut();
          }}
        >
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}
