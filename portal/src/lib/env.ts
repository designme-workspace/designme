function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const env = {
  airtableToken: () => required("AIRTABLE_TOKEN"),
  // Overridable for local testing against a mock server.
  airtableApiUrl: () => process.env.AIRTABLE_API_URL ?? "https://api.airtable.com",
  airtableBaseId: () => process.env.AIRTABLE_BASE_ID ?? "appSs3Jhav8TAxBkg",
  // n8n webhook that receives portal events (onboarding.completed, brief.ready, ...).
  eventsWebhookUrl: () => process.env.N8N_EVENTS_WEBHOOK_URL,
  eventsWebhookSecret: () => process.env.N8N_EVENTS_WEBHOOK_SECRET,
  // Shared secret for internal endpoints called by n8n / the team.
  internalApiKey: () => required("INTERNAL_API_KEY"),
  // "api": the portal calls Claude directly (needs ANTHROPIC_API_KEY).
  // "routine": AI work is queued in Airtable and done by a scheduled Claude Code routine.
  aiMode: (): "api" | "routine" => (process.env.ANTHROPIC_API_KEY ? "api" : "routine"),
  portalUrl: () => process.env.PORTAL_URL ?? "http://localhost:3000",
};
