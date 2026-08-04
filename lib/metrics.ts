// Shared metric definitions and aggregation helpers used by Weekly Ops,
// Monthly Summary, and the CEO Dashboard. Each metric's `compute` function
// takes an array of daily_entries rows for a period (a week OR a month —
// the math is period-agnostic) and returns a single number, or null if
// the inputs don't support a value.

export type Row = Record<string, any>;

export function sumField(rows: Row[], field: string): number {
  return rows.reduce((a, r) => a + (Number(r[field]) || 0), 0);
}
export function avgField(rows: Row[], field: string): number | null {
  if (!rows.length) return null;
  return sumField(rows, field) / rows.length;
}
export function lastField(rows: Row[], field: string): number | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)));
  return Number(sorted[sorted.length - 1][field]) || 0;
}
export function maxField(rows: Row[], field: string): number | null {
  if (!rows.length) return null;
  return Math.max(...rows.map((r) => Number(r[field]) || 0));
}
export function pctFields(rows: Row[], numer: string, denom: string): number | null {
  if (!rows.length) return null;
  const n = sumField(rows, numer);
  const d = sumField(rows, denom);
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}
export function bookedCount(rows: Row[]): number {
  return sumField(rows, "new_lead_recurring_commitment") + sumField(rows, "one_time_booked");
}

export type Fmt = "usd" | "pct1" | "pct0" | "num" | "signed";
export type MetricDef = {
  key: string;
  label: string;
  fmt: Fmt;
  trueKPI?: boolean;
  cadence?: "weekly" | "monthly";
  lowerBetter?: boolean;
  compute: (rows: Row[]) => number | null;
};

