# DesignMe Client Operating System: Blueprint

**Goal:** every client knows what's happening, what we need from them and what they're getting, and every designer has full context without asking. No surprises from payment to referral.

**Principles**

1. **One source of truth per thing.** Clients, deals, projects and feedback live in Airtable (*Paying Clients & Billing* base). Tasks live in ClickUp. Conversations live in Slack. Nothing important lives only in someone's head or DMs.
2. **Everything written down and signed off.** The brief, each phase and the handover end with a written client approval.
3. **Every step has an owner, an SLA and an automated nudge.** If something is late, the system notices before the client does.
4. **Ask early, ask often.** Satisfaction is measured from week 1, not at the end.

---

## The client journey at a glance

| # | Stage (Airtable `Stage`) | Trigger | Owner | Client does | SLA | Automation |
|---|---|---|---|---|---|---|
| 0 | Awaiting Payment | Proposal signed (Attio deal won) | Sales | Pays | n/a | Attio → Airtable Client + Project |
| 1 | Onboarding Sent | Payment received (Stripe auto / Wise confirmed) | Ops | Fills onboarding form | Form sent **< 1 hour** after payment. Client nudged at 48h and 96h | n8n: create token, `ext-`/`int-` Slack channels, email + Slack onboarding link |
| 2 | Onboarding Complete | Client submits form | Portal | n/a | n/a | Portal saves answers → ClickUp list from template → AI brief starts |
| 3 | Brief Review | AI brief generated | Project Lead | Reviews brief | PM reviews **< 1 business day**. Client reviews **< 2 business days** | Slack `int-` alert with expectation gaps; PM sets *Shared with Client* → email + `ext-` post |
| 4 | Brief Approved | Client approves in portal | Project Lead | Books kickoff | Kickoff **< 3 business days** after approval | Pulse surveys scheduled; kickoff task in ClickUp |
| 5 | Discovery | Kickoff call | Project Lead | Joins kickoff, answers discovery | Discovery summary **< 2 days** after kickoff | (Phase 2) AI discovery summary |
| 6 | Moodboard | Discovery approved | Designer | Swipes moodboard | Client completes **< 3 days** | Moodboard Swiper + AI taste summary; link posted when Status = Sent |
| 7 | Design | Moodboard approved | Designer | Reviews designs | Per brief timeline | Mon/Thu update reminders, overdue alerts |
| 8 | Development (web) | Design approved | Developer | Reviews staging | Per brief timeline | Same as above |
| 9 | Revisions | Review delivered | Designer | Consolidated feedback | Feedback **< 2 business days**, 2 rounds included | "Waiting on client" nudges |
| 10 | Handover | Final approval | Project Lead | Signs off handover | Handover pack **< 3 business days** | (Phase 4) Handover checklist + Final survey |
| 11 | Complete | Handover signed | Account Owner | Testimonial, Clutch review, referral | Advocacy ask **< 7 days** | (Phase 4) Advocacy sequence |

---

## 1. Payment → Onboarding

**Stripe:** a paid checkout or invoice fires n8n automatically. The Stripe customer email is matched to Airtable Clients → Project.
**Wise:** Wise doesn't reliably say who paid, so the incoming-transfer webhook posts to `#client-ops` with the amount and reference, and a human clicks **Confirm payment** in Airtable. That triggers the same flow.

Then n8n will:
1. Create or find the **Client** and **Project** records (Stage `1. Onboarding Sent`), and generate a secret **Portal Token**.
2. Create Slack channels **`ext-{client}`** (Slack Connect, invite client) and **`int-{client}`** (team only). Save both names on the Project.
3. Email the client: welcome, what happens next, and their private link `portal.designme.agency/p/{token}/onboarding`. Post the same in `ext-`.
4. Post to `int-`: "💰 {Client} paid {amount}. Onboarding sent."
5. Nudges if the form isn't done: 48h (friendly email + `ext-` message), 96h (Project Lead DMs / calls).

## 2. Onboarding form → AI brief

The **onboarding questionnaire** (portal, ~15 min) has a common core plus sections for each service:

