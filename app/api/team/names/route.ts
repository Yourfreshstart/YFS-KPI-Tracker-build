import { adminDb } from "@/lib/server/db";
import { json } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Names for the sign-in screen's buttons (first names only, active people
// only). Public, since it's what the sign-in screen itself shows. The owner
// is listed first, then everyone else alphabetically.
export async function GET() {
  const { data, error } = await adminDb().from("team_members").select("name,role").eq("is_active", true);
  if (error) return json({ error: "Couldn't load." }, 500);
  const rows = (data || []) as { name: string; role: string }[];
  rows.sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.name.localeCompare(b.name)));
  return json({ names: rows.map((r) => r.name) });
}
