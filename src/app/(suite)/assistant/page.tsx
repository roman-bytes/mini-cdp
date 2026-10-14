import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AskForm } from "@/apps/assistant/components/ask-form";
import { StatusBadge } from "@/apps/assistant/components/answer-parts";
import { PrivacyExplainer } from "@/apps/assistant/components/privacy-explainer";
import { listRecentRuns } from "@/apps/assistant/runs";
import { LoadingMessage } from "@/components/loading-message";
import { PageHeader, Section } from "@/components/page-header";
import { getLiveDb } from "@/shared/db/live";
import { formatDateTime } from "@/shared/format";

import { askAssistantAction } from "./actions";

export const metadata: Metadata = { title: "Assistant" };

async function RecentQuestions() {
  const recent = await listRecentRuns(await getLiveDb(), 10);
  if (recent.length === 0) return <p className="text-sm text-muted-foreground">No questions yet.</p>;

  return (
    <ul className="divide-y rounded-xl border">
      {recent.map((run) => (
        <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link className="font-medium underline-offset-4 hover:underline" href={`/assistant/${run.id}`}>
            {run.question}
          </Link>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={run.status} />
            {formatDateTime(run.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function AssistantPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Assistant"
        description="Ask a question about subscribers, signups, website visits or app activity in plain English. You get an answer, a table or a saved segment."
      />

      <Section title="Ask a question">
        <AskForm ask={askAssistantAction} />
      </Section>

      <Section title="Recent questions">
        <Suspense fallback={<LoadingMessage />}>
          <RecentQuestions />
        </Suspense>
      </Section>

      <Section title="How personal data stays away from the AI">
        <PrivacyExplainer />
      </Section>
    </div>
  );
}