export const SECTIONS: { title: string; rows: MetricDef[] }[] = [
  {
    title: "Revenue & Profitability",
    rows: [
      { key: "gross_revenue", label: "Gross Revenue", fmt: "usd", trueKPI: true, cadence: "weekly", compute: (r) => sumField(r, "daily_revenue") },
      {
        key: "payroll_pct",
        label: "Payroll as % of Revenue",
        fmt: "pct1",
        trueKPI: true,
        cadence: "weekly",
        compute: (r) => {
          const rev = sumField(r, "daily_revenue");
          const payroll = sumField(r, "total_payroll_taxes");
          return rev > 0 ? Math.round((payroll / rev) * 1000) / 10 : null;
        },
      },
      {
        key: "avg_rev_per_rge",
        label: "Average Revenue per RGE",
        fmt: "usd",
        trueKPI: true,
        cadence: "weekly",
        compute: (r) => {
          const rev = sumField(r, "daily_revenue");
          const hc = avgField(r, "rge_headcount");
          return hc && hc > 0 ? Math.round(rev / hc) : null;
        },
      },
    ],
  },
  {
    title: "Growth & Retention",
    rows: [
      { key: "total_recurring_clients", label: "Total Recurring Clients", fmt: "num", trueKPI: true, cadence: "monthly", compute: (r) => lastField(r, "total_recurring_clients") },
      {
        key: "net_recurring_growth",
        label: "Net Recurring Growth",
        fmt: "signed",
        trueKPI: true,
        cadence: "monthly",
        compute: (r) => (r.length ? sumField(r, "recurring_added") - sumField(r, "recurring_lost") : null),
      },
      {
        key: "attrition_rate",
        label: "Attrition Rate",
        fmt: "pct1",
        trueKPI: true,
        cadence: "monthly",
        lowerBetter: true,
        compute: (r) => {
          const lost = sumField(r, "recurring_lost");
          const base = avgField(r, "total_recurring_clients");
          return base && base > 0 ? Math.round((lost / base) * 1000) / 10 : null;
        },
      },
      { key: "initial_to_recurring", label: "Initial-to-Recurring Conversion", fmt: "pct0", trueKPI: true, cadence: "monthly", compute: (r) => pctFields(r, "converted_initial_to_recurring", "initial_cleans") },
    ],
  },
  {
    title: "Sales Funnel — Leads → Contacted → Booked",
    rows: [
      { key: "leads_in", label: "Leads In", fmt: "num", compute: (r) => sumField(r, "leads_in") },
      { key: "contacted", label: "Contacted (Quoted)", fmt: "num", compute: (r) => sumField(r, "contacted") },
      { key: "contact_rate", label: "Contact Rate", fmt: "pct0", trueKPI: true, cadence: "weekly", compute: (r) => pctFields(r, "contacted", "leads_in") },
      { key: "booked", label: "Booked", fmt: "num", compute: (r) => (r.length ? bookedCount(r) : null) },
      {
        key: "lead_to_booking",
        label: "Lead-to-Booking Conversion",
        fmt: "pct0",
        trueKPI: true,
        cadence: "weekly",
        compute: (r) => {
          if (!r.length) return null;
          const leads = sumField(r, "leads_in");
          const booked = bookedCount(r);
          return leads > 0 ? Math.round((booked / leads) * 1000) / 10 : null;
        },
      },
      {
        key: "contact_to_booking",
        label: "Contact-to-Booking",
        fmt: "pct0",
        trueKPI: true,
        cadence: "weekly",
        compute: (r) => {
          if (!r.length) return null;
          const contacted = sumField(r, "contacted");
          const booked = bookedCount(r);
          return contacted > 0 ? Math.round((booked / contacted) * 1000) / 10 : null;
        },
      },
    ],
  },
  {
    title: "Operations",
    rows: [
      { key: "cleans_completed", label: "Cleans Completed", fmt: "num", compute: (r) => sumField(r, "cleans_completed") },
      { key: "initial_cleans_ops", label: "Initial Cleans", fmt: "num", compute: (r) => sumField(r, "initial_cleans") },
      { key: "recurring_cleans", label: "Recurring Cleans", fmt: "num", compute: (r) => sumField(r, "recurring_cleans") },
      { key: "one_time_cleans", label: "One-Time Cleans", fmt: "num", compute: (r) => sumField(r, "one_time_cleans") },
      { key: "skips", label: "Skips", fmt: "num", compute: (r) => sumField(r, "skips") },
      { key: "route_changes", label: "Route Changes", fmt: "num", compute: (r) => sumField(r, "route_changes") },
      { key: "care_opportunities", label: "Care Opportunities", fmt: "num", compute: (r) => sumField(r, "care_opportunities") },
      { key: "breakage_damage", label: "Breakage / Damage", fmt: "num", compute: (r) => sumField(r, "breakage_damage") },
    ],
  },
  {
    title: "Team & Hiring",
    rows: [
      { key: "avg_rge_headcount", label: "Average RGE Headcount", fmt: "num", compute: (r) => avgField(r, "rge_headcount") },
      {
        key: "rges_tier3_pct",
        label: "% RGEs at Tier 3",
        fmt: "pct0",
        trueKPI: true,
        cadence: "weekly",
        compute: (r) => {
          const t1 = sumField(r, "rges_tier1");
          const t2 = sumField(r, "rges_tier2");
          const t3 = sumField(r, "rges_tier3");
          const total = t1 + t2 + t3;
          return total > 0 ? Math.round((t3 / total) * 1000) / 10 : null;
        },
      },
      { key: "interviews_scheduled", label: "Interviews Scheduled", fmt: "num", compute: (r) => sumField(r, "interviews_scheduled") },
      { key: "actual_interviews", label: "Actual Interviews", fmt: "num", compute: (r) => sumField(r, "actual_interviews") },
      { key: "interview_show_up", label: "Interview Show-Up Rate", fmt: "pct0", trueKPI: true, cadence: "weekly", compute: (r) => pctFields(r, "actual_interviews", "interviews_scheduled") },
      { key: "new_hires", label: "New Hires", fmt: "num", compute: (r) => sumField(r, "new_hires") },
      { key: "hire_conversion", label: "Hire Conversion Rate", fmt: "pct0", trueKPI: true, cadence: "monthly", compute: (r) => pctFields(r, "new_hires", "actual_interviews") },
      { key: "workers_comp_due", label: "Workers Comp Due", fmt: "usd", compute: (r) => sumField(r, "workers_comp_due") },
      { key: "highest_paid_cleaner", label: "Highest Paid Cleaner", fmt: "usd", compute: (r) => maxField(r, "highest_paid_cleaner") },
      { key: "trainees_paid", label: "# Trainees Paid", fmt: "num", compute: (r) => sumField(r, "trainees_paid") },
      { key: "total_trainee_pay", label: "Total Trainee Pay", fmt: "usd", compute: (r) => sumField(r, "total_trainee_pay") },
    ],
  },
];

