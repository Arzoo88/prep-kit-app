# AI Interview Prep Kit

Turns a pasted job description + a company URL into a structured, editable
interview prep kit: company brief, role breakdown, categorised question
bank, flashcards, and a day-by-day study schedule.

## Tech stack

- **Frontend:** Next.js (App Router) + Tailwind CSS
- **Backend:** Node.js + Express, ES modules
- **Database:** MongoDB (Mongoose) — also stores sessions via `connect-mongo`
- **Auth:** cookie sessions (`express-session`), bcrypt password hashing
- **Scraping:** `node-fetch` + `cheerio`, own crawler with a hiring-page
  ranking heuristic, `robots-parser` for robots.txt
- **LLM:** any OpenAI-compatible `/chat/completions` endpoint — defaults to
  **Groq's free tier** (`llama-3.1-8b-instant`). Swap `LLM_BASE_URL` /
  `LLM_MODEL` for any other compatible free-tier provider.

All matches the brief's preferred stack, so no substitution to justify.

## Setup — local

**Important:** the backend reads `.env` from its own working directory. Since
`npm run dev:backend` / `npm start` runs with `backend/` as the current
directory, your `.env` file must live at **`backend/.env`** (not just the
project root) or `LLM_API_KEY` etc. will read as empty.

```bash
cp backend/.env.example backend/.env   # fill in LLM_API_KEY at minimum
npm install --workspaces
# needs a local MongoDB, e.g.: docker run -p 27017:27017 mongo
npm run dev:backend         # http://localhost:4000
npm run dev:frontend        # http://localhost:3000
```

## Setup — deployed

Deploy `backend/` (Render/Railway/Fly, free tier) with `MONGODB_URI`
pointing at a free Atlas cluster, and `frontend/` (Vercel free tier) with
`NEXT_PUBLIC_API_URL` pointing at the backend. Set `SESSION_SECRET`,
`LLM_API_KEY`, etc. as environment variables on the backend host — never
commit `.env`.

## Batch entry point (Section 9)

```bash
cd backend
npm install
npm run evaluate -- --input ../fixtures/sample-cases.json --output kits.json
```

Runs the exact same `generateKit()` pipeline the API uses, needs no
MongoDB, reads credentials from env vars, and writes the Appendix B shape.
A sample cases file is at `fixtures/sample-cases.json`.

## Architecture

```
backend/src/
  services/retrieval/   fetchPage, crawler (link ranking, not fixed paths),
                         robots.js, discussionSearch (pluggable, optional)
  services/llm/          llmClient.js — OpenAI-compatible wrapper, retries
                          with backoff on 429/5xx, strict JSON parsing
  services/generation/   extractRequirements, companyBrief,
                          generateQuestions (one call per requirement +
                          category), coverageCheck.js (deterministic),
                          schedule.js (deterministic), flashcards.js
                          (derived, no extra LLM call), pipeline.js
                          (orchestrator — same function used by the API
                          route and bin/evaluate.js)
  services/validation/   kitSchema.js — validates Appendix A shape
  routes/                auth.js, kits.js
  models/                User.js, Kit.js
bin/evaluate.js           batch CLI
frontend/app/             login, register, dashboard, kits/new,
                           kits/[id] (builder), kits/[id]/practice
```

## Retrieval approach & sources used

The crawler starts at the company homepage, extracts same-origin links,
scores them by regex signals (`career`, `hiring`, `interview`, `about`,
`blog`, etc. in the URL/title) and fetches the highest-scoring pages first
(cap: 8 pages) — no hard-coded path list, per Section 2. `robots.txt` is
checked per host before any non-homepage fetch. Every unreachable/blocked
page is recorded in `skipped` rather than failing the run. Public
discussion of the interview process uses a pluggable search API
(`SEARCH_API_KEY`/`SEARCH_BASE_URL`); if unset, this step is skipped and
reported honestly as "not searched" rather than fabricated.

## Sequencing of research & generation steps

1. `extractRequirements` — pasted JD only, no retrieval needed.
2. `crawlCompanySite` — homepage → ranked link crawl → about/hiring pages.
3. `searchPublicDiscussion` — optional, after the company is identified.
4. `generateCompanyBrief` — needs (2) + (3); reports honestly if nothing
   was found rather than inventing a brief.
