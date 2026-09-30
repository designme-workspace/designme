// DesignMe operating standards. These are promises we make to every client and
// are injected into every AI-generated brief, so change them here (and in
// docs/BLUEPRINT.md) rather than in prompts.
export const STANDARDS = {
  responseTime: "We reply to Slack messages and emails within 1 business day (usually same day).",
  updateCadence:
    "Every Monday you get a plan for the week, and every Thursday a progress update (Loom or written) in your shared Slack channel.",
  feedbackWindow:
    "We ask for consolidated feedback within 2 business days of each review request, from one nominated decision-maker.",
  revisionRounds: "Each deliverable includes 2 rounds of revisions. Further rounds are scoped separately.",
  approvalGates:
    "Each phase ends with a written approval before we move on, so nothing changes silently later.",
  channels:
    "Day-to-day communication in the shared Slack Connect channel. Formal documents (brief, surveys, handover) by email.",
  checkIns: "Short satisfaction check-ins after week 1, month 1, then every 3 months.",
} as const;

export function standardsAsText(): string {
  return Object.values(STANDARDS)
    .map((s) => `- ${s}`)
    .join("\n");
}
