// Months are numbered continuously from month 0 = Jan 2026, with no upper
// limit -- month 12 is Jan 2027, and so on. Date() rolls month numbers past
// 11 into the next year on its own.
import { FIRST_YEAR } from "@/lib/weeks";

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthStart(i: number): Date {
  return new Date(FIRST_YEAR, i, 1);
}
export function monthEnd(i: number): Date {
  return new Date(FIRST_YEAR, i + 1, 0);
}

export function currentMonthIndex(): number {
  const now = new Date();
  return Math.max(0, (now.getFullYear() - FIRST_YEAR) * 12 + now.getMonth());
}

export function monthIndexForDateStr(dateStr: string): number {
  const [y, m] = dateStr.split("-").map(Number);
  return (y - FIRST_YEAR) * 12 + (m - 1);
}

// First month number of the given year (Jan of that year).
export function firstMonthOfYear(year: number): number {
  return (year - FIRST_YEAR) * 12;
}
