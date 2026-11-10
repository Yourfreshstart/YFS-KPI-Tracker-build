import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/db";
import { isJsonRequest, isResponse, json, requireAdmin, validPin } from "@/lib/server/session";
import { fetchAllRows } from "@/lib/fetchAll";

export const dynamic = "force-dynamic";

// People management for Lists/Admin (Teather only): add someone, set a PIN,
// retire/restore, rename, and merge a technician who changed their name.

const NAME_RE = /^[A-Za-z][A-Za-z .'-]{0,38}$/;
const cleanName = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const n = v.trim().replace(/\s+/g, " ");
  return NAME_RE.test(n) ? n : null;
};

export async function GET(req: NextRequest) {
  const s = await requireAdmin(req);
  if (isResponse(s)) return s;
  const db = adminDb();
  const { data: team, error } = await db.from("team_members").select("id,name,role,is_active").order("name");
  if (error) return json({ error: "Couldn't load." }, 500);
  const roster = await fetchAllRows<{ name: string }>((a, b) => db.from("rge_roster").select("name").order("name").range(a, b));
  return json({ team, roster: roster.map((r) => r.name) });
}

export async function POST(req: NextRequest) {
  const s = await requireAdmin(req);
  if (isResponse(s)) return s;
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  const body = await req.json().catch(() => null);
  const action = body?.action;
  const db = adminDb();

  const findMember = async (name: string) => {
    const { data } = await db.from("team_members").select("id,name,role,is_active").eq("name", name).maybeSingle();
    return data as { id: string; name: string; role: string; is_active: boolean } | null;
  };

  if (action === "add") {
    const name = cleanName(body.name);
    if (!name || !validPin(body.pin)) return json({ error: "Enter a name and a 4-digit PIN." }, 400);
    if (await findMember(name)) return json({ error: "Someone with that name already exists." }, 409);
    const { error } = await db.rpc("add_team_member", { input_name: name, input_pin: body.pin, input_role: "staff" });
    if (error) return json({ error: "Couldn't add them." }, 500);
    return json({ ok: true });
  }

  if (action === "setpin") {
    const name = cleanName(body.name);
    if (!name || !validPin(body.pin)) return json({ error: "Bad request" }, 400);
    const m = await findMember(name);
    if (!m || !m.is_active) return json({ error: "Person not found." }, 404);
    const { error } = await db.rpc("set_pin", { input_name: name, new_pin: body.pin });
    if (error) return json({ error: "Couldn't save." }, 500);
    // A changed PIN signs that person out everywhere.
    await db.from("app_sessions").delete().eq("person_name", name);
    return json({ ok: true });
  }

  if (action === "deactivate" || action === "reactivate") {
    const name = cleanName(body.name);
    if (!name) return json({ error: "Bad request" }, 400);
    const m = await findMember(name);
    if (!m) return json({ error: "Person not found." }, 404);
    if (m.role === "owner") return json({ error: "The owner can't be deactivated." }, 400);
    const { error } = await db.from("team_members").update({ is_active: action === "reactivate" }).eq("name", name);
    if (error) return json({ error: "Couldn't save." }, 500);
    if (action === "deactivate") await db.from("app_sessions").delete().eq("person_name", name);
    return json({ ok: true });
  }

  if (action === "rename") {
    const name = cleanName(body.name);
    const newName = cleanName(body.newName);
    if (!name || !newName) return json({ error: "Bad request" }, 400);
    if (!(await findMember(name))) return json({ error: "Person not found." }, 404);
    if (await findMember(newName)) return json({ error: "Someone with that name already exists." }, 409);
    const { error } = await db.from("team_members").update({ name: newName }).eq("name", name);
    if (error) return json({ error: "Couldn't save." }, 500);
    await db.from("app_sessions").update({ person_name: newName }).eq("person_name", name);
    return json({ ok: true });
  }

  // Technician changed their name (e.g. married): fold the old roster record
  // and Pulse answers into the new name, keeping the earliest start date.
  if (action === "merge-tech") {
    const from = typeof body.from === "string" ? body.from : "";
    const to = typeof body.to === "string" ? body.to : "";
    if (!from || !to || from === to) return json({ error: "Pick two different people." }, 400);
    const { data: rows } = await db.from("rge_roster").select("*").in("name", [from, to]);
    const oldRow = (rows || []).find((r: { name: string }) => r.name === from);
    const newRow = (rows || []).find((r: { name: string }) => r.name === to);
    if (!oldRow || !newRow) return json({ error: "Both people must be on the roster." }, 400);

    // Pulse answers: move over, but if both names answered on the same day keep the new name's.
    const { data: newDates } = await db.from("pulse_responses").select("survey_date").eq("respondent_name", to);
    const taken = (newDates || []).map((r: { survey_date: string }) => r.survey_date);
    if (taken.length) await db.from("pulse_responses").delete().eq("respondent_name", from).in("survey_date", taken);
    const { error: e1 } = await db.from("pulse_responses").update({ respondent_name: to }).eq("respondent_name", from);
    if (e1) return json({ error: "Couldn't move the Pulse answers." }, 500);

    const earliest = [oldRow.first_seen_date, newRow.first_seen_date].filter(Boolean).sort()[0] ?? null;
    const latest = [oldRow.last_seen_date, newRow.last_seen_date].filter(Boolean).sort().slice(-1)[0] ?? null;
    const patch: Record<string, unknown> = { first_seen_date: earliest, last_seen_date: latest };
    // Keep any trainee/milestone settings the old record had if the new one has none.
    for (const f of ["payroll_status", "payroll_trainer", "milestone14_status", "milestone90_status", "pulse_status_override"]) {
      if (newRow[f] == null && oldRow[f] != null) patch[f] = oldRow[f];
    }
    const { error: e2 } = await db.from("rge_roster").update(patch).eq("name", to);
    if (e2) return json({ error: "Couldn't update the roster." }, 500);
    await db.from("rge_roster").delete().eq("name", from);
    return json({ ok: true });
  }

  return json({ error: "Bad request" }, 400);
}
