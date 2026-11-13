import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/db";
import { isJsonRequest, isResponse, json, requireTeam } from "@/lib/server/session";
import { APP_URL, easternToday, sendEmail } from "@/lib/server/inventory";
import { fmtDate } from "@/lib/inventory";

export const dynamic = "force-dynamic";

type Line = { name: string; qty: number; unit: string };

function cleanLines(raw: unknown): Line[] | null {
  if (!Array.isArray(raw) || raw.length > 200) return null;
  const out: Line[] = [];
  for (const r of raw) {
    const name = typeof r?.name === "string" ? r.name.trim().slice(0, 80) : "";
    const qty = Number(r?.qty);
    const unit = typeof r?.unit === "string" ? r.unit.trim().slice(0, 20) : "";
    if (!name || !Number.isFinite(qty) || qty < 0 || qty > 100000) return null;
    if (qty > 0) out.push({ name, qty, unit });
  }
  return out;
}

// Email the order list to the main inbox: { supplies: [{name, qty, unit}], other: [{name, qty}] }.
export async function POST(req: NextRequest) {
  const s = await requireTeam(req);
  if (isResponse(s)) return s;
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  const body = await req.json().catch(() => null);
  const supplies = cleanLines(body?.supplies);
  const other = cleanLines(body?.other);
  if (!supplies || !other) return json({ error: "Check the order amounts." }, 400);
  if (supplies.length + other.length === 0) return json({ error: "The order is empty." }, 400);

  const today = easternToday().date;
  const month = fmtDate(today, { month: "long", year: "numeric" });
  const list = (lines: Line[]) => (lines.length ? lines.map((l) => `- ${l.name}: ${l.qty}${l.unit ? " " + l.unit : ""}`).join("\n") : "- None");
  const text =
    `Supply order from ${s.person.name}, ${fmtDate(today, { weekday: "long", month: "long", day: "numeric" })}\n\n` +
    `SUPPLIES\n${list(supplies)}\n\nOTHER ITEMS\n${list(other)}\n\n` +
    `Inventory page: ${APP_URL}/inventory`;
  const sent = await sendEmail(`Supply order · ${month} (from ${s.person.name})`, text);
  if (!sent.ok) return json({ error: "The email didn't send. Please try again in a minute.", detail: sent.detail }, 502);
  await adminDb().from("inventory_orders").insert({ sent_by: s.person.name, items: { supplies, other } });
  return json({ ok: true });
}
