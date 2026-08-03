import Logo from "@/components/Logo";

export default function Home() {
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
      <p style={{ margin: 0, color: "var(--ink-muted)", maxWidth: 360 }}>
        The site is live and connected. Screens (Daily Entry, CEO Dashboard,
        Weekly Ops, Monthly Summary, Lists/Admin) get built in next.
      </p>
    </main>
  );
}
