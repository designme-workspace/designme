import { after } from "next/server";
import { runBriefJob } from "@/lib/brief-job";
import { env } from "@/lib/env";

export const maxDuration = 300;

// (Re)generates a project's brief, e.g. after the PM adds Brief Internal Notes
// or the client requests changes. Called by n8n or an Airtable button.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("x-api-key") !== env.internalApiKey()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!/^rec[A-Za-z0-9]{14}$/.test(id)) return Response.json({ error: "Invalid record id" }, { status: 400 });
  after(() => runBriefJob(id));
  return Response.json({ ok: true, status: "Generating" }, { status: 202 });
}

// Same as POST, for the "Regenerate Brief Link" button in Airtable: ?key=<TEAM_KEY>.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teamKey = process.env.TEAM_KEY;
  if (!teamKey || new URL(request.url).searchParams.get("key") !== teamKey) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  if (!/^rec[A-Za-z0-9]{14}$/.test(id)) return new Response("Invalid record id", { status: 400 });
  after(() => runBriefJob(id));
  return new Response(
    env.aiMode() === "airtable"
      ? "<p style='font-family:sans-serif'>Queued. The brief will be rewritten with your internal notes by Airtable AI in a few minutes, and the team will get a Slack message when it's ready. You can close this tab.</p>"
      : "<p style='font-family:sans-serif'>Regenerating the brief with your internal notes. The team will get a Slack message when it's ready (about 2 minutes). You can close this tab.</p>",
    { headers: { "Content-Type": "text/html" } },
  );
}
