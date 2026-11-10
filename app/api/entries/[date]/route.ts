import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/db";
import { isJsonRequest, isResponse, json, requireTeam } from "@/lib/server/session";
import { DATE_RE, ENTRY_KEYS } from "@/lib/server/entryKeys";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { date: string } }) {
  const s = await requireTeam(req);
  if (isResponse(s)) return s;
  if (!DATE_RE.test(params.date)) return json({ error: "Bad date" }, 400);
  const { data, error } = await adminDb().from("daily_entries").select("*").eq("entry_date", params.date).maybeSingle();
  if (error) return json({ error: "Couldn't load that day." }, 500);
  return json({ row: data });
}

// Saves a whole day. "Who entered it" always comes from the signed-in
// session, never from the request.
export async function PUT(req: NextRequest, { params }: { params: { date: string } }) {
  const s = await requireTeam(req);
  if (isResponse(s)) return s;
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  if (!DATE_RE.test(params.date)) return json({ error: "Bad date" }, 400);
  const body = await req.json().catch(() => null);
  const fields = body?.fields;
  if (!fields || typeof fields !== "object") return json({ error: "Bad request" }, 400);

  const row: Record<string, unknown> = {
    entry_date: params.date,
    entered_by: s.person.id,
    last_edited_by: s.person.id,
    last_edited_at: new Date().toISOString(),
  };
  for (const key of ENTRY_KEYS) {
    const v = (fields as Record<string, unknown>)[key];
    if (v === undefined) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) return json({ error: `Bad value for ${key}` }, 400);
    row[key] = n;
  }
  const { error } = await adminDb().from("daily_entries").upsert(row, { onConflict: "entry_date" });
  if (error) return json({ error: "Couldn't save." }, 500);
  return json({ ok: true });
}
