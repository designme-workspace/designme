"""WF-C1 · Payment → Onboarding."""
import os
from sdk import *

START_KEY = os.environ.get("START_ONBOARDING_KEY", "REPLACE_WITH_START_ONBOARDING_KEY")

N = []
N.append(trigger("stripeTrigger", "n8n-nodes-base.stripeTrigger", 1, "Stripe: Payment Received", [0, 0],
    {"events": ["checkout.session.completed", "invoice.paid"]},
    [{"type": "checkout.session.completed", "data": {"object": {"id": "cs_test", "payment_status": "paid", "amount_total": 500000, "currency": "usd", "customer_details": {"email": "jane@acme.com", "name": "Jane Doe"}}}}],
    credentials=STRIPE_CRED))

N.append(code("normalizeStripe", "Normalize Stripe Payment", [240, 0], r"""
const out = [];
for (const item of $input.all()) {
  const e = item.json;
  const o = (e.data && e.data.object) || {};
  const isCheckout = e.type === 'checkout.session.completed';
  if (isCheckout && o.payment_status && o.payment_status !== 'paid') continue;
  const email = String(isCheckout ? ((o.customer_details && o.customer_details.email) || o.customer_email || '') : (o.customer_email || '')).toLowerCase().trim();
  out.push({ json: {
    source: 'Stripe',
    eventType: e.type,
    email,
    emailSafe: email.replace(/['"\\]/g, ''),
    payerName: isCheckout ? ((o.customer_details && o.customer_details.name) || '') : (o.customer_name || ''),
    amount: ((isCheckout ? o.amount_total : o.amount_paid) || 0) / 100,
    currency: String(o.currency || '').toUpperCase(),
    reference: o.id
  } });
}
return out;
""", [{"source": "Stripe", "eventType": "checkout.session.completed", "email": "jane@acme.com", "emailSafe": "jane@acme.com", "payerName": "Jane Doe", "amount": 5000, "currency": "USD", "reference": "cs_test"}]))

N.append(airtable("findProject", "Airtable: Find Project Awaiting Onboarding", [480, 0], "GET", "/" + T_PROJECTS,
    query=[("filterByFormula", Expr("AND(LOWER({Contact Email})='{{ $json.emailSafe }}', {Portal Token}='')")), ("maxRecords", "1")],
    output=[{"records": [{"id": "recXXXXXXXXXXXXXX", "fields": {}}]}]))

N.append(code("resolveStripe", "Resolve Stripe Match", [720, 0], r"""
const payments = $('Normalize Stripe Payment').all();
const out = [];
$input.all().forEach((r, i) => {
  const rec = (r.json.records || [])[0];
  const p = payments[i].json;
  if (!rec && p.eventType !== 'checkout.session.completed') return;
  out.push({ json: Object.assign({}, p, { projectId: rec ? rec.id : '', matched: Boolean(rec) }) });
});
return out;
""", [{"source": "Stripe", "email": "jane@acme.com", "amount": 5000, "currency": "USD", "reference": "cs_test", "projectId": "recXXXXXXXXXXXXXX", "matched": True}]))

N.append(if_true("isMatched", "Project Found?", [960, 0], "{{ $json.matched }}"))

N.append(slack("alertUnmatched", "Slack: Alert Unmatched Payment", [1200, 160], "chat.postMessage",
    Expr('{{ JSON.stringify({ channel: "C087P172QLF", text: "💳 Stripe payment received from *" + $json.email + "* (" + $json.amount + " " + $json.currency + ", ref " + $json.reference + ") but no Airtable project is waiting for onboarding.\\nCreate the Project in Airtable (Paying Clients & Billing → Projects) with Contact Email = " + $json.email + ", then click its *Start Onboarding Link*." }) }}')))

N.append(trigger("manualStart", "n8n-nodes-base.webhook", 2.1, "Manual Start (Airtable link)", [0, 320],
    {"httpMethod": "GET", "path": "client-os-start-onboarding", "responseMode": "onReceived",
     "options": {"onlyRunIf": Expr("{{ $json.query.key === '" + START_KEY + "' }}"),
                 "responseData": "Onboarding is starting. Watch Slack for confirmation. You can close this tab."}},
    [{"query": {"projectId": "recXXXXXXXXXXXXXX", "key": "x"}}]))

