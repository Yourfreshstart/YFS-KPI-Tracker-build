// Tiny CSV download helper shared by every "Download CSV" button in the
// app (Daily Entry, Weekly Ops, Monthly Summary, Pulse). Everything runs
// in the browser -- the rows are already loaded on the page, so there's no
// server route and nothing new to secure.

import type { Fmt } from "@/lib/metrics";

export type CsvCell = string | number | null | undefined;

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(escapeCell).join(",")).join("\r\n");
}

/** Triggers a browser download. The BOM makes Excel read accents/emoji correctly. */
export function downloadCsv(filename: string, rows: CsvCell[][]) {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * A metric value as a plain spreadsheet number (no $, %, or commas) so it
 * can be summed/charted. Blank when there's no real value -- same
 * "no data" vs. real 0 distinction the on-screen tables make with "—".
 */
export function csvNumber(v: number | null | undefined, fmt: Fmt): CsvCell {
  if (v === null || v === undefined || Number.isNaN(v)) return "";
  if (fmt === "usd") return Math.round(v * 100) / 100;
  if (fmt === "pct1" || fmt === "pct0") return Math.round(v * 10) / 10;
  return Math.round(v * 100) / 100;
}

/** Header label with its unit, e.g. "COGS (%)", so the bare numbers stay readable. */
export function csvLabel(label: string, fmt: Fmt): string {
  if (fmt === "usd") return `${label} ($)`;
  if (fmt === "pct1" || fmt === "pct0") return `${label} (%)`;
  return label;
}

export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
