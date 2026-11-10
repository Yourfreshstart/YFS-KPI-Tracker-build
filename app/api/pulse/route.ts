import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/db";
import { isJsonRequest, isResponse, json, requireTeam } from "@/lib/server/session";
import { fetchAllRows } from "@/lib/fetchAll";

export const dynamic = "force-dynamic";

// Pulse answers + roster for the Pulse page and the CEO Dashboard tile.
// Team sign-in required: these answers have names attached.
export async function GET(req: NextRequest) {
  const s = await requireTeam(req);
  if (isResponse(s)) return s;
  const db = adminDb();
  const [responses, roster] = await Promise.all([
    fetchAllRows((a, b) =>
      db.from("pulse_responses").select("*").order("survey_date", { ascending: false }).order("id").range(a, b)
    ),
    fetchAllRows((a, b) => db.from("rge_roster").select("*").order("name").range(a, b)),
  ]);
  return json({ responses, roster });
}

// Active/Inactive override for one person: "active", "inactive", or null (automatic).
export async function PATCH(req: NextRequest) {
  const s = await requireTeam(req);
  if (isResponse(s)) return s;
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  const body = await req.json().catch(() => null);
  const name = body?.name;
  const override = body?.override;
  if (typeof name !== "string" || !name || ![null, "active", "inactive"].includes(override)) {
    return json({ error: "Bad request" }, 400);
  }
  const { error } = await adminDb().from("rge_roster").update({ pulse_status_override: override }).eq("name", name);
  if (error) return json({ error: "Couldn't save." }, 500);
  return json({ ok: true });
}
