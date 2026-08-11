"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import PinPad from "@/components/PinPad";

export default function CeoPinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleChange(digits: string) {
    setPin(digits);
    setError("");
    if (digits.length === 4) {
      setChecking(true);
      const { data, error: rpcError } = await supabase.rpc("verify_pin", {
        input_name: "Teather",
        input_pin: digits,
      });
      setChecking(false);
      if (rpcError || !data || data.length === 0) {
        setError("Incorrect PIN, try again");
        setPin("");
        return;
      }
      onUnlock();
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <Logo height={48} />
        <h2>CEO Dashboard</h2>
        <div className="sub">Enter the 4-digit PIN</div>
        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < pin.length ? "filled" : ""} />
          ))}
        </div>
        <PinPad value={pin} onChange={handleChange} disabled={checking} />
        <div className="pin-error">{error}</div>
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
        .gate-card :global(svg) {
          margin: 0 auto 14px;
        }
        h2 {
          margin: 0 0 4px;
          font-size: 17px;
        }
        .sub {
          font-size: 13px;
          color: var(--ink-muted);
          margin-bottom: 18px;
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
      `}</style>
    </div>
  );
}
