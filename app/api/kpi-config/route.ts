import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/db";
import { isJsonRequest, isResponse, json, requireAdmin, requireCeo } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const TEXT_FIELDS = ["target_label", "good_label", "watch_label", "critical_label", "owner", "off_track_action"];
const NUMBER_FIELDS = ["critical_below", "warning_below", "warning_above", "critical_above"];

// KPI targets/thresholds: readable by whoever has unlocked the CEO step
// (CEO Dashboard, Lists/Admin), editable only by Teather via Lists/Admin.
export async function GET(req: NextRequest) {
  const s = await requireCeo(req);
  if (isResponse(s)) return s;
  const { data, error } = await adminDb().from("kpi_config").select("*").order("sort_order");
  if (error) return json({ error: "Couldn't load." }, 500);
  return json({ rows: data });
}

export async function PATCH(req: NextRequest) {
  const s = await requireAdmin(req);
  if (isResponse(s)) return s;
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  const body = await req.json().catch(() => null);
  const key = body?.kpi_key;
  const field = body?.field;
  const value = body?.value;
  if (typeof key !== "string" || typeof field !== "string") return json({ error: "Bad request" }, 400);

  let patch: Record<string, unknown>;
  if (TEXT_FIELDS.includes(field)) {
    if (typeof value !== "string" || value.length > 4000) return json({ error: "Bad value" }, 400);
    patch = { [field]: value };
  } else if (NUMBER_FIELDS.includes(field)) {
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) return json({ error: "Bad value" }, 400);
    patch = { [field]: value };
  } else {
    return json({ error: "Bad field" }, 400);
  }
  const { error } = await adminDb().from("kpi_config").update(patch).eq("kpi_key", key);
  if (error) return json({ error: "Couldn't save." }, 500);
  return json({ ok: true });
}
