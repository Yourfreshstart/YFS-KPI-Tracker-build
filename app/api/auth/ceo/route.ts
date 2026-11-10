import { NextRequest } from "next/server";
import {
  CEO_NAMES,
  checkPin,
  getSession,
  grantCeo,
  isJsonRequest,
  isLocked,
  json,
  logAttempt,
  startSession,
  validPin,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

// The extra PIN step for the CEO Dashboard (Teather or Jennifer) and
// Lists/Admin (Teather only -- enforced where those are served, by who
// unlocked it). Five wrong PINs in 15 minutes locks this step for everyone.
export async function POST(req: NextRequest) {
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  try {
    const body = await req.json().catch(() => null);
    const pin = body?.pin;
    if (!validPin(pin)) return json({ error: "Incorrect PIN, try again" }, 400);

    if (await isLocked("ceo")) return json({ error: "Too many wrong tries. Please wait 15 minutes and try again." }, 429);

    let matched = null;
    for (const name of CEO_NAMES) {
      const person = await checkPin(name, pin);
      if (person) {
        matched = person;
        break;
      }
    }
    await logAttempt("ceo", !!matched);
    if (!matched) return json({ error: "Incorrect PIN, try again" }, 401);

    const existing = await getSession(req);
    const res = json({ person: matched, ceoName: matched.name });
    if (existing) {
      await grantCeo(existing.tokenHash, matched.name);
    } else {
      // Opened the CEO Dashboard without signing in first: this PIN signs them in too.
      const tokenHash = await startSession(matched, res);
      await grantCeo(tokenHash, matched.name);
    }
    return res;
  } catch (e) {
    return json({ error: "Server error", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
}
