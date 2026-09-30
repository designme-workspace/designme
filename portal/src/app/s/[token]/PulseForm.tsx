"use client";

import { useState } from "react";
import { Button, Card, inputClass } from "@/components/ui";

const EXPECTATIONS = ["Exceeded", "Met", "Partly", "Not met"] as const;

function Stars({ label, value, onChange }: { label: string; value?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n} of 5`}
            onClick={() => onChange(n)}
            className={`text-2xl leading-none transition ${value && n <= value ? "text-warn" : "text-border hover:text-warn/60"}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PulseForm({ token, askTestimonial }: { token: string; askTestimonial: boolean }) {
  const [nps, setNps] = useState<number>();
  const [ratings, setRatings] = useState<{ Communication?: number; Quality?: number; Timeliness?: number }>({});
  const [expectations, setExpectations] = useState<(typeof EXPECTATIONS)[number]>();
  const [goingWell, setGoingWell] = useState("");
  const [improve, setImprove] = useState("");
  const [testimonial, setTestimonial] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit() {
    setState("sending");
    const res = await fetch(`/api/s/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        NPS: nps,
        ...ratings,
        "Expectations Met": expectations,
        "Going Well": goingWell,
        "Could Improve": improve,
        "Open To Testimonial": testimonial,
      }),
    });
    if (res.ok) setState("done");
    else {
      setState("error");
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong.");
    }
  }

  if (state === "done") {
    return (
      <Card>
        <h2 className="text-2xl font-semibold">Thank you! 🙏</h2>
        <p className="mt-2 text-sm text-muted">
          {nps !== undefined && nps <= 6
            ? "We're sorry we've fallen short. Someone senior from our team will reach out within 1 business day to make it right."
            : "Your feedback goes straight to the team working on your project."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-8">
      <div>
        <p className="mb-3 text-sm font-medium">How likely are you to recommend DesignMe to a friend or colleague?</p>
        <div className="grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNps(n)}
              className={`rounded-lg border py-2 text-sm transition ${nps === n ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>Not likely</span>
          <span>Extremely likely</span>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Rate us on…</p>
        {(["Communication", "Quality", "Timeliness"] as const).map((k) => (
          <Stars key={k} label={k} value={ratings[k]} onChange={(v) => setRatings({ ...ratings, [k]: v })} />
        ))}
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">So far, has the work matched what you expected?</p>
        <div className="flex flex-wrap gap-2">
          {EXPECTATIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setExpectations(e)}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${expectations === e ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent"}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">What&apos;s going well?</label>
        <textarea className={`${inputClass} min-h-20`} value={goingWell} onChange={(e) => setGoingWell(e.target.value)} />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">What could we do better?</label>
        <textarea className={`${inputClass} min-h-20`} value={improve} onChange={(e) => setImprove(e.target.value)} />
      </div>

      {askTestimonial && (
        <label className="flex items-start gap-3 rounded-xl bg-accent/5 p-4 text-sm">
          <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={testimonial} onChange={(e) => setTestimonial(e.target.checked)} />
          <span>
            I&apos;d be happy to share a short testimonial and a Clutch review.{" "}
            <span className="text-muted">As a thank-you, we give $1,000 of design time (10–15 hours) to use on anything you like.</span>
          </span>
        </label>
      )}

      {state === "error" && <p className="text-sm text-bad">{error}</p>}
      <Button onClick={submit} disabled={nps === undefined || state === "sending"}>
        {state === "sending" ? "Sending…" : "Send feedback"}
      </Button>
    </Card>
  );
}
