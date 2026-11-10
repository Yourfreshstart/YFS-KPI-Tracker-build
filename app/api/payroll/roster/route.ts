import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/db";
import { isJsonRequest, isResponse, json, requireTeam } from "@/lib/server/session";
import { DATE_RE } from "@/lib/server/entryKeys";

export const dynamic = "force-dynamic";

// Everything the Payroll tool (which runs in the browser) needs from the
// roster table, behind the team sign-in. One POST endpoint, three actions:
//   sync -- record who worked this week (last seen; first seen for new people)
//   get  -- trainee settings + milestone info for the given names
//   set  -- save a trainee/trainer choice or confirm/deny a milestone bonus
function cleanNames(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length > 300) return null;
  const out: string[] = [];
  for (const n of v) {
    if (typeof n !== "string" || !n.trim() || n.length > 120) return null;
    out.push(n);
  }
  return out;
}

export async function POST(req: NextRequest) {
  const s = await requireTeam(req);
  if (isResponse(s)) return s;
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  const body = await req.json().catch(() => null);
  const action = body?.action;
  const db = adminDb();

  if (action === "sync") {
    const names = cleanNames(body.names);
    const lastSeen = body.lastSeen;
    if (!names || !names.length || typeof lastSeen !== "string" || !DATE_RE.test(lastSeen)) return json({ error: "Bad request" }, 400);
    const { data: existingRows, error: e1 } = await db.from("rge_roster").select("name").in("name", names);
    if (e1) return json({ error: "Couldn't sync." }, 500);
    const existing = new Set((existingRows || []).map((r: { name: string }) => r.name));
    const brandNew = names.filter((n) => !existing.has(n));
    const known = names.filter((n) => existing.has(n));
    // first_seen_date is only ever set for a brand-new name, so it can never be overwritten.
    if (brandNew.length) {
      const { error } = await db
        .from("rge_roster")
        .upsert(brandNew.map((name) => ({ name, last_seen_date: lastSeen, first_seen_date: lastSeen })), { onConflict: "name" });
      if (error) return json({ error: "Couldn't sync." }, 500);
    }
    if (known.length) {
      const { error } = await db.from("rge_roster").update({ last_seen_date: lastSeen }).in("name", known);
      if (error) return json({ error: "Couldn't sync." }, 500);
    }
    return json({ ok: true });
  }

  if (action === "get") {
    const names = cleanNames(body.names);
    if (!names) return json({ error: "Bad request" }, 400);
    if (!names.length) return json({ rows: [] });
    const { data, error } = await db
      .from("rge_roster")
      .select("name,first_seen_date,milestone14_status,milestone90_status,payroll_status,payroll_trainer")
      .in("name", names);
    if (error) return json({ error: "Couldn't load." }, 500);
    return json({ rows: data });
  }

  if (action === "set") {
    const name = body.name;
    if (typeof name !== "string" || !name || name.length > 120) return json({ error: "Bad request" }, 400);
    const patch: Record<string, unknown> = {};
    if ("payroll_status" in body) {
      if (![null, "active", "trainee"].includes(body.payroll_status)) return json({ error: "Bad request" }, 400);
      patch.payroll_status = body.payroll_status;
    }
    if ("payroll_trainer" in body) {
      const t = body.payroll_trainer;
      if (t !== null && (typeof t !== "string" || t.length > 120)) return json({ error: "Bad request" }, 400);
      patch.payroll_trainer = t;
    }
    for (const f of ["milestone14_status", "milestone90_status"]) {
      if (f in body) {
        if (![null, "confirmed", "denied"].includes(body[f])) return json({ error: "Bad request" }, 400);
        patch[f] = body[f];
      }
    }
    if (!Object.keys(patch).length) return json({ error: "Nothing to save" }, 400);
    const { error } = await db.from("rge_roster").update(patch).eq("name", name);
    if (error) return json({ error: "Couldn't save." }, 500);
    return json({ ok: true });
  }

  return json({ error: "Bad request" }, 400);
}
