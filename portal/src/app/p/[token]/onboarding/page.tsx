import { notFound } from "next/navigation";
import { Card, Eyebrow } from "@/components/ui";
import { getProjectByToken } from "@/lib/projects";
import { sectionsFor } from "@/lib/questions";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage({ params }: PageProps<"/p/[token]/onboarding">) {
  const { token } = await params;
  const project = await getProjectByToken(token);
  if (!project) notFound();
  const f = project.fields;

  if (f["Onboarding Completed At"]) {
    return (
      <Card>
        <Eyebrow>Onboarding</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold">Thanks, we&apos;ve got everything we need.</h1>
        <p className="mt-2 text-sm text-muted">
          We&apos;re turning your answers into a project brief. You&apos;ll get it to review within 1 business day.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Onboarding · {f["Project Name"]}</Eyebrow>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Let&apos;s get you set up</h1>
        <p className="mt-2 text-muted">
          This takes about 15 minutes. Your answers become the project brief that the whole team works from, so the
          more specific you are, the better the result. Your progress saves automatically on this device.
        </p>
      </div>
      <OnboardingForm
        token={token}
        sections={sectionsFor(f["Service Type"])}
        initial={{ contact_name: f["Contact Name"] ?? "" }}
      />
    </div>
  );
}
