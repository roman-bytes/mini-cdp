"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-reads the current page from the server every few seconds, so a list of
 * live data (such as incoming app events) updates without a reload.
 */
export function AutoRefresh({ everySeconds }: { everySeconds: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), everySeconds * 1000);
    return () => clearInterval(timer);
  }, [router, everySeconds]);

  return null;
}
