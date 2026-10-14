// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CLOCK_TICK_MS } from "@/hooks/use-now";

import { LiveRefresh, MARKER_TIMEOUT_MS } from "./live-refresh";
import { NewLabel, RecentRow } from "./recent-row";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

/** Lets the timers run and any fetches they started finish. */
async function waitSeconds(seconds: number) {
  await act(() => vi.advanceTimersByTimeAsync(seconds * 1000));
}

function setTabHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
}

describe("LiveRefresh", () => {
  const fetchMock = vi.fn<typeof fetch>();

  /** Makes the marker endpoint answer with this marker from now on. */
  function answerWith(marker: string) {
    fetchMock.mockImplementation(async () => Response.json({ marker }));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    refresh.mockClear();
    fetchMock.mockReset();
    setTabHidden(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does nothing while the marker stays the same", async () => {
    answerWith("7");
    render(<LiveRefresh markerUrl="/marker" initialMarker="7" />);

    await waitSeconds(10);

    expect(fetchMock).toHaveBeenCalledWith("/marker", expect.objectContaining({ cache: "no-store" }));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("re-reads the page once when the marker moves", async () => {
    answerWith("7");
    render(<LiveRefresh markerUrl="/marker" initialMarker="7" />);
    await waitSeconds(2);

    answerWith("8");
    await waitSeconds(6);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("checks every two seconds by default", async () => {
    answerWith("7");
    render(<LiveRefresh markerUrl="/marker" initialMarker="7" />);

    await waitSeconds(6);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("waits while the tab is in the background", async () => {
    answerWith("8");
    setTabHidden(true);
    render(<LiveRefresh markerUrl="/marker" initialMarker="7" />);

    await waitSeconds(10);
    expect(fetchMock).not.toHaveBeenCalled();

    setTabHidden(false);
    await waitSeconds(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps going when a check fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    render(<LiveRefresh markerUrl="/marker" initialMarker="7" />);
    await waitSeconds(4);
    expect(refresh).not.toHaveBeenCalled();

    answerWith("8");
    await waitSeconds(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("gives up on a check that hangs, and carries on", async () => {
    // The first request never answers until it is cancelled.
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    render(<LiveRefresh markerUrl="/marker" initialMarker="7" />);
    await waitSeconds(2);

    answerWith("8");
    await waitSeconds(MARKER_TIMEOUT_MS / 1000 + 2);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("stops checking when the page is left", async () => {
    answerWith("7");
    const { unmount } = render(<LiveRefresh markerUrl="/marker" initialMarker="7" />);
    await waitSeconds(2);

    unmount();
    answerWith("8");
    await waitSeconds(10);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("RecentRow", () => {
  const RENDERED_AT = new Date("2026-09-28T15:00:00Z");

  function renderRow(arrivedAt: Date | null) {
    render(
      <table>
        <tbody>
          <RecentRow arrivedAt={arrivedAt} renderedAt={RENDERED_AT.getTime()}>
            <td>
              Row
              <NewLabel />
            </td>
          </RecentRow>
        </tbody>
      </table>,
    );
    return screen.getByText("Row").closest("tr")!;
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: RENDERED_AT });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is green, with a New label, for something that arrived in the last hour", () => {
    const row = renderRow(new Date("2026-09-28T14:30:00Z"));

    expect(row).toHaveAttribute("data-recent", "true");
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("is plain for something that arrived over an hour ago", () => {
    expect(renderRow(new Date("2026-09-28T13:30:00Z"))).not.toHaveAttribute("data-recent");
  });

  it("is plain for something that was imported rather than sent live", () => {
    expect(renderRow(null)).not.toHaveAttribute("data-recent");
  });

  it("goes back to plain once the hour is up, while the page stays open", () => {
    const row = renderRow(new Date("2026-09-28T14:30:00Z"));

    act(() => vi.advanceTimersByTime(29 * 60 * 1000));
    expect(row).toHaveAttribute("data-recent", "true");

    act(() => vi.advanceTimersByTime(60 * 1000 + CLOCK_TICK_MS));
    expect(row).not.toHaveAttribute("data-recent");
  });
});