N.append(code("normalizeManual", "Normalize Manual Start", [240, 320], r"""
const id = String(($input.first().json.query || {}).projectId || '');
if (!/^rec[A-Za-z0-9]{14}$/.test(id)) return [];
return [{ json: { source: 'Manual', projectId: id, amount: null, currency: '', reference: 'Confirmed manually in Airtable', email: '' } }];
""", [{"source": "Manual", "projectId": "recXXXXXXXXXXXXXX", "amount": None, "currency": "", "reference": "Confirmed manually in Airtable", "email": ""}]))

N.append(airtable("getProject", "Airtable: Get Project", [1200, 320], "GET",
    Expr(AIRTABLE + "/" + T_PROJECTS + "/{{ $json.projectId }}"),
    output=[{"id": "recXXXXXXXXXXXXXX", "fields": {"Project Name": "Acme: Website Redesign", "Client Name": ["Acme"], "Contact Email": "jane@acme.com", "Contact Name": "Jane"}}]))

N.append(code("planSetup", "Plan Setup", [1440, 320], r"""
const CONFIG = {
  portalUrl: 'https://portal.designme.agency',
  opsChannel: 'C087P172QLF',
  newProjectsChannel: 'C09L1R9MK9C',
  // Slack user IDs added to every new int-/ext- channel (e.g. founders, ops).
  teamSlackUserIds: []
};
const pay = $('Resolve Stripe Match').isExecuted ? $('Resolve Stripe Match').first().json : $('Normalize Manual Start').first().json;
const p = $input.first().json;
const f = p.fields || {};
if (f['Portal Token']) return [];
function token() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let bytes;
  try { bytes = new Uint8Array(32); globalThis.crypto.getRandomValues(bytes); }
  catch (e) { bytes = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)); }
  return Array.from(bytes, b => chars[b % 62]).join('');
}
const clientName = (f['Client Name'] || [])[0] || String(f['Project Name'] || 'client').split(':')[0];
const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'client';
const lead = f['Project Lead'] || {};
return [{ json: {
  config: CONFIG,
  projectId: p.id,
  projectName: f['Project Name'] || clientName,
  clientName,
  clientId: (f['Client'] || [])[0] || '',
  contactName: f['Contact Name'] || pay.payerName || '',
  contactEmail: f['Contact Email'] || pay.email || '',
  leadEmail: lead.email || '',
  source: pay.source,
  amount: pay.amount,
  currency: pay.currency,
  reference: pay.reference,
  token: token(),
  intName: f['Slack INT Channel'] || ('int-' + slug),
  extName: f['Slack EXT Channel'] || ('ext-' + slug),
  existingIntId: f['Slack INT Channel ID'] || '',
  existingExtId: f['Slack EXT Channel ID'] || ''
} }];
""", [{"config": {"portalUrl": "https://portal.designme.agency", "opsChannel": "C087P172QLF", "newProjectsChannel": "C09L1R9MK9C", "teamSlackUserIds": []}, "projectId": "recXXXXXXXXXXXXXX", "projectName": "Acme: Website Redesign", "clientName": "Acme", "clientId": "recCCCCCCCCCCCCCC", "contactName": "Jane", "contactEmail": "jane@acme.com", "leadEmail": "luke@designme.agency", "source": "Stripe", "amount": 5000, "currency": "USD", "reference": "cs_test", "token": "abc", "intName": "int-acme", "extName": "ext-acme", "existingIntId": "", "existingExtId": ""}]))

N.append(slack("createInt", "Slack: Create INT Channel", [1680, 320], "conversations.create",
    Expr("{{ JSON.stringify({ name: $json.intName, is_private: true }) }}")))
N.append(slack("createExt", "Slack: Create EXT Channel", [1920, 320], "conversations.create",
    Expr("{{ JSON.stringify({ name: $('Plan Setup').item.json.extName, is_private: true }) }}")))

N.append(http("listChannels", "Slack: List Channels", [2160, 320], "GET", "https://slack.com/api/conversations.list",
    "slackOAuth2Api", SLACK_CRED,
    query=[("types", "public_channel,private_channel"), ("exclude_archived", "true"), ("limit", "1000")],
    continue_on_error=True, output=[{"ok": True, "channels": [{"id": "C0000000000", "name": "int-acme"}]}]))

