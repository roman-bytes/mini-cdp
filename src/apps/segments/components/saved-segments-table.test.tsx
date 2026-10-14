// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { rulesSummary, SavedSegmentsTable, type SavedSegmentRow } from "./saved-segments-table";

const SEGMENT: SavedSegmentRow = {
  id: "3f6972bf-3046-4a1b-a662-47e26413d514",
  name: "Cold Instagram",
  definition: {
    match: "all",
    rules: [
      { field: "source", op: "is", value: "instagram" },
      { field: "last_open", op: "not_within_days", value: 30 },
    ],
  },
  createdAt: new Date("2026-10-14T15:40:57Z"),
  size: { total: 229, neverOpened: 146 },
};

describe("rulesSummary", () => {
  it("joins the rules with and, or with or", () => {
    expect(rulesSummary(SEGMENT)).toBe("Signup source is Instagram and Last email open was not in the last 30 days");
    expect(rulesSummary({ definition: { ...SEGMENT.definition, match: "any" } })).toContain(" or ");
  });

  it("says Everyone for a segment with no rules", () => {
    expect(rulesSummary({ definition: { match: "all", rules: [] } })).toBe("Everyone");
  });
});

describe("SavedSegmentsTable", () => {
  it("shows each segment with its size and links to it", () => {
    render(<SavedSegmentsTable segments={[SEGMENT]} />);

    const link = screen.getByRole("link", { name: "Cold Instagram" });
    expect(link).toHaveAttribute("href", "/segments/saved/3f6972bf-3046-4a1b-a662-47e26413d514");
    const cells = within(link.closest("tr")!).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells.slice(2)).toEqual(["229", "146", "Oct 14, 2026"]);
  });

  it("says so when nothing is saved", () => {
    render(<SavedSegmentsTable segments={[]} />);

    expect(screen.getByText("No saved segments yet.")).toBeInTheDocument();
  });
});
