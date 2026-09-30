import { after } from "next/server";
import { runBriefJob } from "@/lib/brief-job";
import { emitEvent } from "@/lib/events";
import { getProjectByToken, updateProject } from "@/lib/projects";
import { missingRequired, sectionsFor, type Answers } from "@/lib/questions";

// Brief generation continues after the response is sent.
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const project = await getProjectByToken(token);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  if (project.fields["Onboarding Completed At"]) {
    return Response.json({ error: "Onboarding has already been submitted" }, { status: 409 });
  }

  const body = (await request.json()) as { answers?: Answers };
  const answers = body.answers ?? {};
  const missing = missingRequired(sectionsFor(project.fields["Service Type"]), answers);
  if (missing.length) return Response.json({ error: "Missing required answers", missing }, { status: 400 });

  await updateProject(project.id, {
    "Onboarding Answers": JSON.stringify(answers, null, 2),
    "Onboarding Completed At": new Date().toISOString(),
    Stage: "2. Onboarding Complete",
    "Contact Name": project.fields["Contact Name"] || String(answers.contact_name ?? ""),
  });

  after(async () => {
    await emitEvent("onboarding.completed", {
      projectId: project.id,
      projectName: project.fields["Project Name"],
      services: project.fields["Service Type"],
      slackIntChannel: project.fields["Slack INT Channel"],
      decisionMaker: answers.decision_maker,
      deadline: answers.deadline,
    });
    await runBriefJob(project.id);
  });

  return Response.json({ ok: true });
}
