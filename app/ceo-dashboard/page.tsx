"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import CeoPinGate from "@/components/CeoPinGate";
import Sparkline from "@/components/Sparkline";
import { useCeoAuth } from "@/lib/useCeoAuth";
import { supabase } from "@/lib/supabase";
import { weekStart, weekEnd, toDateStr, weekIndexForDateStr, todayWeekIndex } from "@/lib/weeks";
import { monthStart, monthEnd, currentMonthIndex, monthIndexForDateStr } from "@/lib/months";
import { SECTIONS, fmtCell, computeStatus, WHY_TEXT, type Row, type Status } from "@/lib/metrics";

type KpiConfigRow = {
  kpi_key: string;
  target_label: string;
  owner: string;
  off_track_action: string;
  critical_below: number | null;
  warning_below: number | null;
  warning_above: number | null;
  critical_above: number | null;
};

const STATUS_LABEL: Record<Status, string> = { good: "On Track", warning: "Watch", critical: "Off Track" };

export default function CeoDashboardPage() {
  const { unlocked, loading, unlock, lock } = useCeoAuth();
  const [config, setConfig] = useState<Record<string, KpiConfigRow>>({});
  const [weekRowsMap, setWeekRowsMap] = useState<Map<number, Row[]>>(new Map());
  const [monthRowsMap, setMonthRowsMap] = useState<Map<number, Row[]>>(new Map());
  const [dataLoading, setDataLoading] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const TODAY_WEEK = todayWeekIndex();
  const LAST_COMPLETE_WEEK = Math.max(0, TODAY_WEEK - 1);
  const COMPLETED_WEEKS = Array.from({ length: 5 }, (_, i) => LAST_COMPLETE_WEEK - 4 + i).filter((i) => i >= 0);
  const CURRENT_MONTH = currentMonthIndex();
  const PREV_MONTH = Math.max(0, CURRENT_MONTH - 1);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    (async () => {
      setDataLoading(true);

      const { data: cfgData } = await supabase
        .from("kpi_config")
        .select("kpi_key, target_label, owner, off_track_action, critical_below, warning_below, warning_above, critical_above");
      if (!cancelled && cfgData) {
        const map: Record<string, KpiConfigRow> = {};
        cfgData.forEach((c: KpiConfigRow) => (map[c.kpi_key] = c));
        setConfig(map);
      }

      const earliestWeek = COMPLETED_WEEKS.length ? Math.min(...COMPLETED_WEEKS) : LAST_COMPLETE_WEEK;
      const weekRangeStart = weekStart(earliestWeek);
      const monthRangeStart = monthStart(PREV_MONTH);
      const rangeStart = monthRangeStart < weekRangeStart ? monthRangeStart : weekRangeStart;
      const weekRangeEnd = weekEnd(LAST_COMPLETE_WEEK);
      const monthRangeEnd = monthEnd(CURRENT_MONTH);
      const rangeEnd = monthRangeEnd > weekRangeEnd ? monthRangeEnd : weekRangeEnd;
      const { data } = await supabase
        .from("daily_entries")
        .select("*")
        .gte("entry_date", toDateStr(rangeStart))
        .lte("entry_date", toDateStr(rangeEnd));

      if (cancelled) return;

      const wMap = new Map<number, Row[]>();
      const mMap = new Map<number, Row[]>();
      (data || []).forEach((row: Row) => {
        const wIdx = weekIndexForDateStr(row.entry_date);
        if (!wMap.has(wIdx)) wMap.set(wIdx, []);
        wMap.get(wIdx)!.push(row);

        const mIdx = monthIndexForDateStr(row.entry_date);
        if (!mMap.has(mIdx)) mMap.set(mIdx, []);
        mMap.get(mIdx)!.push(row);
      });
      setWeekRowsMap(wMap);
      setMonthRowsMap(mMap);
      setDataLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  if (loading) return null;
  if (!unlocked) return <CeoPinGate onUnlock={unlock} />;

  const heroMetric = SECTIONS[0].rows.find((r) => r.key === "gross_revenue")!;
  const heroRows = weekRowsMap.get(LAST_COMPLETE_WEEK) || [];
  const heroVal = heroRows.length ? heroMetric.compute(heroRows) : null;
  const heroSpark = COMPLETED_WEEKS.map((i) => {
    const rows = weekRowsMap.get(i) || [];
    return rows.length ? heroMetric.compute(rows) : null;
  });
  const heroCfg = config["gross_revenue"];
  const heroStatus: Status | null = heroVal !== null ? computeStatus("gross_revenue", heroVal, null, heroCfg) : null;

  const kpiSections = SECTIONS.map((sec) => ({
    title: sec.title,
    rows: sec.rows.filter((r) => r.trueKPI && r.key !== "gross_revenue"),
  })).filter((sec) => sec.rows.length > 0);

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <Logo height={52} />
          <div className="brand-divider" />
          <div className="brand-text">
            <h1>CEO Dashboard</h1>
            <div className="sub">5 most recently completed weeks</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="page-links">
            <Link href="/daily-entry">Daily Entry</Link>
            <Link href="/weekly-ops">Weekly Ops</Link>
            <Link href="/monthly-summary">Monthly Summary</Link>
          </div>
          <Link href="/lists-admin" className="settings-link">
            ⚙️ Settings
          </Link>
          <button className="lock-btn" onClick={lock}>
            🔒 Lock
          </button>
        </div>
      </div>

      {dataLoading ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
          <div className="hero">
            <div className="hero-top">
              <div className="hero-main">
                <span className="hero-label">Gross Revenue · Most recently completed week</span>
                <span className="hero-value">{fmtCell(heroVal, "usd")}</span>
                <span className="hero-target">
                  Target {heroCfg?.target_label ?? "$17,500/week"} · good ≥ $17,500 · watch $16,500–17,499 · critical &lt; $16,500
                </span>
              </div>
              <div className="hero-right">
                <Sparkline values={heroSpark} width={140} height={44} />
                {heroStatus && (
                  <span className={"pill " + heroStatus}>
                    <span className="dot" />
                    {STATUS_LABEL[heroStatus]}
                  </span>
                )}
                <button className="info-btn" onClick={() => setOpenKey(openKey === "gross_revenue" ? null : "gross_revenue")}>
                  i
                </button>
              </div>
            </div>
            {openKey === "gross_revenue" && (
              <div className="tile-detail">
                <dt>Why it matters</dt>
                <dd>{WHY_TEXT.gross_revenue}</dd>
                <dt>Owner</dt>
                <dd>{heroCfg?.owner ?? "Jennifer"}</dd>
                <dt>If off track</dt>
                <dd>{heroCfg?.off_track_action ?? "Not yet defined"}</dd>
              </div>
            )}
          </div>

          {kpiSections.map((sec) => (
            <div className="group" key={sec.title}>
              <div className="group-title">{sec.title}</div>
              <div className="tile-grid">
                {sec.rows.map((row) => {
                  const cfg = config[row.key];
                  let value: number | null;
                  let prev: number | null = null;
                  let spark: (number | null)[] = [];
                  let eyebrow: string;

                  if (row.cadence === "monthly") {
                    const curRows = monthRowsMap.get(CURRENT_MONTH) || [];
                    const prevRows = monthRowsMap.get(PREV_MONTH) || [];
                    value = curRows.length ? row.compute(curRows) : null;
                    prev = prevRows.length ? row.compute(prevRows) : null;
                    eyebrow = "This month";
                  } else {
                    const rows = weekRowsMap.get(LAST_COMPLETE_WEEK) || [];
                    value = rows.length ? row.compute(rows) : null;
                    spark = COMPLETED_WEEKS.map((i) => {
                      const wRows = weekRowsMap.get(i) || [];
                      return wRows.length ? row.compute(wRows) : null;
                    });
                    eyebrow = "This week";
                  }

                  const status: Status | null = value !== null ? computeStatus(row.key, value, prev, cfg) : null;
                  const isOpen = openKey === row.key;

                  return (
                    <div className="tile" key={row.key}>
                      <div className="tile-top">
                        <div className="tile-labels">
                          <span className="tile-eyebrow">{eyebrow}</span>
                          <span className="tile-name">{row.label}</span>
                        </div>
                        <button className="info-btn" onClick={() => setOpenKey(isOpen ? null : row.key)}>
                          i
                        </button>
                      </div>
                      <div className="tile-body">
                        <div>
                          <div className="tile-value">{fmtCell(value, row.fmt)}</div>
                          <div className="tile-target">Target {cfg?.target_label ?? "—"}</div>
                        </div>
                        {row.cadence !== "monthly" && <Sparkline values={spark} />}
                      </div>
                      <div className="tile-foot">
                        {prev !== null && value !== null && (
                          <span
                            className={
                              "tile-delta " +
                              (value === prev
                                ? "flat"
                                : (value > prev) !== !!row.lowerBetter
                                ? "up"
                                : "down")
                            }
                          >
                            {value > prev ? "▲" : value < prev ? "▼" : "•"} vs last month
                          </span>
                        )}
                        {status ? (
                          <span className={"pill " + status}>
                            <span className="dot" />
                            {STATUS_LABEL[status]}
                          </span>
                        ) : (
                          <span className="pill neutral">
                            <span className="dot" />
                            No data yet
                          </span>
                        )}
                      </div>
                      {isOpen && (
                        <div className="tile-detail">
                          <dt>Why it matters</dt>
                          <dd>{WHY_TEXT[row.key]}</dd>
                          <dt>Owner</dt>
                          <dd>{cfg?.owner ?? "Jennifer"}</dd>
                          <dt>If off track</dt>
                          <dd>{cfg?.off_track_action ?? "Not yet defined"}</dd>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      <style jsx>{`
        .wrap {
          max-width: 1080px;
          margin: 0 auto;
          padding: 24px 20px 70px;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
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
          font-size: 21px;
          font-weight: 700;
        }
        .brand-text .sub {
          font-size: 12.5px;
          color: var(--ink-muted);
          margin-top: 2px;
        }
        .topbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .page-links {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-right: 14px;
          border-right: 1px solid var(--line);
        }
        .page-links :global(a) {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink-muted);
          text-decoration: none;
        }
        .page-links :global(a:hover) {
          color: var(--ink);
        }
        .settings-link {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink-muted);
          text-decoration: none;
        }
        .settings-link:hover {
          color: var(--ink);
        }
        .lock-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink-muted);
          cursor: pointer;
        }
        .loading {
          padding: 60px;
          text-align: center;
          color: var(--ink-faint);
        }
        .hero {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 22px 24px;
          margin-bottom: 20px;
        }
        .hero-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }
        .hero-main {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .hero-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ink-faint);
          font-weight: 700;
        }
        .hero-value {
          font-size: 44px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .hero-target {
          font-size: 12.5px;
          color: var(--ink-muted);
        }
        .hero-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .group {
          margin-bottom: 22px;
        }
        .group-title {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--ink-faint);
          margin: 0 0 10px 2px;
        }
        .tile-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 12px;
        }
        .tile {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 16px 16px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tile-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .tile-labels {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .tile-eyebrow {
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-faint);
          font-weight: 700;
        }
        .tile-name {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--ink);
        }
        .info-btn {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1px solid var(--line);
          background: var(--surface-2);
          color: var(--ink-faint);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
        }
        .info-btn:hover {
          color: var(--ink);
          border-color: var(--accent);
        }
        .tile-body {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 10px;
        }
        .tile-value {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .tile-target {
          font-size: 11.5px;
          color: var(--ink-faint);
          margin-top: 1px;
        }
        .tile-delta {
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-muted);
        }
        .tile-delta.up {
          color: var(--status-good);
        }
        .tile-delta.down {
          color: var(--status-critical);
        }
        .tile-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 2px;
        }
        .tile-detail {
          margin-top: 6px;
          padding-top: 10px;
          border-top: 1px solid var(--line);
          font-size: 12px;
          color: var(--ink-muted);
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .tile-detail dt {
          font-weight: 700;
          color: var(--ink);
          margin-top: 6px;
        }
        .tile-detail dt:first-child {
          margin-top: 0;
        }
        .tile-detail dd {
          margin: 1px 0 0;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }
        .pill :global(.dot) {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .pill.good {
          background: var(--status-good-soft, #e6f5e1);
          color: var(--status-good);
        }
        .pill.good :global(.dot) {
          background: var(--status-good);
        }
        .pill.warning {
          background: var(--status-warning-soft, #fff3da);
          color: var(--status-warning);
        }
        .pill.warning :global(.dot) {
          background: var(--status-warning);
        }
        .pill.critical {
          background: var(--status-critical-soft, #fbe3e1);
          color: var(--status-critical);
        }
        .pill.critical :global(.dot) {
          background: var(--status-critical);
        }
        .pill.neutral {
          background: var(--surface-2);
          color: var(--ink-muted);
        }
        .pill.neutral :global(.dot) {
          background: var(--ink-faint);
        }
      `}</style>
    </div>
  );
}
