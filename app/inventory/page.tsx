"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import NavTabs from "@/components/NavTabs";
import IdentityGate from "@/components/IdentityGate";
import { useIdentity } from "@/lib/useIdentity";
import { api } from "@/lib/api";
import {
  addDays,
  analyze,
  buildTechs,
  fmtDate,
  fmtNum,
  fmtOne,
  localToday,
  mondayOf,
  suggestedOrder,
  unitWord,
  validAmount,
  QUARTER_UNITS,
  UNIT_LABEL,
  UNITS,
  type Analysis,
  type CountRow,
  type HeadRow,
  type Supply,
  type Unit,
} from "@/lib/inventory";

type Data = { supplies: Supply[]; counts: CountRow[]; heads: HeadRow[]; picks: string[] };
type FormRow = { now: string; rest: string; ok: boolean };
type OtherLine = { name: string; qty: string };

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const plural = (u: Unit) => UNIT_LABEL[u][1];
const cleanNum = (t: string) => t.replace(/[^0-9.]/g, "");

function Spark({ values }: { values: (number | null)[] }) {
  const w = 110;
  const h = 28;
  const p = 3;
  const vals = values.map((v) => v ?? 0);
  const max = Math.max(...vals, 0.01);
  const pts = vals.map((v, i) => [p + (i * (w - 2 * p)) / Math.max(1, vals.length - 1), h - p - (v / max) * (h - 2 * p)]);
  const line = pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: "block" }}>
      <path d={`${line} L${last[0]} ${h - p} L${p} ${h - p} Z`} fill="var(--accent-soft)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill="var(--accent)" />
    </svg>
  );
}

