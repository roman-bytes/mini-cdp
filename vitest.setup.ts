import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Remove whatever a component test rendered, so tests cannot see each other.
afterEach(() => {
  cleanup();
});
