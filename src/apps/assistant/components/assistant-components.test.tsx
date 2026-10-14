// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ModelCall, TeammateTable } from "../runs";
import {
  AnswerSegment,
  AnswerTable,
  formatCell,
  PrivacyCheck,
  ReplacementsNote,
  StatusBadge,
} from "./answer-parts";
import { AskForm, EXAMPLE_QUESTIONS } from "./ask-form";
import { PRIVACY_LAYERS, PrivacyExplainer } from "./privacy-explainer";
import { newestTurn, replyOf, WhatTheAiSaw } from "./what-the-ai-saw";

describe("AskForm", () => {
  it("fills the box with an example question when one is clicked", async () => {
    const user = userEvent.setup();
    render(<AskForm ask={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: EXAMPLE_QUESTIONS[0] }));

    expect(screen.getByLabelText("Your question")).toHaveValue(EXAMPLE_QUESTIONS[0]);
  });

  it("offers the brief's three questions", () => {
    render(<AskForm ask={vi.fn()} />);

    for (const question of EXAMPLE_QUESTIONS) {
      expect(screen.getByRole("button", { name: question })).toBeInTheDocument();
    }
  });
});

describe("PrivacyExplainer", () => {
  it("lists every layer in order", () => {
    render(<PrivacyExplainer />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(PRIVACY_LAYERS.length);
    expect(items[0]).toHaveTextContent("1. The question is scrubbed");
  });
});

describe("answer parts", () => {
  it("labels each status", () => {
    render(<StatusBadge status="blocked" />);

    expect(screen.getByText("Stopped to protect personal data")).toBeInTheDocument();
  });

  it("shows what was swapped out of the question, and nothing when nothing was", () => {
    const { container, rerender } = render(
      <ReplacementsNote replacements={[{ original: "a@example.com", replacement: "[person abc]" }]} />,
    );
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
    expect(screen.getByText("[person abc]")).toBeInTheDocument();

    rerender(<ReplacementsNote replacements={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("formats cells", () => {
    expect(formatCell(null)).toBe("—");
    expect(formatCell(2900)).toBe("2,900");
    expect(formatCell(true)).toBe("true");
  });

  it("shows a people table with each email linked to the profile, and says where emails came from", () => {
    const table: TeammateTable = {
      title: "Most engaged readers",
      columns: ["person", "visits"],
      rows: [["julia.evans230@gmail.com", 12]],
      personIds: ["3f6972bf-3046-4a1b-a662-47e26413d514"],
      totalRows: 40,
    };
    render(<AnswerTable table={table} />);

    expect(screen.getByRole("link", { name: "julia.evans230@gmail.com" })).toHaveAttribute(
      "href",
      "/people/3f6972bf-3046-4a1b-a662-47e26413d514",
    );
    expect(screen.getByText(/Showing 1 of 40 rows\. Emails were added by this app/)).toBeInTheDocument();
  });

  it("shows a table that is not about people without links", () => {
    render(
      <AnswerTable table={{ title: "Pages", columns: ["page", "subscribers"], rows: [["/", 279]], personIds: [null], totalRows: 1 }} />,
    );

    const row = screen.getByText("/").closest("tr")!;
    expect(within(row).getByText("279")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("1 row.")).toBeInTheDocument();
  });

  it("links to a saved segment and gives its size", () => {
    render(<AnswerSegment segment={{ kind: "segment", segmentId: "s1", name: "Engaged", total: 1234, neverOpened: 0 }} />);

    expect(screen.getByRole("link", { name: "Engaged" })).toHaveAttribute("href", "/segments/saved/s1");
    expect(screen.getByText(/1,234 people\./)).toBeInTheDocument();
  });

  it("reports a passed privacy check, and a stopped request", () => {
    const { rerender } = render(<PrivacyCheck summary={{ requestsSent: 2, requestsBlocked: 0, findings: [] }} />);
    expect(screen.getByText(/2 requests were sent to the AI, and none contained an email/)).toBeInTheDocument();

    rerender(<PrivacyCheck summary={{ requestsSent: 1, requestsBlocked: 1, findings: ["email address"] }} />);
    expect(screen.getByText(/It contained an email address, so it was never sent\./)).toBeInTheDocument();
  });
});

describe("WhatTheAiSaw", () => {
  const request = {
    model: "gemini-3.8-flash",
    contents: [{ role: "user", parts: [{ text: "How many subscribers?" }] }],
    config: { systemInstruction: "You are the data assistant", tools: [{ functionDeclarations: [{ name: "run_query" }] }] },
  };
  const calls: ModelCall[] = [
    {
      id: 1,
      runId: "r",
      step: 1,
      request,
      response: { candidates: [{ content: { role: "model", parts: [{ text: "2,900." }] } }] },
      piiFindings: [],
      createdAt: new Date(),
    },
    { id: 2, runId: "r", step: 2, request, response: null, piiFindings: ["email address"], createdAt: new Date() },
  ];

  it("finds the newest turn in a request and the model's reply", () => {
    expect(newestTurn(request)).toEqual({ role: "user", parts: [{ text: "How many subscribers?" }] });
    expect(newestTurn({})).toBeNull();
    expect(replyOf({ candidates: [{ content: { role: "model", parts: [{ text: "2,900." }] } }] })).toEqual({
      role: "model",
      parts: [{ text: "2,900." }],
    });
    expect(replyOf({})).toBeNull();
  });

  it("shows the instructions once and every request with its reply", () => {
    render(<WhatTheAiSaw calls={calls} />);

    expect(screen.getByText("Instructions and tools (the same on every request)")).toBeInTheDocument();
    expect(screen.getByText("Request 1")).toBeInTheDocument();
    expect(screen.getByText("Request 2 (stopped: contained an email address)")).toBeInTheDocument();
    expect(screen.getByText("No reply: this request was not sent.")).toBeInTheDocument();
    expect(screen.getAllByText("The full request, exactly as sent")).toHaveLength(2);
  });

  it("says so when nothing was sent", () => {
    render(<WhatTheAiSaw calls={[]} />);

    expect(screen.getByText("Nothing was sent to the AI.")).toBeInTheDocument();
  });
});
