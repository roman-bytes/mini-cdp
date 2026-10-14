// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoadingMessage } from "./loading-message";
import { isActivePath, NavLink } from "./nav-link";
import { SUITE_NAV, SuiteHeader } from "./suite-header";

const usePathname = vi.hoisted(() => vi.fn<() => string>());
vi.mock("next/navigation", () => ({ usePathname }));

describe("isActivePath", () => {
  it("matches the link's own page", () => {
    expect(isActivePath("/imports", "/imports")).toBe(true);
  });

  it("matches a page beneath the link", () => {
    expect(isActivePath("/people/123", "/people")).toBe(true);
  });

  it("does not match a different page that starts with the same letters", () => {
    expect(isActivePath("/people-archive", "/people")).toBe(false);
    expect(isActivePath("/", "/imports")).toBe(false);
  });
});

describe("NavLink", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/imports");
  });

  it("marks the link for the current page", () => {
    render(<NavLink href="/imports">Import report</NavLink>);

    expect(screen.getByRole("link", { name: "Import report" })).toHaveAttribute("aria-current", "page");
  });

  it("leaves other links unmarked", () => {
    render(<NavLink href="/people">People</NavLink>);

    expect(screen.getByRole("link", { name: "People" })).not.toHaveAttribute("aria-current");
  });
});

describe("SuiteHeader", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/imports");
  });

  it("shows the product name linking home", () => {
    render(<SuiteHeader />);

    expect(screen.getByRole("link", { name: "Mini CDP" })).toHaveAttribute("href", "/");
  });

  it("shows a link for every screen in the navigation", () => {
    render(<SuiteHeader />);

    for (const item of SUITE_NAV) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });
});

describe("LoadingMessage", () => {
  it("announces that content is loading", () => {
    render(<LoadingMessage />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });
});
