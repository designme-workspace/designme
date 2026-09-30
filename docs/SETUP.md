# Go-live checklist

Everything is built. The n8n workflows are **switched off** until these steps are done.

## 1. Vercel (portal) environment variables

| Variable | Value |
|---|---|
| `AIRTABLE_TOKEN` | Airtable PAT with read/write on *Paying Clients & Billing* |
| `ANTHROPIC_API_KEY` | **Leave unset** to run AI on the Claude subscription via the scheduled routine (see `AI_ROUTINE.md`). Set it only if you want instant AI briefs and moodboard summaries billed to the API. |
| `N8N_EVENTS_WEBHOOK_URL` | `https://n8n-uzay.srv1834652.hstgr.cloud/webhook/2291171a-c1fc-4df4-9643-50b7585b9ae1/client-os-portal-events` |
| `N8N_EVENTS_WEBHOOK_SECRET` | Must equal the value in WF-C2 → *Portal Events* → Options → *Only run if* (shared privately) |
| `TEAM_KEY` | Must equal the `preview=` / `key=` value in the Airtable *Brief Preview Link* and *Regenerate Brief Link* formulas (shared privately) |
| `INTERNAL_API_KEY` | Any long random string (for POST calls to `/api/internal/*`) |
| `PORTAL_URL` | The portal's public URL |

Redeploy after changing them.

## 2. Portal URL

Links currently use **`https://designme-portal-cb1qwjn7j-design-me1.vercel.app`**. When the portal moves to a stable domain (e.g. `portal.designme.agency`), update it in:
- n8n WF-C1 → *Plan Setup* → `CONFIG.portalUrl`
- n8n WF-C3 → *Compose Brief Shared* and *Plan Daily Actions* → `CONFIG.portalUrl`
- Airtable formulas: Projects → *Brief Preview Link*, *Regenerate Brief Link*, *Client Hub Link*; Moodboards → *Moodboard Link*

## 3. Slack bot

- Scopes: `channels:manage`, `groups:write`, `chat:write`, `users:read`, `users:read.email`, `conversations.connect:write` (Slack Connect needs a paid plan). Reinstall the app after adding scopes.
- Optional: add Slack user IDs for people who should join every client channel in WF-C1 → *Plan Setup* → `teamSlackUserIds`.

## 4. Stripe

Activating WF-C1 registers its Stripe webhook automatically (credential "Adrian Personal Stripe API"). Before a client pays, create their **Project** in Airtable with *Contact Email* set to the email they will pay with, *Service Type* and *Proposal Scope* filled in, and a *Project Lead*.

## 5. Test run (recommended)

1. Create a test Project in Airtable (yourself as the contact).
2. Activate WF-C1, WF-C2 and WF-C3.
3. Click the project's *Start Onboarding Link*. You should see `int-`/`ext-` channels, a welcome message and a #new-projects post.
4. Complete onboarding in the portal. You should see the ClickUp board, an `int-` brief review message and the preview link.
5. Set *Brief Status* = *Shared with Client*, then approve it in the portal. Pulse surveys should appear in Airtable.
6. Add a few *Moodboard Library* images, create a Moodboard, set *Status* = *Sent* and swipe it.
7. Archive the test channels and ClickUp folder afterwards.
