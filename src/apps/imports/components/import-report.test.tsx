// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ImportChecks as ImportChecksData, ImportIssue } from "../report";
import { FileOutcomesTable } from "./file-outcomes-table";
import { CHECK_LABELS, ImportChecks } from "./import-checks";
import { ImportIssuesTable } from "./import-issues-table";

const CHECKS: ImportChecksData = {
  subscriberProfiles: 2900,
  duplicateRowsMerged: 85,
  rowsSetAside: 10,
  appAccountsLinkedToSubscriber: 900,
  appOnlyProfiles: 30,
  webVisitsAttachedToSubscriber: 8441,
  webVisitsAnonymous: 1559,
};

describe("ImportChecks", () => {
  it("shows a card for every check", () => {
    render(<ImportChecks checks={CHECKS} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(CHECK_LABELS.length);
  });

  it("shows each number beside its label, with thousands separators", () => {
    render(<ImportChecks checks={CHECKS} />);

    const card = screen.getByText("Web visits attached to a subscriber").closest("li")!;
    expect(within(card).getByText("8,441")).toBeInTheDocument();
  });
});

describe("FileOutcomesTable", () => {
  it("shows one row per file with its counts", () => {
    render(
      <FileOutcomesTable
        files={[{ file: "subscribers.csv", total: 2995, loaded: 2900, merged: 85, setAside: 10 }]}
      />,
    );

    const row = screen.getByText("subscribers.csv").closest("tr")!;
    const cells = within(row).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toEqual(["subscribers.csv", "2,995", "2,900", "85", "10"]);
  });
});

describe("ImportIssuesTable", () => {
  const issues: ImportIssue[] = [
    { file: "subscribers.csv", rowNumber: 3, outcome: "merged", reason: "Duplicate of line 2", value: "SUB@EXAMPLE.COM" },
    { file: "subscribers.csv", rowNumber: 9, outcome: "set_aside", reason: "Blank row", value: "" },
  ];

  it("shows the outcome, the reason and the value as written", () => {
    render(<ImportIssuesTable issues={issues} />);

    const row = screen.getByText("SUB@EXAMPLE.COM").closest("tr")!;
    expect(within(row).getByText("Merged")).toBeInTheDocument();
    expect(within(row).getByText("Duplicate of line 2")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
  });

  it("marks an empty value instead of leaving the cell blank", () => {
    render(<ImportIssuesTable issues={issues} />);

    const row = screen.getByText("Blank row").closest("tr")!;
    expect(within(row).getByText("Set aside")).toBeInTheDocument();
    expect(within(row).getByText("(empty)")).toBeInTheDocument();
  });

  it("says so when there is nothing to list", () => {
    render(<ImportIssuesTable issues={[]} />);

    expect(screen.getByText("Every row loaded cleanly.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
