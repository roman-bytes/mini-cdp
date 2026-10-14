# Mini CDP

A small customer data platform for a newsletter. It pulls subscriber data from three places (the newsletter list, the website and the mobile app) into one database, links the records that belong to the same person, and shows the result in one place.

The full design is in [docs/PLAN.md](docs/PLAN.md).

## Status

Steps 1 to 5 of the 8 in the plan are built. There is no login yet, so do not deploy it.

| Requirement | State | Where |
| --- | --- | --- |
| 1. Load, link and dedupe the three files | Built and tested | `/imports` |
| 2. Look up a subscriber | Built and tested | `/people` (the home screen), then open a person |
| 3. Build a segment | Built and tested | `/segments` |
| 4. `POST /webhooks/app` | Built and tested | `/mobile` shows events; `/settings/api-keys` makes keys |
| 5. AI assistant that never sees PII | Built and tested; needs `GEMINI_API_KEY` | `/assistant` |

The home screen is People: four headline numbers, three charts (new subscribers per week, where
subscribers can be reached, engagement by signup source), then the full list. Every chart has a
"Show as table" view. While searching or paging, the numbers step aside so results come first.

Not built yet: the login (step 6), the JSON API under `/api`, the engagement score, and merging a
placeholder person into a real one when an unknown app user later shows up in an import.

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
    mobile/            App accounts, the webhook and the events it takes in
    segments/          Segment rules, the SQL they compile to, saved segments
    imports/           Runs the import and builds the Import report
  shared/              Helpers every app uses: database, auth (API keys), email, dates, CSV
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
| `mobile` | App accounts and app events |
| `auth` | API keys (hashed) and rate-limit counters |

A view, `people.profiles`, gives one row per person with what every app knows about them. The People
list, the profile page and segments all read it, and it is computed live.

Emails live only in `people` (and in `raw`, as written by the source). Every other table stores a person ID.

### How the import decides who is who

- **Emails are matched after trimming and lowercasing.** Nothing else is folded, so two real people never merge.
- **Duplicate subscribers become one person.** If two rows disagree, the earliest signup and latest open win, and `unsubscribed` beats `active`.
- **Web visits link by visitor, not by row.** Only some visits carry an email. Once a visitor ID is tied to a person, all of that visitor's visits attach to them.
- **App accounts link by email.** An account whose email matches no subscriber gets its own person.
- **Nothing is silently dropped.** Blank rows and invalid emails are kept in `raw` with a reason, and listed on the Import report.

## The webhook

The mobile app sends one event per request:

```bash
curl -X POST http://localhost:3000/webhooks/app \
  -H "Authorization: Bearer <an API key from /settings/api-keys>" \
  -H "Content-Type: application/json" \
  -d '{"event_id":"evt_9f3a1c","event":"read_story","user_id":"u_2b6447a3","device_id":"d_4b21e8","timestamp":"2026-09-28T14:22:05Z","properties":{"story":"supreme-court-ruling-explained"}}'
```

| Situation | What happens |
| --- | --- |
| Same `event_id` twice | Stored once. The second request answers 200 with `"status":"duplicate"` |
| Events out of order | Everything is ordered by `timestamp`, not arrival |
| `user_id` is null | The event is kept, unattached |
| The device later logs in | Its earlier anonymous events attach to that user's person |
| `user_id` never seen before | A new person is created for it; the event is not dropped |
| Missing or wrong key | 401 |
| Bad shape | 400 with the fields that are wrong |
| More than 600 requests a minute from one key | 429 |

Every delivery from a valid key is also kept, as it arrived, in `raw.webhook_events`.

The proof that order and repeats do not matter is `src/apps/mobile/ingest-event.test.ts`: one event
history replayed in 100 shuffled orders, with duplicates, must always end in the same state.

## Segments

A segment is a list of rules joined by "all" or "any". Rules are stored as JSON, checked against a fixed
catalog of fields (`src/apps/segments/definition.ts`) and compiled to parameterised SQL
(`src/apps/segments/compile.ts`). Counts are worked out on every request.

"No open in the last N days" includes subscribers who never opened, and those rows carry a
**Never opened** tag. The brief's example (Instagram, no open in 30 days) returns 229 people, 146 of
them tagged.

## The assistant

A teammate asks a question in plain English at `/assistant` and gets an answer, a table, or a saved
segment. It runs on Google's Gemini API free tier: `gemini-3.8-flash`, falling back to
`gemini-3.5-flash-lite` when the first model's free daily quota runs out. `src/apps/assistant/gemini.ts`
is the only file that knows the provider; the loop in `run.ts` uses the neutral types in
`conversation.ts`, so another provider is one new file. The model has two tools: `run_query` (read-only
SQL) and `create_segment` (the same rules as the segment builder).

How it never sees personal data, in the order a question meets each layer:

1. **The question is scrubbed** (`pii.ts`). Emails and raw app, web or device IDs are swapped for
   `[person <key>]`, where the key is the person's random UUID.
2. **It can only read PII-free views** (`drizzle/0003_assistant_privacy_views.sql`). The model's SQL runs
   as the `ai_reader` database role, which can read the `ai` schema and nothing else. Those views have no
   emails and no raw IDs; visitor and device IDs become plain numbers. Reading an email fails with
   "permission denied".
3. **Its SQL can only read** (`query.ts`). One statement, wrapped in a SELECT, in a read-only transaction,
   with a 5 second timeout.
4. **Every request is checked before it is sent** (`run.ts`). The whole request is scanned for anything
   that looks like an email or a raw ID; a match stops the request.
5. **People are added back afterwards** (`runs.ts`). Tables the model returns carry `person_key`; the app
   swaps keys for emails when showing them, after the model has finished.
6. **Everything is on the record.** Every request and reply is stored in `assistant.model_calls` and shown
   under each answer as "What the AI saw".

The proof is `src/apps/assistant/run.test.ts`. A scripted stand-in plays the model's part (the real
Gemini request builder with the network call swapped out) while everything else runs for real against
the assessment data. It asks the brief's three questions and checks
that no request contains an email, a raw ID, or any of the 2,900 real addresses.

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
| `GEMINI_API_KEY` | The assistant's key for the Gemini API (free from Google AI Studio) |
| `GEMINI_MODEL` | Optional. Gemini models to use, comma-separated, in fallback order |
