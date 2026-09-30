import { emitEvent } from "@/lib/events";
import { getProject, updateProject } from "@/lib/projects";
import { getPulseByToken, needsFollowUp, updatePulse, type PulseFields } from "@/lib/pulse";

type Body = Pick<
  PulseFields,
  "NPS" | "Communication" | "Quality" | "Timeliness" | "Expectations Met" | "Going Well" | "Could Improve" | "Open To Testimonial"
>;

const inRange = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const pulse = await getPulseByToken(token);
  if (!pulse) return Response.json({ error: "Survey not found" }, { status: 404 });
  if (pulse.fields.Status === "Completed") return Response.json({ error: "Already submitted, thank you!" }, { status: 409 });

  const body = (await request.json()) as Body;
  if (!inRange(body.NPS, 0, 10)) return Response.json({ error: "Please choose a score from 0 to 10" }, { status: 400 });
  for (const key of ["Communication", "Quality", "Timeliness"] as const) {
    if (body[key] !== undefined && !inRange(body[key], 1, 5)) return Response.json({ error: `Invalid ${key}` }, { status: 400 });
  }

  const fields: PulseFields = {
    NPS: body.NPS,
    Communication: body.Communication,
    Quality: body.Quality,
    Timeliness: body.Timeliness,
    "Expectations Met": body["Expectations Met"],
    "Going Well": body["Going Well"]?.slice(0, 5000),
    "Could Improve": body["Could Improve"]?.slice(0, 5000),
    "Open To Testimonial": Boolean(body["Open To Testimonial"]),
    Status: "Completed",
    "Completed At": new Date().toISOString(),
  };
  fields["Follow-up Needed"] = needsFollowUp(fields);
  await updatePulse(pulse.id, fields);

  const projectId = pulse.fields.Project?.[0];
  const project = projectId ? await getProject(projectId) : null;
  if (project) {
    await updateProject(project.id, {
      "Latest NPS": body.NPS,
      ...(fields["Follow-up Needed"] ? { Health: "Red" as const } : {}),
    });
  }

  await emitEvent("pulse.completed", {
    pulseId: pulse.id,
    pulseType: pulse.fields.Type,
    projectId,
    projectName: project?.fields["Project Name"],
    slackIntChannel: project?.fields["Slack INT Channel"],
    followUpNeeded: fields["Follow-up Needed"],
    ...fields,
  });
  return Response.json({ ok: true });
}
