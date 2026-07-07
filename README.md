# LODESTAR

Built by Wyatt Pedersen.

A prospecting terminal for a Private Bank analyst covering endowments & foundations (E&F) in the San Francisco Bay Area. LODESTAR turns public IRS Form 990 data plus analyst-logged intelligence into a ranked, explainable, always-current call sheet.

> Single-user demo app, designed to run locally. No auth, no external LLM calls. Built for a JPMorgan U.S. Private Bank summer analyst capstone. (Optional hosted deployment via Vercel + Turso is documented below, added after the initial build.)

---

## Quickstart

Requires Node 20+.

```bash
git clone <this-repo>
cd lodestar
npm install
npm run seed      # resolves ~30 real Bay Area E&F orgs via the live ProPublica API and hydrates real filings — real data only (~2 min, throttled to 1 req/sec)
npm run dev
```

Open http://localhost:3000. First screen is the Rankings Board, populated with real orgs and no fabricated content.

**Want to see the trustee graph / decay curves / pipeline demo in action?** Flip the **Example content** switch in **Settings** — it's a real on/off toggle (`/api/settings/example-content`, DB-only, no ProPublica calls either way, safe to flip repeatedly): ON layers `EXAMPLE`-tagged signals, people, and pipeline cards onto whatever's already hydrated; OFF removes them cleanly and resets pipeline stages, leaving your real data untouched. (`npm run seed:examples` does the same thing from the CLI, for building the demo snapshot.)

**No network at all on demo day?** Go to **Settings → Restore full offline snapshot**. It replaces the *entire* database from the checked-in `data/demo-snapshot.json` (real orgs and example intelligence together) — zero calls to ProPublica. Use the Example Content toggle above for day-to-day switching; save this one for when there's genuinely no connectivity.

### Other scripts

| Command | What it does |
|---|---|
| `npm run seed` | Resolves the Section-10 seed list via live ProPublica search (never hardcoded EINs), hydrates real filings. Real data only — no `EXAMPLE` content. |
| `npm run seed:examples` | Layers `EXAMPLE`-tagged demo intelligence (signals, people, pipeline stages) onto already-hydrated orgs. No ProPublica calls. |
| `npm run snapshot` | Exports the current DB to `data/demo-snapshot.json` for Demo Mode (run after `seed` + `seed:examples` so the snapshot has both). |
| `npm test` | Runs the Vitest suite (133 cases, mostly the scoring engine). |
| `npm run db:push` | Applies the Drizzle schema to `data/lodestar.db`. |
| `npm run db:studio` | Opens Drizzle Studio against the local DB. |

---

## Deploying a public URL (Vercel + Turso)

