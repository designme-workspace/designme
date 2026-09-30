import { briefSummary, generateBrief } from "./brief";
import { env } from "./env";
import { emitEvent } from "./events";
import { getProject, updateProject } from "./projects";

// Generates the brief for a project and records the result in Airtable, or
// queues it for the Claude Code routine when no API key is configured.
// Runs after the HTTP response (via `after`) because generation takes a while.
export async function runBriefJob(projectId: string): Promise<void> {
  if (env.aiMode() === "routine") {
    // Picked up by the scheduled Claude Code routine (see docs/AI_ROUTINE.md).
    await updateProject(projectId, { "Brief Status": "Queued" });
    return;
  }
  await updateProject(projectId, { "Brief Status": "Generating" });
  const project = await getProject(projectId);
  try {
    const brief = await generateBrief(project);
    await updateProject(projectId, {
      "Brief JSON": JSON.stringify(brief, null, 2),
      "Brief Summary": briefSummary(brief),
      "Brief Status": "Internal Review",
      Stage: "3. Brief Review",
    });
    await emitEvent("brief.ready", {
      projectId,
      projectName: project.fields["Project Name"],
      slackIntChannel: project.fields["Slack INT Channel"],
      token: project.fields["Portal Token"],
      expectationGaps: brief.internal.expectation_gaps,
      openQuestions: brief.open_questions,
    });
  } catch (err) {
    console.error(`[brief] generation failed for ${projectId}`, err);
    await updateProject(projectId, { "Brief Status": "Failed" });
    await emitEvent("brief.failed", {
      projectId,
      projectName: project.fields["Project Name"],
      slackIntChannel: project.fields["Slack INT Channel"],
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
