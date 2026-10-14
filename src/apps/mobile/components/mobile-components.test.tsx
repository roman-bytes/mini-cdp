// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { fixClockAt } from "@/shared/fixed-clock";

import type { AppEvent } from "../activity";
import type { DeliveryLogEntry } from "../deliveries";
import { APP_EVENT_NAMES } from "../schema";
import type { SimulatedEventInput, SimulationResult } from "../simulate";
import { DeliveryLogTable } from "./delivery-log-table";
import { EventSimulator } from "./event-simulator";
import { EventsTable } from "./events-table";

/** The tables are drawn as if it were 15:00; the sample event arrived at 14:22. */
const RENDERED_AT = new Date("2026-09-28T15:00:00Z").getTime();
const PERSON_ID = "3f6972bf-3046-4a1b-a662-47e26413d514";

function appEvent(overrides: Partial<AppEvent> = {}): AppEvent {
  return {
    id: "evt_9f3a1c",
    event: "read_story",
    userId: "u_2b6447a3",
    deviceId: "d_4b21e8",
    personId: PERSON_ID,
    occurredAt: new Date("2026-09-28T14:22:05Z"),
    receivedAt: new Date("2026-09-28T14:22:06Z"),
    properties: { story: "supreme-court-ruling-explained" },
    ...overrides,
  };
}

describe("EventsTable", () => {
  fixClockAt(RENDERED_AT);

  it("shows an event with a link to the person it belongs to", () => {
    render(<EventsTable events={[appEvent()]} renderedAt={RENDERED_AT} />);

    const row = screen.getByText("supreme-court-ruling-explained").closest("tr")!;
    expect(within(row).getByText("Sep 28, 2026, 14:22 UTC")).toBeInTheDocument();
    expect(within(row).getByText("read_story")).toBeInTheDocument();
    expect(within(row).getByText("u_2b6447a3")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "View person" })).toHaveAttribute(
      "href",
      `/people/${PERSON_ID}`,
    );
  });

  it("tags an event nobody owns yet as anonymous", () => {
    render(<EventsTable events={[appEvent({ userId: null, personId: null })]} renderedAt={RENDERED_AT} />);

    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("highlights events that arrived in the last hour", () => {
    const older = appEvent({
      id: "evt_old",
      properties: { story: "older-story" },
      receivedAt: new Date("2026-09-28T13:59:59Z"),
    });
    render(<EventsTable events={[appEvent(), older]} renderedAt={RENDERED_AT} />);

    expect(screen.getByText("supreme-court-ruling-explained").closest("tr")).toHaveAttribute("data-recent", "true");
    expect(screen.getByText("older-story").closest("tr")).not.toHaveAttribute("data-recent");
  });

  it("says so when no events have arrived", () => {
    render(<EventsTable events={[]} renderedAt={RENDERED_AT} />);

    expect(screen.getByText("No app events have arrived yet.")).toBeInTheDocument();
  });
});

function delivery(overrides: Partial<DeliveryLogEntry> = {}): DeliveryLogEntry {
  return {
    id: 1,
    receivedAt: new Date("2026-09-28T14:22:06Z"),
    source: "webhook",
    outcome: "accepted",
    reason: null,
    eventId: "evt_9f3a1c",
    event: "read_story",
    userId: "u_2b6447a3",
    deviceId: "d_4b21e8",
    personId: PERSON_ID,
    ...overrides,
  };
}

describe("DeliveryLogTable", () => {
  fixClockAt(RENDERED_AT);

  it("shows a stored delivery with when it arrived, where from, and who it belongs to", () => {
    render(<DeliveryLogTable entries={[delivery()]} renderedAt={RENDERED_AT} />);

    const row = screen.getByText("u_2b6447a3").closest("tr")!;
    expect(within(row).getByText("Sep 28, 2026, 14:22:06 UTC")).toBeInTheDocument();
    expect(within(row).getByText("Stored")).toBeInTheDocument();
    expect(within(row).getByText("read_story")).toBeInTheDocument();
    expect(within(row).getByText("d_4b21e8")).toBeInTheDocument();
    expect(within(row).getByText("Webhook")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "View person" })).toHaveAttribute("href", `/people/${PERSON_ID}`);
  });

  it("shows why a delivery was refused, with dashes for what the body did not have", () => {
    const refused = delivery({
      source: "simulator",
      outcome: "rejected",
      reason: "body: not valid JSON",
      eventId: null,
      event: null,
      userId: null,
      deviceId: null,
      personId: null,
    });
    render(<DeliveryLogTable entries={[refused]} renderedAt={RENDERED_AT} />);

    const row = screen.getByText("Rejected").closest("tr")!;
    expect(within(row).getByText("body: not valid JSON")).toBeInTheDocument();
    expect(within(row).getByText("Simulator")).toBeInTheDocument();
    expect(within(row).getAllByText("—")).toHaveLength(4);
    expect(within(row).queryByText("Anonymous")).not.toBeInTheDocument();
  });

  it("labels repeats and anonymous events", () => {
    render(<DeliveryLogTable entries={[delivery({ outcome: "duplicate", personId: null })]} renderedAt={RENDERED_AT} />);

    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
  });

  it("highlights deliveries from the last hour", () => {
    const older = delivery({ id: 2, userId: "u_old", receivedAt: new Date("2026-09-28T12:00:00Z") });
    render(<DeliveryLogTable entries={[delivery(), older]} renderedAt={RENDERED_AT} />);

    expect(screen.getByText("u_2b6447a3").closest("tr")).toHaveAttribute("data-recent", "true");
    expect(screen.getByText("u_old").closest("tr")).not.toHaveAttribute("data-recent");
  });

  it("says so when nothing has been sent", () => {
    render(<DeliveryLogTable entries={[]} renderedAt={RENDERED_AT} />);

    expect(screen.getByText("Nothing has been sent yet.")).toBeInTheDocument();
  });
});

describe("EventSimulator", () => {
  function renderSimulator(result: SimulationResult) {
    const send = vi.fn<(input: SimulatedEventInput) => Promise<SimulationResult>>().mockResolvedValue(result);
    render(<EventSimulator eventNames={APP_EVENT_NAMES} send={send} />);
    return { send, user: userEvent.setup() };
  }

  it("sends what was filled in", async () => {
    const { send, user } = renderSimulator({ ok: true, eventId: "evt_sim_1", status: "accepted", personId: null });

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
    const { user } = renderSimulator({ ok: true, eventId: "evt_sim_1", status: "accepted", personId: null });

    await user.click(screen.getByRole("button", { name: "Send event" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Event accepted. It is anonymous until this device logs in.",
    );
  });

  it("links to the person an event was attached to", async () => {
    const { user } = renderSimulator({ ok: true, eventId: "evt_sim_1", status: "accepted", personId: "abc" });

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
