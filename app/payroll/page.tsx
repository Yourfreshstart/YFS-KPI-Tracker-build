"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CeoPinGate from "@/components/CeoPinGate";
import { useCeoAuth } from "@/lib/useCeoAuth";

// The payroll tool itself is a complete, self-contained HTML document
// (own CSS/JS, including the bundled SheetJS library) -- it's rendered in
// an iframe rather than ported into React so nothing about how it works
// changes from the version that was reviewed and handed off.
export default function PayrollPage() {
  const { unlocked, loading, unlock } = useCeoAuth();
  const [html, setHtml] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!unlocked) return;
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
  }, [unlocked]);

  if (loading) return null;
  if (!unlocked) return <CeoPinGate onUnlock={unlock} />;

  return (
    <div className="wrap">
      <Link href="/ceo-dashboard" className="backlink">
        ‹ Back to CEO Dashboard
      </Link>
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
        .backlink {
          font-size: 13px;
          color: var(--ink-muted);
          text-decoration: none;
          display: inline-block;
          margin-bottom: 10px;
          flex-shrink: 0;
        }
        .backlink:hover {
          color: var(--ink);
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
