// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppSidebar, NAV_GROUPS, NAV_HREFS } from "./app-sidebar";
import { LoadingMessage } from "./loading-message";
import { PageHeader, Section } from "./page-header";
import { Pagination, pageRange } from "./pagination";
import { activeHref, isActivePath, PlainSidebarNavLink, SidebarNavLink } from "./sidebar-nav-link";

const usePathname = vi.hoisted(() => vi.fn<() => string>());
vi.mock("next/navigation", () => ({ usePathname }));

beforeAll(() => {
  // The sidebar asks the browser whether the screen is phone-sized.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

/** The providers the sidebar needs around it. */
function renderInSidebar(ui: React.ReactNode) {
  return render(
    <TooltipProvider>
      <SidebarProvider>{ui}</SidebarProvider>
    </TooltipProvider>,
  );
}

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

describe("activeHref", () => {
  const hrefs = ["/people", "/segments", "/segments/saved"];

  it("picks the most specific matching link", () => {
    expect(activeHref("/segments/saved/123", hrefs)).toBe("/segments/saved");
    expect(activeHref("/segments/saved", hrefs)).toBe("/segments/saved");
    expect(activeHref("/segments", hrefs)).toBe("/segments");
    expect(activeHref("/people/abc", hrefs)).toBe("/people");
  });

  it("returns null when no link matches", () => {
    expect(activeHref("/elsewhere", hrefs)).toBeNull();
  });

  it("tells the Events page and the Activity log apart", () => {
    expect(activeHref("/mobile/activity", NAV_HREFS)).toBe("/mobile/activity");
    expect(activeHref("/mobile", NAV_HREFS)).toBe("/mobile");
  });

  it("matches Home only on the home page itself", () => {
    expect(activeHref("/", ["/", ...hrefs])).toBe("/");
    expect(activeHref("/people/abc", ["/", ...hrefs])).toBe("/people");
  });
});

describe("SidebarNavLink", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/people/abc");
  });

  it("marks the link for the current section", () => {
    renderInSidebar(<SidebarNavLink href="/people" label="People" allHrefs={NAV_HREFS}>People</SidebarNavLink>);

    const link = screen.getByRole("link", { name: "People" });
    expect(link).toHaveAttribute("href", "/people");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("leaves other links unmarked", () => {
    renderInSidebar(<SidebarNavLink href="/segments" label="Segments" allHrefs={NAV_HREFS}>Segments</SidebarNavLink>);

    expect(screen.getByRole("link", { name: "Segments" })).not.toHaveAttribute("aria-current");
  });

  it("has a plain version with no current-page mark", () => {
    renderInSidebar(<PlainSidebarNavLink href="/imports" label="Import report">Import report</PlainSidebarNavLink>);

    const link = screen.getByRole("link", { name: "Import report" });
    expect(link).toHaveAttribute("href", "/imports");
    expect(link).not.toHaveAttribute("aria-current");
  });
});

describe("AppSidebar", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/segments/saved/abc");
  });

  it("marks only the most specific section as current", () => {
    renderInSidebar(<AppSidebar />);

    expect(screen.getByRole("link", { name: "Saved segments" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Segments" })).not.toHaveAttribute("aria-current");
  });

  it("links to every screen, grouped by app", () => {
    renderInSidebar(<AppSidebar />);

    for (const group of NAV_GROUPS) {
      expect(screen.getByText(group.label, { selector: "[data-sidebar=group-label]" })).toBeInTheDocument();
      for (const item of group.items) {
        expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
      }
    }
  });

  it("shows the product name linking home", () => {
    renderInSidebar(<AppSidebar />);

    expect(screen.getByRole("link", { name: /Mini CDP/ })).toHaveAttribute("href", "/");
  });
});

describe("LoadingMessage", () => {
  it("announces that content is loading", () => {
    render(<LoadingMessage />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });
});

describe("PageHeader and Section", () => {
  it("shows a title, a description and anything placed beside them", () => {
    render(
      <PageHeader title="People" description="Everyone we know.">
        <button>Export</button>
      </PageHeader>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "People" })).toBeInTheDocument();
    expect(screen.getByText("Everyone we know.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("shows a titled section with its content", () => {
    render(<Section title="Identity">content</Section>);

    expect(screen.getByRole("heading", { level: 2, name: "Identity" })).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});

describe("pageRange", () => {
  it("works out the rows on a page and whether there are neighbours", () => {
    expect(pageRange(1, 50, 2930)).toEqual({ first: 1, last: 50, hasPrevious: false, hasNext: true });
    expect(pageRange(59, 50, 2930)).toEqual({ first: 2901, last: 2930, hasPrevious: true, hasNext: false });
    expect(pageRange(1, 50, 0)).toEqual({ first: 0, last: 0, hasPrevious: false, hasNext: false });
  });
});

describe("Pagination", () => {
  const hrefForPage = (page: number) => `/people?page=${page}`;

  it("shows the range and links to the pages either side", () => {
    render(<Pagination page={2} pageSize={50} total={2930} hrefForPage={hrefForPage} />);

    expect(screen.getByText("Showing 51–100 of 2,930")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/people?page=1");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/people?page=3");
  });

  it("has no previous link on the first page and no next link on the last", () => {
    render(<Pagination page={1} pageSize={50} total={20} hrefForPage={hrefForPage} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("useIsMobile", () => {
  it("follows the screen-size media query", async () => {
    const { useIsMobile } = await import("@/hooks/use-mobile");
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...original(query), matches: true })) as typeof window.matchMedia;

    function Probe() {
      return <p>{useIsMobile() ? "phone" : "desktop"}</p>;
    }
    render(<Probe />);

    expect(screen.getByText("phone")).toBeInTheDocument();
    window.matchMedia = original;
  });
});
