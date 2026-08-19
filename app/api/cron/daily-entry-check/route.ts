import { NextRequest, NextResponse } from "next/server";

// Checks whether the previous business day's Daily Entry was actually filled
// in, and emails a reminder if not. Triggered by Vercel Cron (see
// vercel.json) once a day, Mon-Fri, at a time that's safely after 5pm
// Eastern in both DST states (5:30pm EST / 6:30pm EDT).

const SUPABASE_URL = "https://zhbuxfflfyhqxzgtpwkf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_90rqTx_I_-1cTK7TksemRw_YRePULFj";
const NOTIFY_EMAIL = "cleanteam@yourfreshstartclean.com";
const APP_URL = "https://yfs-kpi-tracker-build.vercel.app";

function easternDateParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday: get("weekday") };
}

function prevBusinessDayStr(today: { year: number; month: number; day: number; weekday: string }) {
  const backDays = today.weekday === "Mon" ? 3 : 1; // Monday's previous business day is Friday
  const d = new Date(Date.UTC(today.year, today.month - 1, today.day));
  d.setUTCDate(d.getUTCDate() - backDays);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: NextRequest) {
  // Vercel automatically sends this header on cron-triggered requests when
  // CRON_SECRET is set as a project env var -- keeps randoms from hitting
  // this URL and spamming the reminder.
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = easternDateParts(new Date());
  if (today.weekday === "Sat" || today.weekday === "Sun") {
    return NextResponse.json({ skipped: "weekend" });
  }

  const dateStr = prevBusinessDayStr(today);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_entries?entry_date=eq.${dateStr}&select=entry_date,entered_by`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  const rows = await res.json();
  const entered = Array.isArray(rows) && rows.length > 0 && !!rows[0].entered_by;

  if (entered) {
    return NextResponse.json({ ok: true, date: dateStr, status: "entered" });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, date: dateStr, status: "missing", note: "RESEND_API_KEY not set -- no email sent" });
  }

  const label = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Your Fresh Start KPI Tracker <onboarding@resend.dev>",
      to: [NOTIFY_EMAIL],
      subject: `Daily Entry missing for ${label}`,
      text: `Nobody has entered the KPI numbers for ${label} yet.\n\nEnter them here: ${APP_URL}/daily-entry`,
    }),
  });

  if (!emailRes.ok) {
    const detail = await emailRes.text();
    return NextResponse.json({ ok: false, date: dateStr, status: "email failed", detail }, { status: 500 });
  }

  return NextResponse.json({ ok: true, date: dateStr, status: "reminder sent" });
}
