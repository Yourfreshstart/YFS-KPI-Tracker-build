"use client";

import { useEffect, useState } from "react";

export default function NumberField({
  label,
  value,
  onCommit,
  money,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  money?: boolean;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  return (
    <div className="field">
      <label>{label}</label>
      <div className="inputwrap">
        {money && <span className="prefix">$</span>}
        <input
          className={money ? "money" : ""}
          type="text"
          inputMode="decimal"
          value={text}
          onFocus={(e) => {
            if (text === "0") setText("");
            e.target.select();
          }}
          onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={() => {
            const n = text.trim() === "" ? 0 : parseFloat(text);
            const safe = Number.isFinite(n) ? n : 0;
            setText(String(safe));
            if (safe !== value) onCommit(safe);
          }}
        />
      </div>

      <style jsx>{`
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        label {
          font-size: 12.5px;
          color: var(--ink-muted);
          font-weight: 600;
          line-height: 1.3;
        }
        .inputwrap {
          position: relative;
        }
        .prefix {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--ink-faint);
          font-size: 14px;
          pointer-events: none;
        }
        input {
          width: 100%;
          border: 1px solid var(--line);
          background: var(--surface-2);
          border-radius: 8px;
          padding: 9px 11px;
          font-size: 14.5px;
          font-variant-numeric: tabular-nums;
          color: var(--ink);
          font-family: inherit;
        }
        input.money {
          padding-left: 22px;
        }
        input:focus {
          outline: none;
          border-color: var(--accent);
          background: var(--surface);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
      `}</style>
    </div>
  );
}
