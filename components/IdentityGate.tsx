"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Person } from "@/lib/useIdentity";
import PinPad from "@/components/PinPad";

const NAMES = ["Teather", "Jan", "Jennifer"];

export default function IdentityGate({
  onVerified,
}: {
  onVerified: (person: Person) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  function choosePerson(name: string) {
    setSelected(name);
    setPin("");
    setError("");
  }

  async function handlePinChange(digits: string) {
    setPin(digits);
    setError("");
    if (digits.length === 4 && selected) {
      setChecking(true);
      const { data, error: rpcError } = await supabase.rpc("verify_pin", {
        input_name: selected,
        input_pin: digits,
      });
      setChecking(false);
      if (rpcError || !data || data.length === 0) {
        setError("Incorrect PIN, try again");
        setPin("");
        return;
      }
      onVerified(data[0] as Person);
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        {!selected ? (
          <>
            <h2>Who&apos;s entering today?</h2>
            <div className="sub">Just so we know who to check with if a number looks off.</div>
            <div className="person-row">
              {NAMES.map((name) => (
                <button key={name} className="person-btn" onClick={() => choosePerson(name)}>
                  {name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2>{selected}&apos;s PIN</h2>
            <div className="pin-hint">Enter your 4-digit PIN</div>
            <div className="pin-dots">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={i < pin.length ? "filled" : ""} />
              ))}
            </div>
            <PinPad value={pin} onChange={handlePinChange} disabled={checking} />
            <div className="pin-error">{error}</div>
            <button className="pin-back" onClick={() => setSelected(null)}>
              &lsaquo; Not you? Choose again
            </button>
          </>
        )}
      </div>

      <style jsx>{`
        .gate {
          position: fixed;
          inset: 0;
          background: rgba(16, 21, 18, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 20px;
        }
        .gate-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
          width: 100%;
          max-width: 340px;
          padding: 28px 24px 24px;
          text-align: center;
        }
        .gate-card h2 {
          margin: 0 0 4px;
          font-size: 17px;
        }
        .sub,
        .pin-hint {
          font-size: 13px;
          color: var(--ink-muted);
          margin-bottom: 18px;
        }
        .person-row {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        .person-btn {
          flex: 1;
          padding: 14px 6px;
          border-radius: 10px;
          border: 1px solid var(--line);
          background: var(--surface-2);
          color: var(--ink);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .person-btn:hover {
          border-color: var(--accent);
        }
        .pin-dots {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin: 18px 0;
        }
        .pin-dots span {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 1.5px solid var(--ink-faint);
          display: inline-block;
        }
        .pin-dots span.filled {
          background: var(--accent);
          border-color: var(--accent);
        }
        .pin-error {
          font-size: 12.5px;
          color: #d03b3b;
          min-height: 16px;
          margin-top: 6px;
        }
        .pin-back {
          background: none;
          border: none;
          color: var(--ink-muted);
          font-size: 12.5px;
          cursor: pointer;
          margin-top: 10px;
        }
      `}</style>
    </div>
  );
}
