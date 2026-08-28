// Shared logic for the Employee Pulse Survey, used by both the CEO
// Dashboard's compact summary and the full /pulse results page -- keep
// this the single source of truth for "who counts toward the current
// company pulse," same reasoning as lib/metrics.ts for the daily_entries
// KPIs.

// "Current company pulse" only counts someone if they're (a) still
// showing up in recent payroll and (b) answered within the last 3 months
// -- a stale answer from someone still employed shouldn't drag the number
// down forever once whatever caused it has been addressed. Both windows
// are deliberately generous (payroll runs weekly but someone can miss a
// week or take vacation). Per Teather, 2026-08-28.
export const ACTIVE_ROSTER_DAYS = 60;
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
export type RosterRow = { name: string; last_seen_date: string };

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
  const included: { name: string; latest: PulseRow }[] = [];
  byPerson.forEach((rows, name) => {
    const latest = rows[0];
    const rosterEntry = rosterByName.get(name);
    const stillActive = rosterEntry ? daysAgo(rosterEntry.last_seen_date) <= ACTIVE_ROSTER_DAYS : false;
    const answerFresh = daysAgo(latest.survey_date) <= CURRENT_ANSWER_DAYS;
    if (stillActive && answerFresh) included.push({ name, latest });
  });
  return included;
}

/** Company-wide average per metric, from the included set above. */
export function computeCompanyAverages(included: { name: string; latest: PulseRow }[]) {
  return PULSE_METRICS.map((m) => ({ ...m, value: avgNums(included.map((i) => Number(i.latest[m.key]))) }));
}
