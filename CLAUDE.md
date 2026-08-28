# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Internal KPI tracking web app for Your Fresh Start Cleaning Service LLC (a residential/commercial cleaning company). Next.js 14 (App Router) + Supabase (Postgres) + Vercel. One team (Teather/Jan/Jennifer) types daily operational numbers into **Daily Entry**; every other screen (**Weekly Ops**, **Monthly Summary**, **CEO Dashboard**) is 100% computed from that — nothing is re-entered anywhere else. A separate self-contained tool, **Payroll**, computes commission/tier payroll from ZenMaid CSV exports and is largely independent of the KPI data model.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build (this is what Vercel runs on every push to `main`)
- `npm run lint` — `next lint`
- No test suite exists (no test framework in `package.json`).
- **The owner's machine has no Node/npm installed.** Historically, changes are verified by pushing to `main` (Vercel auto-deploys) and then driving the live site with a browser tool — not by running anything locally. If you have Node available, local dev/build/lint work normally; if not, follow the push-and-verify-live pattern.
- Supabase has no CLI/migration tooling wired up — schema changes are plain `.sql` files in `supabase/` that a human runs manually in the Supabase SQL Editor. **Writing a new migration file does not apply it.** Always tell the user which file to run and confirm they've run it before assuming a new column/table exists on the live database.

## Architecture

**Data model is one table.** `daily_entries` (`supabase/schema.sql`) has one row per weekday, every field a plain column (revenue, funnel counts, ops counts, staffing counts, plus a block of Monday-only nullable payroll fields). There are no per-technician or per-lead-source rows anywhere — everything is a same-day aggregate, by design (RGEs are tracked as counts only, no names).

**`lib/metrics.ts` is the single source of truth for every computed number.** `SECTIONS` is an array of groups, each with `MetricDef`s (`key`, `label`, `fmt`, `compute(rows) => number | null`, plus `trueKPI`/`cadence`/`lowerBetter` flags). `ALL_METRICS = SECTIONS.flatMap(...)`. Weekly Ops, Monthly Summary, and the CEO Dashboard all import from here and call `computeOverPeriod(metricDef, rows)` — never duplicate a formula in a page component. Adding a metric here makes it show up everywhere automatically (see "Adding a new KPI" below).

**`kpi_config` (Postgres table) drives status colors and CEO-facing text, not code.** Columns: `target_label`/`good_label`/`watch_label`/`critical_label` (display strings), `critical_below`/`warning_below`/`warning_above`/`critical_above` (the actual numeric thresholds `computeStatus()` in `metrics.ts` compares against), `owner`, `off_track_action`. Lists/Admin reads and writes this table directly and generically (`select('*').order('sort_order')`) — it doesn't know about individual KPIs, so a new `kpi_config` row just appears there automatically. **The tile's title and its `compute()` formula live in `metrics.ts` (`label`/`key`); the tile's target text and status thresholds live in `kpi_config` (`name`/`target_label`/threshold columns). These are two separate places that both need updating when a metric's meaning changes** — `metrics.ts.label` is what actually renders as the tile title (not `kpi_config.name`, which is only shown on the Lists/Admin table).

