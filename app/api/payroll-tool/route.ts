import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// Serves payroll-tool/payroll.html through the app's own server instead of
// public/, so there's no static URL that bypasses the PIN gate in
// app/payroll/page.tsx. The page only calls this once it's unlocked.
export async function GET() {
  const filePath = path.join(process.cwd(), "payroll-tool", "payroll.html");
  const html = await readFile(filePath, "utf8");
  return new NextResponse(html, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
