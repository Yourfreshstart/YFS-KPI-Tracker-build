"use client";

// A real, tappable on-screen number pad. Earlier PIN screens relied on an
// invisible text input auto-focusing to pop up the phone's keyboard -- that
// trick is unreliable on mobile browsers (iOS Safari in particular won't
// reliably open the keyboard unless focus() happens synchronously inside a
// tap), which is why PIN entry was flaky. This has no dependency on the
// device keyboard at all.

export default function PinPad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  function press(d: string) {
    if (disabled) return;
    if (d === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= 4) return;
    onChange(value + d);
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

  return (
    <div className="pinpad">
      {keys.map((k, i) =>
        k === "" ? (
          <span key={i} />
        ) : (
          <button
            key={i}
            type="button"
            className={"key" + (k === "back" ? " back" : "")}
            disabled={disabled}
            onClick={() => press(k)}
          >
            {k === "back" ? "⌫" : k}
          </button>
        )
      )}
      <style jsx>{`
        .pinpad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 4px;
        }
        .key {
          padding: 16px 0;
          border-radius: 10px;
          border: 1px solid var(--line);
          background: var(--surface-2);
          color: var(--ink);
          font-size: 19px;
          font-weight: 700;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .key:active {
          background: var(--accent-soft);
        }
        .key:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .key.back {
          font-size: 16px;
          color: var(--ink-muted);
        }
      `}</style>
    </div>
  );
}
