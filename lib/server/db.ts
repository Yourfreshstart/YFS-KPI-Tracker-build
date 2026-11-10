import { createClient } from "@supabase/supabase-js";

// Server-only: uses the SECRET key, which bypasses row-level security. Never
// import this from a "use client" file or anything a browser can load.
export function adminDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new Error("Server database key is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
