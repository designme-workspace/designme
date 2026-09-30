"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, Card, inputClass } from "@/components/ui";
import type { Answers, Question, Section } from "@/lib/questions";

function Field({ q, value, onChange }: { q: Question; value: Answers[string] | undefined; onChange: (v: Answers[string]) => void }) {
  switch (q.type) {
    case "textarea":
      return <textarea className={`${inputClass} min-h-28`} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={q.placeholder} />;
    case "select":
      return (
        <div className="flex flex-wrap gap-2">
          {q.options.map((o) => (
            <button
              type="button"
              key={o}
              onClick={() => onChange(o)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${value === o ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent"}`}
            >
              {o}
            </button>
          ))}
        </div>
      );
    case "multiselect": {
      const selected = (value as string[] | undefined) ?? [];
      return (
        <div className="flex flex-wrap gap-2">
          {q.options.map((o) => {
            const on = selected.includes(o);
            return (
              <button
                type="button"
                key={o}
                onClick={() => onChange(on ? selected.filter((s) => s !== o) : [...selected, o])}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition ${on ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent"}`}
              >
                {on ? "✓ " : ""}
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    case "scale":
      return (
        <div className="flex items-center gap-3 text-sm">
          <span className="w-24 text-right text-muted">{q.left}</span>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                aria-label={`${n} of 5`}
                onClick={() => onChange(n)}
                className={`h-8 w-8 rounded-full border transition ${value === n ? "border-accent bg-accent" : "border-border hover:border-accent"}`}
              />
            ))}
          </div>
          <span className="w-24 text-muted">{q.right}</span>
        </div>
      );
    default:
      return <input type={q.type} className={inputClass} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={q.placeholder} />;
  }
}

const isEmpty = (v: Answers[string] | undefined) => v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

type Props = { token: string; sections: Section[]; initial: Answers };

const noopSubscribe = () => () => {};

// The draft lives in localStorage, so the form only renders in the browser.
export default function OnboardingForm(props: Props) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return isClient ? <Form {...props} /> : <Card><p className="text-sm text-muted">Loading…</p></Card>;
}

function loadDraft(storageKey: string): Answers {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Answers;
  } catch {
    return {};
  }
}

function Form({ token, sections, initial }: Props) {
  const storageKey = `designme-onboarding-${token}`;
  const [answers, setAnswers] = useState<Answers>(() => ({ ...initial, ...loadDraft(storageKey) }));
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch {}
  }, [answers, storageKey]);

  const section = sections[step];
  const missing = section.questions.filter((q) => q.required && isEmpty(answers[q.id])).map((q) => q.id);
  const isLast = step === sections.length - 1;

  async function next() {
    if (missing.length) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (!isLast) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setStatus("submitting");
    const res = await fetch(`/api/p/${token}/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    if (res.ok) {
      setStatus("done");
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    } else {
      setStatus("error");
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong. Please try again.");
    }
  }

  if (status === "done") {
    return (
      <Card>
        <h2 className="text-2xl font-semibold">Thank you! 🎉</h2>
        <p className="mt-2 text-sm text-muted">
          Your answers are with the team. We&apos;re turning them into your project brief (goals, scope, timeline and how
          we&apos;ll work together). You&apos;ll get it to review within 1 business day.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-6">
        <div className="mb-2 flex justify-between text-xs text-muted">
          <span>
            Step {step + 1} of {sections.length}
          </span>
          <span>{section.title}</span>
        </div>
        <div className="h-1.5 rounded-full bg-border">
          <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / sections.length) * 100}%` }} />
        </div>
      </div>

      <h2 className="text-xl font-semibold">{section.title}</h2>
      {section.intro && <p className="mt-1 text-sm text-muted">{section.intro}</p>}

      <div className="mt-6 space-y-6">
        {section.questions.map((q) => (
          <div key={q.id}>
            <label className="mb-2 block text-sm font-medium">
              {q.label}
              {q.required && <span className="text-accent"> *</span>}
            </label>
            {q.help && <p className="-mt-1 mb-2 text-xs text-muted">{q.help}</p>}
            <Field q={q} value={answers[q.id]} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
            {showErrors && missing.includes(q.id) && <p className="mt-1 text-xs text-bad">Please answer this one.</p>}
          </div>
        ))}
      </div>

      {status === "error" && <p className="mt-6 text-sm text-bad">{error}</p>}

      <div className="mt-8 flex justify-between">
        <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={step === 0}>
          ← Back
        </Button>
        <Button onClick={next} disabled={status === "submitting"}>
          {isLast ? (status === "submitting" ? "Submitting…" : "Submit") : "Continue →"}
        </Button>
      </div>
    </Card>
  );
}
