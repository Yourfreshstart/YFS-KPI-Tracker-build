"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import IdentityGate from "@/components/IdentityGate";
import { useIdentity } from "@/lib/useIdentity";

// The payroll tool itself is a complete, self-contained HTML document
// (own CSS/JS, including the bundled SheetJS library) -- it's rendered in
// an iframe rather than ported into React so nothing about how it works
// changes from the version that was reviewed and handed off.
export default function PayrollPage() {
  const { person, loading, signIn, switchUser } = useIdentity();
  const [html, setHtml] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    fetch("/api/payroll-tool")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setHtml(text);
      })
      .catch(() => {
        if (!cancelled) setFetchError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [person]);

  if (loading) return null;
  if (!person) return <IdentityGate onVerified={signIn} />;

  return (
    <div className="wrap">
      <div className="topbar">
        <Link href="/daily-entry" className="backlink">
          ‹ Back
        </Link>
        <div className="userbadge">
          <span className="dot" />
          <span>{person.name}</span>
          <button onClick={switchUser}>Switch</button>
        </div>
      </div>
      {!html && !fetchError && <div className="loading">Loading…</div>}
      {fetchError && <div className="loading">Couldn&apos;t load the payroll tool — try refreshing.</div>}
      {html && <iframe title="Payroll" srcDoc={html} className="frame" />}

      <style jsx>{`
        .wrap {
          max-width: 1120px;
          margin: 0 auto;
          padding: 16px 20px 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
          flex-shrink: 0;
        }
        .backlink {
          font-size: 13px;
          color: var(--ink-muted);
          text-decoration: none;
        }
        .backlink:hover {
          color: var(--ink);
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
        .loading {
          padding: 60px;
          text-align: center;
          color: var(--ink-faint);
        }
        .frame {
          flex: 1;
          width: 100%;
          border: none;
          border-radius: 12px;
          background: var(--surface);
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  );
}
