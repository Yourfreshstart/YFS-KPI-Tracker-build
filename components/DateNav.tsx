"use client";

import { useEffect, useRef, useState } from "react";

function isWeekend(d: Date) {
  const g = d.getDay();
  return g === 0 || g === 6;
}
function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}
function fmtWeek(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DateNav({
  value,
  onChange,
  min,
  max,
}: {
  value: Date;
  onChange: (d: Date) => void;
  min: Date;
  max: Date;
}) {
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setCalOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function stepDay(delta: number) {
    const next = new Date(value);
    do {
      next.setDate(next.getDate() + delta);
    } while (isWeekend(next) && next > min && next < max);
    if (next < min) return onChange(new Date(min));
    if (next > max) return onChange(new Date(max));
    onChange(next);
  }

  function openCalendar() {
    setCalMonth(new Date(value.getFullYear(), value.getMonth(), 1));
    setCalOpen(true);
  }

  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const firstDow = calMonth.getDay();
  const today = new Date();

  return (
    <div className="datenav-wrap" ref={wrapRef}>
      <div className="datenav">
        <button onClick={() => stepDay(-1)} disabled={value <= min} aria-label="Previous day">
          &lsaquo;
        </button>
        <span className="datelabel">
          <span className="dow">{fmtWeek(value)}</span> {fmtDate(value)}
        </span>
        <button onClick={() => stepDay(1)} disabled={value >= max} aria-label="Next day">
          &rsaquo;
        </button>
        <button className="jumpBtn" onClick={openCalendar} aria-label="Jump to any date">
          📅
        </button>
      </div>

      {calOpen && (
        <div className="calendar-pop">
          <div className="cal-head">
            <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}>
              &lsaquo;
            </button>
            <span>{calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}>
              &rsaquo;
            </button>
          </div>
          <div className="cal-grid">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div className="cal-dow" key={i}>
                {d}
              </div>
            ))}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div className="cal-day empty" key={"e" + i} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = new Date(calMonth.getFullYear(), calMonth.getMonth(), i + 1);
              const disabled = isWeekend(d) || d < min || d > max;
              return (
                <button
                  key={i}
                  className={
                    "cal-day" +
                    (sameDay(d, value) ? " selected" : "") +
                    (sameDay(d, today) ? " today" : "")
                  }
                  disabled={disabled}
                  onClick={() => {
                    onChange(d);
                    setCalOpen(false);
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        .datenav-wrap {
          position: relative;
        }
        .datenav {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 6px 8px;
          box-shadow: 0 1px 2px rgba(20, 30, 25, 0.06);
        }
        .datenav button {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: var(--ink-muted);
          font-size: 15px;
          cursor: pointer;
        }
        .datenav button:hover {
          background: var(--surface-2);
          color: var(--ink);
        }
        .datenav button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .datelabel {
          font-weight: 600;
          font-size: 14px;
          min-width: 150px;
          text-align: center;
        }
        .dow {
          color: var(--ink-muted);
          font-weight: 500;
        }
        .calendar-pop {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 264px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.18);
          padding: 12px;
          z-index: 40;
        }
        .cal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 700;
        }
        .cal-head button {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: var(--ink-muted);
          cursor: pointer;
        }
        .cal-head button:hover {
          background: var(--surface-2);
          color: var(--ink);
        }
        .cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
        }
        .cal-dow {
          font-size: 10px;
          text-align: center;
          color: var(--ink-faint);
          font-weight: 700;
          padding-bottom: 4px;
        }
        .cal-day {
          font-size: 12.5px;
          text-align: center;
          padding: 7px 0;
          border-radius: 6px;
          cursor: pointer;
          background: none;
          border: none;
          color: var(--ink);
        }
        .cal-day:hover:not(:disabled) {
          background: var(--accent-soft);
        }
        .cal-day:disabled {
          color: var(--ink-faint);
          opacity: 0.35;
          cursor: not-allowed;
        }
        .cal-day.today {
          box-shadow: inset 0 0 0 1px var(--accent);
        }
        .cal-day.selected {
          background: var(--accent);
          color: var(--accent-ink);
          font-weight: 700;
        }
        .cal-day.empty {
          visibility: hidden;
        }
      `}</style>
    </div>
  );
}
