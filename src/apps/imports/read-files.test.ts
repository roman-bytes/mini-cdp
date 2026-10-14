import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readImportFiles } from "./read-files";

/** Writes three CSV files to a new temporary directory and returns its path. */
async function writeSourceFiles(contents: {
  subscribers: string;
  appUsers: string;
  webEvents: string;
}): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "cdp-import-"));
  await writeFile(join(directory, "subscribers.csv"), contents.subscribers);
  await writeFile(join(directory, "app_users.csv"), contents.appUsers);
  await writeFile(join(directory, "web_events.csv"), contents.webEvents);
  return directory;
}

const VALID_FILES = {
  subscribers: "email,signup_date,status,acquisition_source,last_open_date\na@b.com,2026-07-01,active,X,\n",
  appUsers: "user_id,email,created_at\nu_1,a@b.com,2026-07-02\n",
  webEvents: "visitor_id,page,timestamp,utm_source,email\nv_1,/,2026-07-01 10:00:00,,\n",
};

describe("readImportFiles", () => {
  it("reads every row of the assessment files", async () => {
    const files = await readImportFiles("data");

    expect(files.subscribers).toHaveLength(2995);
    expect(files.appUsers).toHaveLength(930);
    expect(files.webEvents).toHaveLength(10000);
  });

  it("parses each file into rows keyed by column name", async () => {
    const files = await readImportFiles(await writeSourceFiles(VALID_FILES));

    expect(files.subscribers).toEqual([
      { email: "a@b.com", signup_date: "2026-07-01", status: "active", acquisition_source: "X", last_open_date: "" },
    ]);
    expect(files.appUsers).toEqual([{ user_id: "u_1", email: "a@b.com", created_at: "2026-07-02" }]);
    expect(files.webEvents).toEqual([
      { visitor_id: "v_1", page: "/", timestamp: "2026-07-01 10:00:00", utm_source: "", email: "" },
    ]);
  });

  it("refuses a file that is missing a column", async () => {
    const directory = await writeSourceFiles({
      ...VALID_FILES,
      appUsers: "user_id,created_at\nu_1,2026-07-02\n",
    });

    await expect(readImportFiles(directory)).rejects.toThrow(
      "app_users.csv is missing column(s): email",
    );
  });

  it("fails clearly when a file is not there", async () => {
    await expect(readImportFiles("no-such-directory")).rejects.toThrow(/subscribers\.csv/);
  });
});
