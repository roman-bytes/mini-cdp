"use client";

import { useEffect, useRef } from "react";

/**
 * Put inside a GET form. Picking a value in any select submits the form
 * straight away, and empty fields are left out of the address so links stay
 * short. Without JavaScript the form still works with its submit button.
 */
export function AutoSubmit() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;

    function onChange(event: Event) {
      if (event.target instanceof HTMLSelectElement) form?.requestSubmit();
    }
    function onSubmit() {
      for (const field of form?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[name], select[name]") ?? []) {
        if (field.value === "") field.disabled = true;
      }
    }
    form.addEventListener("change", onChange);
    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("change", onChange);
      form.removeEventListener("submit", onSubmit);
    };
  }, []);

  return <span ref={marker} hidden />;
}
