"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CeoPinGate from "@/components/CeoPinGate";
import { useCeoAuth } from "@/lib/useCeoAuth";
import { supabase } from "@/lib/supabase";

type KpiRow = {
  kpi_key: string;
  name: string;
  target_label: string;
  good_label: string | null;
  watch_label: string | null;
  critical_label: string | null;
  owner: string;
  off_track_action: string;
};

type TeamRow = {
  id: string;
  name: string;
  role: string;
};

export default function ListsAdminPage() {
  const { unlocked, loading, unlock } = useCeoAuth();
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [pinDrafts, setPinDrafts] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      setDataLoading(true);
      const { data: kpiData } = await supabase.from("kpi_config").select("*").order("sort_order");
      const { data: teamData } = await supabase.from("team_members").select("id, name, role").eq("is_active", true);
      setKpis((kpiData as KpiRow[]) || []);
      setTeam((teamData as TeamRow[]) || []);
      setDataLoading(false);
    })();
  }, [unlocked]);

  async function saveKpiField(kpi_key: string, field: keyof KpiRow, value: string) {
    setKpis((prev) => prev.map((k) => (k.kpi_key === kpi_key ? { ...k, [field]: value } : k)));
    await supabase.from("kpi_config").update({ [field]: value }).eq("kpi_key", kpi_key);
    setSavedKey(kpi_key);
    setTimeout(() => setSavedKey((k) => (k === kpi_key ? null : k)), 1500);
  }

  async function savePin(name: string) {
    const newPin = (pinDrafts[name] || "").replace(/\D/g, "").slice(0, 4);
    if (newPin.length !== 4) return;
    await supabase.rpc("set_pin", { input_name: name, new_pin: newPin });
    setPinDrafts((prev) => ({ ...prev, [name]: "" }));
    setSavedKey("pin-" + name);
    setTimeout(() => setSavedKey((k) => (k === "pin-" + name ? null : k)), 1500);
  }

  if (loading) return null;
  if (!unlocked) return <CeoPinGate onUnlock={unlock} />;

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
              <div className="desc">Editable — changes save automatically and immediately affect the CEO Dashboard.</div>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section">
            <div className="section-head">
              <h2>Team &amp; PINs</h2>
              <div className="desc">Daily Entry sign-in PINs. Teather&apos;s PIN also unlocks the CEO Dashboard and this page.</div>
            </div>
            <div className="team-grid">
              {team.map((p) => (
                <div className="person-card" key={p.id}>
                  <div className="name">{p.name}</div>
                  <div className="role">{p.role === "owner" ? "Owner / CEO" : "Office Staff"}</div>
                  <div className="pin-row">
                    <label>New PIN</label>
                    <div className="pin-field">
                      <input
                        type="text"
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
                </div>
              ))}
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
        textarea {
          width: 260px;
          min-height: 60px;
          resize: vertical;
        }
        input:focus,
        textarea:focus {
          outline: none;
          border-color: var(--accent);
          background: var(--surface);
          box-shadow: 0 0 0 3px var(--accent-soft);
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
