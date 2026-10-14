import Link from "next/link";

import { NavLink } from "@/components/nav-link";

/** The screens in the header, in order. Each app adds its entry here. */
export const SUITE_NAV = [{ href: "/imports", label: "Import report" }];

export function SuiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="font-heading text-base font-semibold tracking-tight">
          Mini CDP
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {SUITE_NAV.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
