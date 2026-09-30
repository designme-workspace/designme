import { emitEvent } from "@/lib/events";
import { getProjectByToken, updateProject } from "@/lib/projects";

type Body = { action: "approve" | "request_changes"; feedback?: string; name?: string };

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const project = await getProjectByToken(token);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (project.fields["Brief Status"] !== "Shared with Client") {
    return Response.json({ error: "This brief is not awaiting your review" }, { status: 409 });
  }

  const { action, feedback, name } = (await request.json()) as Body;
  const stamp = `${new Date().toISOString().slice(0, 10)}${name ? ` (${name})` : ""}`;
  const history = project.fields["Brief Client Feedback"] ?? "";
  const common = {
    projectId: project.id,
    projectName: project.fields["Project Name"],
    slackIntChannel: project.fields["Slack INT Channel"],
    slackExtChannel: project.fields["Slack EXT Channel"],
  };

  if (action === "approve") {
    await updateProject(project.id, {
      "Brief Status": "Client Approved",
      "Brief Approved At": new Date().toISOString(),
      Stage: "4. Brief Approved",
      "Brief Client Feedback": `${history}\n[${stamp}] Approved${feedback ? `: ${feedback}` : ""}`.trim(),
    });
    await emitEvent("brief.approved", { ...common, approvedBy: name, kickoffDate: project.fields["Kickoff Date"] });
    return Response.json({ ok: true });
  }

  if (action === "request_changes") {
    if (!feedback?.trim()) return Response.json({ error: "Please tell us what to change" }, { status: 400 });
    await updateProject(project.id, {
      "Brief Status": "Changes Requested",
      "Brief Client Feedback": `${history}\n[${stamp}] Changes requested: ${feedback}`.trim(),
    });
    await emitEvent("brief.changes_requested", { ...common, feedback, requestedBy: name });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
