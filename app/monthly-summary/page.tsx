"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import NavTabs from "@/components/NavTabs";
import IdentityGate from "@/components/IdentityGate";
import { useIdentity } from "@/lib/useIdentity";
import { supabase } from "@/lib/supabase";
import { toDateStr } from "@/lib/weeks";
import { MONTH_NAMES, monthStart, monthEnd, currentMonthIndex, monthIndexForDateStr } from "@/lib/months";
import { SECTIONS, fmtCell, computeOverPeriod, type Row } from "@/lib/metrics";

export default function MonthlySummaryPage() {
  const { person, loading, signIn, switchUser } = useIdentity();
  const [monthRowsMap, setMonthRowsMap] = useState<Map<number, Row[]>>(new Map());
  const [dataLoading, setDataLoading] = useState(false);

  const TODAY_MONTH = currentMonthIndex();

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      const startStr = toDateStr(monthStart(0));
      const endStr = toDateStr(monthEnd(TODAY_MONTH));
      const { data } = await supabase.from("daily_entries").select("*").gte("entry_date", startStr).lte("entry_date", endStr);
      if (cancelled) return;
      const map = new Map<number, Row[]>();
      (data || []).forEach((row: Row) => {
        const idx = monthIndexForDateStr(row.entry_date);
        if (!map.has(idx)) map.set(idx, []);
        map.get(idx)!.push(row);
      });
      setMonthRowsMap(map);
      setDataLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person]);

  if (loading) return null;
  if (!person) return <IdentityGate onVerified={signIn} />;

  const ytdRows: Row[] = [];
  for (let m = 0; m <= TODAY_MONTH; m++) {
    ytdRows.push(...(monthRowsMap.get(m) || []));
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <Logo height={44} />
          <div className="brand-divider" />
          <div className="brand-text">
            <h1>Monthly Summary</h1>
            <div className="sub">Auto-calculated from Daily Entry — nothing entered here manually</div>
          </div>
        </div>
        <div className="userbadge">
          <span className="dot" />
          <span>{person.name}</span>
          <button onClick={switchUser}>Switch</button>
        </div>
      </div>

      <NavTabs />

      <div className="legend-note">
        <span className="star">★</span> also on the CEO Dashboard (13 True KPIs) &nbsp;·&nbsp;
        <span className="ytd-label">YTD</span> = Jan through the current month
      </div>

      <div className="table-shell">
        {dataLoading ? (
          <div className="loading">Loading…</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {MONTH_NAMES.map((name, m) => (
                  <th key={m} className={m === TODAY_MONTH ? "mo-current" : ""}>
                    {name}
                  </th>
                ))}
                <th className="ytd">YTD</th>
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((sec) => (
                <>
                  <tr className="section-row" key={sec.title}>
                    <th colSpan={14}>{sec.title}</th>
                  </tr>
                  {sec.rows.map((row) => (
                    <tr key={row.key}>
                      <th>
                        {row.trueKPI && <span className="kpi-star">★</span>}
                        {row.label}
                      </th>
                      {MONTH_NAMES.map((_, m) => {
                        const future = m > TODAY_MONTH;
                        const rows = monthRowsMap.get(m) || [];
                        const val = future || rows.length === 0 ? null : computeOverPeriod(row, rows);
                        return (
                          <td key={m} className={m === TODAY_MONTH ? "mo-current" : ""}>
                            {fmtCell(val, row.fmt)}
                          </td>
                        );
                      })}
                      <td className="ytd">{fmtCell(ytdRows.length === 0 ? null : computeOverPeriod(row, ytdRows), row.fmt)}</td>
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
        .legend-note {
          font-size: 12px;
          color: var(--ink-faint);
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 14px;
        }
        .legend-note .star {
          color: var(--accent);
        }
        .ytd-label {
          color: var(--green);
          font-weight: 700;
        }
        .table-shell {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          overflow: auto;
        }
        .loading {
          padding: 40px;
          text-align: center;
          color: var(--ink-faint);
        }
        table {
          border-collapse: separate;
          border-spacing: 0;
          font-size: 14px;
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
          padding: 12px 16px;
          font-weight: 700;
          text-align: right;
          color: var(--ink-muted);
        }
        thead :global(th.mo-current) {
          color: var(--accent);
        }
        thead :global(th.ytd) {
          color: var(--ink);
          background: var(--green-soft);
          border-left: 2px solid var(--green);
        }
        thead :global(th:first-child) {
          position: sticky;
          left: 0;
          top: 0;
          z-index: 3;
          text-align: left;
          min-width: 240px;
          background: var(--surface-2);
        }
        tbody :global(td),
        tbody :global(th) {
          padding: 11px 16px;
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
        tbody :global(td.mo-current) {
          background: var(--accent-soft);
        }
        tbody :global(td.ytd) {
          background: var(--green-soft);
          border-left: 2px solid var(--green);
          font-weight: 700;
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
          padding: 12px 16px 6px;
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
