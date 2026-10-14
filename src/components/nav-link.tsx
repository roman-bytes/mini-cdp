"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** True when `pathname` is the link's page or a page beneath it. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A header link that marks itself as the current page. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isActive = isActivePath(usePathname(), href);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
