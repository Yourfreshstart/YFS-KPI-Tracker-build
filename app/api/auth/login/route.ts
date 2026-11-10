import { NextRequest } from "next/server";
import { checkPin, isJsonRequest, isLocked, json, logAttempt, startSession, validPin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Team sign-in: a person's name + their 4-digit PIN. Five wrong PINs for the
// same name locks that name for 15 minutes.
export async function POST(req: NextRequest) {
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const pin = body?.pin;
  if (!name || !validPin(pin)) return json({ error: "Incorrect PIN, try again" }, 400);

  const bucket = `login:${name}`;
  if (await isLocked(bucket)) return json({ error: "Too many wrong tries. Please wait 15 minutes and try again." }, 429);

  const person = await checkPin(name, pin);
  await logAttempt(bucket, !!person);
  if (!person) return json({ error: "Incorrect PIN, try again" }, 401);

  const res = json({ person });
  await startSession(person, res);
  return res;
}
