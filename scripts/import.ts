/**
 * Loads the three CSV files in ./data into the database named by
 * DATABASE_URL, then prints the import report.  Run with: npm run db:import
 */
import { readImportFiles } from "@/apps/imports/read-files";
import { getImportReport } from "@/apps/imports/report";
import { runImport } from "@/apps/imports/run-import";
import { closeDb, getDb } from "@/shared/db/client";

const DATA_DIRECTORY = "data";

async function main(): Promise<void> {
  const db = getDb();
  try {
    const files = await readImportFiles(DATA_DIRECTORY);
    await runImport(db, files);

    const report = await getImportReport(db);
    console.table(report.files);
    console.table(report.checks);
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
