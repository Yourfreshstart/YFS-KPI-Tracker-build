// Shared logic for the Employee Pulse Survey, used by both the CEO
// Dashboard's compact summary and the full /pulse results page -- keep
// this the single source of truth for "who counts toward the current
// company pulse," same reasoning as lib/metrics.ts for the daily_entries
// KPIs.

// "Current company pulse" only counts someone if they're (a) Active (see
// isActive below) and (b) answered within the last 3 months -- a stale
// answer from someone still employed shouldn't drag the number down
// forever once whatever caused it has been addressed. Per Teather,
// 2026-08-28.
//
// Active vs. Inactive (per Teather, 2026-11-10): payroll runs weekly, and
// someone can take a week of vacation but very rarely two -- so a person
// goes Inactive once they've missed the last 2 payroll runs in a row. This
// is measured against the most recent payroll the Payroll tool has synced
// (the newest last_seen_date on the whole roster), NOT against today's
// date, so a late or skipped payroll run never flips everyone to Inactive
// at once. A manual override (rge_roster.pulse_status_override, set from
// the Pulse page) wins over the automatic rule, e.g. for someone on leave.
export const MISSED_PAYROLLS_FOR_INACTIVE = 2;
export const CURRENT_ANSWER_DAYS = 90;

export type PulseRow = {
  id: string;
  respondent_name: string;
  survey_date: string;
  happiness: number;
  leadership_support: number;
  job_manageability: number;
  likelihood_to_stay: number;
  likelihood_to_recommend: number;
  feedback_text: string | null;
};
export type StatusOverride = "active" | "inactive" | null;
export type RosterRow = {
  name: string;
  last_seen_date: string;
  // Added by supabase/add_pulse_status_override.sql. Undefined (column not
  // there yet) behaves exactly like null: fully automatic.
  pulse_status_override?: StatusOverride;
};

export const PULSE_METRICS: { key: keyof PulseRow; label: string; max: number }[] = [
  { key: "happiness", label: "Happiness", max: 5 },
  { key: "leadership_support", label: "Leadership/Office Support", max: 5 },
  { key: "job_manageability", label: "Job Manageability", max: 5 },
  { key: "likelihood_to_stay", label: "Likelihood to Stay", max: 5 },
  { key: "likelihood_to_recommend", label: "Likelihood to Recommend", max: 10 },
];

export function daysAgo(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function avgNums(nums: number[]): number | null {
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Week-ending date of the newest payroll synced from the Payroll tool. */
export function latestPayrollDate(roster: RosterRow[]): string | null {
  let latest: string | null = null;
  roster.forEach((r) => {
    if (r.last_seen_date && (!latest || r.last_seen_date > latest)) latest = r.last_seen_date;
  });
  return latest;
}

/** What the automatic rule alone says, ignoring any manual override. */
export function autoActive(entry: RosterRow | undefined, latest: string | null): boolean {
  if (!entry || !entry.last_seen_date || !latest) return false;
  // On the latest payroll = 0 days behind, the one before = 7. Missing both
  // of the last 2 weekly runs means 14+ days behind the newest run.
  return daysBetween(entry.last_seen_date, latest) < MISSED_PAYROLLS_FOR_INACTIVE * 7;
}

/** Final Active/Inactive answer: manual override first, then the automatic rule. */
export function isActive(entry: RosterRow | undefined, latest: string | null): boolean {
  if (entry?.pulse_status_override === "active") return true;
  if (entry?.pulse_status_override === "inactive") return false;
  return autoActive(entry, latest);
}

/** Each person's own responses, most-recent first. */
export function groupByPerson(responses: PulseRow[]): Map<string, PulseRow[]> {
  const map = new Map<string, PulseRow[]>();
  responses.forEach((r) => {
    if (!map.has(r.respondent_name)) map.set(r.respondent_name, []);
    map.get(r.respondent_name)!.push(r);
  });
  map.forEach((rows) => rows.sort((a, b) => b.survey_date.localeCompare(a.survey_date)));
  return map;
}

/** People counted toward the current company pulse, with their latest answer. */
export function computeIncluded(responses: PulseRow[], roster: RosterRow[]): { name: string; latest: PulseRow }[] {
  const byPerson = groupByPerson(responses);
  const rosterByName = new Map(roster.map((r) => [r.name, r]));
  const latestPayroll = latestPayrollDate(roster);
  const included: { name: string; latest: PulseRow }[] = [];
  byPerson.forEach((rows, name) => {
    const latest = rows[0];
    const rosterEntry = rosterByName.get(name);
    const stillActive = isActive(rosterEntry, latestPayroll);
    const answerFresh = daysAgo(latest.survey_date) <= CURRENT_ANSWER_DAYS;
    if (stillActive && answerFresh) included.push({ name, latest });
  });
  return included;
}

/** Company-wide average per metric, from the included set above. */
export function computeCompanyAverages(included: { name: string; latest: PulseRow }[]) {
  return PULSE_METRICS.map((m) => ({ ...m, value: avgNums(included.map((i) => Number(i.latest[m.key]))) }));
}
