import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/db";
import { isJsonRequest, isResponse, json, requireTeam } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Order list quick picks (printer paper, snacks...): { name } adds, { name, remove: true } removes.
export async function POST(req: NextRequest) {
  const s = await requireTeam(req);
  if (isResponse(s)) return s;
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  if (!name) return json({ error: "Bad request" }, 400);
  const db = adminDb();
  const { error } = body?.remove
    ? await db.from("inventory_order_picks").delete().eq("name", name)
    : await db.from("inventory_order_picks").upsert({ name }, { onConflict: "name", ignoreDuplicates: true });
  if (error) return json({ error: "Couldn't save." }, 500);
  return json({ ok: true });
}
