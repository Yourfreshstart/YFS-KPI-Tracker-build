"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CeoPinGate from "@/components/CeoPinGate";
import { useCeoAuth } from "@/lib/useCeoAuth";
import { api } from "@/lib/api";

type KpiRow = {
  kpi_key: string;
  name: string;
  target_label: string;
  good_label: string | null;
  watch_label: string | null;
  critical_label: string | null;
  owner: string;
  off_track_action: string;
  critical_below: number | null;
  warning_below: number | null;
  warning_above: number | null;
  critical_above: number | null;
};

const THRESHOLD_FIELDS: { field: keyof KpiRow; label: string }[] = [
  { field: "critical_below", label: "Critical below" },
  { field: "warning_below", label: "Warning below" },
  { field: "warning_above", label: "Warning above" },
  { field: "critical_above", label: "Critical above" },
];

type TeamRow = {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
};

export default function ListsAdminPage() {
  const { unlocked, loading, unlock } = useCeoAuth();
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [pinDrafts, setPinDrafts] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [roster, setRoster] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [peopleMsg, setPeopleMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function loadTeam() {
    const r = await api<{ team: TeamRow[]; roster: string[] }>("/api/team");
    if (r.ok) {
      setTeam(r.data.team);
      setRoster(r.data.roster);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      setDataLoading(true);
      const k = await api<{ rows: KpiRow[] }>("/api/kpi-config");
      setKpis(k.ok ? k.data.rows : []);
      await loadTeam();
      setDataLoading(false);
    })();
  }, [unlocked]);

  async function saveKpiField(kpi_key: string, field: keyof KpiRow, value: string) {
    setKpis((prev) => prev.map((k) => (k.kpi_key === kpi_key ? { ...k, [field]: value } : k)));
    await api("/api/kpi-config", { method: "PATCH", body: { kpi_key, field, value } });
    setSavedKey(kpi_key);
    setTimeout(() => setSavedKey((k) => (k === kpi_key ? null : k)), 1500);
  }

  async function saveThreshold(kpi_key: string, field: keyof KpiRow, raw: string) {
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) return;
    setKpis((prev) => prev.map((k) => (k.kpi_key === kpi_key ? { ...k, [field]: value } : k)));
    await api("/api/kpi-config", { method: "PATCH", body: { kpi_key, field, value } });
    setSavedKey(kpi_key);
    setTimeout(() => setSavedKey((k) => (k === kpi_key ? null : k)), 1500);
  }

  async function savePin(name: string) {
    const newPin = (pinDrafts[name] || "").replace(/\D/g, "").slice(0, 4);
    if (newPin.length !== 4) return;
    const r = await api<{ error?: string }>("/api/team", { body: { action: "setpin", name, pin: newPin } });
    if (!r.ok) {
      setPeopleMsg({ ok: false, text: r.data.error || "Couldn't save that PIN." });
      return;
    }
    setPinDrafts((prev) => ({ ...prev, [name]: "" }));
    setSavedKey("pin-" + name);
    setTimeout(() => setSavedKey((k) => (k === "pin-" + name ? null : k)), 1500);
  }

  async function peopleAction(body: Record<string, unknown>, okText: string): Promise<boolean> {
    setPeopleMsg(null);
    const r = await api<{ error?: string }>("/api/team", { body });
    if (!r.ok) {
      setPeopleMsg({ ok: false, text: r.data.error || "Something went wrong." });
      return false;
    }
    setPeopleMsg({ ok: true, text: okText });
    await loadTeam();
    return true;
  }

  async function addPerson() {
    if (await peopleAction({ action: "add", name: newName, pin: newPin }, `${newName.trim()} was added.`)) {
      setNewName("");
      setNewPin("");
    }
  }

  async function setActive(name: string, active: boolean) {
    if (!active && !window.confirm(`Deactivate ${name}? They won't be able to sign in. You can bring them back later.`)) return;
    await peopleAction({ action: active ? "reactivate" : "deactivate", name }, active ? `${name} is active again.` : `${name} was deactivated.`);
  }

  async function mergeTechs() {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) return;
    if (
      !window.confirm(
        `Merge "${mergeFrom}" into "${mergeTo}"?\n\nAll of ${mergeFrom}'s Pulse answers move to ${mergeTo}, the earliest start date is kept, and "${mergeFrom}" is removed. This can't be undone.`
      )
    )
      return;
    if (await peopleAction({ action: "merge-tech", from: mergeFrom, to: mergeTo }, `${mergeFrom} was merged into ${mergeTo}.`)) {
      setMergeFrom("");
      setMergeTo("");
    }
  }

  if (loading) return null;
  if (!unlocked) return <CeoPinGate onUnlock={unlock} />;

  const activeTeam = team.filter((p) => p.is_active);
  const inactiveTeam = team.filter((p) => !p.is_active);

  return (
    <div className="wrap">
      <Link href="/ceo-dashboard" className="backlink">
        ‹ Back to CEO Dashboard
      </Link>

      <div className="topbar">
        <div className="gear">⚙️</div>
        <div>
          <h1>Lists / Admin</h1>
          <div className="sub">Hidden config — not a daily screen. This is where targets, thresholds, and PINs live.</div>
        </div>
      </div>

      {dataLoading ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
          <div className="section">
            <div className="section-head">
              <h2>KPI Targets &amp; Off-Track Actions</h2>
              <div className="desc">
                Good/Watch/Critical text is just the description shown on the dashboard. The four number columns on the
                right are what actually set the dashboard&apos;s colors — change a number here and the CEO Dashboard
                updates immediately.
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>KPI</th>
                    <th>Target</th>
                    <th>Good</th>
                    <th>Watch</th>
                    <th>Critical</th>
                    <th>Owner</th>
                    <th>If off track…</th>
                    {THRESHOLD_FIELDS.map((tf) => (
                      <th key={tf.field as string}>{tf.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((k) => (
                    <tr key={k.kpi_key} className={savedKey === k.kpi_key ? "saved" : ""}>
                      <td className="kpi-name">{k.name}</td>
                      <td>
                        <input defaultValue={k.target_label} onBlur={(e) => saveKpiField(k.kpi_key, "target_label", e.target.value)} />
                      </td>
                      <td>
                        <input defaultValue={k.good_label ?? ""} onBlur={(e) => saveKpiField(k.kpi_key, "good_label", e.target.value)} />
                      </td>
                      <td>
                        <input defaultValue={k.watch_label ?? ""} onBlur={(e) => saveKpiField(k.kpi_key, "watch_label", e.target.value)} />
                      </td>
                      <td>
                        <input defaultValue={k.critical_label ?? ""} onBlur={(e) => saveKpiField(k.kpi_key, "critical_label", e.target.value)} />
                      </td>
                      <td>
                        <input defaultValue={k.owner} onBlur={(e) => saveKpiField(k.kpi_key, "owner", e.target.value)} />
                      </td>
                      <td>
                        <textarea defaultValue={k.off_track_action} onBlur={(e) => saveKpiField(k.kpi_key, "off_track_action", e.target.value)} />
                      </td>
                      {k.kpi_key === "total_recurring_clients" ? (
                        <td colSpan={4} className="no-threshold">
                          Based on trend vs. last month — no number to set.
                        </td>
                      ) : (
                        THRESHOLD_FIELDS.map((tf) => (
                          <td key={tf.field as string}>
                            <input
                              className="num"
                              type="number"
                              inputMode="decimal"
                              defaultValue={k[tf.field] ?? ("" as any)}
                              onBlur={(e) => saveThreshold(k.kpi_key, tf.field, e.target.value)}
                            />
                          </td>
                        ))
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section">
            <div className="section-head">
              <h2>Team &amp; PINs</h2>
              <div className="desc">
                Sign-in PINs for Daily Entry, Payroll and Pulse. Teather&apos;s and Jennifer&apos;s PINs also open the CEO Dashboard; only Teather&apos;s opens
                this page. Five wrong PINs in a row locks that sign-in for 15 minutes.
              </div>
            </div>
            {peopleMsg && <div className={"people-msg " + (peopleMsg.ok ? "ok" : "bad")}>{peopleMsg.text}</div>}
            <div className="team-grid">
              {activeTeam.map((p) => (
                <div className="person-card" key={p.id}>
                  <div className="name">{p.name}</div>
                  <div className="role">{p.role === "owner" ? "Owner / CEO" : "Office Staff"}</div>
                  <div className="pin-row">
                    <label>New PIN</label>
                    <div className="pin-field">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="••••"
                        value={pinDrafts[p.name] || ""}
                        onChange={(e) => setPinDrafts((prev) => ({ ...prev, [p.name]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                      />
                      <button onClick={() => savePin(p.name)} disabled={(pinDrafts[p.name] || "").length !== 4}>
                        Save
                      </button>
                    </div>
                  </div>
                  {savedKey === "pin-" + p.name && <div className="saved-note">PIN updated</div>}
                  {p.role !== "owner" && (
                    <button className="link-btn" onClick={() => setActive(p.name, false)}>
                      Deactivate
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="sub-block">
              <h3>Add a person</h3>
              <div className="inline-form">
                <input type="text" placeholder="First name" maxLength={38} value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="4-digit PIN"
                  className="pin-input"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
                <button onClick={addPerson} disabled={!newName.trim() || newPin.length !== 4}>
                  Add
                </button>
              </div>
            </div>

            {inactiveTeam.length > 0 && (
              <div className="sub-block">
                <h3>No longer active</h3>
                <div className="inactive-list">
                  {inactiveTeam.map((p) => (
                    <span className="inactive-chip" key={p.id}>
                      {p.name}
                      <button className="link-btn" onClick={() => setActive(p.name, true)}>
                        Reactivate
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-head">
              <h2>Technician changed their name</h2>
              <div className="desc">
                If a technician&apos;s name changes (for example, after getting married) and ZenMaid now shows the new name, they appear twice. Merge the old name into
                the new one to keep a single record and all their Pulse history.
              </div>
            </div>
            <div className="sub-block">
              <div className="inline-form">
                <select value={mergeFrom} onChange={(e) => setMergeFrom(e.target.value)}>
                  <option value="">Old name…</option>
                  {roster.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="arrow">into</span>
                <select value={mergeTo} onChange={(e) => setMergeTo(e.target.value)}>
                  <option value="">New name…</option>
                  {roster
                    .filter((n) => n !== mergeFrom)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                </select>
                <button onClick={mergeTechs} disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo}>
                  Merge
                </button>
              </div>
            </div>
          </div>

          <div className="note-box">
            <b>Decided:</b> numbers only, no dropdown lists for now — Daily Entry stays totals-only. Could be added later as a future phase.
          </div>
        </>
      )}

      <style jsx>{`
        .wrap {
          max-width: 1080px;
          margin: 0 auto;
          padding: 24px 20px 70px;
        }
        .backlink {
          font-size: 13px;
          color: var(--ink-muted);
          text-decoration: none;
          display: inline-block;
          margin-bottom: 14px;
        }
        .backlink:hover {
          color: var(--ink);
        }
        .topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 6px;
        }
        .gear {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--surface-2);
          border: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }
        .sub {
          font-size: 12.5px;
          color: var(--ink-muted);
          margin-top: 2px;
        }
        .loading {
          padding: 60px;
          text-align: center;
          color: var(--ink-faint);
        }
        .section {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          margin-top: 20px;
          overflow: hidden;
        }
        .section-head {
          padding: 18px 20px 14px;
          border-bottom: 1px solid var(--line);
        }
        .section-head h2 {
          margin: 0 0 3px;
          font-size: 15px;
          font-weight: 700;
        }
        .desc {
          font-size: 12.5px;
          color: var(--ink-muted);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        thead th {
          text-align: left;
          padding: 10px 16px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--ink-faint);
          font-weight: 700;
          border-bottom: 1px solid var(--line);
          background: var(--surface-2);
          white-space: nowrap;
        }
        tbody td {
          padding: 10px 16px;
          border-bottom: 1px solid var(--line);
          vertical-align: middle;
        }
        tbody tr.saved {
          background: var(--green-soft);
        }
        .kpi-name {
          font-weight: 600;
          white-space: normal;
          min-width: 170px;
        }
        input,
        textarea {
          border: 1px solid var(--line);
          background: var(--surface-2);
          border-radius: 7px;
          padding: 6px 9px;
          font-size: 12.5px;
          color: var(--ink);
          font-family: inherit;
        }
        input {
          width: 110px;
        }
        input.num {
          width: 84px;
        }
        textarea {
          width: 260px;
          min-height: 60px;
          resize: vertical;
        }
        .no-threshold {
          color: var(--ink-faint);
          font-size: 12px;
          font-style: italic;
          white-space: nowrap;
        }
        input:focus,
        textarea:focus {
          outline: none;
          border-color: var(--accent);
          background: var(--surface);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .people-msg {
          margin: 12px 20px 0;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
        }
        .people-msg.ok {
          background: var(--green-soft);
          color: var(--green);
        }
        .people-msg.bad {
          background: #fbe9e7;
          color: #b3261e;
        }
        .sub-block {
          padding: 4px 20px 18px;
        }
        .sub-block h3 {
          margin: 12px 0 8px;
          font-size: 13px;
        }
        .inline-form {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .inline-form input,
        .inline-form select {
          border: 1px solid var(--line);
          background: var(--surface-2);
          color: var(--ink);
          border-radius: 7px;
          padding: 7px 10px;
          font-size: 13px;
        }
        .inline-form .pin-input {
          width: 110px;
          letter-spacing: 0.1em;
        }
        .inline-form button {
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--ink);
          font-size: 12.5px;
          font-weight: 700;
          padding: 7px 14px;
          border-radius: 7px;
          cursor: pointer;
        }
        .inline-form button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .arrow {
          font-size: 12.5px;
          color: var(--ink-muted);
        }
        .link-btn {
          border: none;
          background: none;
          color: var(--ink-muted);
          font-size: 11.5px;
          text-decoration: underline;
          cursor: pointer;
          padding: 0;
          margin-top: 8px;
        }
        .inactive-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .inactive-chip {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 5px 12px;
          font-size: 12.5px;
          color: var(--ink-muted);
        }
        .inactive-chip .link-btn {
          margin-top: 0;
        }
        .team-grid {
          padding: 16px 20px 20px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }
        .person-card {
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 14px 16px;
          background: var(--surface-2);
        }
        .name {
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 2px;
        }
        .role {
          font-size: 12px;
          color: var(--ink-muted);
          margin-bottom: 10px;
        }
        .pin-row label {
          font-size: 11.5px;
          color: var(--ink-faint);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .pin-field {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }
        .pin-field input {
          width: 70px;
          letter-spacing: 0.15em;
        }
        .pin-field button {
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--ink);
          font-size: 12px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 7px;
          cursor: pointer;
        }
        .pin-field button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .saved-note {
          font-size: 11px;
          color: var(--green);
          margin-top: 6px;
          font-weight: 600;
        }
        .note-box {
          margin-top: 20px;
          padding: 14px 16px;
          background: var(--accent-soft);
          border: 1px solid var(--line);
          border-radius: 10px;
          font-size: 12.5px;
          color: var(--ink-muted);
          line-height: 1.5;
        }
        .note-box b {
          color: var(--ink);
        }
      `}</style>
    </div>
  );
}
