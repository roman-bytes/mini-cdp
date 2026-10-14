"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SidebarMenuButton } from "@/components/ui/sidebar";

/** True when `pathname` is the link's page or a page beneath it. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The sidebar link a page belongs to: the most specific one that matches, so
 * /segments/saved/123 belongs to "Saved segments", not to "Segments".
 */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  const matching = hrefs.filter((href) => isActivePath(pathname, href));
  return matching.sort((a, b) => b.length - a.length)[0] ?? null;
}

type SidebarNavLinkProps = {
  href: string;
  /** Shown as a tooltip when the sidebar is collapsed to icons. */
  label: string;
  children: React.ReactNode;
};

/** A sidebar link that marks itself when it is the current page. */
export function SidebarNavLink({ href, label, allHrefs, children }: SidebarNavLinkProps & { allHrefs: string[] }) {
  const isActive = activeHref(usePathname(), allHrefs) === href;

  return (
    <SidebarMenuButton
      isActive={isActive}
      tooltip={label}
      aria-current={isActive ? "page" : undefined}
      render={<Link href={href} />}
    >
      {children}
    </SidebarMenuButton>
  );
}

/**
 * The same link with no current-page mark. Shown for the instant before the
 * address of a page like /people/123 is known.
 */
export function PlainSidebarNavLink({ href, label, children }: SidebarNavLinkProps) {
  return (
    <SidebarMenuButton tooltip={label} render={<Link href={href} />}>
      {children}
    </SidebarMenuButton>
  );
}
