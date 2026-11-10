import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/db";
import { isJsonRequest, json } from "@/lib/server/session";
import { fetchAllRows } from "@/lib/fetchAll";
import { isActive, latestPayrollDate, type RosterRow } from "@/lib/pulse";

export const dynamic = "force-dynamic";

// PUBLIC on purpose: techs fill this out on their phones with no PIN. It only
// ever returns first-and-last names of active people (for the dropdown) and
// accepts one tightly-checked answer per person per day. It can't read any
// answers back.

const MAX_PER_HOUR = 30;

function easternDate(): string {
  // YYYY-MM-DD in Eastern time, so a late-evening answer lands on that day.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export async function GET() {
  const db = adminDb();
  const rows = await fetchAllRows<RosterRow>((a, b) => db.from("rge_roster").select("*").order("name").range(a, b));
  const latest = latestPayrollDate(rows);
  return json({ names: rows.filter((r) => isActive(r, latest)).map((r) => r.name) });
}

const SCORES: [string, number, number][] = [
  ["happiness", 1, 5],
  ["leadership_support", 1, 5],
  ["job_manageability", 1, 5],
  ["likelihood_to_stay", 1, 5],
  ["likelihood_to_recommend", 0, 10],
];

export async function POST(req: NextRequest) {
  if (!isJsonRequest(req)) return json({ error: "Bad request" }, 400);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string") return json({ error: "Bad request" }, 400);

  const row: Record<string, unknown> = { respondent_name: body.name, survey_date: easternDate() };
  for (const [key, lo, hi] of SCORES) {
    const v = body[key];
    if (typeof v !== "number" || !Number.isInteger(v) || v < lo || v > hi) return json({ error: "Bad request" }, 400);
    row[key] = v;
  }
  const fb = body.feedback_text;
  if (fb !== null && fb !== undefined && (typeof fb !== "string" || fb.length > 3000)) return json({ error: "Bad request" }, 400);
  row.feedback_text = typeof fb === "string" && fb.trim() ? fb.trim() : null;

  const db = adminDb();

  // Simple spam brake: at most 30 answers per phone/network per hour.
  const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const bucket = `survey:${ip}`;
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count } = await db
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .gte("at", since);
  if ((count ?? 0) >= MAX_PER_HOUR) return json({ error: "Too many answers from this device. Try again later." }, 429);

  // The name must be a real person on the roster.
  const { data: person } = await db.from("rge_roster").select("name").eq("name", body.name).maybeSingle();
  if (!person) return json({ error: "Bad request" }, 400);

  await db.from("login_attempts").insert({ bucket, success: true });
  const { error } = await db.from("pulse_responses").upsert(row, { onConflict: "respondent_name,survey_date" });
  if (error) return json({ error: "Something went wrong — try again." }, 500);
  return json({ ok: true });
}
