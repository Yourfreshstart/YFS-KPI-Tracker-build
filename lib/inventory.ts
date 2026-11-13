// Inventory math, shared by the Inventory page and the server routes.
// Nothing here touches the database -- give it rows, get numbers back.
//
// The rules (all confirmed with Teather, Nov 2026):
// - Rachael counts every Monday: what's on the shelf + what was restocked.
//   Used = last count + restocked - this count. Usage is never typed in.
// - Everything is judged PER TECHNICIAN, using the RGE headcount entered on
//   Daily Entry for the week the usage happened in.
// - Quick check: the last 4 weekly counts together vs. normal. Flag "using
//   more" at 30%+ over, "using less" at 40%+ under, and only if the difference
//   is at least 1 gallon/box/bag or 2 bottles/cans. Never a single week.
// - Slow check: the last 13 weeks vs. the weeks before them, same thresholds,
//   so small changes that pile up over months still get caught.
// - Quiet start: a new, returning or "relearn" supply isn't flagged until it
//   has 4 weeks of counts; counts before its learn_from date are ignored.

export type Unit = "gal" | "bottle" | "can" | "box" | "bag";
export const UNITS: Unit[] = ["gal", "bottle", "can", "box", "bag"];
export const UNIT_LABEL: Record<Unit, [string, string]> = {
  gal: ["gallon", "gallons"],
  bottle: ["bottle", "bottles"],
  can: ["can", "cans"],
  box: ["box", "boxes"],
  bag: ["bag", "bags"],
};
// Gallons, boxes and bags are counted in quarters; bottles and cans whole.
export const QUARTER_UNITS: Unit[] = ["gal", "box", "bag"];
export const MIN_DIFF: Record<Unit, number> = { gal: 1, box: 1, bag: 1, bottle: 2, can: 2 };

export const QUICK_WEEKS = 4;
export const LEARN_WEEKS = 4;
export const SLOW_WEEKS = 13;
export const BASELINE_MAX_WEEKS = 26;
export const MORE_PCT = 0.3;
export const LESS_PCT = 0.4;
export const WEEKS_PER_MONTH = 4.33;
// Back stock kept on top of a month's supply when suggesting an order.
export const BACK_STOCK_WEEKS = 2;

export type Supply = {
  id: number;
  name: string;
  unit: Unit;
  sort_order: number;
  status: "active" | "retired";
  learn_from: string | null;
  retired_at: string | null;
  retired_per_tech_week: number | null;
};
export type CountRow = { count_date: string; supply_id: number; on_shelf: number | null; restocked: number };
export type HeadRow = { entry_date: string; rge_headcount: number | null };

export const unitWord = (u: Unit, n: number) => UNIT_LABEL[u][n === 1 ? 0 : 1];