**Auth is two separate PIN gates, not real authentication.** `useIdentity()`/`IdentityGate` (team PIN — Teather/Jan/Jennifer; 8-hour session in `localStorage`) gates Daily Entry, Weekly Ops, Monthly Summary, and Payroll. `useCeoAuth()`/`CeoPinGate` (Teather's PIN only; `sessionStorage`) gates CEO Dashboard and Lists/Admin. Both call the same Postgres RPC `verify_pin(name, pin)` (pgcrypto-hashed). **Supabase RLS policies are wide open (`using (true)`) on every table** — the PIN gates are a UI-layer convenience, not real access control; the anon key can read/write everything directly via the REST API. Don't treat this app as having real auth.

**Payroll (`payroll-tool/payroll.html`) is a separate world.** One self-contained HTML file — inline CSS/JS, bundled SheetJS (free/community edition), zero network calls, zero Supabase — that turns two ZenMaid CSV exports into an Excel workbook, entirely client-side. Kept out of `public/` on purpose (a static file there would bypass the PIN gate); served instead by `app/api/payroll-tool/route.ts` reading it off disk, fetched by `app/payroll/page.tsx` only after the identity gate passes, then rendered in an `<iframe srcDoc>`. Editing the `.html` file and pushing is enough — no build step. The commission/tier/tip business logic in here (`PayrollEngine`) is real payroll math with real dollar consequences — see "Don't change" below.

## Where data is entered

**Only `app/daily-entry/page.tsx`.** Every field autosaves on blur (`commitField` upserts the *entire* `EntryFields` object keyed on `entry_date`) — so adding a new field to `EntryFields`/`DEFAULT_ENTRY`/the relevant `*_FIELDS` array is enough for it to be included in every future save with zero other wiring. `MONDAY_FIELDS` renders only when `date.getDay() === 1`; those DB columns are nullable and stay `null` on every other weekday (this null-vs-0 distinction is load-bearing — see below).

## How the three read-only screens work

- **CEO Dashboard** (`app/ceo-dashboard/page.tsx`): PIN-gated (Teather). Hero tile is Gross Revenue for the **most recently completed week** (not the in-progress current one). Below it, `SECTIONS` filtered to `trueKPI === true` (excluding `gross_revenue`, already the hero), joined against `kpi_config` for thresholds/target/owner/action text. Status color per tile comes from `computeStatus(key, value, prevPeriodValue, thresholds)`. Sparklines show the last 5 weeks.
- **Weekly Ops** (`app/weekly-ops/page.tsx`): every metric in `SECTIONS` as a row (★ = `trueKPI`), all/last-13/last-8 of the 52 weeks as columns. A week strictly after "today" renders blank (`—`), never a fabricated value; a week with zero rows entered also renders `—`, distinct from a real computed `0`.
- **Monthly Summary** (`app/monthly-summary/page.tsx`): same shape, rolled up Jan–Dec + YTD. Money/counts sum across the month; rates recompute from monthly totals (not an average of weekly %s) — see `computeOverPeriod`'s special-case handling below.

## Formulas and dependencies worth knowing before touching `lib/metrics.ts`

- **Weeks are Monday–Sunday, indexed 0–51 from `MIN_DATE` (Mon Jan 5, 2026) to `MAX_DATE` (Dec 31, 2026)** — `lib/weeks.ts`. Months are calendar months within `YEAR = 2026` — `lib/months.ts`. Both are hardcoded to 2026; this app has no concept of a year rollover yet.
- **`weekIndexForDateStr` counts days via `Date.UTC(...)`, not `date.getTime() - other.getTime()`.** The plain-subtraction version silently loses an hour crossing the March DST transition and puts entries in the wrong week column — this was a real shipped bug, fixed once, don't reintroduce it.
- **`computeOverPeriod` has two opt-in special cases, both keyed by metric `key`:**
  - `PERIOD_SENSITIVE_KEYS` (currently just `avg_rev_per_rge`): for metrics that divide a period SUM by a period AVERAGE, running the formula once over a month's rows inflates the result (~4.3x, one month's worth of weeks). These get averaged per-week instead.
  - `WEEK_FILTERED_KEYS` (currently `payroll_pct` → `total_payroll_taxes`, `office_payroll_pct` → `office_pay`): these depend on a field that's only ever filled in on Mondays. A month/YTD view must drop weeks with no real value for that field entirely, not treat the missing week as revenue-with-$0-payroll (which silently drags the % down). The map value is the column checked for presence — **a genuinely-null Monday-only field is meaningful and must stay `null`, never default it to `0`**, or this filter breaks silently.
