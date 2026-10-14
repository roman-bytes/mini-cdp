"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

/** The choices, in display order. "system" follows the operating system's setting. */
export const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Use system setting", icon: Monitor },
] as const;

const subscribeToNothing = () => () => {};

/** False while the page is rendered on the server, true once it runs in the browser. */
function useIsInBrowser(): boolean {
  return useSyncExternalStore(subscribeToNothing, () => true, () => false);
}

/**
 * Three small buttons in the top bar: light, dark, or follow the system.
 * The saved choice is only known in the browser, so nothing is marked as
 * chosen until then; this keeps the server and browser render the same.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isInBrowser = useIsInBrowser();
  const current = isInBrowser ? (theme ?? "system") : null;

  return (
    <div role="group" aria-label="Colour theme" className="flex shrink-0 items-center rounded-lg border p-0.5">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={current === value}
          onClick={() => setTheme(value)}
          className={`flex size-7 items-center justify-center rounded-md transition-colors ${
            current === value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon aria-hidden className="size-4" />
        </button>
      ))}
    </div>
  );
}
