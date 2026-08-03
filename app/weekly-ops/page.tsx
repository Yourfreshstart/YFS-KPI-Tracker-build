"use client";

import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import NavTabs from "@/components/NavTabs";
import IdentityGate from "@/components/IdentityGate";
import { useIdentity } from "@/lib/useIdentity";
import { supabase } from "@/lib/supabase";
import { WEEK_COUNT, weekStart, weekEnd, toDateStr, weekIndexForDateStr, todayWeekIndex, fmtWeekLabel } from "@/lib/weeks";

type Row = Record<string, any>;

function sumField(rows: Row[], field: string): number {
  return rows.reduce((a, r) => a + (Number(r[field]) || 0), 0);
}
function avgField(rows: Row[], field: string): number | null {
  if (!rows.length) return null;
  return sumField(rows, field) / rows.length;
}
function lastField(rows: Row[], field: string): number | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)));
  return Number(sorted[sorted.length - 1][field]) || 0;
}
function maxField(rows: Row[], field: string): number | null {
  if (!rows.length) return null;
  return Math.max(...rows.map((r) => Number(r[field]) || 0));
}
function pctFields(rows: Row[], numer: string, denom: string): number | null {
  if (!rows.length) return null;
  const n = sumField(rows, numer);
  const d = sumField(rows, denom);
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}

type Fmt = "usd" | "pct1" | "pct0" | "num" | "signed";
type MetricDef = { key: string; label: string; fmt: Fmt; trueKPI?: boolean; compute: (rows: Row[]) => number | null };

