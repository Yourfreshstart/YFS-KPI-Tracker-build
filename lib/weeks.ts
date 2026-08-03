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

export function weekIndexForDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const diffDays = Math.floor((date.getTime() - MIN_DATE.getTime()) / 86400000);
  return Math.floor(diffDays / 7);
}

export function todayWeekIndex(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (now < MIN_DATE) return 0;
  if (now > MAX_DATE) return WEEK_COUNT - 1;
  const diffDays = Math.floor((now.getTime() - MIN_DATE.getTime()) / 86400000);
  return Math.min(WEEK_COUNT - 1, Math.floor(diffDays / 7));
}

export function fmtWeekLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
