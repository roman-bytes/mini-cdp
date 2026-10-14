// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AppEvent } from "../activity";
import { APP_EVENT_NAMES } from "../schema";
import type { SimulatedEventInput, SimulationResult } from "../simulate";
import { EventSimulator } from "./event-simulator";
import { EventsTable } from "./events-table";

function appEvent(overrides: Partial<AppEvent> = {}): AppEvent {
  return {
    id: "evt_9f3a1c",
    event: "read_story",
    userId: "u_2b6447a3",
    deviceId: "d_4b21e8",
    personId: "3f6972bf-3046-4a1b-a662-47e26413d514",
    occurredAt: new Date("2026-09-28T14:22:05Z"),
    receivedAt: new Date("2026-09-28T14:22:06Z"),
    properties: { story: "supreme-court-ruling-explained" },
    ...overrides,
  };
}

describe("EventsTable", () => {
  it("shows an event with a link to the person it belongs to", () => {
    render(<EventsTable events={[appEvent()]} />);

    const row = screen.getByText("supreme-court-ruling-explained").closest("tr")!;
    expect(within(row).getByText("Sep 28, 2026, 14:22 UTC")).toBeInTheDocument();
    expect(within(row).getByText("read_story")).toBeInTheDocument();
    expect(within(row).getByText("u_2b6447a3")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "View person" })).toHaveAttribute(
      "href",
      "/people/3f6972bf-3046-4a1b-a662-47e26413d514",
    );
  });

  it("tags an event nobody owns yet as anonymous", () => {
    render(<EventsTable events={[appEvent({ userId: null, personId: null })]} />);

    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says so when no events have arrived", () => {
    render(<EventsTable events={[]} />);

    expect(screen.getByText("No app events have arrived yet.")).toBeInTheDocument();
  });
});

describe("EventSimulator", () => {
  function renderSimulator(result: SimulationResult) {
    const send = vi.fn<(input: SimulatedEventInput) => Promise<SimulationResult>>().mockResolvedValue(result);
    render(<EventSimulator eventNames={APP_EVENT_NAMES} send={send} />);
    return { send, user: userEvent.setup() };
  }

  it("sends what was filled in", async () => {
    const { send, user } = renderSimulator({ ok: true, status: "accepted", personId: null });

    await user.selectOptions(screen.getByLabelText("Event"), "login");
    await user.clear(screen.getByLabelText("Device ID"));
    await user.type(screen.getByLabelText("Device ID"), "d_test");
    await user.type(screen.getByLabelText(/User ID/), "u_2b6447a3");
    await user.type(screen.getByLabelText(/Story/), "ai-regulation-bill");
    await user.click(screen.getByRole("button", { name: "Send event" }));

    expect(send).toHaveBeenCalledWith({
      event: "login",
      deviceId: "d_test",
      userId: "u_2b6447a3",
      story: "ai-regulation-bill",
    });
  });

  it("explains that an event with no user is anonymous for now", async () => {
    const { user } = renderSimulator({ ok: true, status: "accepted", personId: null });

    await user.click(screen.getByRole("button", { name: "Send event" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Event accepted. It is anonymous until this device logs in.",
    );
  });

  it("links to the person an event was attached to", async () => {
    const { user } = renderSimulator({ ok: true, status: "accepted", personId: "abc" });

    await user.click(screen.getByRole("button", { name: "Send event" }));

    expect(await screen.findByRole("link", { name: "It belongs to this person." })).toHaveAttribute(
      "href",
      "/people/abc",
    );
  });

  it("shows the reasons an event was refused", async () => {
    const { user } = renderSimulator({ ok: false, errors: ["device_id: Too small"] });

    await user.click(screen.getByRole("button", { name: "Send event" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("device_id: Too small");
  });
});
