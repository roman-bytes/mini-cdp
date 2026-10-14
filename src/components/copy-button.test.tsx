// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COPY_RESET_MS, CopyButton } from "./copy-button";

const ID = "7130f7ad-9841-4e73-8f8d-6367f1b3941c";

describe("CopyButton", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("copies the value and says so", async () => {
    const user = userEvent.setup();
    render(<CopyButton value={ID} what="person ID" />);

    await user.click(screen.getByRole("button", { name: "Copy person ID" }));

    expect(await navigator.clipboard.readText()).toBe(ID);
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("person ID copied");
  });

  it("goes back to Copy after a moment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CopyButton value={ID} what="person ID" />);

    await user.click(screen.getByRole("button", { name: "Copy person ID" }));
    act(() => vi.advanceTimersByTime(COPY_RESET_MS));

    expect(screen.getByRole("button", { name: "Copy person ID" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says when the browser would not copy", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Not allowed"));
    render(<CopyButton value={ID} what="person ID" />);

    await user.click(screen.getByRole("button", { name: "Copy person ID" }));

    expect(screen.getByRole("button", { name: "Couldn't copy" })).toBeInTheDocument();
  });
});
