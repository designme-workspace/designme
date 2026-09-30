import { notFound } from "next/navigation";
import { Card, Eyebrow, List } from "@/components/ui";
import type { Brief } from "@/lib/brief";
import { getProjectByToken } from "@/lib/projects";
import BriefActions from "./BriefActions";

const VISIBLE_TO_CLIENT = ["Shared with Client", "Changes Requested", "Client Approved"];

export default async function BriefPage({ params, searchParams }: PageProps<"/p/[token]/brief">) {
  const { token } = await params;
  const { preview } = await searchParams;
  const project = await getProjectByToken(token);
  if (!project) notFound();
  const f = project.fields;
  // Team preview: ?preview=<TEAM_KEY> shows drafts and the internal section.
  const teamKey = process.env.TEAM_KEY;
  const isTeam = Boolean(teamKey) && preview === teamKey;

  if (!f["Brief JSON"] || (!isTeam && !VISIBLE_TO_CLIENT.includes(f["Brief Status"] ?? ""))) {
    return (
      <Card>
        <Eyebrow>Project brief</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold">Your brief is being prepared</h1>
        <p className="mt-2 text-sm text-muted">We&apos;ll email you and post in Slack as soon as it&apos;s ready to review.</p>
      </Card>
    );
  }

  const brief = JSON.parse(f["Brief JSON"]) as Brief;

  return (
    <div className="space-y-6">
      {isTeam && (
        <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
          Team preview · Brief status: <strong>{f["Brief Status"]}</strong>. Set it to &quot;Shared with Client&quot; in Airtable to send it.
        </div>
      )}
      <div>
        <Eyebrow>Project brief</Eyebrow>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{brief.project_title}</h1>
        <p className="mt-3 leading-relaxed">{brief.executive_summary}</p>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Objectives & how we&apos;ll measure them</h2>
        <div className="space-y-3">
          {brief.objectives.map((o) => (
            <div key={o.objective} className="text-sm">
              <p className="font-medium">{o.objective}</p>
              <p className="text-muted">{o.success_metric}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Scope</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-good">Included</h3>
            <List items={brief.scope.in_scope} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted">Not included</h3>
            <List items={brief.scope.out_of_scope} />
          </div>
        </div>
        {brief.scope.assumptions.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-medium">Assumptions</h3>
            <List items={brief.scope.assumptions} />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Deliverables</h2>
        <div className="divide-y divide-border">
          {brief.deliverables.map((d) => (
            <div key={d.name} className="py-3 text-sm first:pt-0 last:pb-0">
              <p className="font-medium">
                {d.name} <span className="font-normal text-muted">· {d.service}</span>
              </p>
              <p className="text-muted">{d.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">Plan</h2>
        <ol className="space-y-5">
          {brief.phases.map((p, i) => (
            <li key={p.name} className="relative border-l-2 border-accent/30 pl-5">
              <span className="absolute -left-[9px] top-0.5 h-4 w-4 rounded-full border-2 border-accent bg-surface" />
              <p className="text-xs font-medium uppercase tracking-wide text-accent">{p.timing}</p>
              <p className="font-medium">
                {i + 1}. {p.name}
              </p>
              <p className="mb-2 text-sm text-muted">{p.goal}</p>
              <List items={p.activities} />
              {p.client_inputs.length > 0 && (
                <p className="mt-2 text-sm">
                  <span className="font-medium">We&apos;ll need from you:</span> {p.client_inputs.join("; ")}
                </p>
              )}
              <p className="mt-1 text-sm">
                <span className="font-medium">Sign-off:</span> {p.approval_gate}
              </p>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Design direction</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {brief.design_direction.feel_words.map((w) => (
            <span key={w} className="rounded-full bg-accent/10 px-3 py-1 text-sm text-accent">
              {w}
            </span>
          ))}
        </div>
        <p className="text-sm leading-relaxed">{brief.design_direction.visual_direction}</p>
        <p className="mt-2 text-sm text-muted">{brief.design_direction.references}</p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-good">Do</h3>
            <List items={brief.dos} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-bad">Don&apos;t</h3>
            <List items={brief.donts} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">How we&apos;ll work together</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Channels</dt><dd>{brief.communication_plan.channels}</dd></div>
          <div><dt className="text-muted">Updates</dt><dd>{brief.communication_plan.cadence}</dd></div>
          <div><dt className="text-muted">Feedback</dt><dd>{brief.communication_plan.feedback_turnaround}</dd></div>
          <div><dt className="text-muted">Final sign-off</dt><dd>{brief.communication_plan.decision_maker}</dd></div>
        </dl>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium">We commit to</h3>
            <List items={brief.agency_commitments} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">We&apos;ll need you to</h3>
            <List items={brief.client_responsibilities} />
          </div>
        </div>
      </Card>

      {(brief.risks.length > 0 || brief.open_questions.length > 0) && (
        <Card>
          <h2 className="mb-3 font-semibold">Risks & open questions</h2>
          <div className="space-y-2 text-sm">
            {brief.risks.map((r) => (
              <p key={r.risk}>
                <span className="font-medium">{r.risk}</span> <span className="text-muted">→ {r.mitigation}</span>
              </p>
            ))}
          </div>
          {brief.open_questions.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">To confirm at kickoff</h3>
              <List items={brief.open_questions} />
            </div>
          )}
        </Card>
      )}

      {isTeam && (
        <Card className="border-warn/50">
          <h2 className="mb-3 font-semibold">Internal only</h2>
          <h3 className="mb-1 text-sm font-medium text-bad">Expectation gaps</h3>
          <List items={brief.internal.expectation_gaps} />
          <h3 className="mb-1 mt-4 text-sm font-medium">Team watch-outs</h3>
          <List items={brief.internal.team_watchouts} />
          <h3 className="mb-1 mt-4 text-sm font-medium">Upsell opportunities</h3>
          <List items={brief.internal.suggested_upsells} />
        </Card>
      )}

      {f["Brief Status"] === "Shared with Client" && !isTeam && <BriefActions token={token} />}
      {f["Brief Status"] === "Client Approved" && (
        <Card><p className="text-sm text-good">✓ Approved. This brief is now our shared source of truth for the project.</p></Card>
      )}
      {f["Brief Status"] === "Changes Requested" && (
        <Card><p className="text-sm">Thanks for your feedback. We&apos;re updating the brief and will share a new version shortly.</p></Card>
      )}
    </div>
  );
}