export default function InventoryPage() {
  const { person, loading, signIn, switchUser } = useIdentity();
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState("");
  const [dataLoading, setDataLoading] = useState(false);
  const today = useMemo(() => localToday(), []);
  const thisMonday = useMemo(() => mondayOf(today), [today]);
  const [countDate, setCountDate] = useState(thisMonday);
  const [form, setForm] = useState<Record<number, FormRow>>({});
  const [saveMsg, setSaveMsg] = useState<{ kind: "good" | "bad" | ""; text: string }>({ kind: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [confirmRetire, setConfirmRetire] = useState<number | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<Unit>("gal");
  const [newShelf, setNewShelf] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [orderEdits, setOrderEdits] = useState<Record<number, string>>({});
  const [other, setOther] = useState<OtherLine[]>([]);
  const [otherName, setOtherName] = useState("");
  const [otherQty, setOtherQty] = useState("");
  const [sendMsg, setSendMsg] = useState<{ kind: "good" | "bad" | ""; text: string }>({ kind: "", text: "" });
  const [sending, setSending] = useState(false);
  const entryRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setDataLoading(true);
    const r = await api<Data & { error?: string }>("/api/inventory");
    if (r.ok) {
      setData(r.data);
      setLoadError("");
    } else {
      setLoadError(r.data?.error || "Couldn't load the inventory. Please refresh the page.");
    }
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (person) load();
  }, [person, load]);

  const active = useMemo(() => (data ? data.supplies.filter((s) => s.status === "active") : []), [data]);
  const retired = useMemo(() => (data ? data.supplies.filter((s) => s.status === "retired") : []), [data]);
  const techs = useMemo(() => buildTechs(data?.heads || [], today), [data, today]);
  const analyses = useMemo<Analysis[]>(
    () => (data ? active.map((s) => analyze(s, data.counts, techs, today)) : []),
    [data, active, techs, today]
  );
  const techCount = techs.current !== null ? Math.round(techs.current * 10) / 10 : null;

  // Fill the entry form from whatever is already saved for the chosen Monday.
  useEffect(() => {
    if (!data) return;
    const next: Record<number, FormRow> = {};
    for (const s of active) {
      const c = data.counts.find((x) => x.supply_id === s.id && x.count_date === countDate);
      next[s.id] = {
        now: c && c.on_shelf !== null ? fmtNum(c.on_shelf) : "",
        rest: c ? fmtNum(c.restocked) : "0",
        ok: false,
      };
    }
    setForm(next);
  }, [data, active, countDate]);

  const lastBefore = useCallback(
    (supplyId: number): number | null => {
      if (!data) return null;
      const rows = data.counts
        .filter((c) => c.supply_id === supplyId && c.count_date < countDate && c.on_shelf !== null)
        .sort((a, b) => a.count_date.localeCompare(b.count_date));
      const last = rows[rows.length - 1];
      return last ? Number(last.on_shelf) : null;
    },
    [data, countDate]
  );

  function rowProblem(s: Supply): { text: string; blocking: boolean; confirmable: boolean } | null {
    const f = form[s.id];
    if (!f) return null;
    const restN = f.rest.trim() === "" ? 0 : Number(f.rest);
    if (f.rest.trim() !== "" && !validAmount(s.unit, restN)) {
      return { text: stepText(s, "restocked amount"), blocking: true, confirmable: false };
    }
    if (f.now.trim() === "") return null;
    const nowN = Number(f.now);
    if (!validAmount(s.unit, nowN)) return { text: stepText(s, "shelf count"), blocking: true, confirmable: false };
    const last = lastBefore(s.id);
    if (!f.ok && last !== null && nowN > last + restN + 1e-9) {
      return {
        text: `${s.name} went from ${fmtNum(last)} to ${fmtNum(nowN)}, but ${restN === 0 ? "nothing was" : `only ${fmtNum(restN)} ${unitWord(s.unit, restN)} ${restN === 1 ? "was" : "were"}`} restocked. Double-check?`,
        blocking: true,
        confirmable: true,
      };
    }
    return null;
  }
  function stepText(s: Supply, what: string) {
    return QUARTER_UNITS.includes(s.unit)
      ? `${s.name}: the ${what} is counted in quarters. Use whole numbers or .25, .5, .75.`
      : `${s.name}: the ${what} is counted in whole ${plural(s.unit)}.`;
  }

  function setField(id: number, key: "now" | "rest", value: string) {
    setForm((f) => ({ ...f, [id]: { ...(f[id] || { now: "", rest: "0", ok: false }), [key]: cleanNum(value), ok: false } }));
    setSaveMsg({ kind: "", text: "" });
  }

  async function saveCount() {
    const problems = active.filter((s) => rowProblem(s)?.blocking);
    if (problems.length) {
      setSaveMsg({ kind: "bad", text: `${problems.length} ${problems.length === 1 ? "count needs" : "counts need"} a second look before saving.` });
      return;
    }
    setSaving(true);
    const rows = active.map((s) => {
      const f = form[s.id] || { now: "", rest: "0", ok: false };
      return { supply_id: s.id, on_shelf: f.now.trim() === "" ? null : Number(f.now), restocked: f.rest.trim() === "" ? 0 : Number(f.rest) };
    });
    const r = await api<{ error?: string }>("/api/inventory/counts", { body: { date: countDate, rows } });
    setSaving(false);
    if (!r.ok) {
      setSaveMsg({ kind: "bad", text: r.data?.error || "Couldn't save. Please try again." });
      return;
    }
    const blanks = rows.filter((x) => x.on_shelf === null).length;
    setSaveMsg(
      blanks
        ? {
            kind: "bad",
            text: `Saved. ${blanks} shelf ${blanks === 1 ? "count is" : "counts are"} still blank. If ${blanks === 1 ? "it stays" : "they stay"} blank, a reminder goes out Tuesday at 9am.`,
          }
        : { kind: "good", text: "Saved. All counts are in for this week." }
    );
    await load();
  }

  async function supplyAction(id: number, action: "retire" | "bring_back" | "relearn") {
    setActionMsg("");
    const r = await api<{ error?: string }>("/api/inventory/supplies", { method: "PATCH", body: { id, action } });
    setConfirmRetire(null);
    if (!r.ok) {
      setActionMsg(r.data?.error || "Couldn't save that change. Please try again.");
      return;
    }
    await load();
  }

  async function addSupply() {
    setAddMsg("");
    const name = newName.trim();
    if (!name) {
      setAddMsg("Type the supply's name.");
      return;
    }
    if (newShelf.trim() !== "" && !validAmount(newUnit, Number(newShelf))) {
      setAddMsg(QUARTER_UNITS.includes(newUnit) ? "Shelf count: whole numbers or .25, .5, .75." : "Shelf count: whole numbers only.");
      return;
    }
    const r = await api<{ error?: string }>("/api/inventory/supplies", {
      body: { name, unit: newUnit, on_shelf: newShelf.trim() === "" ? null : Number(newShelf) },
    });
    if (!r.ok) {
      setAddMsg(r.data?.error || "Couldn't add that supply.");
      return;
    }
    setNewName("");
    setNewShelf("");
    setNewUnit("gal");
    setAddOpen(false);
    await load();
  }

  // ---- order list
  const orderLines = useMemo(
    () =>
      analyses.map((a) => {
        const f = form[a.supply.id];
        const shelfNow = countDate === thisMonday && f && f.now.trim() !== "" && Number.isFinite(Number(f.now)) ? Number(f.now) : a.lastShelf;
        const suggested = suggestedOrder(a, techs.current, shelfNow);
        const edit = orderEdits[a.supply.id];
        const qty = edit !== undefined ? (edit === "" ? 0 : Math.max(0, Math.round(Number(edit) || 0))) : suggested;
        return { a, suggested, qty, edited: edit !== undefined };
      }),
    [analyses, form, countDate, thisMonday, techs, orderEdits]
  );
  const shownOrder = orderLines.filter((l) => showAll || l.suggested > 0 || l.edited);
  const hiddenCount = orderLines.filter((l) => !(l.suggested > 0 || l.edited)).length;

  async function addOther(name: string, qty: number, savePick: boolean) {
    const n = name.trim().replace(/\s+/g, " ");
    if (!n) return;
    setOther((o) => (o.some((x) => x.name.toLowerCase() === n.toLowerCase()) ? o : [...o, { name: n, qty: String(qty) }]));
    if (savePick && data && !data.picks.some((p) => p.toLowerCase() === n.toLowerCase())) {
      setData({ ...data, picks: [...data.picks, n] });
      await api("/api/inventory/picks", { body: { name: n } });
    }
  }
  async function removePick(name: string) {
    if (data) setData({ ...data, picks: data.picks.filter((p) => p !== name) });
    await api("/api/inventory/picks", { body: { name, remove: true } });
  }

  async function sendOrder() {
    setSendMsg({ kind: "", text: "" });
    const supplies = orderLines.filter((l) => l.qty > 0).map((l) => ({ name: l.a.supply.name, qty: l.qty, unit: unitWord(l.a.supply.unit, l.qty) }));
    const others = other.map((o) => ({ name: o.name, qty: Math.max(0, Math.round(Number(o.qty) || 0)), unit: "" })).filter((o) => o.qty > 0);
    if (supplies.length + others.length === 0) {
      setSendMsg({ kind: "bad", text: "The order is empty." });
      return;
    }
    setSending(true);
    const r = await api<{ error?: string }>("/api/inventory/order", { body: { supplies, other: others } });
    setSending(false);
    if (!r.ok) {
      setSendMsg({ kind: "bad", text: r.data?.error || "The email didn't send. Please try again." });
      return;
    }
    setSendMsg({ kind: "good", text: "Order sent to cleanteam@yourfreshstartclean.com." });
    setOther([]);
    setOrderEdits({});
  }

  if (loading) return null;
  if (!person) return <IdentityGate onVerified={signIn} />;

  const flagged = analyses.filter((a) => a.flag);
  const learningList = analyses.filter((a) => a.learning);
  const lastCountDate = analyses.reduce<string | null>((m, a) => (a.lastCountDate && (!m || a.lastCountDate > m) ? a.lastCountDate : m), null);
  const mondayOptions = Array.from({ length: 8 }, (_, i) => addDays(thisMonday, -7 * i));
  const monthKeys = analyses[0]?.months.map((m) => m.key) || [];
  const curMonthKey = today.slice(0, 7);
  const monthLabel = (k: string) => MONTH_SHORT[Number(k.slice(5, 7)) - 1] + (k === curMonthKey ? "*" : "");

  function status(a: Analysis) {
    if (a.learning) return <span className="inv-chip learn">Learning · {a.learnedWeeks} of 4 weeks</span>;
    if (a.flag === "more") return <span className="inv-chip more">Using more</span>;
    if (a.flag === "less") return <span className="inv-chip less">Using less</span>;
    if (a.flag === "slow_up") return <span className="inv-chip slow">Slowly rising</span>;
    if (a.flag === "slow_down") return <span className="inv-chip slow">Slowly dropping</span>;
    return <span className="inv-chip ok">Normal</span>;
  }
  function flagText(a: Analysis) {
    const u = plural(a.supply.unit);
    const forTechs = techCount !== null ? ` for ${techCount} technicians` : "";
    if (a.flag === "slow_up" || a.flag === "slow_down") {
      return `Use has been slowly ${a.flag === "slow_up" ? "rising" : "dropping"}: ${fmtNum(a.slowActual)} ${u} used in the last 13 weeks, compared with about ${fmtOne(a.slowExpected)} normally.`;
    }
    return `${fmtNum(a.actual4)} ${u} used in the last 4 weeks. Normal${forTechs} is about ${fmtOne(a.expected4)}.`;
  }

  return (
    <div className="inv-wrap">
      <div className="inv-topbar">
        <div className="inv-brand">
          <Logo height={44} />
          <div className="inv-divider" />
          <div>
            <h1>Inventory</h1>
            <div className="inv-sub">
              Next count: {fmtDate(thisMonday)}
              {techCount !== null ? ` · ${techCount} technicians (from Daily Entry)` : ""} · {person.name}
            </div>
          </div>
        </div>
        <button className="inv-switch" onClick={switchUser}>
          Switch
        </button>
      </div>
      <NavTabs />

      {loadError ? (
        <div className="inv-err">{loadError}</div>
      ) : !data ? (
        <div className="inv-loading">{dataLoading ? "Loading…" : ""}</div>
      ) : (
        <>
          <div className="inv-panel inv-summary">
            <div className="inv-facts">
              <span>
                <b>{active.length}</b> supplies tracked
              </span>
              <span>
                <b>{flagged.length}</b> need attention
              </span>
              <span>
                Last count <b>{lastCountDate ? fmtDate(lastCountDate) : "none yet"}</b>
              </span>
            </div>
            <button
              className="inv-btn primary"
              onClick={() => entryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Enter this week&apos;s count ↓
            </button>
          </div>

          {actionMsg && <div className="inv-err">{actionMsg}</div>}

          <section className="inv-section">
            <div className="inv-head">
              <h2>Needs attention</h2>
              <span className="inv-note">
                Last 4 weeks together, adjusted for technician count. Flags at 30% more or 40% less, and at least 1 gallon, box or
                bag (2 bottles or cans).
              </span>
            </div>
            {flagged.length === 0 ? (
              <div className="inv-panel inv-pad inv-muted">Nothing needs attention right now.</div>
            ) : (
              <div className="inv-flags">
                {flagged.map((a) => (
                  <div key={a.supply.id} className={`inv-flag ${a.flag === "more" ? "" : a.flag === "less" ? "less" : "slow"}`}>
                    <div className="inv-flag-top">
                      <span className="inv-flag-name">{a.supply.name}</span>
                      {status(a)}
                    </div>
                    <p>{flagText(a)}</p>
                    <button className="inv-btn link small" onClick={() => supplyAction(a.supply.id, "relearn")}>
                      We changed how we use it. Relearn its normal.
                    </button>
                  </div>
                ))}
              </div>
            )}
            {learningList.length > 0 && (
              <div className="inv-note">
                Still learning normal amounts (no flags yet):{" "}
                {learningList.map((a, i) => (
                  <span key={a.supply.id}>
                    {i > 0 ? ", " : ""}
                    <b>{a.supply.name}</b> ({a.learnedWeeks} of 4 weeks)
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="inv-section">
            <div className="inv-head">
              <h2>Supply averages</h2>
              <span className="inv-note">Click a supply to see it month by month</span>
            </div>
            <div className="inv-panel inv-scroll">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Supply</th>
                    <th className="num">On shelf</th>
                    <th className="num">Usual per month</th>
                    <th className="num">Last 4 weeks</th>
                    <th>
                      {monthKeys.length ? `${monthLabel(monthKeys[0]).replace("*", "")} – ${monthLabel(monthKeys[monthKeys.length - 1]).replace("*", "")}` : ""}
                    </th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map((a) => {
                    const open = openRow === a.supply.id;
                    const u = a.supply.unit;
                    return (
                      <Fragment key={a.supply.id}>
                      <tr
                        key={a.supply.id}
                        className={`inv-avg-row${open ? " open" : ""}`}
                        tabIndex={0}
                        aria-expanded={open}
                        onClick={() => setOpenRow(open ? null : a.supply.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpenRow(open ? null : a.supply.id);
                          }
                        }}
                      >
                        <td>
                          <span className="inv-caret">▸</span> <b>{a.supply.name}</b>
                        </td>
                        <td className="num">
                          {a.lastShelf !== null ? (
                            <>
                              {fmtNum(a.lastShelf)} <span className="inv-unit">{unitWord(u, a.lastShelf)}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="num">
                          {a.learning ? (
                            <span className="inv-muted">Learning</span>
                          ) : a.usualPerMonth !== null ? (
                            <>
                              {fmtOne(a.usualPerMonth)} <span className="inv-unit">{plural(u)}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="num">{a.weeks.length ? fmtNum(a.weeks.slice(-4).reduce((t, w) => t + w.used, 0)) : "—"}</td>
                        <td>
                          <Spark values={a.months.map((m) => m.value)} />
                        </td>
                        <td>{status(a)}</td>
                      </tr>
                      {open ? (
                        <tr className="inv-detail">
                          <td colSpan={6}>
                            <div className="inv-months">
                              {a.months.map((m) => (
                                <div className="inv-mo" key={m.key}>
                                  <div className="ml">{monthLabel(m.key)}</div>
                                  <div className="mv">{m.value === null ? "—" : fmtOne(m.value)}</div>
                                </div>
                              ))}
                              {a.perTechWeek !== null && (
                                <div className="inv-mo avg">
                                  <div className="ml">Per tech / week</div>
                                  <div className="mv">{a.perTechWeek < 0.01 ? "<0.01" : a.perTechWeek.toFixed(2)}</div>
                                </div>
                              )}
                            </div>
                            <div className="inv-note" style={{ paddingLeft: 18 }}>
                              {plural(u)} per month (each month&apos;s weekly average × 4.33, so 4- and 5-Monday months compare fairly) · *this month so far
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="inv-section" ref={entryRef}>
            <div className="inv-head">
              <h2>Monday count</h2>
              <span className="inv-note">Gallons, boxes and bags count in quarters (.25, .5, .75). Bottles and cans are whole numbers.</span>
            </div>
            <div className="inv-panel">
              <div className="inv-entry-meta">
                <label className="inv-date">
                  Count for{" "}
                  <select value={countDate} onChange={(e) => setCountDate(e.target.value)}>
                    {mondayOptions.map((d) => (
                      <option key={d} value={d}>
                        {fmtDate(d, { weekday: "long", month: "long", day: "numeric" })}
                        {d === thisMonday ? " (this week)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="inv-muted">
                  Entering as <b>{person.name}</b>
                </div>
              </div>
              <div className="inv-scroll">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th>Supply</th>
                      <th className="num">Last count</th>
                      <th className="num">On shelf now</th>
                      <th className="num">Restocked</th>
                      <th className="num">Used</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((s) => {
                      const f = form[s.id] || { now: "", rest: "0", ok: false };
                      const last = lastBefore(s.id);
                      const prob = rowProblem(s);
                      const restN = f.rest.trim() === "" ? 0 : Number(f.rest);
                      const used =
                        f.now.trim() !== "" && last !== null && Number.isFinite(Number(f.now)) && Number.isFinite(restN)
                          ? Math.max(0, last + restN - Number(f.now))
                          : null;
                      return (
                        <Fragment key={s.id}>
                        <tr>
                          <td>
                            <b>{s.name}</b> <span className="inv-unit">{plural(s.unit)}</span>
                          </td>
                          <td className="num inv-muted">{last !== null ? fmtNum(last) : "—"}</td>
                          <td className="num">
                            <input
                              id={`now-${s.id}`}
                              className={`inv-input${f.now.trim() === "" ? " blank" : ""}`}
                              type="text"
                              inputMode="decimal"
                              value={f.now}
                              aria-label={`${s.name} on shelf now`}
                              onChange={(e) => setField(s.id, "now", e.target.value)}
                            />
                          </td>
                          <td className="num">
                            <input
                              id={`rest-${s.id}`}
                              className={`inv-input${restN === 0 ? " zero" : ""}`}
                              type="text"
                              inputMode="decimal"
                              value={f.rest}
                              aria-label={`${s.name} restocked`}
                              onFocus={(e) => {
                                if (f.rest === "0") setField(s.id, "rest", "");
                                e.target.select();
                              }}
                              onBlur={() => {
                                if (f.rest.trim() === "") setField(s.id, "rest", "0");
                              }}
                              onChange={(e) => setField(s.id, "rest", e.target.value)}
                            />
                          </td>
                          <td className="num">{used === null ? <span className="inv-muted">–</span> : <b>{fmtNum(used)}</b>}</td>
                          <td className="num">
                            {confirmRetire === s.id ? (
                              <span className="inv-confirm">
                                Retire {s.name}?{" "}
                                <button className="inv-btn small" onClick={() => supplyAction(s.id, "retire")}>
                                  Retire
                                </button>{" "}
                                <button className="inv-btn small" onClick={() => setConfirmRetire(null)}>
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button className="inv-btn link small" onClick={() => setConfirmRetire(s.id)}>
                                Retire
                              </button>
                            )}
                          </td>
                        </tr>
                        {prob ? (
                          <tr className="inv-warn-row">
                            <td colSpan={6}>
                              <div className="inv-warn">
                                <span>{prob.text}</span>
                                {prob.confirmable && (
                                  <button
                                    className="inv-btn small"
                                    onClick={() => setForm((x) => ({ ...x, [s.id]: { ...f, ok: true } }))}
                                  >
                                    It&apos;s correct
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="inv-entry-foot">
                <span className={`inv-toast ${saveMsg.kind}`}>
                  {saveMsg.text || "If any shelf count is still blank Tuesday at 9am, a reminder goes to the main email."}
                </span>
                <button className="inv-btn primary" onClick={saveCount} disabled={saving}>
                  {saving ? "Saving…" : "Save count"}
                </button>
              </div>
              <div className="inv-addbox">
                {addOpen ? (
                  <>
                    <input
                      id="new-supply-name"
                      className="inv-input wide"
                      type="text"
                      placeholder="Supply name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                    <select id="new-supply-unit" value={newUnit} onChange={(e) => setNewUnit(e.target.value as Unit)} aria-label="Measured in">
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {plural(u)[0].toUpperCase() + plural(u).slice(1)}
                        </option>
                      ))}
                    </select>
                    <input
                      id="new-supply-shelf"
                      className="inv-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="On shelf"
                      value={newShelf}
                      onChange={(e) => setNewShelf(cleanNum(e.target.value))}
                    />
                    <button className="inv-btn small primary" onClick={addSupply}>
                      Add supply
                    </button>
                    <button
                      className="inv-btn small"
                      onClick={() => {
                        setAddOpen(false);
                        setAddMsg("");
                      }}
                    >
                      Cancel
                    </button>
                    {addMsg && <span className="inv-toast bad">{addMsg}</span>}
                  </>
                ) : (
                  <button className="inv-btn small" onClick={() => setAddOpen(true)}>
                    + Add a supply
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="inv-section">
            <div className="inv-head">
              <h2>Order list</h2>
              <span className="inv-note">Suggested amounts cover a month plus 2 weeks of back stock. Change any number.</span>
            </div>
            <div className="inv-order-grid">
              <div className="inv-panel inv-order-block">
                <h3>Supplies</h3>
                {shownOrder.length === 0 && <div className="inv-muted">Nothing needs ordering right now.</div>}
                {shownOrder.map((l) => (
                  <div className="inv-oline" key={l.a.supply.id}>
                    <span>
                      <span className="nm">{l.a.supply.name}</span> <span className="inv-unit">{plural(l.a.supply.unit)}</span>
                    </span>
                    <input
                      id={`order-${l.a.supply.id}`}
                      className="inv-input short"
                      type="text"
                      inputMode="numeric"
                      value={orderEdits[l.a.supply.id] ?? String(l.suggested)}
                      aria-label={`Order ${l.a.supply.name}`}
                      onChange={(e) => setOrderEdits((o) => ({ ...o, [l.a.supply.id]: e.target.value.replace(/[^0-9]/g, "") }))}
                    />
                  </div>
                ))}
                <button className="inv-btn link" onClick={() => setShowAll(!showAll)}>
                  {showAll ? "Hide supplies that don’t need ordering" : `Show all supplies (${hiddenCount} don’t need ordering)`}
                </button>
              </div>
              <div className="inv-panel inv-order-block">
                <h3>Other items</h3>
                <div className="inv-picks">
                  {data.picks.map((p) => (
                    <span className="inv-pick" key={p}>
                      <button title="Add to order" onClick={() => addOther(p, 1, false)}>
                        + {p}
                      </button>
                      <button className="x" aria-label={`Remove ${p} from quick picks`} onClick={() => removePick(p)}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {other.map((o, i) => (
                  <div className="inv-oline" key={o.name}>
                    <span className="nm">{o.name}</span>
                    <span className="inv-inline">
                      <input
                        className="inv-input short"
                        type="text"
                        inputMode="numeric"
                        value={o.qty}
                        aria-label={`Quantity of ${o.name}`}
                        onChange={(e) => setOther((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value.replace(/[^0-9]/g, "") } : y)))}
                      />
                      <button className="inv-btn link small" onClick={() => setOther((x) => x.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    </span>
                  </div>
                ))}
                <div className="inv-inline wrap">
                  <input
                    id="other-name"
                    className="inv-input wide"
                    type="text"
                    placeholder="Item (e.g. printer ink)"
                    value={otherName}
                    onChange={(e) => setOtherName(e.target.value)}
                  />
                  <input
                    id="other-qty"
                    className="inv-input short"
                    type="text"
                    inputMode="numeric"
                    placeholder="Qty"
                    value={otherQty}
                    onChange={(e) => setOtherQty(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                  <button
                    className="inv-btn small"
                    onClick={() => {
                      addOther(otherName, Math.max(1, Number(otherQty) || 1), true);
                      setOtherName("");
                      setOtherQty("");
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div className="inv-send">
              <span className={`inv-toast ${sendMsg.kind}`}>{sendMsg.text}</span>
              <button className="inv-btn primary" onClick={sendOrder} disabled={sending}>
                {sending ? "Sending…" : "Send order"}
              </button>
            </div>
          </section>

          <section className="inv-section">
            <button className="inv-btn link inv-ret-toggle" onClick={() => setShowRetired(!showRetired)}>
              Retired supplies ({retired.length}) {showRetired ? "▾" : "▸"}
            </button>
            {showRetired && (
              <div className="inv-panel inv-retired">
                {retired.length === 0 && <div className="inv-rline inv-muted">No retired supplies.</div>}
                {retired.map((r) => {
                  const pt = r.retired_per_tech_week ?? 0;
                  const note =
                    pt <= 0
                      ? "Hardly used before it was retired."
                      : `About ${pt < 0.01 ? "less than 0.01" : pt.toFixed(2)} ${plural(r.unit)} per technician per week.` +
                        (techCount !== null ? ` For ${techCount} technicians, that's about ${fmtOne(pt * techCount * 4.33)} a month.` : "");
                  return (
                    <div className="inv-rline" key={r.id}>
                      <div>
                        <b>{r.name}</b> <span className="inv-unit">{plural(r.unit)}</span>
                        <div className="inv-note">
                          {note}
                          {r.retired_at ? ` Retired ${fmtDate(r.retired_at, { month: "short", day: "numeric", year: "numeric" })}.` : ""}
                        </div>
                      </div>
                      <button className="inv-btn small" onClick={() => supplyAction(r.id, "bring_back")}>
                        Bring back
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <style jsx global>{`
        .inv-wrap {
          max-width: 1080px;
          margin: 0 auto;
          padding: 24px 20px 70px;
        }
        .inv-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .inv-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .inv-divider {
          width: 1px;
          height: 32px;
          background: var(--line);
        }
        .inv-wrap h1 {
          margin: 0;
          font-size: 19px;
        }
        .inv-sub {
          font-size: 12.5px;
          color: var(--ink-muted);
        }
        .inv-switch {
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--surface-2);
          color: var(--ink-muted);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .inv-loading {
          padding: 60px;
          text-align: center;
          color: var(--ink-faint);
        }
        .inv-err {
          background: #fdecec;
          color: #a12727;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          margin-bottom: 16px;
        }
        .inv-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 26px;
        }
        .inv-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .inv-wrap h2 {
          font-size: 16px;
          margin: 0;
        }
        .inv-note {
          color: var(--ink-muted);
          font-size: 12.5px;
        }
        .inv-muted {
          color: var(--ink-muted);
        }
        .inv-unit {
          color: var(--ink-faint);
          font-size: 12px;
        }
        .inv-panel {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
        }
        .inv-pad {
          padding: 14px;
        }
        .inv-summary {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          margin-bottom: 20px;
        }
        .inv-facts {
          display: flex;
          gap: 22px;
          flex-wrap: wrap;
          color: var(--ink-muted);
          font-size: 13px;
        }
        .inv-facts b {
          color: var(--ink);
          font-size: 15px;
        }
        .inv-btn {
          font: inherit;
          font-weight: 600;
          font-size: 13px;
          border-radius: 8px;
          padding: 9px 14px;
          cursor: pointer;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--ink);
        }
        .inv-btn:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .inv-btn.primary {
          background: var(--accent);
          border-color: var(--accent);
          color: var(--accent-ink);
        }
        .inv-btn.small {
          padding: 5px 10px;
          font-size: 12px;
        }
        .inv-btn.link {
          border: none;
          background: none;
          color: var(--accent);
          padding: 4px 2px;
          align-self: flex-start;
        }
        .inv-flags {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 10px;
        }
        .inv-flag {
          background: var(--surface);
          border: 1px solid var(--line);
          border-left: 4px solid var(--status-critical);
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .inv-flag.less {
          border-left-color: var(--accent);
        }
        .inv-flag.slow {
          border-left-color: var(--status-warning);
        }
        .inv-flag-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .inv-flag-name {
          font-weight: 700;
        }
        .inv-flag p {
          margin: 0;
          color: var(--ink-muted);
          font-size: 13px;
          line-height: 1.45;
        }
        .inv-chip {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          border-radius: 999px;
          padding: 3px 8px;
          white-space: nowrap;
        }
        .inv-chip.more {
          background: #fbe9e9;
          color: var(--status-critical);
        }
        .inv-chip.less {
          background: var(--accent-soft);
          color: var(--accent);
        }
        .inv-chip.slow {
          background: var(--monday-soft);
          color: var(--monday);
        }
        .inv-chip.ok {
          background: var(--green-soft);
          color: var(--green);
        }
        .inv-chip.learn {
          background: var(--surface-2);
          color: var(--ink-muted);
        }
        @media (prefers-color-scheme: dark) {
          .inv-chip.more {
            background: #3a1d1d;
          }
          .inv-err {
            background: #3a1d1d;
            color: #f3b0b0;
          }
        }
        .inv-scroll {
          overflow-x: auto;
        }
        .inv-table {
          width: 100%;
          border-collapse: collapse;
          font-variant-numeric: tabular-nums;
          font-size: 14px;
        }
        .inv-table th {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-faint);
          font-weight: 700;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid var(--line);
          white-space: nowrap;
        }
        .inv-table td {
          padding: 9px 12px;
          border-bottom: 1px solid var(--line);
          vertical-align: middle;
        }
        .inv-table tr:last-child td {
          border-bottom: none;
        }
        .inv-table .num {
          text-align: right;
        }
        .inv-avg-row {
          cursor: pointer;
        }
        .inv-avg-row:hover td {
          background: var(--surface-2);
        }
        .inv-caret {
          display: inline-block;
          width: 12px;
          color: var(--ink-faint);
          transition: transform 0.15s;
        }
        .inv-avg-row.open .inv-caret {
          transform: rotate(90deg);
        }
        .inv-months {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          padding: 4px 0 6px 18px;
        }
        .inv-mo {
          background: var(--surface-2);
          border-radius: 8px;
          padding: 6px 10px;
          min-width: 74px;
          text-align: center;
        }
        .inv-mo.avg {
          background: var(--accent-soft);
        }
        .inv-mo .ml {
          font-size: 11px;
          color: var(--ink-faint);
          font-weight: 600;
        }
        .inv-mo .mv {
          font-weight: 700;
        }
        .inv-entry-meta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid var(--line);
          font-size: 13px;
        }
        .inv-date {
          font-weight: 600;
        }
        .inv-wrap select,
        .inv-input {
          font: inherit;
          font-size: 14px;
          color: var(--ink);
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 7px;
          padding: 7px 9px;
        }
        .inv-input {
          width: 92px;
          text-align: right;
        }
        .inv-input.short {
          width: 72px;
        }
        .inv-input.wide {
          width: auto;
          flex: 1;
          min-width: 160px;
          text-align: left;
        }
        .inv-input.blank {
          border-color: var(--monday-line);
          background: var(--monday-soft);
        }
        .inv-input.zero {
          color: var(--ink-faint);
        }
        .inv-warn-row td {
          padding-top: 0;
        }
        .inv-warn {
          background: var(--monday-soft);
          color: var(--monday);
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 12.5px;
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .inv-confirm {
          font-size: 12.5px;
          color: var(--ink-muted);
          white-space: nowrap;
        }
        .inv-entry-foot,
        .inv-send {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .inv-entry-foot {
          padding: 12px 14px;
          border-top: 1px solid var(--line);
        }
        .inv-toast {
          font-size: 13px;
          color: var(--ink-muted);
        }
        .inv-toast.good {
          color: var(--status-good);
          font-weight: 600;
        }
        .inv-toast.bad {
          color: var(--monday);
          font-weight: 600;
        }
        .inv-addbox {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          padding: 12px 14px;
          border-top: 1px solid var(--line);
          background: var(--surface-2);
          border-radius: 0 0 12px 12px;
        }
        .inv-order-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
          gap: 14px;
        }
        @media (max-width: 820px) {
          .inv-order-grid {
            grid-template-columns: 1fr;
          }
        }
        .inv-order-block {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .inv-order-block h3 {
          font-size: 12px;
          margin: 0;
          color: var(--ink-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .inv-oline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 6px 0;
          border-bottom: 1px solid var(--line);
        }
        .inv-oline .nm {
          font-weight: 600;
        }
        .inv-inline {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .inv-inline.wrap {
          flex-wrap: wrap;
        }
        .inv-picks {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .inv-pick {
          display: inline-flex;
          align-items: center;
          background: var(--surface-2);
          border: 1px solid var(--line);
          border-radius: 999px;
          font-size: 12.5px;
          font-weight: 600;
        }
        .inv-pick button {
          font: inherit;
          background: none;
          border: none;
          color: var(--ink);
          cursor: pointer;
          padding: 5px 4px 5px 11px;
        }
        .inv-pick button.x {
          color: var(--ink-faint);
          padding: 5px 9px 5px 3px;
        }
        .inv-ret-toggle {
          font-size: 15px !important;
          font-weight: 700 !important;
        }
        .inv-retired {
          padding: 4px 14px;
        }
        .inv-rline {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid var(--line);
          flex-wrap: wrap;
        }
        .inv-rline:last-child {
          border-bottom: none;
        }
      `}</style>
    </div>
  );
}
