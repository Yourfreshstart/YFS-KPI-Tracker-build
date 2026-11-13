import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { adminDb } from "@/lib/server/db";
import { json } from "@/lib/server/session";
import { fetchAllRows } from "@/lib/fetchAll";

export const dynamic = "force-dynamic";

// Full copy of the app's data for the weekly Google Drive backup
// (scripts/google-drive-backup.gs). Protected by a long random token kept in
// Vercel (BACKUP_TOKEN) and in the Google script -- nothing else can read it.
//
// PIN hashes are deliberately left out so a backup file never contains
// anything that could be used to guess PINs. After a restore, PINs are simply
// set again in Lists/Admin.

const TABLES: { name: string; order: string }[] = [
  { name: "daily_entries", order: "entry_date" },
  { name: "kpi_config", order: "kpi_key" },
  { name: "team_members", order: "name" },
  { name: "rge_roster", order: "name" },
  { name: "pulse_responses", order: "id" },
  { name: "inventory_supplies", order: "id" },
  { name: "inventory_counts", order: "id" },
  { name: "inventory_order_picks", order: "name" },
  { name: "inventory_orders", order: "id" },
];

function tokenOk(header: string | null): boolean {
  const want = process.env.BACKUP_TOKEN;
  if (!want || want.length < 32) return false;
  const given = (header || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!process.env.BACKUP_TOKEN) return json({ error: "Backups are not set up yet." }, 503);
  if (!tokenOk(req.headers.get("authorization"))) return json({ error: "unauthorized" }, 401);

  const db = adminDb();
  const tables: Record<string, Record<string, unknown>[]> = {};
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    const rows = await fetchAllRows<Record<string, unknown>>((a, b) =>
      db.from(t.name).select("*").order(t.order, { ascending: true }).range(a, b)
    );
    if (t.name === "team_members") rows.forEach((r) => delete r.pin_hash);
    tables[t.name] = rows;
    counts[t.name] = rows.length;
  }
  return json({ app: "yfs-kpi-tracker", exportedAt: new Date().toISOString(), counts, tables });
}
