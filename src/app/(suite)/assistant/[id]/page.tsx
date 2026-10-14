import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  AnswerSegment,
  AnswerTable,
  PrivacyCheck,
  ReplacementsNote,
  StatusBadge,
} from "@/apps/assistant/components/answer-parts";
import { WhatTheAiSaw } from "@/apps/assistant/components/what-the-ai-saw";
import { getRun, prepareTableForTeammate, summarisePrivacy } from "@/apps/assistant/runs";
import { LoadingMessage } from "@/components/loading-message";
import { Section } from "@/components/page-header";
import { getLiveDb } from "@/shared/db/live";

async function RunDetail({ params }: Pick<PageProps<"/assistant/[id]">, "params">) {
  const { id } = await params;
  const db = await getLiveDb();
  const record = await getRun(db, id);
  if (!record) notFound();
  const { run, calls } = record;

  const tables = [];
  for (const output of run.outputs) {
    if (output.kind === "table") tables.push(await prepareTableForTeammate(db, output));
  }
  const segments = run.outputs.filter((output) => output.kind === "segment");

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href="/assistant" className="text-sm text-muted-foreground hover:text-foreground">
          ← Assistant
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{run.question}</h1>
          <StatusBadge status={run.status} />
        </div>
        <ReplacementsNote replacements={run.replacements} />
      </header>

      <Section title="Answer">
        {run.answer ? <p className="max-w-3xl whitespace-pre-wrap leading-relaxed">{run.answer}</p> : null}
        {run.error ? <p className="text-sm text-destructive">{run.error}</p> : null}
      </Section>

      {segments.length > 0 || tables.length > 0 ? (
        <div className="space-y-4">
          {segments.map((segment) => (
            <AnswerSegment key={segment.segmentId} segment={segment} />
          ))}
          {tables.map((table, index) => (
            <AnswerTable key={index} table={table} />
          ))}
        </div>
      ) : null}

      <Section title="What the AI saw">
        <PrivacyCheck summary={summarisePrivacy(calls)} />
        <WhatTheAiSaw calls={calls} />
      </Section>
    </div>
  );
}

export default function AssistantRunPage({ params }: PageProps<"/assistant/[id]">) {
  return (
    <Suspense fallback={<LoadingMessage />}>
      <RunDetail params={params} />
    </Suspense>
  );
}
