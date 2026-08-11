"use client";

import { useState } from "react";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { INTAKE_SCHEMA } from "@/lib/kpiIntakeSchema";

export default function KpiIntakePage() {
  const [businessName, setBusinessName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function setField(id: string, v: string) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  async function submit() {
    setError("");
    setSubmitting(true);
    const { error: dbError } = await supabase.from("kpi_leads").insert({
      business_name: businessName.trim() || null,
      ...values,
    });
    setSubmitting(false);
    if (dbError) {
      setError("Something went wrong sending this — mind trying again?");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="wrap">
        <div className="done-card">
          <Logo height={48} />
          <h1>Thanks — that's sent.</h1>
          <p>Your answers are on their way. You'll hear back about next steps soon.</p>
        </div>
        <style jsx>{`
          .wrap {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .done-card {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 14px;
            padding: 40px 32px;
            text-align: center;
            max-width: 380px;
          }
          .done-card :global(svg) {
            margin: 0 auto 16px;
          }
          h1 {
            font-size: 20px;
            margin: 0 0 8px;
          }
          p {
            font-size: 14px;
            color: var(--ink-muted);
            line-height: 1.55;
            margin: 0;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="header">
        <Logo height={40} />
        <h1>Let's talk numbers</h1>
        <p className="lede">
          A few questions about how your cleaning business runs day to day. There's no wrong answer — rough numbers
          and gut feelings are totally fine. Takes about 10 minutes.
        </p>
      </div>

      <div className="field top-field">
        <label htmlFor="businessName">Your business name</label>
        <input
          id="businessName"
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Sparkle Squad Cleaning"
        />
      </div>

      {INTAKE_SCHEMA.map((sec) => (
        <div className="section" key={sec.title}>
          <div className="tape">{sec.title}</div>
          {sec.sub && <div className="section-sub">{sec.sub}</div>}
          <div className="fields">
            {sec.fields.map((f) => (
              <div className={"field" + (f.type === "textarea" ? " full" : "")} key={f.id}>
                <label htmlFor={f.id}>{f.label}</label>
                {f.hint && <div className="hint">{f.hint}</div>}
                {f.type === "textarea" ? (
                  <textarea id={f.id} value={values[f.id] || ""} onChange={(e) => setField(f.id, e.target.value)} />
                ) : (
                  <input
                    id={f.id}
                    type="text"
                    value={values[f.id] || ""}
                    onChange={(e) => setField(f.id, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="submit-bar">
        {error && <div className="error">{error}</div>}
        <button onClick={submit} disabled={submitting}>
          {submitting ? "Sending…" : "Submit"}
        </button>
      </div>

      <style jsx>{`
        .wrap {
          max-width: 720px;
          margin: 0 auto;
          padding: 32px 20px 80px;
        }
        .header {
          margin-bottom: 24px;
        }
        .header :global(svg) {
          margin-bottom: 14px;
        }
        h1 {
          font-size: 26px;
          font-weight: 800;
          margin: 0 0 8px;
          letter-spacing: -0.01em;
        }
        .lede {
          font-size: 14.5px;
          color: var(--ink-muted);
          line-height: 1.55;
          max-width: 56ch;
          margin: 0;
        }
        .top-field {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 16px 18px;
          margin-bottom: 18px;
        }
        .top-field label {
          display: block;
          font-size: 13.5px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .section {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          margin-bottom: 18px;
          overflow: hidden;
        }
        .tape {
          display: inline-flex;
          font-family: ui-monospace, "SF Mono", Consolas, monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--monday);
          background: var(--monday-soft);
          border: 1px solid var(--monday-line);
          padding: 7px 14px;
          border-radius: 4px;
          margin: 16px 0 0 16px;
        }
        .section-sub {
          font-size: 12.5px;
          color: var(--ink-faint);
          padding: 8px 20px 0;
          line-height: 1.5;
        }
        .fields {
          padding: 16px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .field label {
          font-size: 13.5px;
          font-weight: 700;
        }
        .field .hint {
          font-size: 12px;
          color: var(--ink-muted);
          font-style: italic;
          line-height: 1.45;
          margin-bottom: 2px;
        }
        input,
        textarea {
          font: inherit;
          font-size: 14px;
          padding: 9px 11px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: var(--surface-2);
          color: var(--ink);
        }
        textarea {
          min-height: 56px;
          resize: vertical;
        }
        input:focus,
        textarea:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .submit-bar {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
        }
        .error {
          font-size: 13px;
          color: var(--status-critical);
        }
        button {
          font-size: 15px;
          font-weight: 700;
          padding: 13px 28px;
          border-radius: 10px;
          border: none;
          background: var(--accent);
          color: var(--accent-ink);
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
