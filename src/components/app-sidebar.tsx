import {
  Activity,
  Bookmark,
  FileSpreadsheet,
  Filter,
  House,
  KeyRound,
  MessageSquare,
  Smartphone,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PlainSidebarNavLink, SidebarNavLink } from "@/components/sidebar-nav-link";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

/** The screens in the sidebar, grouped by the app they belong to. */
export const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Home", icon: House }],
  },
  {
    label: "People",
    items: [
      { href: "/people", label: "People", icon: Users },
      { href: "/segments", label: "Segments", icon: Filter },
      { href: "/segments/saved", label: "Saved segments", icon: Bookmark },
    ],
  },
  {
    label: "Assistant",
    items: [{ href: "/assistant", label: "Ask the data", icon: MessageSquare }],
  },
  {
    label: "Mobile app",
    items: [
      { href: "/mobile", label: "Events", icon: Smartphone },
      { href: "/mobile/activity", label: "Activity log", icon: Activity },
      { href: "/settings/api-keys", label: "API keys", icon: KeyRound },
    ],
  },
  {
    label: "Data",
    items: [{ href: "/imports", label: "Import report", icon: FileSpreadsheet }],
  },
];

/** Every link in the sidebar, so each link can tell whether it is the most specific match. */
export const NAV_HREFS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

/** The left-hand navigation shared by every screen. */
export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/" className="flex h-8 items-center gap-2 px-2 font-heading font-semibold tracking-tight">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">
            M
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">Mini CDP</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const content = (
                    <>
                      <item.icon aria-hidden />
                      <span>{item.label}</span>
                    </>
                  );
                  return (
                    <SidebarMenuItem key={item.href}>
                      <Suspense
                        fallback={
                          <PlainSidebarNavLink href={item.href} label={item.label}>
                            {content}
                          </PlainSidebarNavLink>
                        }
                      >
                        <SidebarNavLink href={item.href} label={item.label} allHrefs={NAV_HREFS}>
                          {content}
                        </SidebarNavLink>
                      </Suspense>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
