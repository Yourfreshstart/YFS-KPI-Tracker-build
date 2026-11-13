import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/db";
import { isJsonRequest, isResponse, json, requireTeam } from "@/lib/server/session";
import { DATE_RE } from "@/lib/server/entryKeys";
import { validAmount, type Unit } from "@/lib/inventory";

export const dynamic = "force-dynamic";

// Save one week's count: { date, rows: [{ supply_id, on_shelf (number|null), restocked }] }.
// A blank shelf count is saved as null -- that's what the Tuesday reminder looks for.
export async function POST(req: NextRequest) {
  const s = await requireTeam(req);
  if (isResponse(s)) return s;
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  const body = await req.json().catch(() => null);
  const date = body?.date;
  const rows = body?.rows;
  if (typeof date !== "string" || !DATE_RE.test(date) || !Array.isArray(rows) || rows.length > 500) {
    return json({ error: "Bad request" }, 400);
  }
  const db = adminDb();
  const { data: supplies, error } = await db.from("inventory_supplies").select("id,unit,name");
  if (error) return json({ error: "Couldn't save." }, 500);
  const units = new Map<number, { unit: Unit; name: string }>();
  (supplies || []).forEach((x: { id: number; unit: Unit; name: string }) => units.set(Number(x.id), { unit: x.unit, name: x.name }));

  const out: { count_date: string; supply_id: number; on_shelf: number | null; restocked: number; entered_by: string; updated_at: string }[] = [];
  const now = new Date().toISOString();
  for (const r of rows) {
    const id = Number(r?.supply_id);
    const sup = units.get(id);
    if (!sup) return json({ error: "Unknown supply." }, 400);
    const shelf = r?.on_shelf === null || r?.on_shelf === undefined || r?.on_shelf === "" ? null : Number(r.on_shelf);
    const rest = r?.restocked === null || r?.restocked === undefined || r?.restocked === "" ? 0 : Number(r.restocked);
    if (shelf !== null && !validAmount(sup.unit, shelf)) return json({ error: `${sup.name}: check the shelf count.` }, 400);
    if (!validAmount(sup.unit, rest)) return json({ error: `${sup.name}: check the restocked amount.` }, 400);
    out.push({ count_date: date, supply_id: id, on_shelf: shelf, restocked: rest, entered_by: s.person.name, updated_at: now });
  }
  if (out.length === 0) return json({ ok: true });
  const { error: upErr } = await db.from("inventory_counts").upsert(out, { onConflict: "count_date,supply_id" });
  if (upErr) return json({ error: "Couldn't save." }, 500);
  return json({ ok: true });
}
