import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: kpis, error } = await supabase
    .from("kpi_config")
    .select("kpi_key")
    .order("sort_order");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 24,
        textAlign: "center",
      }}
    >
      <Logo height={90} />
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
        KPI Tracker
      </h1>

      {error && (
        <p style={{ margin: 0, color: "#d03b3b", maxWidth: 420 }}>
          Database not connected yet: {error.message}
        </p>
      )}

      {!error && (
        <p style={{ margin: 0, color: "var(--ink-muted)", maxWidth: 420 }}>
          Database connected — {kpis?.length ?? 0} of 13 KPIs loaded from
          Supabase. Screens (Daily Entry, CEO Dashboard, Weekly Ops, Monthly
          Summary, Lists/Admin) get built in next.
        </p>
      )}
    </main>
  );
}
