import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { answersAsText, sectionsFor, type Answers } from "./questions";
import type { Project } from "./projects";
import { standardsAsText } from "./standards";

export const BriefSchema = z.object({
  project_title: z.string(),
  executive_summary: z.string().describe("3-5 sentences in plain English, written to the client."),
  client_snapshot: z.object({
    company: z.string(),
    audience: z.string(),
    positioning: z.string(),
  }),
  objectives: z.array(z.object({ objective: z.string(), success_metric: z.string() })),
  scope: z.object({
    in_scope: z.array(z.string()),
    out_of_scope: z.array(z.string()),
    assumptions: z.array(z.string()),
  }),
  deliverables: z.array(z.object({ name: z.string(), description: z.string(), service: z.string() })),
  phases: z.array(
    z.object({
      name: z.string(),
      timing: z.string().describe("Relative timing, e.g. 'Week 1-2'. Never invent calendar dates."),
      goal: z.string(),
      activities: z.array(z.string()),
      client_inputs: z.array(z.string()).describe("What we need from the client in this phase."),
      approval_gate: z.string().describe("What the client signs off to close this phase."),
    }),
  ),
  design_direction: z.object({
    feel_words: z.array(z.string()),
    visual_direction: z.string(),
    references: z.string(),
  }),
  dos: z.array(z.string()),
  donts: z.array(z.string()),
  client_responsibilities: z.array(z.string()),
  agency_commitments: z.array(z.string()),
  communication_plan: z.object({
    channels: z.string(),
    cadence: z.string(),
    feedback_turnaround: z.string(),
    decision_maker: z.string(),
  }),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })),
  open_questions: z.array(z.string()).describe("Questions to resolve at the kickoff call."),
  internal: z
    .object({
      expectation_gaps: z
        .array(z.string())
        .describe("Where the client's answers ask for more, or something different, than the proposal covers."),
      team_watchouts: z.array(z.string()),
      suggested_upsells: z.array(z.string()),
    })
    .describe("For the DesignMe team only. Never shown to the client."),
});

export type Brief = z.infer<typeof BriefSchema>;

const SYSTEM = `You are the senior project strategist at DesignMe, a design agency doing website design and development, branding, and product (UI/UX) design.

You turn a signed proposal plus the client's onboarding answers into a Project Brief. The brief is shared with the client and becomes the single source of truth for the team, so it must remove ambiguity between what the client expects and what we will deliver.

Rules:
- The proposal defines scope. If the client's answers ask for things the proposal does not cover, do not silently add them to scope. List them in out_of_scope where relevant (client-facing, phrased kindly, e.g. "Copywriting. Can be added as a separate scope.") and in internal.expectation_gaps (blunt, for the team).
- Be specific to this client. Quote their words where it helps. No generic agency filler.
- Do's and don'ts are concrete design and working instructions for our designers, drawn from what the client said (e.g. "Don't use stock photography of people shaking hands; they called it cliché").
- Phases follow our process: Discovery, Moodboard, Design, (Development if in scope), Revisions, Handover. Adapt names and activities to the services in scope. Use relative timing only. Never invent calendar dates or durations that contradict the proposal.
- Where information is missing or contradictory, add it to open_questions instead of guessing.
- Client-facing text is warm, confident, plain English, and uses "we" for DesignMe and "you" for the client.
- If the team left internal notes, they override everything else.`;

export async function generateBrief(project: Project): Promise<Brief> {
  const f = project.fields;
  const answers: Answers = f["Onboarding Answers"] ? JSON.parse(f["Onboarding Answers"]) : {};
  const sections = sectionsFor(f["Service Type"]);

  const prompt = `# Project
Name: ${f["Project Name"] ?? "Untitled"}
Services: ${(f["Service Type"] ?? []).join(", ") || "Not specified"}
Target delivery date: ${f["Target Delivery Date"] ?? "Not set"}

# Signed proposal / scope of work
${f["Proposal Scope"]?.trim() || "(No proposal pasted yet. Treat scope as unconfirmed and flag this in internal.team_watchouts.)"}

# Client onboarding answers
${answersAsText(sections, answers)}

# DesignMe operating standards (use these in the communication plan and agency commitments)
${standardsAsText()}
${f["Brief Internal Notes"]?.trim() ? `\n# Internal notes from the DesignMe team (highest priority)\n${f["Brief Internal Notes"]}` : ""}

Write the Project Brief.`;

  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(BriefSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") throw new Error("Brief generation was declined by the model");
  if (response.stop_reason === "max_tokens") throw new Error("Brief generation ran out of tokens");
  if (!response.parsed_output) throw new Error("Brief generation returned no parseable output");
  return response.parsed_output;
}

export function briefSummary(brief: Brief): string {
  return [
    brief.executive_summary,
    "",
    "Objectives:",
    ...brief.objectives.map((o) => `• ${o.objective} (${o.success_metric})`),
    "",
    brief.internal.expectation_gaps.length ? "⚠️ Expectation gaps:" : "",
    ...brief.internal.expectation_gaps.map((g) => `• ${g}`),
    "",
    brief.open_questions.length ? "Open questions for kickoff:" : "",
    ...brief.open_questions.map((q) => `• ${q}`),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
