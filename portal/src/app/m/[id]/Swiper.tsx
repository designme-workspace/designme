"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, Card as Panel, Eyebrow, inputClass } from "@/components/ui";
import type { Card, Rating, Responses } from "@/lib/moodboard";

type Props = {
  id: string;
  type: string;
  intro: string;
  firstName: string;
  cards: Card[];
  submitted: boolean;
  // false when summaries are written by the Airtable AI automation
  instantSummary: boolean;
};
type Phase = "intro" | "swiping" | "notes" | "waiting" | "received";

const noopSubscribe = () => () => {};

// The draft lives in localStorage, so the swiper only renders in the browser.
export default function Swiper(props: Props) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return isClient ? <SwiperInner {...props} /> : <Panel><p className="text-sm text-muted">Loading…</p></Panel>;
}

type Draft = { responses: Responses; index: number; notes: string };

function loadDraft(key: string): Draft | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null;
  } catch {
    return null;
  }
}

const RATING_LABEL: Record<Rating, string> = { dislike: "Not for me", like: "Like", love: "Love" };

function SwiperInner({ id, type, intro, firstName, cards, submitted, instantSummary }: Props) {
  const router = useRouter();
  const storageKey = `designme-moodboard-${id}`;
  const [draft] = useState(() => loadDraft(storageKey));
  const [responses, setResponses] = useState<Responses>(draft?.responses ?? {});
  const [index, setIndex] = useState(Math.min(draft?.index ?? 0, cards.length));
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [note, setNote] = useState("");
  // "received": answers saved; the summary appears later (airtable mode, or AI timed out).
  const [phase, setPhase] = useState<Phase>(submitted ? (instantSummary ? "waiting" : "received") : draft ? (draft.index >= cards.length ? "notes" : "swiping") : "intro");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState({ x: 0, active: false });
  const start = useRef(0);

  useEffect(() => {
    if (phase === "waiting") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ responses, index, notes }));
    } catch {}
  }, [responses, index, notes, phase, storageKey]);

  const card = cards[index];

  const rate = useCallback(
    (rating: Rating) => {
      if (!card) return;
      setResponses((r) => ({ ...r, [card.id]: { rating, ...(note.trim() ? { note: note.trim() } : {}) } }));
      setNote("");
      setDrag({ x: 0, active: false });
      const next = index + 1;
      setIndex(next);
      if (next >= cards.length) setPhase("notes");
    },
    [card, note, index, cards.length],
  );

  const undo = useCallback(() => {
    if (index === 0) return;
    const prev = cards[index - 1];
    const { [prev.id]: removed, ...rest } = responses;
    setResponses(rest);
    setNote(removed?.note ?? "");
    setIndex(index - 1);
    setPhase("swiping");
  }, [index, cards, responses]);

  useEffect(() => {
    if (phase !== "swiping") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") rate("dislike");
      if (e.key === "ArrowUp") rate("like");
      if (e.key === "ArrowRight") rate("love");
      if (e.key === "Backspace") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, rate, undo]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const started = Date.now();
    const timer = setInterval(async () => {
      const res = await fetch(`/api/m/${id}`, { cache: "no-store" }).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { status?: string }) : {};
      if (data.status === "Completed") {
        clearInterval(timer);
        router.refresh();
      } else if (data.status === "Failed" || Date.now() - started > 4 * 60_000) {
        clearInterval(timer);
        setPhase("received");
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [phase, id, router]);

  async function submit() {
    setError("");
    const res = await fetch(`/api/m/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses, notes }),
    });
    if (res.ok) {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      setPhase(instantSummary ? "waiting" : "received");
    } else {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong. Please try again.");
    }
  }

  if (phase === "intro") {
    return (
      <div className="space-y-6">
        <div>
          <Eyebrow>Moodboard · {type}</Eyebrow>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{firstName ? `${firstName}, what` : "What"} catches your eye?</h1>
          <p className="mt-3 leading-relaxed text-muted">
            You&apos;ll see {cards.length} design references. Go with your gut. Tell us if you <strong>love</strong> it,{" "}
            <strong>like</strong> it, or it&apos;s <strong>not for you</strong>. Add a quick note whenever something
            really stands out. It takes about 5 minutes, and we&apos;ll turn your picks into a written direction for
            your designer.
          </p>
        </div>
        {intro && (
          <Panel>
            <p className="text-sm font-medium">A note from your designer</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted">{intro}</p>
          </Panel>
        )}
        <Button onClick={() => setPhase("swiping")}>Start →</Button>
        <p className="text-xs text-muted">Tip: on a keyboard use ← not for me, ↑ like, → love. On mobile, swipe left or right.</p>
      </div>
    );
  }

  if (phase === "waiting" || phase === "received") {
    return (
      <Panel className="text-center">
        {phase === "waiting" ? (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <h2 className="text-xl font-semibold">Reading your picks…</h2>
            <p className="mt-2 text-sm text-muted">We&apos;re turning your choices into a written design direction. This takes about a minute.</p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">Thanks, we&apos;ve got your picks! 🎉</h2>
            <p className="mt-2 text-sm text-muted">
              We&apos;re turning your picks into a written design direction. It will appear on this page and in your project hub
              within a few minutes, and your designer will share it with you in Slack.
            </p>
          </>
        )}
      </Panel>
    );
  }

  if (phase === "notes") {
    const count = (r: Rating) => Object.values(responses).filter((x) => x.rating === r).length;
    return (
      <div className="space-y-6">
        <div>
          <Eyebrow>Almost done</Eyebrow>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Anything else we should know?</h1>
          <p className="mt-2 text-sm text-muted">
            You loved {count("love")}, liked {count("like")} and passed on {count("dislike")}.
          </p>
        </div>
        <Panel>
          <textarea
            className={`${inputClass} min-h-32`}
            placeholder="e.g. brands you admire, colours to avoid, a feeling you want people to have…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error && <p className="mt-3 text-sm text-bad">{error}</p>}
          <div className="mt-4 flex justify-between">
            <Button variant="secondary" onClick={undo}>← Back</Button>
            <Button onClick={submit}>See my summary</Button>
          </div>
        </Panel>
      </div>
    );
  }

  const sectionCards = cards.filter((c) => c.category === card.category);
  const sectionIndex = sectionCards.indexOf(card) + 1;
  const hint: Rating | null = drag.x > 60 ? "love" : drag.x < -60 ? "dislike" : null;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <div className="mb-2 flex justify-between text-xs text-muted">
          <span className="font-medium text-accent">
            {card.category} · {sectionIndex} of {sectionCards.length}
          </span>
          <span>
            {index + 1} / {cards.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-border">
          <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${(index / cards.length) * 100}%` }} />
        </div>
      </div>

      <div
        className="relative touch-pan-y select-none overflow-hidden rounded-2xl border border-border bg-surface"
        style={{
          transform: `translateX(${drag.x}px) rotate(${drag.x / 30}deg)`,
          transition: drag.active ? "none" : "transform 0.2s",
        }}
        onPointerDown={(e) => {
          start.current = e.clientX;
          setDrag({ x: 0, active: true });
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => drag.active && setDrag({ x: e.clientX - start.current, active: true })}
        onPointerUp={() => {
          if (drag.x > 120) rate("love");
          else if (drag.x < -120) rate("dislike");
          else setDrag({ x: 0, active: false });
        }}
        onPointerCancel={() => setDrag({ x: 0, active: false })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.imageUrl} alt={card.title} draggable={false} className="aspect-[4/3] w-full bg-background object-contain" />
        {hint && (
          <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-sm font-semibold text-white ${hint === "love" ? "bg-good" : "bg-bad"}`}>
            {RATING_LABEL[hint]}
          </span>
        )}
      </div>

      <input className={inputClass} placeholder="Why? (optional, e.g. love the big bold type)" value={note} onChange={(e) => setNote(e.target.value)} />

      <div className="grid grid-cols-3 gap-3">
        <Button variant="secondary" onClick={() => rate("dislike")}>👎 Not for me</Button>
        <Button variant="secondary" onClick={() => rate("like")}>👍 Like</Button>
        <Button onClick={() => rate("love")}>❤️ Love</Button>
      </div>
      <div className="text-center">
        <button type="button" onClick={undo} disabled={index === 0} className="text-xs text-muted underline disabled:opacity-40">
          Undo last
        </button>
      </div>
    </div>
  );
}
