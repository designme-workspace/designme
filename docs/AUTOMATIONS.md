# Automations (n8n)

The portal owns client-facing pages and the AI brief. **n8n owns everything that touches Slack, ClickUp, email, Stripe and Wise.** The two talk through one events webhook and one internal API.

## Credentials needed in n8n

| Credential | Used for | Status |
|---|---|---|
| Airtable PAT | Projects / Pulse Surveys | ✅ exists (`Airtable PAT DesignMe Account`) |
| Stripe | Payment trigger | ⚠️ exists as "Adrian Personal Stripe API". Confirm it's the business account |
| Slack (bot token, scopes `channels:manage`, `groups:write`, `chat:write`, `conversations.connect:write`, `users:read.email`) | `ext-`/`int-` channels, alerts | ❌ add |
| Gmail / Google Workspace (operations@designme.agency) | Onboarding, brief, survey emails | ❌ add |
| ClickUp | Project list from template | ❌ add |
| Wise (webhook subscription for `balances#credit`) | Wise payment alerts | ❌ add |
| Header auth `x-api-key` = portal `INTERNAL_API_KEY` | Regenerate brief | ❌ add |

## Workflows

### WF-C1 · Payment → Start onboarding
**Triggers:** (a) Stripe `checkout.session.completed` / `invoice.paid`. (b) Webhook `POST /start-onboarding {projectId}`, used by the Airtable *Confirm payment* button for Wise and manual payments.

1. Find Client by email (Stripe) or load Project (webhook). Create the Project if missing: `Stage=1. Onboarding Sent`, `Paid At`, `Payment Source`, `Payment Reference`, `Portal Token` = 32 random url-safe chars, `Brief Status=Not Started`. Set Client `Status=Onboarding`.
2. Slack: create `int-{slug}` (private, add Project Lead + team) and `ext-{slug}` (Slack Connect invite to Contact Email). Save the names on the Project.
3. Gmail: welcome email with `{PORTAL_URL}/p/{token}/onboarding` and a "what happens next" list. Post the same in `ext-`. Set `Onboarding Sent At`.
4. Slack `int-`: "💰 {Client} paid via {source}. Onboarding link sent."

### WF-C2 · Wise payment alert
Wise `balances#credit` → Slack `#client-ops`: "Wise: {amount} {currency} received, ref {reference}. Match it to a project and click *Confirm payment* in Airtable."

### WF-C3 · Portal events router
Webhook `POST /portal-events`. Check the `X-DesignMe-Secret` header first, then switch on `type`:

| Event | Payload highlights | Actions |
|---|---|---|
| `onboarding.completed` | projectId, services, decisionMaker, deadline | Create ClickUp list from the service template in *Clients* space. Save `ClickUp List URL`. Post to `int-`: "📝 Onboarding in, brief generating." |
| `brief.ready` | token, expectationGaps[], openQuestions[] | Post to `int-` with the preview link `{portalUrl}/p/{token}/brief?preview=…`, expectation gaps (⚠️) and open questions. Assign "Review brief" to Project Lead in ClickUp, due +1 business day |
| `brief.failed` | error | 🚨 `int-` + `#client-ops`. Retry via `POST /api/internal/projects/{id}/brief` |
| `brief.changes_requested` | feedback, requestedBy | Post to `int-`. PM adds `Brief Internal Notes` then calls regenerate |
| `brief.approved` | approvedBy, kickoffDate | Post 🎉 to `int-` + `ext-` (kickoff booking link). Create Pulse Surveys: Week 1 (kickoff+7d), Month 1 (+30d), Quarterly (+90d), each with its own token and `Status=Scheduled` |
| `pulse.completed` | NPS, ratings, followUpNeeded, Open To Testimonial | Post to `int-`. If `followUpNeeded`: 🚨 to founder + `#client-ops`, assign Follow-up Owner. If NPS ≥ 9 and Open To Testimonial: start the advocacy sequence (Phase 4) |

### WF-C4 · Brief shared with client
Airtable trigger: `Brief Status` becomes *Shared with Client* → Gmail "Your project brief is ready" with `{PORTAL_URL}/p/{token}/brief` + post in `ext-`. Nudge at +2 business days if still not approved.

### WF-C5 · Daily 9:00 accountability run
- **Pulse sender:** surveys with `Status=Scheduled` and `Scheduled For ≤ today` → email + `ext-` post with `{PORTAL_URL}/s/{token}`, `Status=Sent`, `Sent At`. Reminder after 3 days, `Expired` after 10.
- **Onboarding nudges:** `Stage=1` and `Onboarding Sent At` older than 48h / 96h.
- **Update watchdog:** `Next Client Update Due < today` → `int-` alert to Project Lead. If no `Last Client Update At` for 5 days, set `Health=Amber`.
- **Overdue digest:** ClickUp overdue tasks per project → `int-`.

## Event format

Every portal event is `POST`ed as JSON:

```json
{
  "type": "brief.ready",
  "at": "2026-09-30T11:03:54.962Z",
  "portalUrl": "https://portal.designme.agency",
  "projectId": "recXXXXXXXXXXXXXX",
  "projectName": "Acme: Website Redesign",
  "slackIntChannel": "int-acme",
  "...": "event-specific fields"
}
```
