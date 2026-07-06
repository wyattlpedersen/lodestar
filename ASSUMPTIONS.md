# ASSUMPTIONS.md

Every assumption made while building LODESTAR, logged as it's made. This file is the audit trail for anything not explicitly specified in the build prompt.

## Phase 0 — Scaffold

- **Project name/location:** created at `~/lodestar` per user instruction (not inside the repo the build prompt was dropped into, since that directory wasn't an empty project dir).
- **Next.js version:** `create-next-app` installed Next.js 16.2.10, which satisfies the "15+" requirement in the spec.
- **UI kit generation:** the `shadcn` CLI installed in this environment defaults to the `base-nova` style, which renders on **Base UI** (`@base-ui/react`) rather than Radix. This changes two API surfaces used throughout the app:
  - No `asChild` prop for polymorphic rendering — Base UI uses `render={<Link .../>}` instead.
  - `TooltipProvider` takes `delay`, not `delayDuration`.
- **Fonts:** Inter (grotesque UI), JetBrains Mono (tabular figures — EINs, scores, dollar amounts), Fraunces (display serif for wordmark/dossier headers), all via `next/font/google`, per Section 14's typography direction.
- **Design tokens:** built a custom palette in `globals.css` (`--gold`, `--slate-chrome`, `--signal-positive`, `--signal-stale`, `--tier-1/2/3/watchlist`) instead of the shadcn neutral default, per Section 14. Terminal (dark) mode lives in `:root` since it's the default; presentation mode is a `.presentation` class override applied via a Zustand-backed toggle + localStorage (chose this over `next-themes` since presentation mode is an explicit manual toggle, not a system light/dark preference, and `next-themes`'s light/dark assumptions didn't map cleanly).
- **EIN storage:** stored as `TEXT` (unpadded digit string, e.g. `"941655673"`) matching the integer ProPublica returns, cast to string. Not the hyphenated `strein` format.
- **`next.config.ts`:** set `turbopack.root` explicitly to the project directory — Next.js's workspace-root auto-detection was picking up an unrelated stray `package-lock.json` in the user's home directory (parent of this project) and mis-inferring the monorepo root.

## Phase 1 — ProPublica API (live verification, `2026-07-06`)

Verified directly against `https://projects.propublica.org/nonprofits/api/v2/` before writing any mapper code.

- **NTEE major-group mapping confirmed exactly as spec guessed:** `ntee[id]` 1=Arts(A), 2=Education(B), 3=Environment/Animal-Related(C,D), 4=Health(E–H), 5=Human Services(I–P), 6=International(Q), 7=Public/Societal Benefit(R,T,U,W — S/Community-Improvement not sampled but assumed grouped here), 8=Religion(X), 9=Mutual Benefit(Y), 10=Unknown(Z).
- **`search.json` response shape:** `{ total_results, organizations: [{ ein (int), strein, name, sub_name, city, state, ntee_code, raw_ntee_code, subseccd, has_subseccd, have_filings, have_extracts, have_pdfs, score }], num_pages, cur_page, page_offset, per_page, search_query, selected_state, selected_ntee, selected_code, data_source, api_version }`.
- **`organizations/{ein}.json` response shape:** `{ organization: {...}, filings_with_data: [...], filings_without_data: [...], data_source, api_version }`.
  - `filings_without_data` entries only carry `{ tax_prd, tax_prd_yr, formtype, formtype_str, pdf_url }` — no financials. These are older filings ProPublica hasn't extracted structured data for; the mapper skips them for financial derivations but still surfaces the PDF link.
  - `filings_with_data` confirmed core fields match the spec's best guess: `tax_prd_yr`, `formtype`, `totrevenue`, `totfuncexpns`, `totassetsend`, `totliabend`, `pdf_url`.
  - **`formtype` values observed:** `0` = Form 990 (public charity), `2` = Form 990-PF (private foundation). `1` (990-EZ) not yet observed in seed set but assumed per ProPublica convention; mapper treats any unrecognized value as "unmapped, financials best-effort."
  - **Contributions field differs by form type** — this is the one place the spec's guess needed correction: 990-PF filings use `grscontrgifts`; standard 990 filings use `totcntrbgfts` instead. The mapper checks both and takes whichever is present.
  - No single `revenue_amount` at the org-summary level is reliable (frequently `null`); always prefer the latest `filings_with_data` entry's `totrevenue`.

- **`org_type` inference:** the API exposes no direct public-charity/private-foundation/university taxonomy matching our schema's enum. `src/lib/propublica/mapper.ts` infers it from a name-keyword + NTEE-prefix + `foundation_code` heuristic (e.g. name contains "community foundation" → `community_foundation`; NTEE starts with `E` or name contains "hospital"/"health" → `hospital_health`). This is a best-effort classification, not authoritative — an analyst can be given an override control in a later phase if the heuristic misfires on an edge case.
- **Most private/community foundations file under NTEE major 7, not their funding cause:** confirmed live — Hewlett is `T21`, Moore is `T20`, Silicon Valley Community Foundation is `T31` (the `T` prefix = "Philanthropy, Voluntarism & Grantmaking Foundations"). The Bay Area E&F preset (`/api/universe/preset`) therefore searches NTEE majors 1–8 (Arts through Religion), not just the "obvious" categories, and major 7 alone surfaces most foundations.
- **Bay Area preset pull depth:** the preset pulls the first **2 result pages per NTEE major** (majors 1–8, `state=CA`, `c_code=3`), then filters by Bay Area city — a bounded ~400-org sample, not an exhaustive crawl of all ~10,000+ CA 501(c)(3)s per major group (verified live: `ntee[id]=7` alone reports `total_results: 10000` capped / `num_pages: 400`). This keeps the preset finishing in ~15-20s under the 1 req/sec throttle while still surfacing prominent Bay Area orgs first (verified: page 1 of major 7 alone returned Moore, Hewlett, Chan Zuckerberg Initiative, Silicon Valley Community Foundation). A full crawl is out of scope for a single-click demo action; the analyst can always run a targeted name search for anything the preset misses.
- **City→county mapping is a static table** (`src/lib/bay-area-counties.ts`), not derived from the API (ProPublica never returns county). Covers the ~140 incorporated cities most likely to appear as an E&F org's registered address across the 10 target counties; not exhaustive of every unincorporated place.
- **CAGR "never guess" is interpreted literally:** 3yr/5yr CAGR require an *exact* filing at `latestYear − 3` / `latestYear − 5` in `filings_with_data`. If ProPublica's structured extraction skipped that specific year (common — see Hewlett's 2018 filing, which exists in `filings_without_data` with no financials), the CAGR is `null` rather than interpolated or approximated from an adjacent year.

