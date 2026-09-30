# DesignMe Client Portal

The client-facing part of the DesignMe Client Operating System (see [`../docs/BLUEPRINT.md`](../docs/BLUEPRINT.md)).

| URL | Who | What |
|---|---|---|
| `/p/{token}` | Client | Project status page: where we are, what we need from you, latest update |
| `/p/{token}/onboarding` | Client | Onboarding questionnaire (sections adapt to the project's service types) |
| `/p/{token}/brief` | Client | AI-generated project brief to approve or request changes |
| `/p/{token}/brief?preview={TEAM_KEY}` | Team | Draft preview including the internal section (expectation gaps, watch-outs, upsells) |
| `/s/{token}` | Client | Pulse / NPS survey (Week 1, Month 1, Quarterly, Final) |
| `POST /api/internal/projects/{recordId}/brief` | n8n / team | Regenerate a brief (header `x-api-key: INTERNAL_API_KEY`, or `GET ?key=TEAM_KEY` from the Airtable link) |

Airtable (*Paying Clients & Billing* base → **Projects**, **Pulse Surveys**) is the source of truth. The portal reads and writes it and sends every client action to n8n as an event (`src/lib/events.ts`), and n8n handles Slack, ClickUp and email.

## Setup

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

Deploy to Vercel (root directory `portal`), add the same env vars, and point `portal.designme.agency` at it. Brief generation runs in the background after the client submits (`maxDuration = 300`), so use a plan that allows 300-second functions.

## Changing things

- **Questions:** `src/lib/questions.ts`
- **Brief structure and AI instructions:** `src/lib/brief.ts`
- **Promises we make to clients** (used in every brief): `src/lib/standards.ts`
- **Brand colours:** CSS variables at the top of `src/app/globals.css`

## Testing locally without credentials

`scripts/mock-services.mjs` mocks Airtable, the Claude API and the n8n webhook on port 4010, with a test project (`/p/test-token-1234567890`) and survey (`/s/pulse-token-1234567890`):

```bash
node scripts/mock-services.mjs &
AIRTABLE_TOKEN=x AIRTABLE_API_URL=http://localhost:4010 ANTHROPIC_API_KEY=x ANTHROPIC_BASE_URL=http://localhost:4010 \
N8N_EVENTS_WEBHOOK_URL=http://localhost:4010/events INTERNAL_API_KEY=dev npm run dev
```
