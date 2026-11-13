import { adminDb } from "@/lib/server/db";
import { fetchAllRows } from "@/lib/fetchAll";
import { addDays, type CountRow, type HeadRow, type Supply } from "@/lib/inventory";

// Server-only: reads everything the Inventory page and its routes need.
// Counts go back far enough to cover the 26-week baseline plus the 13-week
// slow check, with room to spare.
export const HISTORY_DAYS = 7 * 60;

export type InventoryData = {
  supplies: Supply[];
  counts: CountRow[];
  heads: HeadRow[];
  picks: string[];
};

export async function loadInventory(today: string): Promise<InventoryData | null> {
  const db = adminDb();
  const since = addDays(today, -HISTORY_DAYS);
  const sup = await db.from("inventory_supplies").select("*").order("sort_order").order("id");
  if (sup.error) return null; // tables not created yet (migration not run)
  const [counts, heads, picks] = await Promise.all([
    fetchAllRows<CountRow>((a, b) =>
      db
        .from("inventory_counts")
        .select("count_date,supply_id,on_shelf,restocked")
        .gte("count_date", since)
        .order("count_date")
        .order("id")
        .range(a, b)
    ),
    fetchAllRows<HeadRow>((a, b) =>
      db.from("daily_entries").select("entry_date,rge_headcount").gte("entry_date", since).order("entry_date").range(a, b)
    ),
    db.from("inventory_order_picks").select("name").order("created_at").order("name"),
  ]);
  return {
    supplies: (sup.data || []).map((s) => ({
      ...s,
      retired_per_tech_week: s.retired_per_tech_week === null ? null : Number(s.retired_per_tech_week),
    })) as Supply[],
    counts: counts.map((c) => ({
      count_date: c.count_date,
      supply_id: Number(c.supply_id),
      on_shelf: c.on_shelf === null ? null : Number(c.on_shelf),
      restocked: Number(c.restocked || 0),
    })),
    heads: heads.map((h) => ({ entry_date: h.entry_date, rge_headcount: h.rge_headcount === null ? null : Number(h.rge_headcount) })),
    picks: ((picks.data || []) as { name: string }[]).map((p) => p.name),
  };
}

// Today's date in Eastern time, as YYYY-MM-DD (the server runs in UTC).
export function easternToday(): { date: string; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday: get("weekday") };
}

export const NOTIFY_EMAIL = "cleanteam@yourfreshstartclean.com";
export const APP_URL = "https://yfs-kpi-tracker-build.vercel.app";

export async function sendEmail(subject: string, text: string): Promise<{ ok: boolean; detail?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, detail: "RESEND_API_KEY not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Your Fresh Start Inventory <onboarding@resend.dev>",
      to: [NOTIFY_EMAIL],
      subject,
      text,
    }),
  });
  if (!res.ok) return { ok: false, detail: await res.text() };
  return { ok: true };
}
