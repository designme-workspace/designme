"use client";

import { useState } from "react";
import { Button, Card, inputClass } from "@/components/ui";

export default function BriefActions({ token }: { token: string }) {
  const [mode, setMode] = useState<"choose" | "changes">("choose");
  const [name, setName] = useState("");
  const [feedback, setFeedback] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "approved" | "changes" | "error">("idle");
  const [error, setError] = useState("");

  async function send(action: "approve" | "request_changes") {
    setState("sending");
    const res = await fetch(`/api/p/${token}/brief`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, feedback, name }),
    });
    if (res.ok) setState(action === "approve" ? "approved" : "changes");
    else {
      setState("error");
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong.");
    }
  }

  if (state === "approved") return <Card><p className="font-medium text-good">✓ Brief approved, thank you! We&apos;ll confirm the kickoff in Slack.</p></Card>;
  if (state === "changes") return <Card><p className="font-medium">Got it. We&apos;ll update the brief and share a new version within 1 business day.</p></Card>;

  return (
    <Card className="border-accent/40">
      <h2 className="font-semibold">Does this capture everything?</h2>
      <p className="mt-1 text-sm text-muted">
        Approving the brief locks in goals, scope and how we&apos;ll work together, so there are no surprises later.
      </p>
      <input className={`${inputClass} mt-4`} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      {mode === "changes" && (
        <textarea
          className={`${inputClass} mt-3 min-h-28`}
          placeholder="What should we change, add or remove?"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      )}
      {state === "error" && <p className="mt-3 text-sm text-bad">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        {mode === "choose" ? (
          <>
            <Button onClick={() => send("approve")} disabled={!name.trim() || state === "sending"}>Approve brief</Button>
            <Button variant="secondary" onClick={() => setMode("changes")}>Request changes</Button>
          </>
        ) : (
          <>
            <Button onClick={() => send("request_changes")} disabled={!name.trim() || !feedback.trim() || state === "sending"}>Send feedback</Button>
            <Button variant="secondary" onClick={() => setMode("choose")}>Cancel</Button>
          </>
        )}
      </div>
    </Card>
  );
}
