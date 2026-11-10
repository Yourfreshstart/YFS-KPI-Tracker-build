import { NextRequest } from "next/server";
import { endSession, getSession, isJsonRequest, json } from "@/lib/server/session";
import { adminDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// { ceoOnly: true } just re-locks the CEO step; otherwise signs out fully.
export async function POST(req: NextRequest) {
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  const body = await req.json().catch(() => null);
  const s = await getSession(req);
  if (body?.ceoOnly) {
    if (s) await adminDb().from("app_sessions").update({ ceo_name: null, ceo_until: null }).eq("token_hash", s.tokenHash);
    return json({ ok: true });
  }
  const res = json({ ok: true });
  await endSession(req, res);
  return res;
}
