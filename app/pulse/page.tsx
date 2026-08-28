"use client";

import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import NavTabs from "@/components/NavTabs";
import IdentityGate from "@/components/IdentityGate";
import { useIdentity } from "@/lib/useIdentity";
import { supabase } from "@/lib/supabase";
import {
  ACTIVE_ROSTER_DAYS,
  CURRENT_ANSWER_DAYS,
  PULSE_METRICS as METRICS,
  type PulseRow,
  type RosterRow,
  daysAgo,
  groupByPerson,
  computeIncluded,
  computeCompanyAverages,
} from "@/lib/pulse";

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PulsePage() {
  const { person, loading, signIn, switchUser } = useIdentity();
  const [responses, setResponses] = useState<PulseRow[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [openName, setOpenName] = useState<string | null>(null);

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

  const allNames = useMemo(() => [...new Set([...roster.map((r) => r.name), ...byPerson.keys()])].sort(), [roster, byPerson]);

  // Company pulse = average of each active person's most recent answer.
  const included = useMemo(() => computeIncluded(responses, roster), [responses, roster]);
  const companyAvg = useMemo(() => computeCompanyAverages(included), [included]);

  if (loading) return null;
  if (!person) return <IdentityGate onVerified={signIn} />;

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
              Average of each active tech&apos;s most recent answer — counts {included.length} of {allNames.length} people (still on
              payroll in the last {ACTIVE_ROSTER_DAYS} days, answered in the last {CURRENT_ANSWER_DAYS} days).
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
            <div className="card-title">By technician</div>
            {allNames.length === 0 && <div className="empty">No responses yet.</div>}
            <div className="people">
              {allNames.map((name) => {
                const rows = byPerson.get(name) || [];
                const latest = rows[0];
                const rosterEntry = rosterByName.get(name);
                const stillActive = rosterEntry ? daysAgo(rosterEntry.last_seen_date) <= ACTIVE_ROSTER_DAYS : false;
                const open = openName === name;
                return (
                  <div className="person" key={name}>
                    <button className="person-head" onClick={() => setOpenName(open ? null : name)}>
                      <span className="person-name">
                        {name}
                        {!stillActive && <span className="tag">not on recent payroll</span>}
                      </span>
                      <span className="person-latest">
                        {latest ? `Last answered ${fmtDate(latest.survey_date)}` : "No responses yet"}
                        <span className="chev">{open ? "▲" : "▼"}</span>
                      </span>
                    </button>
                    {open && (
                      <div className="history">
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
              })}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
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
