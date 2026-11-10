import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/db";

export const SESSION_COOKIE = "yfs_sid";
const SESSION_HOURS = 8;
const CEO_HOURS = 4;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export type Person = { id: string; name: string; role: string };
export type Session = { person: Person; ceoName: string | null; tokenHash: string };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export const unauthorized = () => json({ error: "Please sign in." }, 401);
export const forbidden = () => json({ error: "You don't have access to that." }, 403);

// Browsers can't send a cross-site request with a JSON content type without a
// permission check first, so requiring it on writes blocks forged form posts.
export function isJsonRequest(req: NextRequest): boolean {
  return (req.headers.get("content-type") || "").toLowerCase().startsWith("application/json");
}

export async function getSession(req: NextRequest): Promise<Session | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);
  const db = adminDb();
  const { data } = await db.from("app_sessions").select("*").eq("token_hash", tokenHash).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await db.from("app_sessions").delete().eq("token_hash", tokenHash);
    return null;
  }
  const ceoOk = data.ceo_name && data.ceo_until && new Date(data.ceo_until).getTime() > Date.now();
  return {
    person: { id: data.person_id, name: data.person_name, role: data.role },
    ceoName: ceoOk ? (data.ceo_name as string) : null,
    tokenHash,
  };
}

// Who may see what. Everyone signed in is "team"; the CEO Dashboard also
// needs the CEO PIN step (Teather or Jennifer); Lists/Admin is Teather only.
export const CEO_NAMES = ["Teather", "Jennifer"];
export const ADMIN_NAMES = ["Teather"];

export async function requireTeam(req: NextRequest): Promise<Session | NextResponse> {
  const s = await getSession(req);
  return s ?? unauthorized();
}
export async function requireCeo(req: NextRequest): Promise<Session | NextResponse> {
  const s = await getSession(req);
  if (!s) return unauthorized();
  return s.ceoName && CEO_NAMES.includes(s.ceoName) ? s : forbidden();
}
export async function requireAdmin(req: NextRequest): Promise<Session | NextResponse> {
  const s = await getSession(req);
  if (!s) return unauthorized();
  return s.ceoName && ADMIN_NAMES.includes(s.ceoName) ? s : forbidden();
}
export const isResponse = (x: Session | NextResponse): x is NextResponse => x instanceof NextResponse;

export async function startSession(person: Person, res: NextResponse): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  const db = adminDb();
  await db.from("app_sessions").delete().lt("expires_at", new Date().toISOString());
  const { error: insertError } = await db.from("app_sessions").insert({
    token_hash: hashToken(token),
    person_id: person.id,
    person_name: person.name,
    role: person.role,
    expires_at: expires.toISOString(),
  });
  if (insertError) throw new Error("startSession: " + insertError.message);
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  return hashToken(token);
}

export async function endSession(req: NextRequest, res: NextResponse): Promise<void> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await adminDb().from("app_sessions").delete().eq("token_hash", hashToken(token));
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
}

export async function grantCeo(tokenHash: string, name: string): Promise<void> {
  const until = new Date(Date.now() + CEO_HOURS * 3600 * 1000).toISOString();
  const { error } = await adminDb().from("app_sessions").update({ ceo_name: name, ceo_until: until }).eq("token_hash", tokenHash);
  if (error) throw new Error("grantCeo: " + error.message);
}

// Wrong-PIN limiter: 5 wrong guesses in 15 minutes locks that bucket (a
// person's name, or "ceo") for the rest of the window.
export async function isLocked(bucket: string): Promise<boolean> {
  const since = new Date(Date.now() - LOCK_MINUTES * 60 * 1000).toISOString();
  const { count } = await adminDb()
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("success", false)
    .gte("at", since);
  return (count ?? 0) >= MAX_FAILS;
}
export async function logAttempt(bucket: string, success: boolean): Promise<void> {
  await adminDb().from("login_attempts").insert({ bucket, success });
  if (success) {
    // a good sign-in clears that bucket's earlier misses
    await adminDb().from("login_attempts").delete().eq("bucket", bucket).eq("success", false);
  }
}

export async function checkPin(name: string, pin: string): Promise<Person | null> {
  const { data, error } = await adminDb().rpc("verify_pin", { input_name: name, input_pin: pin });
  if (error || !data || data.length === 0) return null;
  return data[0] as Person;
}
export const validPin = (pin: unknown): pin is string => typeof pin === "string" && /^\d{4}$/.test(pin);
