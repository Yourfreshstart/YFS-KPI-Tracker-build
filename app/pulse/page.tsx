"use client";

import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import NavTabs from "@/components/NavTabs";
import IdentityGate from "@/components/IdentityGate";
import { useIdentity } from "@/lib/useIdentity";
import { supabase } from "@/lib/supabase";
import {
  MISSED_PAYROLLS_FOR_INACTIVE,
  CURRENT_ANSWER_DAYS,
  PULSE_METRICS as METRICS,
  type PulseRow,
  type RosterRow,
  type StatusOverride,
  groupByPerson,
  computeIncluded,
  computeCompanyAverages,
  latestPayrollDate,
  autoActive,
  isActive,
} from "@/lib/pulse";
import { downloadCsv, todayStamp, type CsvCell } from "@/lib/csv";

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Range = "month" | "3mo" | "12mo" | "all";
const RANGE_LABELS: Record<Range, string> = {
  month: "This month",
  "3mo": "Last 3 months",
  "12mo": "Last 12 months",
  all: "All time",
};

export default function PulsePage() {
  const { person, loading, signIn, switchUser } = useIdentity();
  const [responses, setResponses] = useState<PulseRow[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [openName, setOpenName] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [range, setRange] = useState<Range>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [overrideError, setOverrideError] = useState("");

  useEffect(() => {
    if (!person) return;
    (async () => {
      setDataLoading(true);
      const [{ data: pr }, { data: ro }] = await Promise.all([
        supabase.from("pulse_responses").select("*").order("survey_date", { ascending: false }),
        supabase.from("rge_roster").select("*"),
      ]);
      setResponses((pr as PulseRow[]) || []);
      setRoster((ro as RosterRow[]) || []);
      setDataLoading(false);
    })();
  }, [person]);

  const byPerson = useMemo(() => groupByPerson(responses), [responses]);

  const rosterByName = useMemo(() => {
    const map = new Map<string, RosterRow>();
    roster.forEach((r) => map.set(r.name, r));
    return map;
  }, [roster]);

  const latestPayroll = useMemo(() => latestPayrollDate(roster), [roster]);

  const allNames = useMemo(() => [...new Set([...roster.map((r) => r.name), ...byPerson.keys()])].sort(), [roster, byPerson]);
  const activeNames = useMemo(
    () => allNames.filter((n) => isActive(rosterByName.get(n), latestPayroll)),
    [allNames, rosterByName, latestPayroll]
  );
  const inactiveNames = useMemo(
    () => allNames.filter((n) => !isActive(rosterByName.get(n), latestPayroll)),
    [allNames, rosterByName, latestPayroll]
  );

  // Company pulse = average of each active person's most recent answer.
  const included = useMemo(() => computeIncluded(responses, roster), [responses, roster]);
  const companyAvg = useMemo(() => computeCompanyAverages(included), [included]);

  async function setOverride(name: string, value: StatusOverride) {
    setOverrideError("");
    const prev = roster;
    setRoster((rs) => rs.map((r) => (r.name === name ? { ...r, pulse_status_override: value } : r)));
    const { error } = await supabase.from("rge_roster").update({ pulse_status_override: value }).eq("name", name);
    if (error) {
      setRoster(prev);
      setOverrideError(
        "Couldn't save that status change. If this is the first time, the database update (add_pulse_status_override.sql) may not have been run yet."
      );
    }
  }

  function downloadResponses() {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    if (range === "month") cutoff.setDate(1);
    if (range === "3mo") cutoff.setMonth(cutoff.getMonth() - 3);
    if (range === "12mo") cutoff.setMonth(cutoff.getMonth() - 12);
    const rows = responses
      .filter((r) => range === "all" || new Date(r.survey_date + "T00:00:00") >= cutoff)
      .filter((r) => includeInactive || isActive(rosterByName.get(r.respondent_name), latestPayroll))
      .sort((a, b) => b.survey_date.localeCompare(a.survey_date) || a.respondent_name.localeCompare(b.respondent_name));
    const out: CsvCell[][] = [
      ["Survey Date", "Name", "Status", ...METRICS.map((m) => `${m.label} (out of ${m.max})`), "Feedback"],
      ...rows.map((r) => [
        r.survey_date,
        r.respondent_name,
        isActive(rosterByName.get(r.respondent_name), latestPayroll) ? "Active" : "Inactive",
        ...METRICS.map((m) => Number(r[m.key])),
        r.feedback_text || "",
      ]),
    ];
    const suffix = range === "all" ? "all-time" : range;
    downloadCsv(`YFS Pulse Survey - ${suffix}${includeInactive ? " - incl inactive" : ""} - ${todayStamp()}.csv`, out);
  }

  if (loading) return null;
  if (!person) return <IdentityGate onVerified={signIn} />;

  function renderPerson(name: string, active: boolean) {
    const rows = byPerson.get(name) || [];
    const latest = rows[0];
    const rosterEntry = rosterByName.get(name);
    const override = rosterEntry?.pulse_status_override ?? null;
    const auto = autoActive(rosterEntry, latestPayroll);
    const open = openName === name;
    return (
      <div className="person" key={name}>
        <button className="person-head" onClick={() => setOpenName(open ? null : name)}>
          <span className="person-name">
            {name}
            {override === "active" && <span className="tag">kept active</span>}
            {override === "inactive" && <span className="tag">marked inactive</span>}
          </span>
          <span className="person-latest">
            {latest ? `Last answered ${fmtDate(latest.survey_date)}` : "No responses yet"}
            <span className="chev">{open ? "▲" : "▼"}</span>
          </span>
        </button>
        {open && (
          <div className="history">
            {rosterEntry && (
              <div className="status-row">
                <span className="status-text">
                  Last on payroll: <b>{rosterEntry.last_seen_date ? fmtDate(rosterEntry.last_seen_date) : "—"}</b> · Automatically{" "}
                  <b>{auto ? "Active" : "Inactive"}</b>
                </span>
                <div className="seg">
                  <button className={override === null ? "on" : ""} onClick={() => setOverride(name, null)}>
                    Automatic
                  </button>
                  <button className={override === "active" ? "on" : ""} onClick={() => setOverride(name, "active")}>
                    Keep Active
                  </button>
                  <button className={override === "inactive" ? "on" : ""} onClick={() => setOverride(name, "inactive")}>
                    Mark Inactive
                  </button>
                </div>
              </div>
            )}
            {!rosterEntry && !active && <div className="status-text">Not found in payroll records.</div>}
            {rows.length === 0 && <div className="empty">No responses yet.</div>}
            {rows.map((r) => (
              <div className="response" key={r.id}>
                <div className="response-date">{fmtDate(r.survey_date)}</div>
                <div className="response-scores">
                  {METRICS.map((m) => (
                    <span key={m.key}>
                      {m.label}: <b>{r[m.key]}</b>/{m.max}
                    </span>
                  ))}
                </div>
                {r.feedback_text && <div className="response-feedback">“{r.feedback_text}”</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <Logo height={44} />
          <div className="brand-divider" />
          <div className="brand-text">
            <h1>Employee Pulse</h1>
            <div className="sub">Company averages and individual history — {person.name}</div>
          </div>
        </div>
        <button className="switch" onClick={switchUser}>
          Switch
        </button>
      </div>
      <NavTabs />

      {dataLoading ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
          <div className="card">
            <div className="card-title">Current company pulse</div>
            <div className="card-sub">
              Average of each active tech&apos;s most recent answer — counts {included.length} of {activeNames.length} active
              people (answered in the last {CURRENT_ANSWER_DAYS} days).
            </div>
            <div className="avg-grid">
              {companyAvg.map((m) => (
                <div className="avg-tile" key={m.key}>
                  <div className="avg-label">{m.label}</div>
                  <div className="avg-value">{m.value !== null ? `${m.value} / ${m.max}` : "—"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Download to spreadsheet</div>
            <div className="card-sub">One row per survey answer, as a CSV file that opens in Excel or Google Sheets.</div>
            <div className="dl-row">
              <select value={range} onChange={(e) => setRange(e.target.value as Range)}>
                {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
                  <option key={r} value={r}>
                    {RANGE_LABELS[r]}
                  </option>
                ))}
              </select>
              <label className="chk">
                <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
                Include inactive employees
              </label>
              <button className="dl-btn" onClick={downloadResponses}>
                ⬇ Download CSV
              </button>
            </div>
          </div>

          {overrideError && <div className="err">{overrideError}</div>}

          <div className="card">
            <div className="card-title">Active ({activeNames.length})</div>
            <div className="card-sub">
              On at least one of the last {MISSED_PAYROLLS_FOR_INACTIVE} weekly payrolls
              {latestPayroll ? ` (latest payroll week ending ${fmtDate(latestPayroll)})` : ""}, or kept active by hand.
            </div>
            {activeNames.length === 0 && <div className="empty">No active people.</div>}
            <div className="people">{activeNames.map((n) => renderPerson(n, true))}</div>
          </div>

          <div className="card">
            <button className="inactive-head" onClick={() => setShowInactive(!showInactive)}>
              <span className="card-title">Inactive ({inactiveNames.length})</span>
              <span className="chev">{showInactive ? "▲" : "▼"}</span>
            </button>
            <div className="card-sub">
              Missed the last {MISSED_PAYROLLS_FOR_INACTIVE} payrolls in a row, or marked inactive by hand. Their past answers are
              kept, and they move back to Active automatically if they show up on payroll again.
            </div>
            {showInactive && (
              <>
                {inactiveNames.length === 0 && <div className="empty">No inactive people.</div>}
                <div className="people">{inactiveNames.map((n) => renderPerson(n, false))}</div>
              </>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .dl-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .dl-row select {
          padding: 7px 10px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: var(--surface-2);
          color: var(--ink);
          font-size: 13px;
        }
        .chk {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--ink-muted);
          cursor: pointer;
        }
        .dl-btn {
          padding: 8px 16px;
          border-radius: 999px;
          border: none;
          background: var(--accent);
          color: var(--accent-ink);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .err {
          background: #fdecec;
          color: #a12727;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          margin-bottom: 16px;
        }
        .inactive-head {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          color: var(--ink);
          text-align: left;
        }
        .status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .status-text {
          font-size: 12.5px;
          color: var(--ink-muted);
        }
        .seg {
          display: flex;
          gap: 3px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 3px;
        }
        .seg button {
          border: none;
          background: transparent;
          color: var(--ink-muted);
          font-size: 12px;
          font-weight: 600;
          padding: 5px 11px;
          border-radius: 999px;
          cursor: pointer;
        }
        .seg button.on {
          background: var(--accent);
          color: var(--accent-ink);
        }
        .wrap {
          max-width: 900px;
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
          height: 32px;
          background: var(--line);
        }
        h1 {
          margin: 0;
          font-size: 19px;
        }
        .sub {
          font-size: 12.5px;
          color: var(--ink-muted);
        }
        .switch {
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--surface-2);
          color: var(--ink-muted);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .loading {
          padding: 60px;
          text-align: center;
          color: var(--ink-faint);
        }
        .card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 18px 20px;
          margin-bottom: 16px;
        }
        .card-title {
          font-size: 15px;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .card-sub {
          font-size: 12.5px;
          color: var(--ink-muted);
          margin-bottom: 14px;
        }
        .avg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }
        .avg-tile {
          background: var(--surface-2);
          border-radius: 10px;
          padding: 12px;
        }
        .avg-label {
          font-size: 11.5px;
          color: var(--ink-muted);
          font-weight: 700;
          margin-bottom: 4px;
        }
        .avg-value {
          font-size: 20px;
          font-weight: 800;
        }
        .empty {
          color: var(--ink-faint);
          font-size: 13px;
        }
        .people {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .person {
          border: 1px solid var(--line);
          border-radius: 10px;
          overflow: hidden;
        }
        .person-head {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 14px;
          background: var(--surface);
          border: none;
          cursor: pointer;
          text-align: left;
          flex-wrap: wrap;
        }
        .person-name {
          font-weight: 700;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tag {
          font-size: 10.5px;
          font-weight: 700;
          color: var(--ink-faint);
          background: var(--surface-2);
          border-radius: 999px;
          padding: 2px 8px;
        }
        .person-latest {
          font-size: 12.5px;
          color: var(--ink-muted);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .history {
          background: var(--surface-2);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .response {
          padding: 10px 12px;
          background: var(--surface);
          border-radius: 8px;
          border: 1px solid var(--line);
        }
        .response-date {
          font-size: 12px;
          font-weight: 800;
          color: var(--ink-muted);
          margin-bottom: 6px;
        }
        .response-scores {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 12px;
          color: var(--ink-muted);
        }
        .response-feedback {
          margin-top: 8px;
          font-size: 13px;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
