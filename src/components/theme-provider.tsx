"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light and dark mode. The theme follows the operating system until someone
 * picks one with the toggle; their choice is remembered in this browser.
 * The "dark" class on <html> switches every colour token in globals.css.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
