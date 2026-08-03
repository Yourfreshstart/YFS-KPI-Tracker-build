"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/daily-entry", label: "Daily Entry" },
  { href: "/weekly-ops", label: "Weekly Ops" },
  { href: "/monthly-summary", label: "Monthly Summary" },
];

export default function NavTabs() {
  const pathname = usePathname();
  return (
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
      <style jsx>{`
        .navtabs {
          display: flex;
          gap: 4px;
          background: var(--surface-2);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 4px;
          margin-bottom: 18px;
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
      `}</style>
    </div>
  );
}
