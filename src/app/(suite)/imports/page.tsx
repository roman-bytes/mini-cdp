import type { Metadata } from "next";
import { Suspense } from "react";

import { FileOutcomesTable } from "@/apps/imports/components/file-outcomes-table";
import { ImportChecks } from "@/apps/imports/components/import-checks";
import { ImportIssuesTable } from "@/apps/imports/components/import-issues-table";
import { getImportReport, type ImportReport } from "@/apps/imports/report";
import { LoadingMessage } from "@/components/loading-message";
import { getLiveDb } from "@/shared/db/live";

export const metadata: Metadata = { title: "Import report" };

function hasImportedRows(report: ImportReport): boolean {
  return report.files.some((file) => file.total > 0);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function NothingImported() {
  return (
    <p className="text-muted-foreground">
      Nothing has been imported yet. Run <code className="font-mono text-sm">npm run db:import</code> to
      load the files in <code className="font-mono text-sm">data/</code>.
    </p>
  );
}

/** Reads the report on every request, so it always matches the database. */
async function ImportReportSections() {
  const report = await getImportReport(await getLiveDb());
  if (!hasImportedRows(report)) return <NothingImported />;

  return (
    <>
      <Section title="Results">
        <ImportChecks checks={report.checks} />
      </Section>
      <Section title="Source files">
        <FileOutcomesTable files={report.files} />
      </Section>
      <Section title="Rows merged or set aside">
        <ImportIssuesTable issues={report.issues} />
      </Section>
    </>
  );
}

export default function ImportReportPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Import report</h1>
        <p className="text-muted-foreground">
          What happened to every row of the three source files, and how they linked up.
        </p>
      </header>

      {/* The heading shows at once; the numbers stream in when the query returns. */}
      <Suspense fallback={<LoadingMessage />}>
        <ImportReportSections />
      </Suspense>
    </div>
  );
}