// ---- dates (plain YYYY-MM-DD strings, counted in UTC days so DST can't shift anything)
function dayNum(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
function fromDayNum(n: number): string {
  const d = new Date(n * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
export function addDays(s: string, days: number): string {
  return fromDayNum(dayNum(s) + days);
}
export function mondayOf(s: string): string {
  const n = dayNum(s);
  const dow = new Date(n * 86400000).getUTCDay(); // 0 = Sunday
  return fromDayNum(n - ((dow + 6) % 7));
}
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function fmtDate(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", opts);
}

// ---- number checks
export function validAmount(unit: Unit, n: number): boolean {
  if (!Number.isFinite(n) || n < 0 || n > 100000) return false;
  const steps = QUARTER_UNITS.includes(unit) ? n * 4 : n;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}
export function fmtNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(r);
}
export function fmtOne(n: number): string {
  const r = Math.round(n * 10) / 10;
  return String(r);
}

// ---- technician headcount by week
export type Techs = {
  forUsageEnding: (countDate: string) => number; // techs during the week before a count
  current: number | null; // latest known headcount
};
export function buildTechs(heads: HeadRow[], today: string): Techs {
  const sums = new Map<number, { total: number; n: number }>();
  for (const h of heads) {
    const v = Number(h.rge_headcount);
    if (!h.rge_headcount || !Number.isFinite(v) || v <= 0) continue;
    const wk = dayNum(mondayOf(h.entry_date));
    const cur = sums.get(wk) || { total: 0, n: 0 };
    cur.total += v;
    cur.n += 1;
    sums.set(wk, cur);
  }
  const weeks = [...sums.keys()].sort((a, b) => a - b);
  const avg = (wk: number) => {
    const s = sums.get(wk)!;
    return s.total / s.n;
  };
  const todayWk = dayNum(mondayOf(today));
  const pastWeeks = weeks.filter((w) => w <= todayWk);
  const current = pastWeeks.length ? avg(pastWeeks[pastWeeks.length - 1]) : weeks.length ? avg(weeks[weeks.length - 1]) : null;
  function lookup(wk: number): number {
    if (weeks.length === 0) return 1; // no headcount at all: compare raw amounts
    let before: number | null = null;
    for (const w of weeks) {
      if (w <= wk) before = w;
      else break;
    }
    if (before !== null) return avg(before);
    return avg(weeks[0]);
  }
  return {
    forUsageEnding: (countDate: string) => lookup(dayNum(mondayOf(countDate)) - 7),
    current,
  };
}

// ---- per-supply analysis
export type UsageWeek = { date: string; used: number; techs: number };
export type FlagKind = "more" | "less" | "slow_up" | "slow_down";
export type Analysis = {
  supply: Supply;
  weeks: UsageWeek[]; // counted weeks after learn_from
  learning: boolean;
  learnedWeeks: number;
  flag: FlagKind | null;
  actual4: number;
  expected4: number;
  slowActual: number;
  slowExpected: number;
  perTechWeek: number | null; // typical use per technician per week
  usualPerMonth: number | null; // at the current headcount
  lastShelf: number | null;
  lastCountDate: string | null;
  months: { key: string; value: number | null }[];
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const meanPerTech = (ws: UsageWeek[]) => (ws.length ? sum(ws.map((w) => w.used / w.techs)) / ws.length : 0);

function judge(unit: Unit, actual: number, expected: number): "more" | "less" | null {
  const min = MIN_DIFF[unit];
  if (actual - expected >= min - 1e-9 && actual >= expected * (1 + MORE_PCT)) return "more";
  if (expected - actual >= min - 1e-9 && actual <= expected * (1 - LESS_PCT)) return "less";
  return null;
}

export function lastSixMonths(today: string): string[] {
  const [y, m] = today.split("-").map(Number);
  const out: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function analyze(supply: Supply, counts: CountRow[], techs: Techs, today: string): Analysis {
  const mine = counts.filter((c) => c.supply_id === supply.id).sort((a, b) => a.count_date.localeCompare(b.count_date));
  const all: UsageWeek[] = [];
  for (let i = 1; i < mine.length; i++) {
    const prev = mine[i - 1].on_shelf;
    const cur = mine[i].on_shelf;
    if (prev === null || cur === null) continue;
    const used = Math.max(0, Number(prev) + Number(mine[i].restocked || 0) - Number(cur));
    all.push({ date: mine[i].count_date, used, techs: techs.forUsageEnding(mine[i].count_date) });
  }
  const weeks = supply.learn_from ? all.filter((w) => w.date >= supply.learn_from!) : all;
  const learning = weeks.length < LEARN_WEEKS;

  const last4 = weeks.slice(-QUICK_WEEKS);
  let base = weeks.slice(0, Math.max(0, weeks.length - QUICK_WEEKS)).slice(-BASELINE_MAX_WEEKS);
  if (base.length < LEARN_WEEKS) base = weeks.slice(-BASELINE_MAX_WEEKS);
  const baseNormal = meanPerTech(base);
  const actual4 = sum(last4.map((w) => w.used));
  const expected4 = baseNormal * sum(last4.map((w) => w.techs));

  let flag: FlagKind | null = null;
  let slowActual = 0;
  let slowExpected = 0;
  if (!learning) {
    flag = judge(supply.unit, actual4, expected4);
    if (!flag && weeks.length >= SLOW_WEEKS + LEARN_WEEKS) {
      const window = weeks.slice(-SLOW_WEEKS);
      const older = weeks.slice(0, weeks.length - SLOW_WEEKS).slice(-BASELINE_MAX_WEEKS);
      slowActual = sum(window.map((w) => w.used));
      slowExpected = meanPerTech(older) * sum(window.map((w) => w.techs));
      const s = judge(supply.unit, slowActual, slowExpected);
      if (s === "more") flag = "slow_up";
      if (s === "less") flag = "slow_down";
    }
  }

  // Typical use for averages and order suggestions: the recent weeks
  // (including the latest ones), or the saved number for a returning supply.
  let perTechWeek: number | null = null;
  if (weeks.length > 0) perTechWeek = meanPerTech(weeks.slice(-BASELINE_MAX_WEEKS));
  else if (supply.retired_per_tech_week !== null && supply.retired_per_tech_week !== undefined) perTechWeek = Number(supply.retired_per_tech_week);
  const curTechs = techs.current ?? 1;
  const usualPerMonth = perTechWeek === null ? null : perTechWeek * curTechs * WEEKS_PER_MONTH;

  const withShelf = mine.filter((c) => c.on_shelf !== null && c.count_date <= today);
  const lastRow = withShelf[withShelf.length - 1];

  // Month by month: average weekly use that month x 4.33, so 4- and 5-Monday
  // months compare fairly. Uses every count, even before a relearn.
  const months = lastSixMonths(today).map((key) => {
    const ws = all.filter((w) => w.date.startsWith(key));
    return { key, value: ws.length ? (sum(ws.map((w) => w.used)) / ws.length) * WEEKS_PER_MONTH : null };
  });

  return {
    supply,
    weeks,
    learning,
    learnedWeeks: Math.min(weeks.length, LEARN_WEEKS),
    flag,
    actual4,
    expected4,
    slowActual,
    slowExpected,
    perTechWeek,
    usualPerMonth,
    lastShelf: lastRow ? Number(lastRow.on_shelf) : null,
    lastCountDate: lastRow ? lastRow.count_date : null,
    months,
  };
}

// How many to order: a month plus back stock, minus what's on the shelf,
// rounded up to whole containers (nobody orders a quarter jug).
export function suggestedOrder(a: Analysis, curTechs: number | null, onShelf: number | null): number {
  if (a.perTechWeek === null) return 0;
  const weekly = a.perTechWeek * (curTechs ?? 1);
  const target = weekly * (WEEKS_PER_MONTH + BACK_STOCK_WEEKS);
  const need = target - (onShelf ?? 0);
  return need > 1e-9 ? Math.ceil(need - 1e-9) : 0;
}
