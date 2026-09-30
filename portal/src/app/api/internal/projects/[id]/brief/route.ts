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
