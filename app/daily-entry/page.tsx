"use client";

import { useEffect, useState, type ReactNode } from "react";
import Logo from "@/components/Logo";
import NavTabs from "@/components/NavTabs";
import DateNav from "@/components/DateNav";
import IdentityGate from "@/components/IdentityGate";
import NumberField from "@/components/NumberField";
import { useIdentity } from "@/lib/useIdentity";
import { supabase } from "@/lib/supabase";

const MIN = new Date(2026, 0, 5);
const MAX = new Date(2026, 11, 31);

type EntryFields = {
  daily_revenue: number;
  leads_in: number;
  contacted: number;
  new_lead_recurring_commitment: number;
  one_time_booked: number;
  initial_cleans: number;
  converted_initial_to_recurring: number;
  recurring_added: number;
  recurring_lost: number;
  total_recurring_clients: number;
  cleans_completed: number;
  recurring_cleans: number;
  one_time_cleans: number;
  skips: number;
  route_changes: number;
  care_opportunities: number;
  breakage_damage: number;
  call_offs: number;
  rge_headcount: number;
  interviews_scheduled: number;
  actual_interviews: number;
  new_hires: number;
  total_payroll_taxes: number;
  workers_comp_due: number;
  highest_paid_cleaner: number;
  trainees_paid: number;
  total_trainee_pay: number;
  rges_tier1: number;
  rges_tier2: number;
  rges_tier3: number;
};

