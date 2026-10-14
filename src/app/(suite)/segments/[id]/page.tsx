import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MembersTable, SegmentSizeLine } from "@/apps/segments/components/members-table";
import { describeRule } from "@/apps/segments/definition";
import { countSegment, listSegmentMembers } from "@/apps/segments/run";
import { getSegment } from "@/apps/segments/saved";
import { LoadingMessage } from "@/components/loading-message";
import { Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getLiveDb } from "@/shared/db/live";
import { getToday } from "@/shared/today";

import { deleteSegmentAction } from "../actions";

/** How many people the page lists. The CSV export always has everyone. */
const MEMBER_LIMIT = 500;

async function SegmentDetail({ params }: Pick<PageProps<"/segments/[id]">, "params">) {
  const { id } = await params;
  const db = await getLiveDb();
  const segment = await getSegment(db, id);
  if (!segment) notFound();

  const today = getToday();
  const size = await countSegment(db, segment.definition, today);
  const members = await listSegmentMembers(db, segment.definition, today, MEMBER_LIMIT);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/segments" className="text-sm text-muted-foreground hover:text-foreground">
          ← Segments
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{segment.name}</h1>
          <div className="flex gap-2">
            <a
              className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
              href={`/segments/${segment.id}/export`}
            >
              Export CSV
            </a>
            <form action={deleteSegmentAction}>
              <input type="hidden" name="id" value={segment.id} />
              <Button type="submit" variant="outline">
                Delete
              </Button>
            </form>
          </div>
        </div>
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

      <Section title="People">
        <SegmentSizeLine total={size.total} neverOpened={size.neverOpened} />
        <MembersTable members={members} />
        {size.total > members.length ? (
          <p className="text-sm text-muted-foreground">
            Showing the first {members.length}. Export the CSV for everyone.
          </p>
        ) : null}
      </Section>
    </div>
  );
}

export default function SegmentPage({ params }: PageProps<"/segments/[id]">) {
  return (
    <Suspense fallback={<LoadingMessage />}>
      <SegmentDetail params={params} />
    </Suspense>
  );
}
