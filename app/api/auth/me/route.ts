import { NextRequest } from "next/server";
import { getSession, json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Who is signed in right now (and whether the CEO step is unlocked).
export async function GET(req: NextRequest) {
  const s = await getSession(req);
  return json({ person: s ? s.person : null, ceoName: s ? s.ceoName : null });
}
