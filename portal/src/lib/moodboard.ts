import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { TABLES, getRecord, isRecordId, listRecords, updateRecord, type AirtableRecord } from "./airtable";

export type MoodboardType = "Website" | "Branding" | "Product / UI-UX";
export type Rating = "love" | "like" | "dislike";
export type Responses = Record<string, { rating: Rating; note?: string }>;

type Attachment = { url: string; thumbnails?: { large?: { url: string } } };

type LibraryFields = {
  Title?: string;
  Image?: Attachment[];
  "Service Type"?: MoodboardType[];
  Category?: string;
  "Style Tags"?: string[];
  Description?: string;
  Active?: boolean;
  Project?: string[];
};

export type MoodboardFields = {
  Name?: string;
  Project?: string[];
  Type?: MoodboardType;
  Status?: "Draft" | "Sent" | "In Progress" | "Completed" | "Failed";
  Items?: string[];
  "Intro Message"?: string;
  Loved?: string[];
  Liked?: string[];
  Disliked?: string[];
  "Responses JSON"?: string;
  "Client Notes"?: string;
  Summary?: string;
  "Designer Notes"?: string;
  "Direction JSON"?: string;
  "Completed At"?: string;
  "Contact Name"?: string[];
};

export type Moodboard = AirtableRecord<MoodboardFields>;

export type Card = {
  id: string;
  title: string;
  imageUrl: string;
  category: string;
  tags: string[];
  description: string;
};

// The order sections appear in for each moodboard type.
const CATEGORY_ORDER: Record<MoodboardType, string[]> = {
  Website: ["Hero Sections", "Layout & Structure", "Typography", "Colour", "Imagery & Photography", "Illustration & 3D", "Interaction & Motion"],
  Branding: ["Logo Style", "Typography", "Colour", "Imagery & Photography", "Patterns & Graphics", "Brand Applications"],
  "Product / UI-UX": ["Dashboards & Data", "Navigation", "Components", "Mobile", "Onboarding Flows", "Density & Spacing", "Colour", "Typography"],
};

const MAX_CARDS = 60;

export async function getMoodboard(id: string): Promise<Moodboard | null> {
  if (!isRecordId(id)) return null;
  try {
    return await getRecord<MoodboardFields>(TABLES.moodboards, id);
  } catch {
    return null;
  }
}

export function updateMoodboard(id: string, fields: MoodboardFields) {
  return updateRecord<MoodboardFields>(TABLES.moodboards, id, fields);
}

function toCard(r: AirtableRecord<LibraryFields>): Card | null {
  const image = r.fields.Image?.[0];
  if (!image) return null;
  return {
    id: r.id,
    title: r.fields.Title ?? "",
    imageUrl: image.thumbnails?.large?.url ?? image.url,
    category: r.fields.Category ?? "Other",
    tags: r.fields["Style Tags"] ?? [],
    description: r.fields.Description ?? "",
  };
}

// Hand-picked items if the team chose any; otherwise the shared library for
// this type plus references linked to this client's project.
export async function getCards(mb: Moodboard): Promise<Card[]> {
  const type = mb.fields.Type ?? "Website";
  const projectId = mb.fields.Project?.[0];
  let records: AirtableRecord<LibraryFields>[];
  if (mb.fields.Items?.length) {
    const ids = mb.fields.Items.filter(isRecordId);
    records = await listRecords<LibraryFields>(TABLES.moodboardLibrary, `OR(${ids.map((id) => `RECORD_ID()='${id}'`).join(",")})`);
    const order = new Map(ids.map((id, i) => [id, i]));
    records.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  } else {
    records = await listRecords<LibraryFields>(TABLES.moodboardLibrary, `AND({Active}, FIND('${type}', ARRAYJOIN({Service Type})))`);
    records = records.filter((r) => !r.fields.Project?.length || (projectId && r.fields.Project.includes(projectId)));
    const order = CATEGORY_ORDER[type];
    const rank = (c?: string) => (c && order.includes(c) ? order.indexOf(c) : order.length);
    records.sort((a, b) => rank(a.fields.Category) - rank(b.fields.Category));
  }
  return records.map(toCard).filter((c): c is Card => c !== null).slice(0, MAX_CARDS);
}

export const DirectionSchema = z.object({
  headline: z.string().describe("One short line capturing their taste, e.g. 'Calm, editorial and quietly premium'."),
  summary: z.string().describe("3-5 sentences to the client, in plain English, about what they are drawn to and why."),
  keywords: z.array(z.string()).describe("5-8 style keywords."),
  loves: z.array(z.string()).describe("Specific patterns they responded well to."),
  avoid: z.array(z.string()).describe("Specific patterns they rejected."),
  colour: z.string(),
  typography: z.string(),
  imagery: z.string(),
  layout: z.string().describe("Layout, composition and density (or logo construction for branding)."),
  designer_notes: z.array(z.string()).describe("Internal, concrete instructions for the designer. Never shown to the client."),
  open_questions: z.array(z.string()).describe("Contradictions or gaps to clarify with the client."),
});

export type Direction = z.infer<typeof DirectionSchema>;

const SYSTEM = `You are the design director at DesignMe, a design agency. A client just went through a moodboard, rating design references as "love", "like" or "not for me", sometimes with a note.

Look carefully at the images themselves, not only the labels. Find the patterns across what they loved versus rejected: colour, contrast, typography, imagery, layout density, tone, craft details. Their written notes outrank your visual inferences. Be specific ("high-contrast serif headlines on warm off-white", not "clean and modern"). Where their choices contradict each other, say so in open_questions rather than papering over it.

Client-facing fields are warm and plain English, addressed to the client as "you". designer_notes are blunt, actionable instructions for the designer.`;

export async function summarizeMoodboard(mb: Moodboard, cards: Card[], responses: Responses, notes: string): Promise<Direction> {
  const byRating = (r: Rating) => cards.filter((c) => responses[c.id]?.rating === r);
  const groups: [string, Card[]][] = [
    ["LOVED", byRating("love")],
    ["LIKED", byRating("like")],
    ["NOT FOR ME", byRating("dislike")],
  ];

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    {
      type: "text",
      text: `Moodboard type: ${mb.fields.Type ?? "Website"}\nThe client rated ${Object.keys(responses).length} of ${cards.length} references. Each image below is labelled with its rating, category, our tags and any note the client wrote.`,
    },
  ];
  for (const [label, group] of groups) {
    for (const c of group.slice(0, 15)) {
      const note = responses[c.id]?.note;
      content.push({
        type: "text",
        text: `[${label}] ${c.category}: ${c.title}${c.tags.length ? ` (tags: ${c.tags.join(", ")})` : ""}${c.description ? ` · ${c.description}` : ""}${note ? `\nClient note: "${note}"` : ""}`,
      });
      content.push({ type: "image", source: { type: "url", url: c.imageUrl } });
    }
  }
  content.push({ type: "text", text: `Client's closing notes: ${notes.trim() || "(none)"}\n\nWrite the moodboard direction.` });

  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(DirectionSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new Error("Moodboard summary was declined by the model");
  if (response.stop_reason === "max_tokens") throw new Error("Moodboard summary ran out of tokens");
  if (!response.parsed_output) throw new Error("Moodboard summary returned no parseable output");
  return response.parsed_output;
}
