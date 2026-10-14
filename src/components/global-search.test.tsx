// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { allResultsHref, GlobalSearch, isSearchShortcut } from "./global-search";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const JULIA = {
  personId: "3f6972bf-3046-4a1b-a662-47e26413d514",
  email: "julia.evans230@gmail.com",
  kind: "subscriber",
  matched: null,
};
const BY_USER_ID = {
  personId: "11111111-1111-4111-8111-111111111111",
  email: null,
  kind: "unknown",
  matched: { type: "user_id", value: "u_2b6447a3" },
};

describe("allResultsHref", () => {
  it("links to the People page searching for the text", () => {
    expect(allResultsHref(" julia evans ")).toBe("/people?q=julia%20evans");
  });
});

describe("isSearchShortcut", () => {
  it("is Cmd+K or Ctrl+K", () => {
    expect(isSearchShortcut({ key: "k", metaKey: true, ctrlKey: false })).toBe(true);
    expect(isSearchShortcut({ key: "K", metaKey: false, ctrlKey: true })).toBe(true);
    expect(isSearchShortcut({ key: "k", metaKey: false, ctrlKey: false })).toBe(false);
    expect(isSearchShortcut({ key: "j", metaKey: true, ctrlKey: false })).toBe(false);
  });
});

describe("GlobalSearch", () => {
  const fetchMock = vi.fn<(url: string) => Promise<{ json: () => Promise<unknown> }>>();

  beforeEach(() => {
    push.mockClear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ json: async () => ({ results: [JULIA, BY_USER_ID] }) });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows matches as you type, with the ID that matched", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(screen.getByRole("combobox", { name: "Find a person" }), "julia");

    expect(await screen.findByText("julia.evans230@gmail.com")).toBeInTheDocument();
    expect(screen.getByText("App user ID: u_2b6447a3")).toBeInTheDocument();
    expect(screen.getByText("No email on file")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/people/v1/search?q=julia");
  });

  it("waits for at least two characters before searching", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(screen.getByRole("combobox"), "j");
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens a person when their match is clicked", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(screen.getByRole("combobox"), "julia");
    await user.click(await screen.findByText("julia.evans230@gmail.com"));

    expect(push).toHaveBeenCalledWith(`/people/${JULIA.personId}`);
  });

  it("moves through matches with the arrow keys and opens one with Enter", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);
    const box = screen.getByRole("combobox");

    await user.type(box, "julia");
    await screen.findByText("julia.evans230@gmail.com");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(push).toHaveBeenCalledWith(`/people/${BY_USER_ID.personId}`);
  });

  it("goes to every match on the People page when Enter is pressed with nothing picked", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(screen.getByRole("combobox"), "gmail{Enter}");

    expect(push).toHaveBeenCalledWith("/people?q=gmail");
  });

  it("says when no one matches", async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ results: [] }) });
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(screen.getByRole("combobox"), "zzzz");

    expect(await screen.findByText("No one matches.")).toBeInTheDocument();
    expect(screen.getByText("See all matches for “zzzz” in People")).toBeInTheDocument();
  });

  it("jumps to the box with Cmd+K", async () => {
    render(<GlobalSearch />);

    act(() => {
      fireEvent.keyDown(window, { key: "k", metaKey: true });
    });

    await waitFor(() => expect(screen.getByRole("combobox")).toHaveFocus());
  });
});
