"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { toDateStr } from "@/lib/weeks";

// Public, no PIN -- meant to be opened on a tech's own phone (or passed
// around on one device) right before a company meeting. Name comes from
// rge_roster, which the Payroll tool keeps in sync automatically every
// time it's run -- nothing here needs manual upkeep for new hires or
// turnover. Submitting again the same day replaces that day's answer
// (upsert on respondent_name + survey_date), it doesn't create a
// duplicate -- so two techs submitting at the same moment can never
// collide with each other, and one tech fixing a mistake just overwrites
// their own answer.

const FIVE = [1, 2, 3, 4, 5];
const TEN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function ScaleField({
  label,
  scale,
  value,
  onChange,
}: {
  label: string;
  scale: number[];
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="scale">
        {scale.map((n) => (
          <button key={n} type="button" className={value === n ? "on" : ""} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <style jsx>{`
        .field {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        label {
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
          line-height: 1.35;
        }
        .scale {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        button {
          flex: 1;
          min-width: 30px;
          padding: 10px 0;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--ink-muted);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        button.on {
          background: var(--accent);
          border-color: var(--accent);
          color: var(--accent-ink);
        }
      `}</style>
    </div>
  );
}

type Answers = {
  happiness: number | null;
  leadership_support: number | null;
  job_manageability: number | null;
  likelihood_to_stay: number | null;
  likelihood_to_recommend: number | null;
  feedback_text: string;
};

const EMPTY: Answers = {
  happiness: null,
  leadership_support: null,
  job_manageability: null,
  likelihood_to_stay: null,
  likelihood_to_recommend: null,
  feedback_text: "",
};

export default function PulseSurveyPage() {
  const [roster, setRoster] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("rge_roster").select("name").order("name");
      setRoster((data || []).map((r: { name: string }) => r.name));
    })();
  }, []);

  const complete =
    name &&
    answers.happiness !== null &&
    answers.leadership_support !== null &&
    answers.job_manageability !== null &&
    answers.likelihood_to_stay !== null &&
    answers.likelihood_to_recommend !== null;

  async function submit() {
    if (!complete) return;
    setSubmitting(true);
    setError("");
    const { error: err } = await supabase.from("pulse_responses").upsert(
      {
        respondent_name: name,
        survey_date: toDateStr(new Date()),
        happiness: answers.happiness,
        leadership_support: answers.leadership_support,
        job_manageability: answers.job_manageability,
        likelihood_to_stay: answers.likelihood_to_stay,
        likelihood_to_recommend: answers.likelihood_to_recommend,
        feedback_text: answers.feedback_text.trim() || null,
      },
      { onConflict: "respondent_name,survey_date" }
    );
    setSubmitting(false);
    if (err) {
      setError("Something went wrong — try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="wrap">
        <div className="card done">
          <Logo height={40} />
          <h2>Thanks, {name}!</h2>
          <p>Your answers are in.</p>
          <button
            className="again"
            onClick={() => {
              setDone(false);
              setName("");
              setAnswers(EMPTY);
            }}
          >
            Submit for someone else
          </button>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="card">
        <Logo height={40} />
        <h1>Employee Pulse</h1>
        <p className="sub">Quick check-in before the meeting. Your name is attached to your answers.</p>

        <div className="field">
          <label>Your name</label>
          <select value={name} onChange={(e) => setName(e.target.value)}>
            <option value="">Choose your name…</option>
            {roster.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <ScaleField
          label="How happy are you at work? (1 = not at all, 5 = very)"
          scale={FIVE}
          value={answers.happiness}
          onChange={(n) => setAnswers((a) => ({ ...a, happiness: n }))}
        />
        <ScaleField
          label="How supported do you feel by leadership/the office? (1–5)"
          scale={FIVE}
          value={answers.leadership_support}
          onChange={(n) => setAnswers((a) => ({ ...a, leadership_support: n }))}
        />
        <ScaleField
          label="How manageable is your workload right now? (1–5)"
          scale={FIVE}
          value={answers.job_manageability}
          onChange={(n) => setAnswers((a) => ({ ...a, job_manageability: n }))}
        />
        <ScaleField
          label="How likely are you to still be here in a year? (1–5)"
          scale={FIVE}
          value={answers.likelihood_to_stay}
          onChange={(n) => setAnswers((a) => ({ ...a, likelihood_to_stay: n }))}
        />
        <ScaleField
          label="How likely are you to recommend Your Fresh Start as a place to work? (0–10)"
          scale={TEN}
          value={answers.likelihood_to_recommend}
          onChange={(n) => setAnswers((a) => ({ ...a, likelihood_to_recommend: n }))}
        />

        <div className="field">
          <label>What could we do to make working here better? (optional)</label>
          <textarea
            value={answers.feedback_text}
            onChange={(e) => setAnswers((a) => ({ ...a, feedback_text: e.target.value }))}
            placeholder="Anything you want us to know…"
            rows={4}
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button className="submit" disabled={!complete || submitting} onClick={submit}>
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .wrap {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    justify-content: center;
    padding: 24px 16px 60px;
  }
  .card {
    width: 100%;
    max-width: 440px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 24px 20px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  h1 {
    margin: 0;
    font-size: 20px;
  }
  h2 {
    margin: 0;
  }
  .sub {
    margin: -12px 0 0;
    font-size: 13.5px;
    color: var(--ink-muted);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  label {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-muted);
  }
  select {
    padding: 11px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--ink);
    font-size: 15px;
  }
  textarea {
    padding: 11px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--ink);
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
  }
  .error {
    color: var(--status-critical);
    font-size: 13px;
    font-weight: 600;
  }
  .submit {
    padding: 14px;
    border-radius: 10px;
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
  }
  .submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .done {
    align-items: center;
    text-align: center;
  }
  .again {
    padding: 10px 16px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--ink-muted);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
`;
