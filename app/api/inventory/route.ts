import { NextRequest } from "next/server";
import { isResponse, json, requireTeam } from "@/lib/server/session";
import { easternToday, loadInventory } from "@/lib/server/inventory";

export const dynamic = "force-dynamic";

// Everything the Inventory page shows: supplies, recent counts, technician
// headcounts (from Daily Entry) and the order quick picks. Any signed-in person.
export async function GET(req: NextRequest) {
  const s = await requireTeam(req);
  if (isResponse(s)) return s;
  const data = await loadInventory(easternToday().date);
  if (!data) return json({ error: "Inventory isn't set up yet. Run supabase/add_inventory.sql in Supabase first." }, 503);
  return json(data);
}