const SECTIONS: { title: string; rows: MetricDef[] }[] = [
  {
    title: "Revenue & Profitability",
    rows: [
      { key: "gross_revenue", label: "Gross Revenue", fmt: "usd", trueKPI: true, compute: (r) => sumField(r, "daily_revenue") },
      {
        key: "payroll_pct",
        label: "Payroll as % of Revenue",
        fmt: "pct1",
        trueKPI: true,
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
      { key: "total_recurring_clients", label: "Total Recurring Clients", fmt: "num", trueKPI: true, compute: (r) => lastField(r, "total_recurring_clients") },
      {
        key: "net_recurring_growth",
        label: "Net Recurring Growth",
        fmt: "signed",
        trueKPI: true,
        compute: (r) => (r.length ? sumField(r, "recurring_added") - sumField(r, "recurring_lost") : null),
      },
      {
        key: "attrition_rate",
        label: "Attrition Rate",
        fmt: "pct1",
        trueKPI: true,
        compute: (r) => {
          const lost = sumField(r, "recurring_lost");
          const base = avgField(r, "total_recurring_clients");
          return base && base > 0 ? Math.round((lost / base) * 1000) / 10 : null;
        },
      },
      { key: "initial_to_recurring", label: "Initial-to-Recurring Conversion", fmt: "pct0", trueKPI: true, compute: (r) => pctFields(r, "converted_initial_to_recurring", "initial_cleans") },
    ],
  },
  {
    title: "Sales Funnel — Leads → Contacted → Booked",
    rows: [
      { key: "leads_in", label: "Leads In", fmt: "num", compute: (r) => sumField(r, "leads_in") },
      { key: "contacted", label: "Contacted (Quoted)", fmt: "num", compute: (r) => sumField(r, "contacted") },
      { key: "contact_rate", label: "Contact Rate", fmt: "pct0", trueKPI: true, compute: (r) => pctFields(r, "contacted", "leads_in") },
      {
        key: "booked",
        label: "Booked",
        fmt: "num",
        compute: (r) => (r.length ? sumField(r, "new_lead_recurring_commitment") + sumField(r, "one_time_booked") : null),
      },
      {
        key: "lead_to_booking",
        label: "Lead-to-Booking Conversion",
        fmt: "pct0",
        trueKPI: true,
        compute: (r) => {
          if (!r.length) return null;
          const leads = sumField(r, "leads_in");
          const booked = sumField(r, "new_lead_recurring_commitment") + sumField(r, "one_time_booked");
          return leads > 0 ? Math.round((booked / leads) * 1000) / 10 : null;
        },
      },
      {
        key: "contact_to_booking",
        label: "Contact-to-Booking",
        fmt: "pct0",
        trueKPI: true,
        compute: (r) => {
          if (!r.length) return null;
          const contacted = sumField(r, "contacted");
          const booked = sumField(r, "new_lead_recurring_commitment") + sumField(r, "one_time_booked");
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
      { key: "interview_show_up", label: "Interview Show-Up Rate", fmt: "pct0", trueKPI: true, compute: (r) => pctFields(r, "actual_interviews", "interviews_scheduled") },
      { key: "new_hires", label: "New Hires", fmt: "num", compute: (r) => sumField(r, "new_hires") },
      { key: "hire_conversion", label: "Hire Conversion Rate", fmt: "pct0", trueKPI: true, compute: (r) => pctFields(r, "new_hires", "actual_interviews") },
      { key: "workers_comp_due", label: "Workers Comp Due", fmt: "usd", compute: (r) => sumField(r, "workers_comp_due") },
      { key: "highest_paid_cleaner", label: "Highest Paid Cleaner", fmt: "usd", compute: (r) => maxField(r, "highest_paid_cleaner") },
      { key: "trainees_paid", label: "# Trainees Paid", fmt: "num", compute: (r) => sumField(r, "trainees_paid") },
      { key: "total_trainee_pay", label: "Total Trainee Pay", fmt: "usd", compute: (r) => sumField(r, "total_trainee_pay") },
    ],
  },
];

function fmtCell(v: number | null, fmt: Fmt): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (fmt === "usd") return "$" + Math.round(v).toLocaleString();
  if (fmt === "pct1") return v.toFixed(1) + "%";
  if (fmt === "pct0") return Math.round(v) + "%";
  if (fmt === "signed") return (v > 0 ? "+" : "") + Math.round(v);
  return Math.round(v).toLocaleString();
}

const RANGE_OPTIONS = [8, 13, 52];

export default function WeeklyOpsPage() {
  const { person, loading, signIn, switchUser } = useIdentity();
  const [rangeN, setRangeN] = useState(13);
  const [weekRowsMap, setWeekRowsMap] = useState<Map<number, Row[]>>(new Map());
  const [dataLoading, setDataLoading] = useState(false);

  const TODAY_IDX = todayWeekIndex();

  const idxs = useMemo(() => {
    if (rangeN >= WEEK_COUNT) return Array.from({ length: WEEK_COUNT }, (_, i) => i);
    const start = Math.max(0, TODAY_IDX - rangeN + 1);
    const arr: number[] = [];
    for (let i = start; i <= TODAY_IDX; i++) arr.push(i);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeN, TODAY_IDX]);

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      const startStr = toDateStr(weekStart(idxs[0]));
      const lastVisible = Math.min(idxs[idxs.length - 1], TODAY_IDX);
      const endStr = toDateStr(weekEnd(lastVisible));
      const { data } = await supabase.from("daily_entries").select("*").gte("entry_date", startStr).lte("entry_date", endStr);
      if (cancelled) return;
      const map = new Map<number, Row[]>();
      (data || []).forEach((row: Row) => {
        const idx = weekIndexForDateStr(row.entry_date);
        if (!map.has(idx)) map.set(idx, []);
        map.get(idx)!.push(row);
      });
      setWeekRowsMap(map);
      setDataLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person, idxs.join(",")]);

  if (loading) return null;
  if (!person) return <IdentityGate onVerified={signIn} />;

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <Logo height={44} />
          <div className="brand-divider" />
          <div className="brand-text">
            <h1>Weekly Ops</h1>
            <div className="sub">All 52 weeks — the full operational view</div>
          </div>
        </div>
        <div className="userbadge">
          <span className="dot" />
          <span>{person.name}</span>
          <button onClick={switchUser}>Switch</button>
        </div>
      </div>

      <NavTabs />

      <div className="controls">
        <div className="range-pick">
          {RANGE_OPTIONS.map((n) => (
            <button key={n} className={rangeN === n ? "active" : ""} onClick={() => setRangeN(n)}>
              {n >= WEEK_COUNT ? "All 52 weeks" : `Last ${n} weeks`}
            </button>
          ))}
        </div>
        <div className="legend-note">
          <span className="star">★</span> also on the CEO Dashboard (13 True KPIs)
        </div>
      </div>

      <div className="table-shell">
        {dataLoading ? (
          <div className="loading">Loading…</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {idxs.map((i) => (
                  <th key={i} className={i === TODAY_IDX ? "wk-current" : ""}>
                    {fmtWeekLabel(weekStart(i))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((sec) => (
                <>
                  <tr className="section-row" key={sec.title}>
                    <th colSpan={idxs.length + 1}>{sec.title}</th>
                  </tr>
                  {sec.rows.map((row) => (
                    <tr key={row.key}>
                      <th>
                        {row.trueKPI && <span className="kpi-star">★</span>}
                        {row.label}
                      </th>
                      {idxs.map((i) => {
                        const future = i > TODAY_IDX;
                        const rows = weekRowsMap.get(i) || [];
                        const val = future || rows.length === 0 ? null : row.compute(rows);
                        return (
                          <td key={i} className={i === TODAY_IDX ? "wk-current" : ""}>
                            {fmtCell(val, row.fmt)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .wrap {
          max-width: 1240px;
          margin: 0 auto;
          padding: 24px 20px 70px;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .brand-divider {
          width: 1px;
          align-self: stretch;
          background: var(--line);
        }
        .brand-text h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }
        .brand-text .sub {
          font-size: 12.5px;
          color: var(--ink-muted);
          margin-top: 2px;
        }
        .userbadge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 6px 8px 6px 14px;
          font-size: 13px;
          font-weight: 700;
        }
        .userbadge .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--green);
        }
        .userbadge button {
          border: none;
          background: var(--surface-2);
          color: var(--ink-muted);
          font-size: 11.5px;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 999px;
          cursor: pointer;
        }
        .controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .range-pick {
          display: flex;
          gap: 4px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 4px;
        }
        .range-pick button {
          border: none;
          background: transparent;
          color: var(--ink-muted);
          font-size: 12.5px;
          font-weight: 600;
          padding: 6px 13px;
          border-radius: 999px;
          cursor: pointer;
        }
        .range-pick button.active {
          background: var(--accent);
          color: var(--accent-ink);
        }
        .legend-note {
          font-size: 12px;
          color: var(--ink-faint);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .legend-note .star {
          color: var(--accent);
        }
        .table-shell {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          overflow: auto;
          max-height: 72vh;
        }
        .loading {
          padding: 40px;
          text-align: center;
          color: var(--ink-faint);
        }
        table {
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13px;
          white-space: nowrap;
          width: 100%;
          min-width: 100%;
        }
        thead :global(th) {
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--surface-2);
          border-bottom: 1px solid var(--line);
          padding: 10px 14px;
          font-weight: 700;
          text-align: right;
          color: var(--ink-muted);
        }
        thead :global(th.wk-current) {
          color: var(--accent);
        }
        thead :global(th:first-child) {
          position: sticky;
          left: 0;
          top: 0;
          z-index: 3;
          text-align: left;
          min-width: 220px;
          background: var(--surface-2);
        }
        tbody :global(td),
        tbody :global(th) {
          padding: 9px 14px;
          text-align: right;
          border-bottom: 1px solid var(--line);
        }
        tbody :global(th) {
          position: sticky;
          left: 0;
          z-index: 1;
          text-align: left;
          background: var(--surface);
          font-weight: 600;
          color: var(--ink);
        }
        tbody :global(tr:hover td),
        tbody :global(tr:hover th) {
          background: var(--surface-2);
        }
        tbody :global(td.wk-current) {
          background: var(--accent-soft);
        }
        :global(tr.section-row th) {
          position: sticky;
          left: 0;
          background: var(--surface-2);
          color: var(--ink-faint);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          text-align: left;
          padding: 12px 14px 6px;
          border-bottom: none;
        }
        .kpi-star {
          color: var(--accent);
          margin-right: 5px;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}
