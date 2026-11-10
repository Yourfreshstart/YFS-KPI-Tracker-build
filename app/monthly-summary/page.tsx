"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import NavTabs from "@/components/NavTabs";
import IdentityGate from "@/components/IdentityGate";
import { useIdentity } from "@/lib/useIdentity";
import { api } from "@/lib/api";
import { FIRST_YEAR, currentYear, toDateStr } from "@/lib/weeks";
import { MONTH_NAMES, monthStart, monthEnd, currentMonthIndex, monthIndexForDateStr, firstMonthOfYear } from "@/lib/months";
import { SECTIONS, fmtCell, computeOverPeriod, type Row } from "@/lib/metrics";
import { downloadCsv, csvNumber, csvLabel, todayStamp, type CsvCell } from "@/lib/csv";

const YEARS = Array.from({ length: currentYear() - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

export default function MonthlySummaryPage() {
  const { person, loading, signIn, switchUser } = useIdentity();
  const [year, setYear] = useState(currentYear());
  const [monthRowsMap, setMonthRowsMap] = useState<Map<number, Row[]>>(new Map());
  const [dataLoading, setDataLoading] = useState(false);

  // Months are numbered continuously from Jan 2026 (month 0); BASE is the
  // number of the selected year's January, LAST_SHOWN its last month that
  // has started (all 12 for a past year, up to this month for this year).
  const TODAY_MONTH = currentMonthIndex();
  const BASE = firstMonthOfYear(year);
  const LAST_SHOWN = Math.min(BASE + 11, TODAY_MONTH);
  const isThisYear = year === currentYear();

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      const startStr = toDateStr(monthStart(BASE));
      const endStr = toDateStr(monthEnd(LAST_SHOWN));
      const r = await api<{ rows: Row[] }>(`/api/entries?from=${startStr}&to=${endStr}`);
      const data = r.ok ? r.data.rows : [];
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
  }, [person, year]);

  if (loading) return null;
  if (!person) return <IdentityGate onVerified={signIn} />;

  const totalLabel = isThisYear ? "YTD" : "Full year";
  const ytdRows: Row[] = [];
  for (let m = BASE; m <= LAST_SHOWN; m++) {
    ytdRows.push(...(monthRowsMap.get(m) || []));
  }

  function downloadMonthly() {
    const out: CsvCell[][] = [["Section", "Metric", ...MONTH_NAMES, totalLabel]];
    SECTIONS.forEach((sec) =>
      sec.rows.forEach((row) => {
        out.push([
          sec.title,
          csvLabel(row.label, row.fmt),
          ...MONTH_NAMES.map((_, m) => {
            const rows = monthRowsMap.get(BASE + m) || [];
            return BASE + m > TODAY_MONTH || rows.length === 0 ? "" : csvNumber(computeOverPeriod(row, rows), row.fmt);
          }),
          ytdRows.length === 0 ? "" : csvNumber(computeOverPeriod(row, ytdRows), row.fmt),
        ]);
      })
    );
    downloadCsv(`YFS Monthly Summary ${year} - ${todayStamp()}.csv`, out);
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

      <div className="controls">
        <div className="legend-note">
          <span className="star">★</span> also on the CEO Dashboard (13 True KPIs) &nbsp;·&nbsp;
          <span className="ytd-label">{totalLabel}</span> = {isThisYear ? "Jan through the current month" : "all twelve months"}
        </div>
        <div className="controls-right">
          {YEARS.length > 1 && (
            <select className="year-pick" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
          <button className="dl-btn" onClick={downloadMonthly} disabled={dataLoading}>
            ⬇ Download CSV
          </button>
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
                {MONTH_NAMES.map((name, m) => (
                  <th key={m} className={BASE + m === TODAY_MONTH ? "mo-current" : ""}>
                    {name}
                  </th>
                ))}
                <th className="ytd">{totalLabel}</th>
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
                        const future = BASE + m > TODAY_MONTH;
                        const rows = monthRowsMap.get(BASE + m) || [];
                        const val = future || rows.length === 0 ? null : computeOverPeriod(row, rows);
                        return (
                          <td key={m} className={BASE + m === TODAY_MONTH ? "mo-current" : ""}>
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
        .controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .controls .legend-note {
          margin-bottom: 0 !important;
        }
        .controls-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .year-pick {
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--ink);
          font-size: 12.5px;
          font-weight: 700;
          padding: 6px 10px;
          border-radius: 999px;
          cursor: pointer;
        }
        .dl-btn {
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--ink);
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
        }
        .dl-btn:hover {
          border-color: var(--accent);
        }
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
