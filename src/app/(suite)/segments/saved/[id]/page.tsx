import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PeopleDirectory } from "@/apps/people/components/people-directory";
import { parsePeopleParams } from "@/apps/people/people-params";
import { SegmentSizeLine } from "@/apps/segments/components/segment-size-line";
import { describeRule } from "@/apps/segments/definition";
import { SAVED_SEGMENTS_PATH, segmentExportPath, segmentPath } from "@/apps/segments/paths";
import { countSegment, listSegmentPeople } from "@/apps/segments/run";
import { getSegment } from "@/apps/segments/saved";
import { LoadingMessage } from "@/components/loading-message";
import { Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getLiveDb } from "@/shared/db/live";
import { formatNumber } from "@/shared/format";
import { getToday } from "@/shared/today";

import { deleteSegmentAction } from "../../actions";

async function SegmentDetail({ params, searchParams }: PageProps<"/segments/saved/[id]">) {
  const { id } = await params;
  const tableParams = parsePeopleParams(await searchParams);
  const db = await getLiveDb();
  const segment = await getSegment(db, id);
  if (!segment) notFound();

  const today = getToday();
  const size = await countSegment(db, segment.definition, today);
  const people = await listSegmentPeople(db, segment.definition, today, tableParams);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href={SAVED_SEGMENTS_PATH} className="text-sm text-muted-foreground hover:text-foreground">
          ← Saved segments
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{segment.name}</h1>
          <div className="flex gap-2">
            <a
              className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
              href={segmentExportPath(segment.id)}
            >
              Export all {formatNumber(size.total)} as CSV
            </a>
            <form action={deleteSegmentAction}>
              <input type="hidden" name="id" value={segment.id} />
              <Button type="submit" variant="outline">
                Delete
              </Button>
            </form>
          </div>
        </div>
        <SegmentSizeLine total={size.total} neverOpened={size.neverOpened} />
      </header>

      <Section title={segment.definition.match === "all" ? "Matches all of" : "Matches any of"}>
        {segment.definition.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules: everyone.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {segment.definition.rules.map((rule, index) => (
              <li key={index}>{describeRule(rule)}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="People in this segment">
        <PeopleDirectory
          params={tableParams}
          result={people}
          basePath={segmentPath(segment.id)}
          searchLabel="Search this segment"
          scope={{ total: size.total, name: "this segment" }}
        />
      </Section>
    </div>
  );
}

export default function SegmentPage(props: PageProps<"/segments/saved/[id]">) {
  return (
    <Suspense fallback={<LoadingMessage />}>
      <SegmentDetail {...props} />
    </Suspense>
  );
}