N.append(code("resolveChannels", "Resolve Channel IDs", [2400, 320], r"""
const plan = $('Plan Setup').first().json;
const ci = $('Slack: Create INT Channel').first().json;
const ce = $('Slack: Create EXT Channel').first().json;
const list = $input.first().json.channels || [];
const find = n => (list.find(c => c.name === n) || {}).id || '';
const intId = plan.existingIntId || (ci.ok && ci.channel ? ci.channel.id : find(plan.intName));
const extId = plan.existingExtId || (ce.ok && ce.channel ? ce.channel.id : find(plan.extName));
return [{ json: Object.assign({}, plan, { intId, extId }) }];
""", [{"projectId": "recXXXXXXXXXXXXXX", "intId": "C1", "extId": "C2", "leadEmail": "luke@designme.agency", "contactEmail": "jane@acme.com", "config": {"teamSlackUserIds": []}}]))

N.append(http("lookupLead", "Slack: Look Up Project Lead", [2640, 320], "GET", "https://slack.com/api/users.lookupByEmail",
    "slackOAuth2Api", SLACK_CRED, query=[("email", Expr("{{ $json.leadEmail }}"))],
    never_error=True, continue_on_error=True, output=[{"ok": True, "user": {"id": "U0000000000"}}]))

N.append(code("buildInvites", "Build Invite List", [2880, 320], r"""
const s = $('Resolve Channel IDs').first().json;
const lead = $input.first().json;
const users = [...s.config.teamSlackUserIds];
if (lead.ok && lead.user && !users.includes(lead.user.id)) users.push(lead.user.id);
return [{ json: Object.assign({}, s, { inviteUsers: users.join(','), leadSlackId: lead.ok && lead.user ? lead.user.id : '' }) }];
""", [{"intId": "C1", "extId": "C2", "inviteUsers": "U0000000000", "leadSlackId": "U0000000000", "contactEmail": "jane@acme.com"}]))

N.append(slack("inviteInt", "Slack: Invite Team to INT", [3120, 320], "conversations.invite",
    Expr("{{ JSON.stringify({ channel: $json.intId, users: $json.inviteUsers }) }}")))
N.append(slack("inviteExt", "Slack: Invite Team to EXT", [3360, 320], "conversations.invite",
    Expr("{{ JSON.stringify({ channel: $('Build Invite List').item.json.extId, users: $('Build Invite List').item.json.inviteUsers }) }}")))
N.append(slack("inviteShared", "Slack Connect: Invite Client to EXT", [3600, 320], "conversations.inviteShared",
    Expr("{{ JSON.stringify({ channel: $('Build Invite List').item.json.extId, emails: [$('Build Invite List').item.json.contactEmail] }) }}")))

N.append(code("compose", "Compose Updates & Messages", [3840, 320], r"""
const s = $('Build Invite List').first().json;
const shared = $input.first().json;
const portal = s.config.portalUrl;
const onboardingUrl = portal + '/p/' + s.token + '/onboarding';
const hubUrl = portal + '/p/' + s.token;
const now = new Date().toISOString();
const paid = s.amount ? (s.amount.toLocaleString('en-GB') + ' ' + s.currency) : 'payment confirmed';
const warnings = [];
if (!s.intId) warnings.push('Could not create or find #' + s.intName + '. Create it, invite the bot, and paste the channel ID into Airtable.');
if (!s.extId) warnings.push('Could not create or find #' + s.extName + '. Create it, invite the bot, and paste the channel ID into Airtable.');
if (s.extId && !shared.ok) warnings.push('Slack Connect invite to ' + (s.contactEmail || 'the client') + ' failed (' + (shared.error || 'unknown') + '). Invite them manually.');
if (!s.leadSlackId) warnings.push('No Project Lead set in Airtable (or not found in Slack). Assign one.');
const projectPatch = { typecast: true, fields: {
  'Portal Token': s.token,
  'Stage': '1. Onboarding Sent',
  'Brief Status': 'Not Started',
  'Health': 'Green',
  'Paid At': now,
  'Payment Source': s.source,
  'Payment Reference': s.reference,
  'Onboarding Sent At': now,
  'Onboarding Reminders Sent': 0,
  'Slack INT Channel': s.intName,
  'Slack EXT Channel': s.extName,
  'Slack INT Channel ID': s.intId,
  'Slack EXT Channel ID': s.extId
} };
const first = (s.contactName || '').split(' ')[0] || 'there';
const extText = [
  '👋 Welcome to DesignMe, ' + first + '! We are excited to get started on *' + s.projectName + '*.',
  '',
  '*Step 1:* please complete your onboarding questionnaire (about 15 minutes). Your answers become the project brief the whole team works from:',
  onboardingUrl,
  '',
  'Your project hub (status, brief and next steps): ' + hubUrl,
  'We reply to every message within 1 business day at the latest. Ask us anything in this channel.'
].join('\n');
const intText = [
  '💰 *' + s.projectName + '* is paid (' + s.source + ', ' + paid + '). Onboarding link sent to the client.',
  'Client hub: ' + hubUrl,
  ...(warnings.length ? ['', '⚠️ *Needs attention:*', ...warnings.map(w => '• ' + w)] : [])
].join('\n');
const newProjectText = '🎉 New project: *' + s.projectName + '* (' + s.source + ', ' + paid + ').' + (s.intId ? ' Team channel: <#' + s.intId + '>' : '');
return [{ json: Object.assign({}, s, { projectPatch, extText, intText, newProjectText, warnings }) }];
""", [{"projectId": "recXXXXXXXXXXXXXX", "clientId": "recCCCCCCCCCCCCCC", "intId": "C1", "extId": "C2", "projectPatch": {"fields": {}}, "extText": "hi", "intText": "hi", "newProjectText": "hi", "config": {"opsChannel": "C087P172QLF", "newProjectsChannel": "C09L1R9MK9C"}}]))

