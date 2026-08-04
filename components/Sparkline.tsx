"use client";

export default function Sparkline({ values, width = 90, height = 34 }: { values: (number | null)[]; width?: number; height?: number }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p) => p.v !== null) as { v: number; i: number }[];
  if (pts.length < 2) {
    return <svg width={width} height={height} />;
  }
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const range = max - min || 1;
  const pad = 4;
  const step = (width - pad * 2) / (values.length - 1);
  const coords = pts.map((p) => {
    const x = pad + p.i * step;
    const y = pad + (height - pad * 2) * (1 - (p.v - min) / range);
    return { x, y };
  });
  const path = coords.map((c, i) => (i === 0 ? "M" : "L") + c.x.toFixed(1) + "," + c.y.toFixed(1)).join(" ");
  const last = coords[coords.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke="var(--ink-faint)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
      <circle cx={last.x} cy={last.y} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
