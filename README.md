# Mini CDP

A small customer data platform for a newsletter. It pulls subscriber data from three places (the newsletter list, the website and the mobile app) into one database, links the records that belong to the same person, and shows the result in one place.

The full design is in [docs/PLAN.md](docs/PLAN.md).

## Status

Step 1 of 8 in the plan is built: the project scaffold, the database schema, the import pipeline and the Import report page.

| Requirement | State |
| --- | --- |
| 1. Load, link and dedupe the three files | Built and tested |
| 2. Look up a subscriber | Not started |
| 3. Build a segment | Not started |
| 4. `POST /webhooks/app` | Not started |
| 5. AI assistant that never sees PII | Not started |

## Run it locally

You need Node 22 or newer and a Postgres database (the plan uses [Neon](https://neon.tech)).

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL in .env.local
npm run db:migrate           # create the tables
npm run db:import            # load the three CSV files in data/
npm run dev                  # http://localhost:3000
```

`npm run db:import` prints the import report when it finishes, and is safe to run again.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app in development |
| `npm run build` | Production build |
| `npm test` | Run every test once |
| `npm run test:watch` | Re-run tests as files change |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no output |
| `npm run check` | Lint, typecheck and tests together |
| `npm run db:generate` | Write a new SQL migration after a schema change |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `npm run db:import` | Load `data/*.csv` into `DATABASE_URL` |

## How it is organised

The code is split the way Planning Center splits its suite. **People** is the one place a person lives. Every other app stores its own activity and points at a person by ID.

```
data/                  The three source CSV files
docs/PLAN.md           The design
drizzle/               SQL migrations, generated from the schema files
scripts/               Thin command-line wrappers (migrate, import)
src/
  app/                 Next.js routes. Pages are thin and call into src/apps
  apps/
    people/            The person record and every identifier. Other apps call its functions
    newsletter/        Subscriptions (the beehiiv data)
    web/               Website visits
    mobile/            App accounts (and, later, webhook events)
    imports/           Runs the import and builds the Import report
  shared/              Helpers every app uses: database, email, dates, channels, CSV
  components/          Shared UI, including shadcn/ui components in components/ui
```

Each app folder holds its own `schema.ts` (its tables), its functions and their tests.

### The database

One Postgres database, one schema per app:

| Schema | Holds |
| --- | --- |
| `raw` | Every source row exactly as it arrived, plus what the importer did with it and why |
| `people` | One row per person, and every identifier (email, visitor ID, user ID) that points to them |
| `newsletter` | Subscription status, source, signup date, last open date |
| `web` | Page views, with the person when known |
| `mobile` | App accounts |

Emails live only in `people` (and in `raw`, as written by the source). Every other table stores a person ID.

### How the import decides who is who

- **Emails are matched after trimming and lowercasing.** Nothing else is folded, so two real people never merge.
- **Duplicate subscribers become one person.** If two rows disagree, the earliest signup and latest open win, and `unsubscribed` beats `active`.
- **Web visits link by visitor, not by row.** Only some visits carry an email. Once a visitor ID is tied to a person, all of that visitor's visits attach to them.
- **App accounts link by email.** An account whose email matches no subscriber gets its own person.
- **Nothing is silently dropped.** Blank rows and invalid emails are kept in `raw` with a reason, and listed on the Import report.

## Tests

`npm test` needs no database server. Tests that touch the database use [PGlite](https://pglite.dev), a real Postgres that runs in memory inside the test process, with the same migrations applied.

The acceptance test for requirement 1 is `src/apps/imports/run-import.test.ts`. It loads the real CSV files and checks the numbers worked out by hand in the plan:

| Check | Expected |
| --- | --- |
| Subscriber profiles | 2,900 |
| Duplicate rows merged | 85 |
| Rows set aside | 10 |
| App accounts linked to a subscriber | 900 |
| App-only profiles | 30 |
| Web visits attached to a subscriber | 8,441 |
| Web visits left anonymous | 1,559 |

## Settings

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. On Neon, use the pooled one |
| `CDP_TODAY` | "Today" for time-based rules. The assessment fixes it at `2026-09-28`; unset uses the real clock |