- **COGS** (`kpi_config.kpi_key = 'payroll_pct'`, tile label "COGS" in `metrics.ts`): `(total_payroll_taxes + workers_comp_due − office_pay − tips) / revenue`. Target band 48–52% is intentional and was confirmed correct as-is even after Workers Comp/Office Pay/Tips were folded into the formula (2026-08-28) — don't "fix" it back to the old number without asking.
- **Office Payroll %** (`office_payroll_pct`): `(office_pay × 1.10) / revenue`. The `×1.10` is a synthetic employer-tax estimate specific to office pay (the real aggregate Taxes figure covers everyone and can't be split back out) — don't confuse this with the real `total_payroll_taxes` field.
- **Payroll tool commission math** (`payroll-tool/payroll.html`, `PayrollEngine.compute()`): tier is 36/40/43% by weekly ticket-hours (<24 / 24–33.9 / ≥34), Tier 1 additionally caps at $16/scheduled-hour. Fuel stipend is $5/house ($10 in Lancaster, OH), split evenly among non-trainee co-workers on a shared job; tips split the same way. A job's `status` field only excludes it from pay if it clearly means "didn't happen" (`/cancel|no.?show|declined/i`) — it does **not** require the literal string `"Completed"`, because ZenMaid exports sometimes show a real, worked, charged job as e.g. `"Active"` if its status hadn't finished syncing; a job kept in pay whose status isn't literally `"Completed"` gets a `STATUS_REVIEW` flag instead of vanishing silently. This flip from allowlist to denylist fixed a real bug where real jobs were dropped and mislabeled "Cancelled" — don't revert to an exact-match on `"Completed"`.
- **This tool's bundled SheetJS build cannot write cell borders/fonts/fills, and cannot write `!pageSetup` (fit-to-page print scaling)** — both are Pro-only features in the real library. `!margins`, `!cols`, `!merges`, and formulas all work. A cell with a number format but no value is silently dropped on write — give it a real value (e.g. `0`) if it needs to carry a format before the user fills it in.

## Don't change without understanding the consequences

- The DST-safe date math in `lib/weeks.ts` (see above).
- Treating a Monday-only payroll column's `null` as meaningfully different from `0` — several `computeOverPeriod`/`compute()` functions branch on `!== null && !== undefined` specifically.
- The RLS-is-open / PIN-gates-are-UI-only security model — don't build a feature assuming the anon key or REST API is actually access-controlled.
- `metrics.ts` vs `kpi_config` as two sources of truth (label/formula vs. target text/thresholds) — see above.
- The commission/tier/fuel/tip logic in `payroll-tool/payroll.html` — every rule in there was explicitly confirmed with the business owner against real ZenMaid data; don't approximate or "simplify" the math, and verify any change against real exported rows before shipping (no test suite exists for it).
- `app/api/payroll-tool/route.ts`'s reason for existing (keeping `payroll.html` out of `public/`) — don't move the file to `public/` for convenience.

## Adding a new KPI

1. Add a `MetricDef` to the right group in `lib/metrics.ts`'s `SECTIONS` (set `trueKPI: true` if it should get a CEO Dashboard tile).
2. If it needs Monday-only or other new input, add the column to `daily_entries` via a new `supabase/add_*.sql` migration (nullable, matching the existing Monday-field pattern) and add it to `EntryFields`/`DEFAULT_ENTRY`/`MONDAY_FIELDS` (or the relevant `*_FIELDS` array) in `app/daily-entry/page.tsx`.
3. If it needs thresholds/a tile, add a row to `kpi_config` in the same migration file (`kpi_key` must match the `MetricDef.key`; set `sort_order` to place it, shifting later rows if inserting mid-list) and a `WHY_TEXT` entry in `metrics.ts`.
4. If it's a ratio depending on a field only entered some days (like the Monday payroll fields), add it to `WEEK_FILTERED_KEYS` with the right presence-check field.
5. Nothing else — Weekly Ops, Monthly Summary, CEO Dashboard, and Lists/Admin all pick it up automatically from `SECTIONS`/`kpi_config`.

## Naming conventions

- `daily_entries` / `EntryFields` / `MetricDef.key` are all `snake_case` and must match exactly across the DB column, the Daily Entry field array, and the metric's `key` in `metrics.ts` — there's no mapping layer.
- Migration files: `add_<thing>.sql` to add, `drop_<thing>.sql` to remove; never edit `schema.sql` retroactively for a change made after initial setup — it's the original bootstrap script, and every change since has been its own additive file in `supabase/`.
- Locked product terminology (don't rename without asking): "Quoted" (not Contacted, as a business term — the DB column is still `contacted`), "Recurring Added" vs "New Lead Recurring Commitment" (two different things — same-day sale-to-recurring vs. any recurring addition that day), "Initial Cleans" (not TTB), "Care Opportunities" (not complaints), RGE (Revenue Generating Employee — cleaning technician, tracked as counts only, never by name).
