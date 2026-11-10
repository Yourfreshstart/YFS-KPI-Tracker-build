import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/db";
import { isResponse, json, requireTeam } from "@/lib/server/session";
import { DATE_RE } from "@/lib/server/entryKeys";
import { fetchAllRows } from "@/lib/fetchAll";

export const dynamic = "force-dynamic";

// Daily entries for a date range (?from=YYYY-MM-DD&to=YYYY-MM-DD), or every
// entry ever (?all=1, used by the CSV download).
export async function GET(req: NextRequest) {
  const s = await requireTeam(req);
  if (isResponse(s)) return s;
  const p = req.nextUrl.searchParams;
  const db = adminDb();

  if (p.get("all") === "1") {
    const rows = await fetchAllRows((a, b) =>
      db.from("daily_entries").select("*").order("entry_date", { ascending: true }).range(a, b)
    );
    return json({ rows });
  }

  const start = p.get("from");
  const end = p.get("to");
  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) return json({ error: "Bad dates" }, 400);
  const rows = await fetchAllRows((a, b) =>
    db
      .from("daily_entries")
      .select("*")
      .gte("entry_date", start)
      .lte("entry_date", end)
      .order("entry_date", { ascending: true })
      .range(a, b)
  );
  return json({ rows });
}
