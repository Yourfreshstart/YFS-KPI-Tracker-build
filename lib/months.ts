export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEAR = 2026;

export function monthStart(i: number): Date {
  return new Date(YEAR, i, 1);
}
export function monthEnd(i: number): Date {
  return new Date(YEAR, i + 1, 0);
}

export function currentMonthIndex(): number {
  const now = new Date();
  if (now.getFullYear() < YEAR) return 0;
  if (now.getFullYear() > YEAR) return 11;
  return now.getMonth();
}

export function monthIndexForDateStr(dateStr: string): number {
  const [, m] = dateStr.split("-").map(Number);
  return m - 1;
}
