import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/db";
import { APP_URL, easternToday, sendEmail } from "@/lib/server/inventory";
import { addDays, fmtDate } from "@/lib/inventory";

export const dynamic = "force-dynamic";

// Tuesday reminder: if Monday's inventory count is missing, or any active
// supply's shelf count was left blank, email the main inbox. A 0 counts as
// entered. Vercel Cron runs this Tuesdays at 14:00 UTC = 9am Eastern in
// winter (10am in summer); Vercel's free plan can start it up to an hour late.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { date: today, weekday } = easternToday();
  if (weekday !== "Tue") return NextResponse.json({ skipped: "not Tuesday" });
  const monday = addDays(today, -1);

  const db = adminDb();
  const [sup, cnt] = await Promise.all([
    db.from("inventory_supplies").select("id,name").eq("status", "active").order("sort_order"),
    db.from("inventory_counts").select("supply_id,on_shelf").eq("count_date", monday),
  ]);
  if (sup.error || cnt.error) {
    // Never send a "missing" email just because the lookup failed.
    return NextResponse.json({ ok: false, status: "lookup failed" }, { status: 500 });
  }
  const filled = new Set(
    ((cnt.data || []) as { supply_id: number; on_shelf: number | null }[]).filter((c) => c.on_shelf !== null).map((c) => Number(c.supply_id))
  );
  const missing = ((sup.data || []) as { id: number; name: string }[]).filter((x) => !filled.has(Number(x.id))).map((x) => x.name);
  if (missing.length === 0) return NextResponse.json({ ok: true, date: monday, status: "complete" });

  const label = fmtDate(monday, { weekday: "long", month: "short", day: "numeric" });
  const none = filled.size === 0;
  const text = none
    ? `Monday's inventory count (${label}) hasn't been entered yet.\n\nEnter it here: ${APP_URL}/inventory`
    : `Monday's inventory count (${label}) is missing a shelf count for:\n${missing.map((n) => `- ${n}`).join("\n")}\n\nIf there are none on the shelf, enter 0.\nEnter it here: ${APP_URL}/inventory`;
  const sent = await sendEmail(`Inventory count missing for ${label}`, text);
  if (!sent.ok) return NextResponse.json({ ok: false, status: "email failed", detail: sent.detail }, { status: 500 });
  return NextResponse.json({ ok: true, date: monday, status: "reminder sent", missing });
}
