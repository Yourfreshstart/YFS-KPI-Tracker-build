import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/db";
import { isJsonRequest, isResponse, json, requireTeam } from "@/lib/server/session";
import { easternToday, loadInventory } from "@/lib/server/inventory";
import { analyze, buildTechs, mondayOf, UNITS, validAmount, type Unit } from "@/lib/inventory";

export const dynamic = "force-dynamic";

// Add a supply: { name, unit, on_shelf? }. It starts in its 4-week quiet start.
export async function POST(req: NextRequest) {
  const s = await requireTeam(req);
  if (isResponse(s)) return s;
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const unit = body?.unit as Unit;
  if (!name || name.length > 60 || !UNITS.includes(unit)) return json({ error: "Give the supply a name and how it's measured." }, 400);
  const shelfRaw = body?.on_shelf;
  const shelf = shelfRaw === null || shelfRaw === undefined || shelfRaw === "" ? null : Number(shelfRaw);
  if (shelf !== null && !validAmount(unit, shelf)) return json({ error: "Check the shelf count." }, 400);

  const db = adminDb();
  const { data: existing } = await db.from("inventory_supplies").select("id,name,status,sort_order");
  const list = (existing || []) as { id: number; name: string; status: string; sort_order: number }[];
  const clash = list.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (clash) {
    return json(
      { error: clash.status === "retired" ? `${clash.name} is in Retired supplies. Use Bring back there.` : `${clash.name} is already on the list.` },
      400
    );
  }
  const today = easternToday().date;
  const monday = mondayOf(today);
  const sortOrder = list.reduce((m, x) => Math.max(m, Number(x.sort_order) || 0), 0) + 1;
  const { data: created, error } = await db
    .from("inventory_supplies")
    .insert({ name, unit, sort_order: sortOrder, status: "active", learn_from: monday })
    .select("id")
    .single();
  if (error || !created) return json({ error: "Couldn't add that supply." }, 500);
  if (shelf !== null) {
    await db
      .from("inventory_counts")
      .upsert(
        { count_date: monday, supply_id: created.id, on_shelf: shelf, restocked: 0, entered_by: s.person.name, updated_at: new Date().toISOString() },
        { onConflict: "count_date,supply_id" }
      );
  }
  return json({ ok: true });
}

// { id, action: "retire" | "bring_back" | "relearn" }
export async function PATCH(req: NextRequest) {
  const s = await requireTeam(req);
  if (isResponse(s)) return s;
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  const action = body?.action;
  if (!Number.isInteger(id) || !["retire", "bring_back", "relearn"].includes(action)) return json({ error: "Bad request" }, 400);

  const db = adminDb();
  const today = easternToday().date;
  const monday = mondayOf(today);

  if (action === "retire") {
    // Keep only the average use per technician per week; the weekly counts are removed.
    const data = await loadInventory(today);
    const supply = data?.supplies.find((x) => x.id === id);
    if (!data || !supply) return json({ error: "Couldn't find that supply." }, 404);
    const a = analyze(supply, data.counts, buildTechs(data.heads, today), today);
    const { error } = await db
      .from("inventory_supplies")
      .update({ status: "retired", retired_at: today, retired_per_tech_week: a.perTechWeek ?? 0 })
      .eq("id", id);
    if (error) return json({ error: "Couldn't retire that supply." }, 500);
    await db.from("inventory_counts").delete().eq("supply_id", id);
    return json({ ok: true });
  }

  const update = action === "bring_back" ? { status: "active", retired_at: null, learn_from: monday } : { learn_from: monday };
  const { error } = await db.from("inventory_supplies").update(update).eq("id", id);
  if (error) return json({ error: "Couldn't save." }, 500);
  return json({ ok: true });
}
