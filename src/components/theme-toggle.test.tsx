// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_OPTIONS, ThemeToggle } from "./theme-toggle";

const setTheme = vi.hoisted(() => vi.fn());
const theme = vi.hoisted(() => ({ current: "system" as string | undefined }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: theme.current, setTheme }) }));

describe("ThemeToggle", () => {
  beforeEach(() => {
    setTheme.mockClear();
    theme.current = "system";
  });

  it("offers light, dark and the system setting", () => {
    render(<ThemeToggle />);

    expect(screen.getByRole("group", { name: "Colour theme" })).toBeInTheDocument();
    for (const option of THEME_OPTIONS) {
      expect(screen.getByRole("button", { name: option.label })).toBeInTheDocument();
    }
  });

  it("marks the current choice, defaulting to the system setting", () => {
    theme.current = undefined;
    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "Use system setting" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false");
  });

  it("marks dark when dark was chosen", () => {
    theme.current = "dark";
    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches the theme when a choice is clicked", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "Dark" }));
    await user.click(screen.getByRole("button", { name: "Light" }));

    expect(setTheme.mock.calls).toEqual([["dark"], ["light"]]);
  });
});
