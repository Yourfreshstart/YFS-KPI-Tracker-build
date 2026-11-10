"use client";

import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import NavTabs from "@/components/NavTabs";
import IdentityGate from "@/components/IdentityGate";
import { useIdentity } from "@/lib/useIdentity";
import { api } from "@/lib/api";
import { FIRST_YEAR, currentYear, weeksInYear, weekStart, weekEnd, toDateStr, weekIndexForDateStr, todayWeekIndex, fmtWeekLabel } from "@/lib/weeks";
import { SECTIONS, fmtCell, type Row } from "@/lib/metrics";
import { downloadCsv, csvNumber, csvLabel, todayStamp, type CsvCell } from "@/lib/csv";

type Mode = 8 | 13 | "year";
const MODE_OPTIONS: Mode[] = [8, 13, "year"];
const YEARS = Array.from({ length: currentYear() - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

export default function WeeklyOpsPage() {
  const { person, loading, signIn, switchUser } = useIdentity();
  const [mode, setMode] = useState<Mode>(13);
  const [year, setYear] = useState(currentYear());
  const [weekRowsMap, setWeekRowsMap] = useState<Map<number, Row[]>>(new Map());
  const [dataLoading, setDataLoading] = useState(false);

  const TODAY_IDX = todayWeekIndex();

  const idxs = useMemo(() => {
    if (mode === "year") return weeksInYear(year);
    const start = Math.max(0, TODAY_IDX - mode + 1);
    const arr: number[] = [];
    for (let i = start; i <= TODAY_IDX; i++) arr.push(i);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, year, TODAY_IDX]);

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      const startStr = toDateStr(weekStart(idxs[0]));
      const lastVisible = Math.min(idxs[idxs.length - 1], TODAY_IDX);
      const endStr = toDateStr(weekEnd(lastVisible));
      const r = await api<{ rows: Row[] }>(`/api/entries?from=${startStr}&to=${endStr}`);
      const data = r.ok ? r.data.rows : [];
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

  // Same weeks and same computed values as the table on screen, as plain numbers.
  function downloadWeekly() {
    const out: CsvCell[][] = [["Section", "Metric", ...idxs.map((i) => `Week of ${toDateStr(weekStart(i))}`)]];
    SECTIONS.forEach((sec) =>
      sec.rows.forEach((row) => {
        out.push([
          sec.title,
          csvLabel(row.label, row.fmt),
          ...idxs.map((i) => {
            const rows = weekRowsMap.get(i) || [];
            return i > TODAY_IDX || rows.length === 0 ? "" : csvNumber(row.compute(rows), row.fmt);
          }),
        ]);
      })
    );
    const label = mode === "year" ? String(year) : `last ${mode} weeks`;
    downloadCsv(`YFS Weekly Ops - ${label} - ${todayStamp()}.csv`, out);
  }

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
            <div className="sub">Week by week — the full operational view</div>
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
          {MODE_OPTIONS.map((m) => (
            <button key={m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
              {m === "year" ? "Full year" : `Last ${m} weeks`}
            </button>
          ))}
          {mode === "year" && (
            <select className="year-pick" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="controls-right">
          <div className="legend-note">
            <span className="star">★</span> also on the CEO Dashboard (13 True KPIs)
          </div>
          <button className="dl-btn" onClick={downloadWeekly} disabled={dataLoading}>
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
        .controls-right {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
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
        .year-pick {
          border: none;
          background: transparent;
          color: var(--ink);
          font-size: 12.5px;
          font-weight: 700;
          padding: 6px 8px;
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
