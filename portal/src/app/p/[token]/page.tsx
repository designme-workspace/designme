import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Eyebrow, List } from "@/components/ui";
import { getMoodboard } from "@/lib/moodboard";
import { getProjectByToken, stageIndex, type Project } from "@/lib/projects";

type Step = { label: string; from: number; to: number };

function journey(project: Project): Step[] {
  const hasDev = project.fields["Service Type"]?.includes("Website Development");
  const steps: Step[] = [
    { label: "Onboarding", from: 0, to: 2 },
    { label: "Project brief", from: 3, to: 4 },
    { label: "Discovery", from: 5, to: 5 },
    { label: "Moodboard", from: 6, to: 6 },
    { label: "Design", from: 7, to: 7 },
    ...(hasDev ? [{ label: "Development", from: 8, to: 8 }] : []),
    { label: "Revisions", from: 9, to: 9 },
    { label: "Handover", from: 10, to: 11 },
  ];
  return steps;
}

const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : null;

export default async function ProjectHub({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const project = await getProjectByToken(token);
  if (!project) notFound();
  const f = project.fields;
  const current = stageIndex(f.Stage);
  const paused = f.Stage === "Paused";
  const clientActions = (f["Client Actions"] ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

  const moodboards = (await Promise.all((f.Moodboards ?? []).map(getMoodboard))).filter(
    (m) => m && m.fields.Status !== "Draft",
  );
  const openMoodboard = moodboards.find((m) => m!.fields.Status === "Sent");
  const doneMoodboard = moodboards.find((m) => m!.fields.Status === "Completed");

  if (!f["Onboarding Completed At"]) clientActions.unshift("Complete your onboarding questionnaire");
  if (openMoodboard) clientActions.unshift("Go through your moodboard (about 5 minutes)");
  if (f["Brief Status"] === "Shared with Client") clientActions.unshift("Review and approve your project brief");

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Your project</Eyebrow>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{f["Project Name"]}</h1>
        <p className="mt-1 text-sm text-muted">{(f["Service Type"] ?? []).join(" · ")}</p>
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">Where we are</h2>
        {paused ? (
          <p className="text-sm text-warn">This project is currently paused.</p>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-4">
            {journey(project).map((step) => {
              const state = current > step.to ? "done" : current >= step.from ? "now" : "next";
              return (
                <li
                  key={step.label}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    state === "now"
                      ? "border-accent bg-accent/10 font-medium text-accent"
                      : state === "done"
                        ? "border-border text-muted line-through decoration-muted/40"
                        : "border-dashed border-border text-muted"
                  }`}
                >
                  {state === "done" ? "✓ " : ""}
                  {step.label}
                </li>
              );
            })}
          </ol>
        )}
        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted">Next update from us</p>
            <p className="font-medium">{formatDate(f["Next Client Update Due"]) ?? "Monday & Thursday in Slack"}</p>
          </div>
          <div>
            <p className="text-muted">Target delivery</p>
            <p className="font-medium">{formatDate(f["Target Delivery Date"]) ?? "Confirmed at kickoff"}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">What we need from you</h2>
        {clientActions.length ? <List items={clientActions} /> : <p className="text-sm text-muted">Nothing right now. We&apos;re on it.</p>}
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {!f["Onboarding Completed At"] && (
            <Link href={`/p/${token}/onboarding`} className="rounded-full bg-accent px-4 py-2 font-medium text-accent-foreground">
              Start onboarding →
            </Link>
          )}
          {openMoodboard && (
            <Link href={`/m/${openMoodboard.id}`} className="rounded-full bg-accent px-4 py-2 font-medium text-accent-foreground">
              Start moodboard →
            </Link>
          )}
          {doneMoodboard && (
            <Link href={`/m/${doneMoodboard.id}`} className="rounded-full border border-border px-4 py-2 font-medium">
              Your moodboard summary →
            </Link>
          )}
          {["Shared with Client", "Client Approved", "Changes Requested"].includes(f["Brief Status"] ?? "") && (
            <Link href={`/p/${token}/brief`} className="rounded-full border border-border px-4 py-2 font-medium">
              View project brief →
            </Link>
          )}
        </div>
      </Card>

      {f["Latest Update"] && (
        <Card>
          <h2 className="mb-1 font-semibold">Latest update</h2>
          {f["Last Client Update At"] && <p className="mb-3 text-xs text-muted">{formatDate(f["Last Client Update At"])}</p>}
          <p className="whitespace-pre-line text-sm leading-relaxed">{f["Latest Update"]}</p>
        </Card>
      )}
    </div>
  );
}