The app runs against SQLite via [libSQL](https://turso.tech/libsql), which works both as a plain local file (default — no setup needed) and against a hosted [Turso](https://turso.tech) database (same schema, same queries, just a URL + token). That's what makes a public deployment possible without touching any app code.

1. **Create a Turso database** at [turso.tech](https://turso.tech) (free tier is plenty). From its dashboard, grab the database URL (`libsql://...`) and create an auth token.
2. **Push the schema to it** from your machine:
   ```bash
   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run db:push
   ```
3. **(Recommended) Seed it directly**, so the deployed site has real data on first load:
   ```bash
   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run seed
   ```
4. **Deploy to Vercel:** go to [vercel.com/new](https://vercel.com/new), import this GitHub repo, and before the first deploy add two environment variables in the project settings — `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (same values as above). Click Deploy.

That's it — Vercel builds and serves the Next.js app, and every request talks to the hosted Turso database over HTTP instead of a local file. No native binary, no persistent server process required.


---

## Architecture sketch

```
Next.js 15+ (App Router, TS strict)
├── src/app/                    routes + route handlers (server-side only — never call ProPublica from the browser)
│   ├── (Rankings, Universe, Pipeline, Monday Report, Settings)/page.tsx
│   ├── org/[ein]/               Org Dossier — tabbed: Overview, Score, Signals, People, Peers, Briefing, Activity
│   └── api/                     route handlers for every mutation + data fetch
├── src/lib/
│   ├── propublica/               throttled API client (1 req/s + backoff), raw-cache-first reads, mapper (API shape -> schema)
│   ├── scoring/                  isomorphic scoring engine — zero server-only imports, runs identically in SSR, API routes, and the browser (What-If live re-rank)
│   ├── signals/                  Section 8 taxonomy + AUTO-signal derivation from filing deltas
│   ├── graph/                    pure bipartite trustee graph (BFS Path Finder, super-connector index) — no graph library; visualized whole-universe at /network
│   ├── fiscal-calendar.ts        FYE-based outreach windows, Next-60-Days queue
│   ├── reason-to-call.ts         16 deterministic templates (no LLM)
│   ├── briefing/objection-prep.ts profile-tailored objection responses
│   └── db/schema.ts              Drizzle schema, single SQLite file at data/lodestar.db (gitignored)
└── scripts/seed.ts, snapshot.ts   standalone tsx scripts reusing the same lib code as the app
```

**Data flow for one org:** ProPublica search/detail → `raw_api_cache` (every raw response persisted before mapping) → `propublica/mapper.ts` → `organizations`/`filings` tables → `scoring/context.ts` bulk-loads the whole universe in 4 queries (not one per org) → `scoring/engine.ts` (pure function) computes the six-pillar score → optionally persisted to the append-only `scores` table on "Rescore all" (powers sparklines and Monday Report movers).

**Why the scoring engine has no server-only imports:** the same `computeScore()` call needs to run during SSR (initial Dossier render), inside API routes (`/api/scoring`, `/api/scoring/rescore`), and live in the browser (Rankings Board weight sliders, the Score tab's What-If panel) — all from identical inputs, so a slider drag re-ranks instantly with no round trip. The one server-only seam is `scoring/context.ts`, which loads DB rows into the engine's plain `ScoringInput` shape. (The `scripts/seed.ts` and `scripts/snapshot.ts` CLI scripts reuse this exact same server-side code outside of Next's request lifecycle.)

---

## Scoring methodology

Composite 0–100 per org, six weighted pillars (weights are user-adjustable, always renormalized to sum to 1.0):

| Pillar | Default weight | What it answers |
|---|---|---|
| Money in Motion | 30% | Is there a reason to call this quarter? Signals decay exponentially by half-life; persistent conditions (e.g. spending stress) are recomputed each run, not decayed. |
| Scale & Mandate Fit | 20% | Right size/shape for the desk? Piecewise on assets; >$1B sets a `COORDINATE_INSTITUTIONAL` channel flag. |
| Access & Connectivity | 15% | Can we get a warm meeting? Computed from the real trustee graph — known contacts, second-degree paths via shared board members, super-connectors (3+ boards). |
| Need & Vulnerability | 15% | Is their setup beatable? Fee ratio, investment-officer staffing, asset-mix sophistication — all analyst-entered from reading the actual 990, never fabricated. |
| Wealth Adjacency | 10% | Does this open a door to private wealth? Living founders, liquidity events, family/UHNW trustees. |
| Growth & Expansion | 10% | Will this relationship compound? Peer-cohort CAGR percentile, contribution momentum, credit/treasury and DAF fit. |

A separate **Confidence Index** (0–100, graded A/B/C) scores filing recency, data completeness, sourced-signal count, and analyst verification. **Tier 1 requires Confidence ≥ B** — a high-scoring org with thin data surfaces as "Tier 1 (pending verification)" rather than being silently trusted or silently demoted.

Every score renders as a **waterfall**: pillar contributions stacked to the total, each pillar expandable to its factor rows, each factor showing its exact math and data provenance (`API` / `MANUAL` / `EXAMPLE` / `DERIVED`). The engine is unit-tested exhaustively (decay curves, every pillar's caps and boundaries, weight normalization, tier boundaries, persistent-signal behavior, confidence gating) — see `src/lib/scoring/__tests__/`.

---

## Data sources & limitations

- **Real data:** IRS Form 990/990-PF/990-EZ filings via the [ProPublica Nonprofit Explorer API](https://projects.propublica.org/nonprofits/api/) (free, no key). Every raw response is cached in `raw_api_cache` before mapping; re-fetch only happens on an explicit refresh.
- **`EXAMPLE`-tagged content is fake and clearly marked.** Seed signals, seed people/affiliations, and any seed pipeline entries carry a dashed border + `EXAMPLE` badge in the UI and are excluded from exports by default. Never presented as real intelligence.
- **Manual-assisted fields** (investment fees, staffing, asset mix) aren't in the API — the app shows a "Read the 990" deep link next to structured inputs, and an analyst reads the actual filing and types 2–4 numbers. This capture step *is* the workflow, not a shortcut around it.
- **Known heuristics/limitations** (all documented in detail, with the live evidence behind each call, in `ASSUMPTIONS.md`):
  - `org_type` (private foundation / community foundation / university / etc.) is inferred from name keywords + NTEE code + IRS foundation code — not an authoritative API field.
  - The "70/30 benchmark" used for the PERFORMANCE_GAP signal is a static 7% assumption; there's no market-data feed in scope.
  - CAGR is `null` rather than guessed whenever ProPublica's structured extraction skipped the exact year needed — never interpolated.
  - "Corporate foundation with C-suite trustees" (Wealth Adjacency) can't fire yet — no schema field distinguishes a corporate foundation, and this app doesn't fabricate that detection.
  - 3 of the ~30 seed-list orgs didn't resolve cleanly against the live API on the last seed run (logged, not guessed) — see the Seed Resolution Log at the bottom of `ASSUMPTIONS.md`.

---

## Demo script (~5 minutes)

Rehearsed flow, matches the build spec's acceptance script:

1. **Rankings Board** — "Every Bay Area E&F over $25M, scored and ranked. Built from live IRS data."
2. **Adjust a weight slider** — watch the whole board re-rank live, instantly, client-side.
3. **Open the #1 org → Score tab** — the waterfall: "Every point is auditable down to the source filing. No black box."
4. **Signals tab** — a decaying event curve with "today" marked: "Intel goes stale. A CIO departure from last week outweighs one from last year."
5. **People tab → Path Finder** — "One trustee we know sits two hops from this board. That's the meeting."
6. **Network page** — zoom out to the whole universe's trustee graph: "Here's every relationship we've mapped, and the handful of people who quietly connect dozens of these institutions."
7. **Briefing tab → Print** — one-click, print-ready meeting prep.
8. **Monday Report** — "This is what lands in my MD's inbox every Monday at 8am."

Toggle **presentation mode** (top-right) before projecting — same layout, inverted light palette, larger type.

---

## Tech stack

Next.js 15+ (App Router, TS strict) · Tailwind + shadcn/ui (Base UI) · SQLite via better-sqlite3 + Drizzle ORM · Zustand · Recharts · Vitest. No auth, no multi-user, no external LLM calls, no web scraping — see `ASSUMPTIONS.md` for every judgment call made building it.
