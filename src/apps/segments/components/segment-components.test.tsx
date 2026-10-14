// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EXAMPLE_DEFINITION, SEGMENT_FIELDS, type SegmentDefinition } from "../definition";
import type { SaveResult, SegmentPreview } from "../preview";
import type { SegmentMember } from "../run";
import { MembersTable, SegmentSizeLine } from "./members-table";
import { SegmentBuilder } from "./segment-builder";

function member(overrides: Partial<SegmentMember> = {}): SegmentMember {
  return {
    personId: "3f6972bf-3046-4a1b-a662-47e26413d514",
    email: "cold@example.com",
    kind: "subscriber",
    status: "active",
    acquisitionSource: "instagram",
    signupDate: "2026-08-01",
    lastOpenDate: null,
    hasAppAccount: false,
    appAccountCreatedOn: null,
    webVisitCount: 0,
    firstVisitAt: null,
    lastVisitAt: null,
    appEventCount: 0,
    lastAppEventAt: null,
    neverOpened: true,
    ...overrides,
  };
}

describe("MembersTable", () => {
  it("tags people who never opened and links to their profile", () => {
    render(<MembersTable members={[member()]} />);

    expect(screen.getByText("Never opened")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "cold@example.com" })).toHaveAttribute(
      "href",
      "/people/3f6972bf-3046-4a1b-a662-47e26413d514",
    );
  });

  it("shows the last open date for people who have opened", () => {
    render(<MembersTable members={[member({ lastOpenDate: "2026-08-10", neverOpened: false })]} />);

    expect(screen.getByText("Aug 10, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Never opened")).not.toBeInTheDocument();
  });

  it("says so when nobody matches", () => {
    render(<MembersTable members={[]} />);

    expect(screen.getByText("Nobody matches these rules.")).toBeInTheDocument();
  });
});

describe("SegmentSizeLine", () => {
  it("shows the total and how many never opened", () => {
    render(<SegmentSizeLine total={229} neverOpened={146} />);

    expect(screen.getByText("229")).toBeInTheDocument();
    expect(screen.getByText(/146 never opened/)).toBeInTheDocument();
  });

  it("uses the singular for one person and hides a zero never-opened count", () => {
    render(<SegmentSizeLine total={1} neverOpened={0} />);

    expect(screen.getByText(/person/)).toBeInTheDocument();
    expect(screen.queryByText(/never opened/)).not.toBeInTheDocument();
  });
});

describe("SegmentBuilder", () => {
  const goodPreview: SegmentPreview = { ok: true, size: { total: 229, neverOpened: 146 }, members: [member()] };

  function renderBuilder(options: { preview?: SegmentPreview; saveResult?: SaveResult } = {}) {
    const preview = vi
      .fn<(definition: SegmentDefinition) => Promise<SegmentPreview>>()
      .mockResolvedValue(options.preview ?? goodPreview);
    const save = vi
      .fn<(name: string, definition: SegmentDefinition) => Promise<SaveResult>>()
      .mockResolvedValue(options.saveResult ?? { ok: true, id: "x" });
    render(<SegmentBuilder fields={SEGMENT_FIELDS} initial={EXAMPLE_DEFINITION} preview={preview} save={save} />);
    return { preview, save, user: userEvent.setup() };
  }

  it("previews the starting rules straight away and shows the count", async () => {
    const { preview } = renderBuilder();

    expect(await screen.findByText("229")).toBeInTheDocument();
    expect(screen.getByText(/146 never opened/)).toBeInTheDocument();
    expect(preview).toHaveBeenCalledWith(EXAMPLE_DEFINITION);
  });

  it("previews again when a rule's value changes", async () => {
    const { preview, user } = renderBuilder();
    await screen.findByText("229");

    await user.selectOptions(screen.getByLabelText("Rule 1 value"), "facebook");

    await waitFor(() =>
      expect(preview).toHaveBeenLastCalledWith({
        match: "all",
        rules: [{ field: "source", op: "is", value: "facebook" }, EXAMPLE_DEFINITION.rules[1]],
      }),
    );
  });

  it("resets a rule to a valid default when its field changes", async () => {
    const { preview, user } = renderBuilder();
    await screen.findByText("229");

    await user.selectOptions(screen.getByLabelText("Rule 2 field"), "app_account");

    await waitFor(() =>
      expect(preview).toHaveBeenLastCalledWith({
        match: "all",
        rules: [EXAMPLE_DEFINITION.rules[0], { field: "app_account", op: "has", value: undefined }],
      }),
    );
    expect(screen.queryByLabelText("Rule 2 value")).not.toBeInTheDocument();
  });

  it("adds and removes rules, and switches between all and any", async () => {
    const { preview, user } = renderBuilder();
    await screen.findByText("229");

    await user.click(screen.getByRole("button", { name: "Add rule" }));
    expect(screen.getByLabelText("Rule 3 field")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove rule 3" }));
    await user.click(screen.getByRole("button", { name: "Remove rule 2" }));
    await user.selectOptions(screen.getByLabelText("Match mode"), "any");

    await waitFor(() =>
      expect(preview).toHaveBeenLastCalledWith({ match: "any", rules: [EXAMPLE_DEFINITION.rules[0]] }),
    );
  });

  it("says the segment matches everyone when the last rule is removed", async () => {
    const { user } = renderBuilder();
    await screen.findByText("229");

    await user.click(screen.getByRole("button", { name: "Remove rule 2" }));
    await user.click(screen.getByRole("button", { name: "Remove rule 1" }));

    expect(screen.getByText("No rules, so this matches everyone.")).toBeInTheDocument();
  });

  it("shows the server's errors instead of a count", async () => {
    renderBuilder({ preview: { ok: false, errors: ["Signup date needs a YYYY-MM-DD date"] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Signup date needs a YYYY-MM-DD date");
  });

  it("saves the current rules under the typed name", async () => {
    const { save, user } = renderBuilder();
    await screen.findByText("229");

    await user.type(screen.getByLabelText("Segment name"), "Cold Instagram");
    await user.click(screen.getByRole("button", { name: "Save segment" }));

    expect(save).toHaveBeenCalledWith("Cold Instagram", EXAMPLE_DEFINITION);
  });

  it("shows why a save was refused", async () => {
    const { user } = renderBuilder({ saveResult: { ok: false, errors: ["Give the segment a name"] } });
    await screen.findByText("229");

    await user.click(screen.getByRole("button", { name: "Save segment" }));

    expect(await screen.findByText("Give the segment a name")).toBeInTheDocument();
  });

  it("notes when the list is only a sample", async () => {
    renderBuilder();

    expect(await screen.findByText(/Showing the first 1\./)).toBeInTheDocument();
  });
});
