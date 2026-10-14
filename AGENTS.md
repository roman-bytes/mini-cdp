<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules

The design is in `docs/PLAN.md`. Read it before adding a feature.

- **Tests for everything.** Every function and every route gets a test, in a `*.test.ts(x)` file beside it. Run `npm run check` before calling work done.
- **Small functions that do one thing**, named for what they do.
- **DRY.** Shared logic is written once in `src/shared` and called from each app.
- **Basic constructs.** Plain functions and plain data. No clever abstractions.
- **People is the core app.** Other apps (`newsletter`, `web`, `mobile`, `assistant`) store a person ID and call the functions in `src/apps/people`. They never read or write the `people` tables themselves, and they never store an email.
- **Each app owns its tables** in its own `schema.ts` and its own Postgres schema. After changing one, run `npm run db:generate`.
- **Data functions take `db` as their first argument**, so they run the same against the app database, inside a transaction, and in tests.
- **Pages show live data.** A page that reads the database calls `getLiveDb()` inside a component wrapped in `<Suspense>`.
- **Database tests use `createTestDb()`** from `src/shared/db/testing.ts`. No database server is needed.
