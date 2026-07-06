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

(This file will keep growing through Phase 1–5 — seed EIN resolutions, manual-assisted field decisions, and any other non-obvious calls land here as they're made.)