export const ALL_METRICS: MetricDef[] = SECTIONS.flatMap((s) => s.rows);

export function fmtCell(v: number | null | undefined, fmt: Fmt): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (fmt === "usd") return "$" + Math.round(v).toLocaleString();
  if (fmt === "pct1") return v.toFixed(1) + "%";
  if (fmt === "pct0") return Math.round(v) + "%";
  if (fmt === "signed") return (v > 0 ? "+" : "") + Math.round(v);
  return Math.round(v).toLocaleString();
}

// ---- CEO Dashboard status thresholds (mirrors the approved Lists/Admin bands) ----
export type Status = "good" | "warning" | "critical";

export const STATUS_FNS: Record<string, (v: number, prev?: number | null) => Status> = {
  gross_revenue: (v) => (v < 16500 ? "critical" : v < 17500 ? "warning" : "good"),
  payroll_pct: (v) => (v >= 48 && v <= 52 ? "good" : (v >= 45 && v < 48) || (v > 52 && v <= 55) ? "warning" : "critical"),
  avg_rev_per_rge: (v) => (v < 1300 ? "critical" : v < 1400 ? "warning" : "good"),
  total_recurring_clients: (v, prev) => (prev == null ? "good" : v > prev ? "good" : v === prev ? "warning" : "critical"),
  net_recurring_growth: (v) => (v >= 3 ? "good" : v >= 0 ? "warning" : "critical"),
  attrition_rate: (v) => (v <= 3 ? "good" : v <= 3.75 ? "warning" : "critical"),
  initial_to_recurring: (v) => (v < 44 ? "critical" : v < 50 ? "warning" : "good"),
  contact_rate: (v) => (v < 44 ? "critical" : v < 50 ? "warning" : "good"),
  lead_to_booking: (v) => (v < 21 ? "critical" : v < 25 ? "warning" : "good"),
  contact_to_booking: (v) => (v <= 40 ? "critical" : v < 45 ? "warning" : v <= 70 ? "good" : "warning"),
  interview_show_up: (v) => (v < 40 ? "critical" : v < 45 ? "warning" : "good"),
  rges_tier3_pct: (v) => (v < 30 || v >= 60 ? "critical" : "good"),
  hire_conversion: (v) => (v < 8 ? "critical" : v < 12 ? "warning" : "good"),
};

// ---- "Why it matters" copy for the CEO Dashboard info panels (static, not editable via Lists/Admin) ----
export const WHY_TEXT: Record<string, string> = {
  gross_revenue: "The core weekly revenue figure — the single number the whole dashboard leads with.",
  payroll_pct: "Keeps labor cost in a sustainable band relative to what came in.",
  avg_rev_per_rge: "Shows how efficiently the team is generating revenue per technician.",
  total_recurring_clients: "The base of predictable, recurring revenue.",
  net_recurring_growth: "Recurring clients added minus recurring clients lost — the real growth signal.",
  attrition_rate: "How fast recurring clients are leaving.",
  initial_to_recurring: "Share of one-time initial cleans that turn into recurring clients.",
  contact_rate: "Of leads that came in, how many actually got contacted.",
  lead_to_booking: "Of all leads in, how many turned into a booking — the full funnel.",
  contact_to_booking: "Of leads that were contacted, how many booked — isolates closing performance from contact performance.",
  interview_show_up: "Of scheduled interviews, how many candidates actually showed.",
  rges_tier3_pct: "Share of the team earning top-tier Empowerment Pay — a proxy for team strength.",
  hire_conversion: "Of actual interviews held, how many became new hires.",
};
