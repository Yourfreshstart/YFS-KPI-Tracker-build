export const MIN_DATE = new Date(2026, 0, 5); // Mon Jan 5, 2026
export const MAX_DATE = new Date(2026, 11, 31); // Dec 31, 2026
export const WEEK_COUNT = 52;

export function weekStart(i: number): Date {
  const d = new Date(MIN_DATE);
  d.setDate(d.getDate() + i * 7);
  return d;
}

export function weekEnd(i: number): Date {
  const d = weekStart(i);
  d.setDate(d.getDate() + 6);
  return d;
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Counts calendar days between two dates using their UTC-midnight equivalents.
// Plain (date.getTime() - other.getTime()) / 86400000 is NOT safe here: it
// silently loses/gains an hour across a Daylight Saving transition (this
// range spans one, in March), which throws the day count off by one and
// shifts every week index by one. Date.UTC() sidesteps DST entirely.
function daysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

export function weekIndexForDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Math.floor(daysBetween(MIN_DATE, date) / 7);
}

export function todayWeekIndex(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (now < MIN_DATE) return 0;
  if (now > MAX_DATE) return WEEK_COUNT - 1;
  return Math.min(WEEK_COUNT - 1, Math.floor(daysBetween(MIN_DATE, now) / 7));
}

export function fmtWeekLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
