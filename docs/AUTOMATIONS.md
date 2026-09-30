# Automations (n8n)

The portal owns the client-facing pages and the AI (brief and moodboard summaries). **n8n owns everything that touches Slack, ClickUp, Stripe and scheduling.** Airtable (*Paying Clients & Billing*) is the shared source of truth.

All workflows are tagged `client-os` in n8n and are **built but switched off**. Generators live in `n8n/` (`python3 wf_c1.py` prints SDK code). Secrets are read from env vars and are never committed.

| Workflow | n8n ID | Triggers | What it does |
|---|---|---|---|
| **WF-C1 Payment → Onboarding** | `jjgTfkt1ZLtoeKBn` | Stripe `checkout.session.completed` / `invoice.paid`; GET webhook from the Airtable *Start Onboarding Link* (Wise/manual) | Matches payment to a Project by Contact Email, generates the Portal Token, creates private `int-`/`ext-` channels (reuses existing), invites team + Project Lead, Slack Connect invite to the client, writes stage/channels to Airtable, welcomes the client, notifies `int-` and #new-projects |
| **WF-C2 Portal Events** | `BErHVD75aSCBKElM` | POST webhook from the portal (`X-DesignMe-Secret`) | Slack messages for every event. `onboarding.completed` builds the ClickUp board from templates. `brief.approved` schedules Week 1 / Month 1 / Quarterly pulse surveys |
| **WF-C3 Brief Shared + Daily Run** | `eluoknCehoAarnFn` | Airtable polls (Brief Status → *Shared with Client*; Moodboard Status → *Sent*); weekdays 09:00 Europe/London | Sends the brief / moodboard link to `ext-`. Daily: sends due pulse surveys, 3-day reminders, expiry at 10 days, onboarding nudges (48h client / 96h team), overdue brief review/approval, overdue client updates (Health → Amber), morning digest in #designme-operations |

Alert channels: #designme-operations (`C087P172QLF`) for ops alerts, #new-projects (`C09L1R9MK9C`) for new paid projects.

## Portal → n8n events

Portal env `N8N_EVENTS_WEBHOOK_URL` = WF-C2's production URL, and `N8N_EVENTS_WEBHOOK_SECRET` = the value in WF-C2's webhook *Only run if* option.

| Event | Sent when | Slack | Other |
|---|---|---|---|
| `onboarding.completed` | Client submits onboarding | `int-` | ClickUp folder + list(s) from templates |
| `brief.ready` / `brief.failed` | AI brief generated / failed | `int-` (+ ops on failure) | |
| `brief.changes_requested` | Client asks for changes | `int-` | |
| `brief.approved` | Client approves | `int-` + `ext-` (kickoff booking link) | 3 pulse surveys created |
| `moodboard.completed` / `moodboard.failed` | Moodboard AI summary done / failed | `int-` (designer notes) + `ext-` | |
| `pulse.completed` | Client answers a check-in | `int-` (+ ops alert if unhappy) | |

## ClickUp templates

*Knowledge Base → Templates* contains `TEMPLATE · Website Project`, `TEMPLATE · Branding Project` and `TEMPLATE · Product Project`. Edit tasks, descriptions and due dates there. Due dates are relative to the **anchor Mon 7 Jan 2030 = kickoff**, counted in business days. Website tasks starting with 🛠️ / 🧪 / 🌐 or containing "staging" are only copied when *Website Development* is in scope.

Each client gets a folder in the *Clients* space (reused if one with the same name exists). Clients are ClickUp **guests**, so share only their folder with them and they will never see other clients.

## Airtable links the team uses

On **Projects**: *Start Onboarding Link* (Wise/manual payments), *Brief Preview Link* (team-only brief view), *Regenerate Brief Link* (after editing *Brief Internal Notes*), *Client Hub Link*.
On **Moodboards**: *Moodboard Link*.