- **Everyone:** business, audience, competitors, *why now*, what success looks like in 3 months, metrics, must-haves, must-avoids, past agency experience, worries, feel words, style sliders (Classic↔Modern, Playful↔Serious, Minimal↔Expressive, Accessible↔Premium), inspiration links, existing assets, **single decision-maker**, stakeholders, feedback speed, comms preference, timezone, hard deadline.
- **Website:** site type, pages, platform, CMS needs, integrations, who writes copy, current-site problems, domain/hosting owner.
- **Branding:** new/refresh/rebrand, name final?, keep vs drop, expected deliverables, applications, values.
- **Product / UI-UX:** stage, platforms, key flows, users & pain, research available, design system, dev team & handoff, accessibility.

On submit, the portal generates the **Project Brief** with Claude from three inputs: the **proposal/scope** (pasted into `Proposal Scope`), the **answers**, and our **operating standards**. The brief contains:

- Executive summary, objectives + success metrics
- Scope: included / **not included** / assumptions
- Deliverables, phased plan with **what we need from the client** and the **sign-off** that closes each phase
- Design direction, **do's and don'ts** for designers
- Communication plan, our commitments vs client responsibilities
- Risks + mitigations, open questions for kickoff
- **Internal only:** *expectation gaps* (where the client wants more or something different than we sold), team watch-outs, upsell ideas

**PM review (≤ 1 business day):** open `…/p/{token}/brief?preview={INTERNAL_API_KEY}`. Wrong? Add corrections to `Brief Internal Notes` and hit *Regenerate*. Right? Set `Brief Status` = **Shared with Client**. The client gets an email and an `ext-` post, and can **Approve** or **Request changes** in the portal. Approval is timestamped. This is the fix for "lost in translation".

## 3. Discovery & Moodboard

- **Discovery questionnaire + kickoff call** *(next)*: a recording or transcript plus answers go to an AI discovery summary, which the client approves.
- **Moodboard Swiper** *(built)*: the client swipes through design references and rates each one ❤️ Love / 👍 Like / 👎 Not for me, with an optional "why".
  1. **The team decides the type.** In Airtable → *Moodboards*, create a record, link the Project and pick **Type** (Website / Branding / Product / UI-UX). The client only sees references of that type.
  2. **Library:** *Moodboard Library* is one reusable, tagged library (Service Type, Category, Style Tags, short Description). Leave *Project* empty for shared references, or link a Project to add 10–20 client-specific picks. To hand-pick an exact set, fill *Items* on the moodboard instead.
  3. Set **Status = Sent**. n8n posts the link in `ext-` and the client swipes (about 5 minutes, section by section, keyboard or swipe on mobile).
  4. **Output:** a visual board of what they loved and a written direction written by Claude, which looks at the images: headline, summary, keywords, loves, avoid, colour, typography, imagery, layout. The client sees their summary. The team gets *Designer Notes* and open questions in Airtable and in `int-`.

## 4. Delivery & accountability

**ClickUp** stays the task tool. Each project gets a list from its **service template** (Website / Branding / Product) with phase tasks, owners and due dates from the brief.

The rhythm everybody can rely on:

| When | What | Who |
|---|---|---|
| Monday | "This week" plan in `ext-` | Project Lead |
| Thursday | Progress update (Loom or written) in `ext-`, and in the portal's *Latest Update* | Project Lead |
| Daily 9:00 | Overdue-task digest to each `int-` channel | n8n |
| Any review sent | Client-feedback due date set (2 business days). Nudge at due date, escalate at +2 days | n8n |
| Client message | First reply < 1 business day | Everyone |

**Health** (`Green / Amber / Red` on the Project) is set by automation: Red if NPS ≤ 6, a rating ≤ 3, overdue > 3 days or no update in 5 days. Ops reviews all Amber/Red projects every Monday.

**Client status page:** `portal/p/{token}` shows where we are, what we need from the client, the next update date and the latest update. Share it in the channel topic.

## 5. Client pulse & NPS

