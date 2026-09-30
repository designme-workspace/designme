import { env } from "./env";

export type PortalEvent =
  | "onboarding.completed"
  | "brief.ready"
  | "brief.failed"
  | "brief.approved"
  | "brief.changes_requested"
  | "pulse.completed"
  | "moodboard.completed"
  | "moodboard.failed";

// Sends an event to n8n, which fans it out to Slack (INT-/EXT- channels),
// ClickUp and email. Failures are logged, never thrown: the client's action
// has already been saved in Airtable, which is the source of truth.
export async function emitEvent(type: PortalEvent, data: Record<string, unknown>): Promise<void> {
  const url = env.eventsWebhookUrl();
  if (!url) {
    console.warn(`[events] N8N_EVENTS_WEBHOOK_URL not set; dropping ${type}`);
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.eventsWebhookSecret() ? { "X-DesignMe-Secret": env.eventsWebhookSecret()! } : {}),
      },
      body: JSON.stringify({ type, at: new Date().toISOString(), portalUrl: env.portalUrl(), ...data }),
    });
    if (!res.ok) console.error(`[events] ${type} -> ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error(`[events] ${type} failed`, err);
  }
}
