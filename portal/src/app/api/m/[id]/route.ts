import { after } from "next/server";
import { emitEvent } from "@/lib/events";
import { getCards, getMoodboard, summarizeMoodboard, updateMoodboard, type Rating, type Responses } from "@/lib/moodboard";

export const maxDuration = 300;

// Polled by the swiper while the AI summary is being written.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mb = await getMoodboard(id);
  if (!mb) return Response.json({ error: "Moodboard not found" }, { status: 404 });
  return Response.json({ status: mb.fields.Status });
}

const RATINGS: Rating[] = ["love", "like", "dislike"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mb = await getMoodboard(id);
  if (!mb || mb.fields.Status === "Draft") return Response.json({ error: "Moodboard not found" }, { status: 404 });
  if (mb.fields.Status === "Completed") return Response.json({ error: "Already submitted, thank you!" }, { status: 409 });

  const body = (await request.json()) as { responses?: Responses; notes?: string };
  const cards = await getCards(mb);
  const known = new Set(cards.map((c) => c.id));
  const responses: Responses = {};
  for (const [itemId, r] of Object.entries(body.responses ?? {})) {
    if (known.has(itemId) && RATINGS.includes(r.rating)) {
      responses[itemId] = { rating: r.rating, ...(r.note?.trim() ? { note: r.note.trim().slice(0, 500) } : {}) };
    }
  }
  if (Object.keys(responses).length < Math.min(5, cards.length)) {
    return Response.json({ error: "Please rate a few more designs first" }, { status: 400 });
  }
  const notes = (body.notes ?? "").slice(0, 5000);
  const ids = (rating: Rating) => Object.keys(responses).filter((k) => responses[k].rating === rating);

  await updateMoodboard(mb.id, {
    Status: "In Progress",
    Loved: ids("love"),
    Liked: ids("like"),
    Disliked: ids("dislike"),
    "Responses JSON": JSON.stringify(responses, null, 2),
    "Client Notes": notes,
  });

  after(async () => {
    const projectId = mb.fields.Project?.[0];
    try {
      const direction = await summarizeMoodboard(mb, cards, responses, notes);
      await updateMoodboard(mb.id, {
        Status: "Completed",
        "Completed At": new Date().toISOString(),
        Summary: `${direction.headline}\n\n${direction.summary}`,
        "Designer Notes": direction.designer_notes.map((n) => `• ${n}`).join("\n"),
        "Direction JSON": JSON.stringify(direction, null, 2),
      });
      if (projectId) {
        await emitEvent("moodboard.completed", {
          projectId,
          moodboardId: mb.id,
          moodboardName: mb.fields.Name,
          counts: { love: ids("love").length, like: ids("like").length, dislike: ids("dislike").length },
          headline: direction.headline,
          keywords: direction.keywords,
          avoid: direction.avoid,
          designerNotes: direction.designer_notes,
          openQuestions: direction.open_questions,
        });
      }
    } catch (err) {
      console.error(`[moodboard] summary failed for ${mb.id}`, err);
      await updateMoodboard(mb.id, { Status: "Failed" });
      if (projectId) {
        await emitEvent("moodboard.failed", { projectId, moodboardId: mb.id, error: err instanceof Error ? err.message : String(err) });
      }
    }
  });

  return Response.json({ ok: true });
}
