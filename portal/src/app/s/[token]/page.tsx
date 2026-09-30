import { notFound } from "next/navigation";
import { Card, Eyebrow } from "@/components/ui";
import { getProject } from "@/lib/projects";
import { getPulseByToken } from "@/lib/pulse";
import PulseForm from "./PulseForm";

const INTRO: Record<string, string> = {
  "Week 1": "We're one week in. How's it going so far? Early feedback helps us get things right from the start.",
  "Month 1": "A month in. We'd love to know how we're doing.",
  Quarterly: "Our quarterly check-in: two minutes to tell us what's working and what isn't.",
  Final: "We've wrapped up. How did we do overall?",
};

export default async function PulsePage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const pulse = await getPulseByToken(token);
  if (!pulse) notFound();
  const projectId = pulse.fields.Project?.[0];
  const project = projectId ? await getProject(projectId) : null;

  if (pulse.fields.Status === "Completed") {
    return (
      <Card>
        <h1 className="text-2xl font-semibold">Thank you! 🙏</h1>
        <p className="mt-2 text-sm text-muted">We&apos;ve received your feedback and read every response.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>{pulse.fields.Type} check-in{project ? ` · ${project.fields["Project Name"]}` : ""}</Eyebrow>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">How are we doing?</h1>
        <p className="mt-2 text-muted">{INTRO[pulse.fields.Type ?? "Quarterly"]}</p>
      </div>
      <PulseForm token={token} askTestimonial={pulse.fields.Type === "Final" || pulse.fields.Type === "Month 1"} />
    </div>
  );
}
