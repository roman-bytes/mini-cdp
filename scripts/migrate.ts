/**
 * Applies every pending SQL migration in ./drizzle to the database named by
 * DATABASE_URL.  Run with: npm run db:migrate
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { withExplicitSslMode } from "@/shared/db/connection";
import { MIGRATIONS_FOLDER } from "@/shared/db/migrations";
import { requireEnv } from "@/shared/env";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: withExplicitSslMode(requireEnv("DATABASE_URL")) });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("Migrations applied.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
