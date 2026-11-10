import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/db";

// Deletes an employee's Pulse Survey answers once a year has passed since
// their last real appearance in payroll (rge_roster.last_seen_date) --
// keeps individual history around long enough to look back at after a
// wave of turnover (per Teather, 2026-08-28), without holding it forever.
// Triggered monthly by Vercel Cron (see vercel.json). Only pulse_responses
// is cleaned up here -- the roster row itself (just a name + a date) is
// left alone, it's not the sensitive part.

const RETENTION_DAYS = 365;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const db = adminDb();
  const { data: staleRows, error: rosterError } = await db.from("rge_roster").select("name").lt("last_seen_date", cutoffStr);
  if (rosterError) {
    return NextResponse.json({ ok: false, step: "roster lookup", detail: rosterError.message }, { status: 500 });
  }
  const stale = (staleRows || []) as { name: string }[];

  if (!Array.isArray(stale) || stale.length === 0) {
    return NextResponse.json({ ok: true, deleted_for: [] });
  }

  const names = stale.map((r) => r.name);
  const { data: deleted, error: delError } = await db.from("pulse_responses").delete().in("respondent_name", names).select("id");
  if (delError) {
    return NextResponse.json({ ok: false, step: "delete", detail: delError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted_for: names, deleted_rows: deleted ? deleted.length : null });
}
