"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import CeoPinGate from "@/components/CeoPinGate";
import { useCeoAuth } from "@/lib/useCeoAuth";
import { supabase } from "@/lib/supabase";
import { INTAKE_SCHEMA } from "@/lib/kpiIntakeSchema";

type Lead = Record<string, any> & { id: string; submitted_at: string; business_name: string | null };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function KpiIntakeAdminPage() {
  const { unlocked, loading, unlock } = useCeoAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      setDataLoading(true);
      const { data } = await supabase.from("kpi_leads").select("*").order("submitted_at", { ascending: false });
      setLeads((data as Lead[]) || []);
      setDataLoading(false);
    })();
  }, [unlocked]);

  if (loading) return null;
  if (!unlocked) return <CeoPinGate onUnlock={unlock} />;

  return (
    <div className="wrap">
      <Link href="/ceo-dashboard" className="backlink">
        ‹ Back to CEO Dashboard
      </Link>

      <div className="topbar">
        <Logo height={40} />
        <div>
          <h1>KPI Interview Submissions</h1>
          <div className="sub">
            {dataLoading ? "Loading…" : leads.length === 0 ? "No submissions yet" : `${leads.length} submission${leads.length === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>

      {!dataLoading && leads.length === 0 && (
        <div className="empty">
          Nobody's filled out the interview form yet. Send them <code>/kpi-intake</code> and it'll show up here.
        </div>
      )}

      <div className="lead-list">
        {leads.map((lead) => {
          const isOpen = openId === lead.id;
          return (
            <div className="lead-card" key={lead.id}>
              <button className="lead-head" onClick={() => setOpenId(isOpen ? null : lead.id)}>
                <div>
                  <div className="lead-name">{lead.business_name || "(no business name given)"}</div>
                  <div className="lead-date">{fmtDate(lead.submitted_at)}</div>
                </div>
                <span className="chevron">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="lead-body">
                  {INTAKE_SCHEMA.map((sec) => {
                    const filled = sec.fields.filter((f) => (lead[f.id] || "").toString().trim());
                    if (!filled.length) return null;
                    return (
                      <div className="lead-section" key={sec.title}>
                        <div className="lead-section-title">{sec.title}</div>
                        <dl>
                          {filled.map((f) => (
                            <div className="lead-row" key={f.id}>
                              <dt>{f.label}</dt>
                              <dd>{lead[f.id]}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .wrap {
          max-width: 780px;
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
          gap: 14px;
          margin-bottom: 22px;
        }
        h1 {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
        }
        .sub {
          font-size: 12.5px;
          color: var(--ink-muted);
          margin-top: 2px;
        }
        .empty {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 24px;
          font-size: 13.5px;
          color: var(--ink-muted);
          line-height: 1.6;
        }
        .empty code {
          background: var(--surface-2);
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 12.5px;
        }
        .lead-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .lead-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          overflow: hidden;
        }
        .lead-head {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 18px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          font: inherit;
          color: var(--ink);
        }
        .lead-name {
          font-size: 14.5px;
          font-weight: 700;
        }
        .lead-date {
          font-size: 12px;
          color: var(--ink-faint);
          margin-top: 2px;
        }
        .chevron {
          font-size: 11px;
          color: var(--ink-faint);
        }
        .lead-body {
          border-top: 1px solid var(--line);
          padding: 6px 18px 16px;
        }
        .lead-section {
          margin-top: 14px;
        }
        .lead-section-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-faint);
          margin-bottom: 6px;
        }
        dl {
          margin: 0;
        }
        .lead-row {
          display: grid;
          grid-template-columns: minmax(140px, 40%) 1fr;
          gap: 10px;
          padding: 6px 0;
          border-bottom: 1px solid var(--line);
          font-size: 13.5px;
        }
        .lead-row:last-child {
          border-bottom: none;
        }
        dt {
          color: var(--ink-muted);
        }
        dd {
          margin: 0;
          color: var(--ink);
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
}
