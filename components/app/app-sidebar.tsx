"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDownIcon,
  FolderIcon,
  FolderKanbanIcon,
  SettingsIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { ProjectSummary } from "@/lib/api/types";

export function AppSidebar({ projects }: { projects: ProjectSummary[] }) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const projectSectionActive = pathname.startsWith("/projects");
  const [projectsOpen, setProjectsOpen] = useState(projectSectionActive);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              href="/"
              size="lg"
              tooltip="Duti home"
              aria-label="Duti home"
              className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
            >
              <Image
                src="/icons/android-chrome-192x192.png"
                alt=""
                width={30}
                height={30}
                priority
                className="size-7 shrink-0 rounded-md ring-1 ring-foreground/10"
              />
              <span className="font-heading text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                Duti
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  href="/"
                  isActive={pathname === "/"}
                  tooltip="All projects"
                >
                  <FolderKanbanIcon />
                  <span className="group-data-[collapsible=icon]:hidden">
                    All projects
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={projectSectionActive}
                  tooltip="Projects"
                  aria-expanded={projectsOpen}
                  onPress={() => setProjectsOpen((open) => !open)}
                >
                  <FolderIcon />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Projects
                  </span>
                  <ChevronDownIcon
                    className={
                      projectsOpen
                        ? "ml-auto rotate-180 group-data-[collapsible=icon]:hidden"
                        : "ml-auto group-data-[collapsible=icon]:hidden"
                    }
                  />
                </SidebarMenuButton>
                {projectsOpen && !isCollapsed && (
                  <SidebarMenuSub>
                    {projects.length ? (
                      projects.map((project) => {
                        const href = "/projects/" + project.id;
                        const active =
                          pathname === href || pathname.startsWith(href + "/");
                        return (
                          <SidebarMenuSubItem key={project.id}>
                            <SidebarMenuSubButton href={href} isActive={active}>
                              <span>{project.name}</span>
                              <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                                {project.key}
                              </span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })
                    ) : (
                      <SidebarMenuSubItem>
                        <span className="px-2 py-2 text-xs text-muted-foreground">
                          No projects yet
                        </span>
                      </SidebarMenuSubItem>
                    )}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  href="/settings"
                  isActive={pathname.startsWith("/settings")}
                  tooltip="Settings"
                >
                  <SettingsIcon />
                  <span className="whitespace-nowrap group-data-[collapsible=icon]:hidden">
                    Settings
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex h-6 items-center overflow-hidden whitespace-nowrap px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:justify-center">
          <span className="group-data-[collapsible=icon]:hidden">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
          <span className="hidden group-data-[collapsible=icon]:inline">
            {projects.length}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