5. Per-requirement, per-category `generateQuestionsForRequirement` — reads
   the hiring page's text (if found) so a company that describes a
   take-home + system-design round produces different questions than one
   that says nothing; a `behavioural` requirement is routed to
   behavioural/company-fit categories while `technical`/`domain` requirements
   are routed to technical/system-design (`categoriesFor()`), so a "5 years
   React" requirement and a "mentors juniors" requirement never share a
   call or instructions.
6. `checkCoverage` (deterministic, code) — any requirement with zero
   referencing questions is a gap.
7. Second pass — regenerates questions only for gap requirements (max 2
   passes total; a requirement still uncovered after that is reported
   honestly in `coverage.uncovered_requirement_ids` rather than retried
   indefinitely, burning free-tier tokens for no benefit).
8. `buildSchedule` (deterministic, code) — see algorithm below.
9. `buildFlashcards` — derived from the final question set, no extra LLM
   call (front = prompt, back = answer outline); keeps flashcards
   guaranteed consistent with question coverage.
10. `validateKit` — checked against Appendix A before persisting/writing.

Both (6) and (8) are plain code, never handed to the model, per Section 3.

## Schedule allocation algorithm

Questions are sorted by (must-have first, then difficulty descending), then
distributed across `days` buckets with a weighted round-robin: day *i*'s
share of questions is weighted by `(days - i)`, so day 1 gets the largest
share and the last day the smallest — harder/must-have material lands
early, not the night before. Any must-have requirement whose question(s)
didn't make it into the weighted walk (can happen with very few days) is
force-placed into day 1. Minutes per question come from
`{1:10, 2:15, 3:20}` by difficulty, always integers.

## Generated / edited / pinned state (the hardest part)

Each `Kit` document has a `pinned` field: `{ questionIds: [], flashcardIds: [] }`.
Editing a question's text/category in the builder adds its id to
`pinned.questionIds`. Regenerating a question *category* keeps every
pinned question in that category untouched and only replaces the
non-pinned, model-authored ones; the schedule and flashcards are then
rebuilt from the merged question list so everything downstream stays
consistent. Regenerating the company brief or schedule fully replaces that
section (they have no per-item pins), but schedule regeneration reads from
whatever the *current* (possibly edited) question set is, so builder edits
still flow through.

## Failure handling / edge cases

- Company URL invalid/404/timeout → recorded in `skipped`, pipeline
  continues with an honest, thin company brief.
- No hiring page found → `hiringPage` is `null`; the brief says so.
- Thin JD → `extractRequirements` is instructed not to invent requirements;
  few requirements in, few (or a note) out.
- No public discussion found → reported as not found, not fabricated.
- Invalid/incomplete LLM JSON → caught by `completeJSON`, surfaced as
  `LLM_INVALID_JSON`; that generation call is skipped and recorded, not
  fatal to the run.
- Rate limits → `withBackoff` retries 429/5xx with exponential backoff +
  jitter before giving up.
- Duplicate submission → SHA-256 of `(jd, companyUrl, days)` per user is
  checked before creating a new kit; the existing kit is returned instead.
- 1-day / 60-day schedules → day count is clamped to `[1, 60]`.

## Security

External URLs are validated before fetching: non-http(s) schemes and
private/loopback/link-local IPs are rejected (with a `resolve`-then-check
step against DNS rebinding), except an explicit `allowLoopback` flag used
only by the batch CLI, since Section 9 says its fixture company sites may
be served from `localhost`. Responses are capped by content-type and size.
Every piece of fetched/pasted text is wrapped in a clearly delimited,
labelled block before being sent to the model with an explicit instruction
that it is content, not instructions (`services/llm/llmClient.js#fence`).

## Known limitations

- `searchPublicDiscussion` needs a search API key to do anything; without
  one it degrades gracefully but won't find real discussion threads.
- Practice mode uses a simple confidence-weighted resort rather than a full
  spaced-repetition interval (SM-2) — a reasonable next step, documented as
  a deliberate scope choice (Section 7 explicitly allows either).
- Kit generation runs in-process on creation rather than via a job queue;
  fine for the assessment's scale, would move to a queue for real load.
