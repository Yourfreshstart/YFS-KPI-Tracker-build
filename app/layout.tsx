import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Your Fresh Start — KPI Tracker",
  description: "Internal KPI tracking for Your Fresh Start Cleaning Service LLC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