N.append(airtable("updateProject", "Airtable: Update Project", [4080, 320], "PATCH",
    Expr(AIRTABLE + "/" + T_PROJECTS + "/{{ $json.projectId }}"),
    body=Expr("{{ JSON.stringify($json.projectPatch) }}")))

N.append(airtable("updateClient", "Airtable: Mark Client Onboarding", [4320, 320], "PATCH",
    Expr(AIRTABLE + "/" + T_CLIENTS + "/{{ $('Compose Updates & Messages').item.json.clientId || 'none' }}"),
    body='{"typecast": true, "fields": {"Status": "Onboarding"}}', never_error=True, continue_on_error=True))

C = "$('Compose Updates & Messages').item.json"
N.append(slack("postExt", "Slack: Welcome Client (EXT)", [4560, 320], "chat.postMessage",
    Expr("{{ JSON.stringify({ channel: " + C + ".extId, text: " + C + ".extText }) }}")))
N.append(slack("postInt", "Slack: Notify Team (INT)", [4800, 320], "chat.postMessage",
    Expr("{{ JSON.stringify({ channel: " + C + ".intId || " + C + ".config.opsChannel, text: " + C + ".intText }) }}")))
N.append(slack("postNew", "Slack: Announce in #new-projects", [5040, 320], "chat.postMessage",
    Expr("{{ JSON.stringify({ channel: " + C + ".config.newProjectsChannel, text: " + C + ".newProjectText }) }}")))

NOTE = sticky_note("note", (
    "## Client OS · WF-C1 Payment → Onboarding\n\n"
    "**Stripe:** a paid checkout/invoice is matched to an Airtable Project by Contact Email (with no Portal Token yet). "
    "An unmatched checkout alerts #designme-operations; unmatched invoices (retainer renewals) are ignored.\n\n"
    "**Manual / Wise:** the Airtable field *Start Onboarding Link* calls this workflow's webhook for that project.\n\n"
    "Then: create private `int-`/`ext-` channels (or reuse), invite the team and Project Lead, Slack Connect invite to the client, "
    "write token/stage/channels to Airtable, welcome the client and notify the team.\n\n"
    "Edit `CONFIG` in **Plan Setup** for the portal URL, alert channels and team Slack IDs. "
    "Idempotent: projects that already have a Portal Token are skipped."), [0, -440])

COMPOSITION = """
export default workflow('client-os-wf-c1', 'Client OS · WF-C1 Payment → Onboarding')
  .add(stripeTrigger)
  .to(normalizeStripe)
  .to(findProject)
  .to(resolveStripe)
  .to(isMatched.onTrue(getProject).onFalse(alertUnmatched))
  .add(manualStart)
  .to(normalizeManual)
  .to(getProject)
  .add(getProject)
  .to(planSetup)
  .to(createInt)
  .to(createExt)
  .to(listChannels)
  .to(resolveChannels)
  .to(lookupLead)
  .to(buildInvites)
  .to(inviteInt)
  .to(inviteExt)
  .to(inviteShared)
  .to(compose)
  .to(updateProject)
  .to(updateClient)
  .to(postExt)
  .to(postInt)
  .to(postNew)
  .add(note);
"""

if __name__ == "__main__":
    print(render(N, [NOTE], COMPOSITION))
