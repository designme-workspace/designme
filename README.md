# DesignMe Client Operating System

How DesignMe runs every client engagement, from payment to referral, and the tools that automate it.

- **[docs/BLUEPRINT.md](docs/BLUEPRINT.md)**: the operating model (stages, owners, SLAs, surveys, handover, advocacy, roadmap)
- **[docs/AUTOMATIONS.md](docs/AUTOMATIONS.md)**: n8n workflows and the portal event contract
- **[docs/AI_ROUTINE.md](docs/AI_ROUTINE.md)**: how AI briefs and moodboard summaries run on the Claude subscription
- **[docs/SETUP.md](docs/SETUP.md)**: go-live checklist
- **[portal/](portal/)**: client portal (Next.js): onboarding, AI project brief, status page, pulse/NPS surveys

Stack: Airtable (*Paying Clients & Billing*) as source of truth · ClickUp for tasks · Slack (`ext-`/`int-` channels per client) · n8n for automation · Claude for briefs and summaries.
