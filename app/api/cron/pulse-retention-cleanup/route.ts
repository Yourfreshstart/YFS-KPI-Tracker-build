import { NextRequest, NextResponse } from "next/server";

// Deletes an employee's Pulse Survey answers once a year has passed since
// their last real appearance in payroll (rge_roster.last_seen_date) --
// keeps individual history around long enough to look back at after a
// wave of turnover (per Teather, 2026-08-28), without holding it forever.
// Triggered monthly by Vercel Cron (see vercel.json). Only pulse_responses
// is cleaned up here -- the roster row itself (just a name + a date) is
// left alone, it's not the sensitive part.

const SUPABASE_URL = "https://zhbuxfflfyhqxzgtpwkf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_90rqTx_I_-1cTK7TksemRw_YRePULFj";
const RETENTION_DAYS = 365;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

  const rosterRes = await fetch(`${SUPABASE_URL}/rest/v1/rge_roster?last_seen_date=lt.${cutoffStr}&select=name`, { headers });
  if (!rosterRes.ok) {
    return NextResponse.json({ ok: false, step: "roster lookup", detail: await rosterRes.text() }, { status: 500 });
  }
  const stale: { name: string }[] = await rosterRes.json();

  if (!Array.isArray(stale) || stale.length === 0) {
    return NextResponse.json({ ok: true, deleted_for: [] });
  }

  const names = stale.map((r) => r.name);
  const inList = names.map((n) => encodeURIComponent(n)).join(",");

  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/pulse_responses?respondent_name=in.(${inList})`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=representation" },
  });

  if (!delRes.ok) {
    return NextResponse.json({ ok: false, step: "delete", detail: await delRes.text() }, { status: 500 });
  }

  const deleted = await delRes.json();
  return NextResponse.json({ ok: true, deleted_for: names, deleted_rows: Array.isArray(deleted) ? deleted.length : null });
}