const DEFAULT_ENTRY: EntryFields = {
  daily_revenue: 0,
  leads_in: 0,
  contacted: 0,
  new_lead_recurring_commitment: 0,
  one_time_booked: 0,
  initial_cleans: 0,
  converted_initial_to_recurring: 0,
  recurring_added: 0,
  recurring_lost: 0,
  total_recurring_clients: 0,
  cleans_completed: 0,
  recurring_cleans: 0,
  one_time_cleans: 0,
  skips: 0,
  route_changes: 0,
  care_opportunities: 0,
  breakage_damage: 0,
  call_offs: 0,
  rge_headcount: 0,
  interviews_scheduled: 0,
  actual_interviews: 0,
  new_hires: 0,
  total_payroll_taxes: 0,
  workers_comp_due: 0,
  highest_paid_cleaner: 0,
  trainees_paid: 0,
  total_trainee_pay: 0,
  rges_tier1: 0,
  rges_tier2: 0,
  rges_tier3: 0,
};

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDefaultDate(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let d = now < MIN ? new Date(MIN) : now > MAX ? new Date(MAX) : now;
  while (d.getDay() === 0 || d.getDay() === 6) {
    d = new Date(d);
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function mapRowToFields(row: any): EntryFields {
  const out: any = {};
  for (const key of Object.keys(DEFAULT_ENTRY)) {
    const v = row[key];
    out[key] = v === null || v === undefined ? 0 : Number(v);
  }
  return out as EntryFields;
}

const SALES_FIELDS: [keyof EntryFields, string][] = [
  ["leads_in", "Leads In"],
  ["contacted", "Contacted (Quoted)"],
  ["new_lead_recurring_commitment", "New Lead Recurring Commitment"],
  ["one_time_booked", "One-Time Booked"],
];
const SCHEDULING_FIELDS: [keyof EntryFields, string][] = [
  ["initial_cleans", "Initial Cleans"],
  ["converted_initial_to_recurring", "Converted (Initial → Recurring)"],
  ["recurring_added", "Recurring Added"],
  ["recurring_lost", "Recurring Lost"],
  ["total_recurring_clients", "Total Recurring Clients"],
  ["cleans_completed", "Cleans Completed"],
  ["recurring_cleans", "Recurring Cleans"],
  ["one_time_cleans", "One-Time Cleans"],
  ["skips", "Skips"],
  ["route_changes", "Route Changes"],
];
const INCIDENT_FIELDS: [keyof EntryFields, string][] = [
  ["care_opportunities", "Care Opportunities"],
  ["breakage_damage", "Breakage / Damage"],
  ["call_offs", "Call-offs"],
];
const STAFFING_FIELDS: [keyof EntryFields, string][] = [
  ["rge_headcount", "RGE Headcount (working today)"],
  ["interviews_scheduled", "Interviews Scheduled"],
  ["actual_interviews", "Actual Interviews"],
  ["new_hires", "New Hires"],
];
const MONDAY_FIELDS: [keyof EntryFields, string, boolean][] = [
  ["total_payroll_taxes", "Total Payroll + Taxes", true],
  ["workers_comp_due", "Workers Comp Due", true],
  ["highest_paid_cleaner", "Highest Paid Cleaner", true],
  ["trainees_paid", "# Trainees Paid", false],
  ["total_trainee_pay", "Total Trainee Pay", true],
  ["rges_tier1", "# RGEs at Tier 1", false],
  ["rges_tier2", "# RGEs at Tier 2", false],
  ["rges_tier3", "# RGEs at Tier 3", false],
];

export default function DailyEntryPage() {
  const { person, loading, signIn, switchUser } = useIdentity();
  const [date, setDate] = useState<Date>(getDefaultDate());
  const [entry, setEntry] = useState<EntryFields>(DEFAULT_ENTRY);
  const [entryLoading, setEntryLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    (async () => {
      setEntryLoading(true);
      const { data } = await supabase
        .from("daily_entries")
        .select("*")
        .eq("entry_date", toDateStr(date))
        .maybeSingle();
      if (cancelled) return;
      setEntry(data ? mapRowToFields(data) : DEFAULT_ENTRY);
      setLastSaved(null);
      setEntryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [date, person]);

  async function commitField(key: keyof EntryFields, value: number) {
    if (!person) return;
    const updated = { ...entry, [key]: value };
    setEntry(updated);
    const { error } = await supabase.from("daily_entries").upsert(
      {
        entry_date: toDateStr(date),
        entered_by: person.id,
        last_edited_by: person.id,
        last_edited_at: new Date().toISOString(),
        ...updated,
      },
      { onConflict: "entry_date" }
    );
    if (!error) {
      setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
  }

  if (loading) return null;
  if (!person) return <IdentityGate onVerified={signIn} />;

  const isMonday = date.getDay() === 1;

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <Logo height={52} />
          <div className="brand-divider" />
          <div className="brand-text">
            <h1>Daily Entry</h1>
          </div>
        </div>
        <div className="topbar-right">
          <div className="userbadge">
            <span className="dot" />
            <span>{person.name}</span>
            <button onClick={switchUser}>Switch</button>
          </div>
          {isMonday && <span className="monday-pill">● Payroll day</span>}
          <DateNav value={date} onChange={setDate} min={MIN} max={MAX} />
        </div>
      </div>

      <NavTabs />

      <div className="notice">
        <span>✓</span>
        <div>
          <b>Blank fields save as 0.</b> A zero confirms someone looked at this field today.
        </div>
      </div>

      {entryLoading ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
          <Section title="Revenue">
            <NumberField
              label="Daily Revenue"
              value={entry.daily_revenue}
              money
              onCommit={(v) => commitField("daily_revenue", v)}
            />
          </Section>

          <Section title="Sales & Leads" desc="Contact Rate · Lead-to-Booking · Contact-to-Booking">
            {SALES_FIELDS.map(([key, label]) => (
              <NumberField key={key} label={label} value={entry[key]} onCommit={(v) => commitField(key, v)} />
            ))}
          </Section>

          <Section title="Scheduling & Cleans" desc="Net Recurring Growth · Attrition · Initial-to-Recurring Conversion">
            {SCHEDULING_FIELDS.map(([key, label]) => (
              <NumberField key={key} label={label} value={entry[key]} onCommit={(v) => commitField(key, v)} />
            ))}
          </Section>

          <Section title="Incidents">
            {INCIDENT_FIELDS.map(([key, label]) => (
              <NumberField key={key} label={label} value={entry[key]} onCommit={(v) => commitField(key, v)} />
            ))}
          </Section>

          <Section title="Staffing & Hiring" desc="Average Revenue per RGE · Hire Conversion · Interview Show-Up">
            {STAFFING_FIELDS.map(([key, label]) => (
              <NumberField key={key} label={label} value={entry[key]} onCommit={(v) => commitField(key, v)} />
            ))}
          </Section>

          {isMonday && (
            <Section title="Payroll — Monday Only" desc="Entered once per week" monday>
              {MONDAY_FIELDS.map(([key, label, money]) => (
                <NumberField key={key} label={label} value={entry[key]} money={money} onCommit={(v) => commitField(key, v)} />
              ))}
            </Section>
          )}
        </>
      )}

      <div className="footer">
        <span className="status">
          Autosaves as you type
          {lastSaved && (
            <>
              {" "}
              · Last saved <b>{lastSaved}</b>
            </>
          )}
        </span>
      </div>

      <style jsx>{`
        .wrap {
          max-width: 900px;
          margin: 0 auto;
          padding: 28px 20px 80px;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 6px;
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
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .topbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .userbadge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 6px 8px 6px 14px;
          box-shadow: 0 1px 2px rgba(20, 30, 25, 0.06);
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
        .monday-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--monday-soft, #fdf3dc);
          color: var(--monday, #8a6512);
          border: 1px solid var(--monday-line, #f0dba0);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.03em;
          padding: 5px 10px;
          border-radius: 999px;
          text-transform: uppercase;
        }
        .notice {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          background: var(--accent-soft);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 13px;
          color: var(--ink-muted);
          margin-bottom: 24px;
        }
        .notice b {
          color: var(--ink);
        }
        .loading {
          padding: 40px;
          text-align: center;
          color: var(--ink-faint);
        }
        .footer {
          position: sticky;
          bottom: 0;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 10px;
          box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
          padding: 12px 16px;
          margin-top: 20px;
        }
        .status {
          font-size: 12.5px;
          color: var(--ink-faint);
        }
        .status b {
          color: var(--accent);
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  desc,
  monday,
  children,
}: {
  title: string;
  desc?: string;
  monday?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={"section" + (monday ? " monday" : "")}>
      <div className="section-head">
        <h2>{title}</h2>
        {desc && <span className="desc">{desc}</span>}
      </div>
      <div className="grid">{children}</div>

      <style jsx>{`
        .section {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 10px;
          box-shadow: 0 1px 2px rgba(20, 30, 25, 0.06);
          margin-bottom: 16px;
          overflow: hidden;
        }
        .section.monday {
          border-color: var(--monday-line, #f0dba0);
        }
        .section-head {
          padding: 16px 18px 14px;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
        }
        .section.monday .section-head {
          background: var(--monday-soft, #fdf3dc);
          border-bottom-color: var(--monday-line, #f0dba0);
        }
        .section-head h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
        }
        .section.monday .section-head h2 {
          color: var(--monday, #8a6512);
        }
        .desc {
          font-size: 12px;
          color: var(--ink-faint);
        }
        .grid {
          padding: 14px 18px 18px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
          gap: 14px 16px;
        }
      `}</style>
    </div>
  );
}