## Phase 2 — Scoring engine & Rankings Board

- **Pillars 3 (Access) and 5 (Wealth Adjacency) are wired to accept trustee-graph inputs, but the graph doesn't exist until Phase 3.** Until then, `hasWarmPath`, `hasSecondDegreePath`, `superConnectorOnBoard`, `jpmAlumOnBoard`, family-on-board count, and UHNW-trustee count all default to `false`/`0` — every org effectively scores the "no path identified" base (10 pts) on Access and 0 on those Wealth factors until people/affiliations are entered. `hqInCoverageMetro` (+10 Access) *is* live now, since it only needs the county already derived in Phase 1.
- **Need & Vulnerability (Pillar 4) and part of Wealth Adjacency read from `manual_facts`**, entered via a new Overview-tab form (`mgmt_fees_usd`, `has_paid_cio`, `pct_cash_public`, `single_manager`, `founder_living`). This UI wasn't explicitly assigned to a build phase in the spec, but Section 5 requires it and Pillar 4 is otherwise permanently zero, so it landed in Phase 2 alongside the Overview tab.
- **"Contribution momentum positive & accelerating" (Growth pillar) is simplified to "YoY contributions delta > 0"** rather than checking a full 3-year accelerating trend — the spec names the factor but doesn't specify the exact multi-year test, and filing gaps (see Hewlett's missing 2018 extract) make a strict 3-point trend unreliable. Documented here since it's a literal reading of "positive," not "accelerating."
- **Growth pillar's boolean factors (contribution momentum, credit/treasury fit, custody/DAF fit) are all-or-nothing 0/20**, not graduated within their stated "0-20" range — the spec gives no sub-criteria for partial credit, so each is a clean pass/fail.
- **"Credit/treasury fit" for real-asset-heavy balance sheets** is approximated as `totalLiabilities / totalAssets > 0.3` on the latest filing — a debt-load heuristic, not a literal read of asset composition (990 data doesn't break out real assets specifically).
- **Confidence Index's filing-recency threshold is measured from the filing's own fiscal-year-end**, assuming FYE = the last day of `fyeMonth` if known, else December. This means confidence recency reflects the underlying tax period age, not how long ago ProPublica happened to extract it.
- **Scoring is fully isomorphic by design**: `src/lib/scoring/*` has zero server-only imports so the identical engine runs during SSR, in API routes, and live in the browser for What-If re-ranking — `src/lib/scoring/context.ts` is the one server-only seam that loads DB rows into the pure `ScoringInput` shape (4 bulk queries for the whole universe, not one query per org, to keep Rankings-Board load times flat as the universe grows).
- **Verified against 26 real hydrated orgs** (Hewlett + 25 from the Bay Area preset spanning cultural, university, and private-foundation types): `/api/scoring` computed all 26 scores in ~105ms server-side, confirming the "instant re-rank" requirement holds well before hitting the 200+-org target universe size.

## Phase 3 — Signals, people, trustee graph

- **"70/30 proxy" benchmark for PERFORMANCE_GAP is a static 7.0% nominal annual return assumption** — no market-data feed is in scope (Section 4 lists none), so there's no real blended-benchmark series to compare against. `ASSUMED_70_30_ANNUAL_RETURN` in `src/lib/signals/auto-derive.ts`. In practice this fires very broadly right now (most hydrated cultural/nonprofit orgs show 2yr asset CAGR well under 7%, plausibly a real post-2022-drawdown pattern, not a bug) — worth an analyst sanity-check on the assumed rate before trusting PERFORMANCE_GAP volume as-is.
- **FEE_SPIKE requires two manual data points** (`mgmt_fees_usd` and a new `mgmt_fees_usd_prior`), not one — the schema only stores a flat current value per key, so detecting a YoY change needs the analyst to enter both figures (both are usually visible side-by-side on the 990 anyway). Added a "prior-year fees" field to the Overview tab for this. Never fabricated from a single snapshot.
- **"Contribution momentum" for CONTRIB_SPIKE requires all 3 trailing years' contributions to be non-null** — if ProPublica's extraction skipped any of the 3 prior years (common), the signal simply doesn't fire rather than averaging over fewer years.
- **AUTO signal reconciliation runs on every hydrate/refresh** (`src/lib/signals/sync.ts`), keyed so it never spams duplicates: persistent types (PERFORMANCE_GAP, SPENDING_STRESS) are exactly one row per org, updated in place while true and auto-deactivated the moment the condition clears; decaying types (CONTRIB_SPIKE, FEE_SPIKE, ASSET_DROP) dedupe by `(ein, type, eventDate)` so re-running against the same filing year never re-inserts.
- **"Existing relationship" (for the Access pillar's second-degree path and F6 Path Finder) is defined as a pipeline row with stage in `meeting`/`proposal`/`won`** — the spec's schema has no dedicated "existing relationship" flag on `organizations`, and Pipeline Kanban CRUD doesn't land until Phase 4. This proxy is used starting now since Path Finder needs *some* anchor; verified live with a real 2-hop chain (Asian Art Museum -> shared trustee -> SFMOMA, SFMOMA marked `meeting`).
- **"≥2 family members on board" (Wealth Adjacency) is detected via the analyst-entered `role` free-text field containing "family"** (case-insensitive) — the schema has no family-grouping or surname-matching field, and surname heuristics seemed more likely to misfire than an explicit analyst tag entered at affiliation time.
- **"Corporate foundation with C-suite trustees" (Wealth Adjacency) cannot fire yet** — neither the spec's own `org_type` enum (Section 6) nor ProPublica's data distinguishes a "corporate foundation" classification, so this factor is hardcoded `false` in `context.ts` rather than built on a fragile name-matching guess. Flagging as a known gap rather than fabricating a detector.
- **Verified live end-to-end**: refreshing the 26 already-hydrated orgs generated 31 real AUTO signals (PERFORMANCE_GAP/SPENDING_STRESS/CONTRIB_SPIKE) from actual filing deltas — no fabricated data. A manually-added known-contact trustee produced a real 1-hop warm path (Hewlett Foundation); a shared trustee across two other real orgs (with one pipeline-marked as `meeting`) produced a real 2-hop second-degree path, and both fed correctly into the live scoring engine's Access pillar.

## Phase 4 — Banker workflow

- **"Expected audit completion" (F7) is approximated as FYE + 4 months** — no such field exists in 990 data. The post-audit outreach window is [that + 30, that + 60] days; the pre-FYE window is the literal spec value, [FYE − 90, FYE − 60] days. Both recur annually off the org's `fyeMonth`.
- **Every org entering the universe now auto-gets a `pipeline` row at stage `identified`** (in `hydrateOrganization`) — the spec's F10 Kanban assumes orgs start somewhere, and "Identified" is the natural default the moment an org exists at all. (26 orgs hydrated during Phase 1-3 testing predate this change and needed a one-time manual backfill in the local dev DB — not a code issue, just sequencing.)
- **Reason-to-Call has one deterministic template per Signal Taxonomy code (16) plus a no-signal fallback (17 total)** — comfortably over the "≥10" requirement. Each interpolates org name, asset band, and org type; none call an LLM.
- **Objection Prep always shows all three canned objections**, with each *response* tailored from manual-assisted facts (fee ratio, has-paid-CIO, cash/equity mix) when present, falling back to a generic-but-still-specific counter when the analyst hasn't entered that data yet. Read literally: spec says "3 canned objections + responses selected by profile" — interpreted as the responses being profile-selected, not the objection set being filtered down to fewer than three.
- **Contribution volatility (F11 Peer Benchmarking) is the population stdev of YoY contribution % deltas**, requiring ≥2 deltas (≥3 years of contributions data) — not defined numerically in the spec, so this is a reasonable, testable stand-in for "how erratic is this org's giving."
- **Movers/history-dependent Monday Report sections are honestly empty on a fresh install** — "biggest 7-day movers" needs at least two `scores` rows per org spaced across days, which a same-day demo won't have. This isn't a bug; running `Rescore all` on different days (or the seed script's snapshot in Phase 5) is what populates it.
- **Verified live**: pipeline stage-transition validation blocks moving past Researched without a next action + date, and allows it once supplied; the debrief note on that same call correctly created a NEWS_MENTION signal. The Monday Report, Briefing aggregator, and Peers tab all confirmed against the 26 real hydrated orgs — real scores, real peer percentiles (KQED's contribution volatility landed at the 0th percentile of its cohort, its 5yr CAGR at the 100th — plausible, not fabricated), and a Reason-to-Call correctly keyed off its live PERFORMANCE_GAP signal.
- **Print CSS verification was API/source-level only, not a rendered visual check** — the browser preview tool in this sandbox is scoped to the environment's home-directory config, and modifying it to point at this project was denied by the permission classifier (self-modification of a Claude Code startup file outside this project). Print layout (`.no-print`, `@page` sizing, `break-inside: avoid`) was verified by inspecting the generated HTML/CSS, not by visually rendering a print preview — worth a manual print-preview check before a real demo.

## Phase 5 — Polish, seed data, demo hardening

- **Removed the `server-only` package guard from six lib files** (`propublica/client.ts`, `propublica/ingest.ts`, `signals/sync.ts`, `graph/loader.ts`, `scoring/context.ts`, `scoring/peer-loader.ts`). The package unconditionally throws when required outside Next.js's webpack build (it has no environment check of its own — Next's bundler is what swaps in a no-op for server bundles and an error for client bundles). That made it impossible for `scripts/seed.ts`/`scripts/snapshot.ts` to reuse the real ingest pipeline via plain `tsx` execution, which Section 9/F14 explicitly requires. The actual safety net — these modules are only ever imported from route handlers or server components — was never the `server-only` package itself; it's that nothing in this codebase imports them from a `"use client"` file, which `next build`'s successful production build (verified) confirms.
- **Seed-list name→EIN resolution needed two manual query refinements** to avoid a wrong-but-plausible match: "Santa Clara University" as a literal query surfaces "Jesuit Community At Santa Clara University Inc" (a religious-community entity) ahead of the real corporate filer; querying "President Board of Trustees Santa Clara" instead correctly surfaces "President Board Of Trustees Santa Clara College" (EIN 941156617). Similarly "Fine Arts Museums of San Francisco" surfaces an obscure donor-advised "...Fund" first; the shorter query "Fine Arts Museums" surfaces the real "Fine Arts Museums Foundation" instead. Both fixes were verified live before being applied — never a hardcoded EIN, just a better search string, logged in `scripts/seed.ts`.
- **3 of 29 seed-list orgs didn't resolve** on the live run committed with this snapshot: S.D. Bechtel Jr. Foundation, John Muir Health Foundation, and Sutter Health Foundation all returned `404` from ProPublica's search endpoint for those exact query strings (likely zero-result queries return 404 rather than an empty 200 array — worth confirming against ProPublica's docs if this matters later). Per spec, these were skipped and logged rather than guessed — see the Seed Resolution Log below. 26 real orgs were hydrated instead of ~29.
- **Demo Mode is implemented as "restore the snapshot into the real SQLite DB,"** not a separate in-memory/read-only mode — this reuses every existing DB-reading code path with zero special-casing, and the actual requirement (a full offline demo, Section 0 #6) only needs the *loading* step to skip the network, not the whole app to behave differently afterward. Verified live: wiped the DB, POSTed `/api/settings/demo-mode`, confirmed all 26 orgs / 315 filings / 58 signals / 8 people / 11 affiliations / 26 pipeline rows restored with no ProPublica calls in the server log.
- **Export/import covers all app tables except `raw_api_cache` by default** (pure API-response cache, large and reconstructable via refresh); the full-backup export endpoint includes it for completeness, but the checked-in `data/demo-snapshot.json` (built by `npm run snapshot`) deliberately excludes it to keep the repo file small (~280KB instead of multiple MB).
- **`j`/`k`/Enter row navigation is implemented on the Rankings Board table specifically** (the flagship dense table per spec), not generically across every table in the app — the Pipeline Kanban is drag-and-drop cards, not a navigable table, and other tabs' tables (filings, peer metrics) are short enough that row-by-row keyboard nav wasn't worth the added complexity for this pass.
- **Print-CSS and visual-focus verification remain source/API-level, not a rendered visual check** — same sandbox constraint noted in the Phase 4 log (the browser preview tool here is scoped to a different directory's config, and modifying it was denied). Worth a manual print-preview and a tab-through pass before a live demo.

(This file will keep growing — seed EIN resolutions, manual-assisted field decisions, and any other non-obvious calls land here as they're made.)


## Seed Resolution Log

<!-- SEED_LOG_START -->
### Seed resolution log (`npm run seed`, last run 2026-07-06T23:12:24.883Z)

| Seed name | Resolved EIN | Matched name | Status |
|---|---|---|---|
| William & Flora Hewlett Foundation | 941655673 | William & Flora Hewlett Foundation | resolved |
| David and Lucile Packard Foundation | 942278431 | David And Lucile Packard Foundation | resolved |
| Gordon and Betty Moore Foundation | 943397785 | Gordon E And Betty I Moore Foundation | resolved |
| Koret Foundation | 941624987 | Koret Foundation | resolved |
| Walter and Elise Haas Fund | 946068564 | Walter And Elise Haas Fund | resolved |
| Heising-Simons Foundation | 260799587 | The Heising Simons Foundation | resolved |
| Sobrato Family Foundation | 770348912 | Sobrato Family Foundation | resolved |
| S.D. Bechtel Jr. Foundation | — | — | ProPublica API request failed: 404 Not Found (https://projects.propublica.org/nonprofits/api/v2/search.json?q=S.D.+Bechtel+Jr.+Foundation&state%5Bid%5D=CA) |
| Silicon Valley Community Foundation | 205205488 | Silicon Valley Community Foundation | resolved |
| San Francisco Foundation | 10679337 | San Francisco Foundation | resolved |
| Marin Community Foundation | 943007979 | Marin Community Foundation | resolved |
| East Bay Community Foundation | 946070996 | East Bay Community Foundation | resolved |
| San Francisco State University Foundation | 261169717 | San Francisco State University Foundation | resolved |
| Tower Foundation of San Jose State University | 830403915 | The Tower Foundation Of San Jose State University | resolved |
| University of San Francisco | 941156628 | University Of San Francisco | resolved |
| Santa Clara University | 941156617 | President Board Of Trustees Santa Clara College | resolved |
| Golden Gate University | 941585735 | Golden Gate University | resolved |
| UCSF Foundation | 861175591 | Ucsf Health Medical Foundation | resolved |
| John Muir Health Foundation | — | — | ProPublica API request failed: 404 Not Found (https://projects.propublica.org/nonprofits/api/v2/search.json?q=John+Muir+Health+Foundation&state%5Bid%5D=CA) |
| Sutter Health Foundation | — | — | ProPublica API request failed: 404 Not Found (https://projects.propublica.org/nonprofits/api/v2/search.json?q=Sutter+Health+Foundation&state%5Bid%5D=CA) |
| San Francisco Museum of Modern Art | 941156300 | San Francisco Museum Of Modern Art | resolved |
| Fine Arts Museums of San Francisco | 946096509 | Fine Arts Museums Foundation | resolved |
| Asian Art Museum Foundation of San Francisco | 941704765 | Asian Art Museum Foundation Of San Francisco | resolved |
| San Francisco Symphony | 941156284 | San Francisco Symphony | resolved |
| San Francisco Opera | 940836240 | San Francisco Opera Association | resolved |
| San Francisco Ballet | 941415298 | San Francisco Ballet Association | resolved |
| Exploratorium | 941696494 | The Exploratorium | resolved |
| California Academy of Sciences | 941156258 | California Academy Of Sciences | resolved |
| Oakland Museum of California | 453138892 | Oakland Museum Of California | resolved |
<!-- SEED_LOG_END -->
