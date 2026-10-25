"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const subscribeToMount = () => () => {};

const THEMES = [
  { id: "light", label: "Light", icon: SunIcon },
  { id: "dark", label: "Dark", icon: MoonIcon },
  { id: "system", label: "System", icon: MonitorIcon },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

function isThemeId(value: string): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  );
  const selectedTheme: ThemeId =
    mounted && theme && isThemeId(theme) ? theme : "system";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Choose how Duti looks. System follows your device setting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ToggleGroup
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[selectedTheme]}
          onSelectionChange={(keys) => {
            const [key] = [...keys];

            if (typeof key === "string" && isThemeId(key)) {
              setTheme(key);
            }
          }}
          isDisabled={!mounted}
          aria-label="Theme"
          className="w-full"
        >
          {THEMES.map((option) => {
            const Icon = option.icon;

            return (
              <ToggleGroupItem
                key={option.id}
                id={option.id}
                className="flex-1 gap-2"
              >
                <Icon />
                {option.label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </CardContent>
    </Card>
  );
}
