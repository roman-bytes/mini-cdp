"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type LiveRefreshProps = {
  /** An endpoint that answers {"marker": "..."}, a value that changes when there is something new. */
  markerUrl: string;
  /** The marker as it was when the server drew the page. */
  initialMarker: string;
  everySeconds?: number;
};

/** How long one check may take. A check that hangs would otherwise stop all later ones. */
export const MARKER_TIMEOUT_MS = 10_000;

/** Reads the marker from the endpoint, or null when it cannot be reached right now. */
async function fetchMarker(markerUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MARKER_TIMEOUT_MS);
  try {
    const response = await fetch(markerUrl, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const marker = (body as { marker?: unknown }).marker;
    return typeof marker === "string" ? marker : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Keeps a page of live data current. Every few seconds it asks a small
 * endpoint whether anything changed, and only then re-reads the page from the
 * server. It stays quiet while the tab is in the background.
 */
export function LiveRefresh({ markerUrl, initialMarker, everySeconds = 2 }: LiveRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    let known = initialMarker;
    let checking = false;
    let stopped = false;

    async function check() {
      if (checking || document.hidden) return;
      checking = true;
      const marker = await fetchMarker(markerUrl);
      checking = false;
      if (stopped || marker === null || marker === known) return;
      known = marker;
      router.refresh();
    }

    const timer = setInterval(check, everySeconds * 1000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [router, markerUrl, initialMarker, everySeconds]);

  return null;
}