| Survey | When | Purpose |
|---|---|---|
| Week 1 | Kickoff + 7 days | Catch misalignment early |
| Month 1 | Kickoff + 30 days | First real read, testimonial opt-in |
| Quarterly | Every 90 days while active | Retainers and long projects |
| Final | At handover | Overall NPS, testimonial and referral |

Each survey is 2 minutes: NPS (0–10), stars for Communication / Quality / Timeliness, expectations met?, going well, could improve.
- **Promoter (9–10):** thank-you, then the advocacy ask (below).
- **Passive (7–8):** Project Lead follows up on "could improve" within 3 days.
- **Detractor (≤ 6) or any rating ≤ 3:** 🚨 alert in `int-` + founder. Call within 1 business day. Health goes Red, and a follow-up owner and notes are required in Airtable.

## 6. Handover *(Phase 4)*

A checklist per service. The client signs it off in the portal.

- **Website:** Webflow/Framer ownership transfer, domain/DNS, forms → client inbox, analytics, CMS guide (Loom), SEO basics, 30-day bug-fix window.
- **Branding:** logo suite (SVG/PNG/PDF, colour/mono/reversed), colour codes, fonts + licences, brand guidelines PDF, templates, source files.
- **Product:** Figma file ownership, component library, dev handoff (Dev Mode, specs, tokens), prototype links, walkthrough call.

Everything goes into a shared "Handover" folder linked on the Project. Then the Final survey goes out.

## 7. Advocacy & growth *(Phase 4)*

- **Testimonial + Clutch review offer:** $1,000 of design time (10–15 hours) for a written/video testimonial **and** a Clutch review. Offered to promoters at Month 1 and Final. The credit is tracked in Airtable.
- **Referral ask:** in the Final survey thank-you and 2 weeks later.
- **Continuation:** use the brief's *suggested upsells* and pulse feedback to propose the next project or a retainer. At 30 and 90 days after handover, send a "how's it performing?" check-in.

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| **1** | Blueprint, Airtable schema, portal (onboarding → AI brief → client approval, status page, pulse/NPS form) | ✅ Built, portal deployed |
| 1b | n8n WF-C1/C2/C3: payment intake, Slack channels, ClickUp board from templates, event alerts, pulse scheduler, daily accountability run | ✅ Built, switched off until go-live checks pass (see SETUP.md) |
| 2 | **Moodboard Swiper** ✅ built · Discovery questionnaire + AI summary (next) | In progress |
| 3 | Accountability engine: ClickUp overdue-task digests, client feedback-due nudges, Monday health review | Partly built (daily run) |
| 4 | Handover checklists + sign-off, advocacy sequence, referral tracking | |

## Data model (Airtable, *Paying Clients & Billing*)

- **Clients**: existing. Status `Onboarding / Active / Paused / Churned`.
- **Deals**, **Invoices**: existing.
- **Projects** *(new)*: Stage, Health, Service Type, Portal Token, contact, payment source/ref, onboarding timestamps and answers, Proposal Scope, Brief Status/JSON/Summary/Internal Notes/Client Feedback/Approved At, dates, Project Lead, Designers, ClickUp list, Slack EXT/INT channels, Latest Update, Client Actions, Next Client Update Due, Latest NPS.
- **Moodboard Library** *(new)*: tagged references (Service Type, Category, Style Tags, Description, Active, optional Project).
- **Moodboards** *(new)*: one per client round (Project, Type, Status, Items, Loved/Liked/Disliked, Summary, Designer Notes, Direction JSON, Moodboard Link).
- **Pulse Surveys** *(new)*: Project, Type, Status, Token, NPS (+ Category formula), Communication / Quality / Timeliness, Expectations Met, Going Well, Could Improve, Open To Testimonial, Follow-up Needed / Owner / Notes.

## Operating standards (promised in every brief)

Kept in code at `portal/src/lib/standards.ts`. Change them there.

- Reply within 1 business day at the latest (usually same day).
- Monday plan + Thursday progress update in Slack.
- Consolidated feedback from one decision-maker within 2 business days.
- 2 revision rounds per deliverable.
- Written approval at the end of each phase.
- Slack Connect for day-to-day, email for formal documents.
- Check-ins after week 1, month 1, then every 3 months.
