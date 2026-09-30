import { notFound } from "next/navigation";
import { Card as Panel, Eyebrow, List } from "@/components/ui";
import { env } from "@/lib/env";
import { getCards, getMoodboard, type Direction, type Responses } from "@/lib/moodboard";
import Swiper from "./Swiper";

export default async function MoodboardPage({ params }: PageProps<"/m/[id]">) {
  const { id } = await params;
  const mb = await getMoodboard(id);
  if (!mb || mb.fields.Status === "Draft") notFound();
  const f = mb.fields;
  const cards = await getCards(mb);

  if (f.Status === "Completed" && f["Direction JSON"]) {
    const direction = JSON.parse(f["Direction JSON"]) as Direction;
    const responses = JSON.parse(f["Responses JSON"] ?? "{}") as Responses;
    const favourites = cards
      .filter((c) => responses[c.id]?.rating === "love" || responses[c.id]?.rating === "like")
      .sort((a, b) => (responses[a.id].rating === "love" ? -1 : 1) - (responses[b.id].rating === "love" ? -1 : 1));
    return (
      <div className="space-y-6">
        <div>
          <Eyebrow>Your moodboard · {f.Type}</Eyebrow>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{direction.headline}</h1>
          <p className="mt-3 leading-relaxed">{direction.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {direction.keywords.map((k) => (
              <span key={k} className="rounded-full bg-accent/10 px-3 py-1 text-sm text-accent">
                {k}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {favourites.map((c) => (
            <figure key={c.id} className="relative overflow-hidden rounded-xl border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.imageUrl} alt={c.title} className="aspect-[4/3] w-full object-cover" />
              {responses[c.id].rating === "love" && (
                <span className="absolute right-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-xs">❤️</span>
              )}
            </figure>
          ))}
        </div>

        <Panel>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-medium text-good">You&apos;re drawn to</h2>
              <List items={direction.loves} />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-medium text-bad">We&apos;ll steer clear of</h2>
              <List items={direction.avoid} />
            </div>
          </div>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Colour</dt><dd>{direction.colour}</dd></div>
            <div><dt className="text-muted">Typography</dt><dd>{direction.typography}</dd></div>
            <div><dt className="text-muted">Imagery</dt><dd>{direction.imagery}</dd></div>
            <div><dt className="text-muted">{f.Type === "Branding" ? "Logo & composition" : "Layout"}</dt><dd>{direction.layout}</dd></div>
          </dl>
        </Panel>
        <p className="text-center text-sm text-muted">
          Something not quite right? Tell us in Slack. Your designer uses this as the starting point, not the final word.
        </p>
      </div>
    );
  }

  if (!cards.length) {
    return (
      <Panel>
        <h1 className="text-2xl font-semibold">Your moodboard is being prepared</h1>
        <p className="mt-2 text-sm text-muted">Your designer is still adding references. We&apos;ll let you know in Slack when it&apos;s ready.</p>
      </Panel>
    );
  }

  const firstName = (f["Contact Name"]?.[0] ?? "").split(" ")[0];
  return (
    <Swiper
      id={mb.id}
      type={f.Type ?? "Website"}
      intro={f["Intro Message"] ?? ""}
      firstName={firstName}
      cards={cards}
      submitted={f.Status === "In Progress" || f.Status === "Failed"}
      instantSummary={env.aiMode() === "api"}
    />
  );
}
