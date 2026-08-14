"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/daily-entry", label: "Daily Entry" },
  { href: "/weekly-ops", label: "Weekly Ops" },
  { href: "/monthly-summary", label: "Monthly Summary" },
  { href: "/payroll", label: "Payroll" },
];

export default function NavTabs() {
  const pathname = usePathname();
  return (
    <div className="navrow">
      <div className="navtabs">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={pathname === tab.href ? "active" : ""}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <Link href="/ceo-dashboard" className="ceo-link">
        🔒 CEO Dashboard
      </Link>
      <style jsx>{`
        .navrow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .navtabs {
          display: flex;
          gap: 4px;
          background: var(--surface-2);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 4px;
          width: fit-content;
        }
        .navtabs :global(a) {
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-muted);
          padding: 7px 14px;
          border-radius: 999px;
        }
        .navtabs :global(a.active) {
          background: var(--surface);
          color: var(--ink);
          box-shadow: 0 1px 2px rgba(20, 30, 25, 0.06);
        }
        .ceo-link {
          text-decoration: none;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-faint);
        }
        .ceo-link:hover {
          color: var(--ink-muted);
        }
      `}</style>
    </div>
  );
}
