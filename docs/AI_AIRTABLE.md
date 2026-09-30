# AI briefs and moodboard summaries (Airtable AI)

The portal has no Anthropic API key, so it **queues** AI work in Airtable and two Airtable automations in *Paying Clients & Billing* do the writing with Airtable AI (included in the Airtable plan, no API key needed):

| Automation | Starts when | Does |
|---|---|---|
| **Client OS · AI project brief** ([open](https://airtable.com/appSs3Jhav8TAxBkg/wflcqK1xYBQEA8UN5)) | Projects · **Brief Status = Queued** (client submitted onboarding, or the team opened the *Regenerate Brief Link*) | Brief Status → Generating → Airtable AI writes the brief from *Proposal Scope*, *Onboarding Answers* and *Brief Internal Notes* → script saves *Brief JSON*, *Brief Summary*, Brief Status → **Internal Review**, Stage → **3. Brief Review** |
| **Client OS · AI moodboard summary** ([open](https://airtable.com/appSs3Jhav8TAxBkg/wflppfRnMcNoVqPtH)) | Moodboards · **Status = In Progress** and *Responses JSON* not empty (client finished the swiper) | Script turns the ratings into a text digest from the Moodboard Library (Title, Category, Style Tags, Description, client notes) → Airtable AI writes the direction → script saves *Direction JSON*, *Summary*, *Designer Notes*, *Completed At*, Status → **Completed** |

Results land within a few minutes. n8n (WF-C3) notices the status change and posts to Slack as before.

**Both automations are created switched off.** Open each link above, check the steps, click *Test* on a real record if you like, then turn it on.

Notes:
- Airtable AI reads text only, so moodboard summaries depend on good **Descriptions** and **Style Tags** in the Moodboard Library.
- If a run fails, Airtable emails the automation owner and the record stays at *Generating* / *In Progress*. To retry a brief, open the *Regenerate Brief Link*; to retry a moodboard, set Status to *Sent* and back to *In Progress*.
- The prompts and output schemas live in `airtable/build_automations.py` (`python3 airtable/build_automations.py brief|moodboard` prints the automation definition). Edit them there, then update the automation in Airtable to match.
- If an `ANTHROPIC_API_KEY` is ever added to Vercel, the portal generates instantly itself and these automations simply never trigger.
- The earlier Claude Code routine (`trig_01MfYCiXYJy868AmcTbLHiDP`) has been disabled and can be deleted under Routines at claude.ai/code.
