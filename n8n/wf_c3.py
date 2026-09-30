"""WF-C3 · Brief shared notifier + daily accountability run."""
from sdk import *

CONFIG_JS = r"""const CONFIG = {
  portalUrl: 'https://portal.designme.agency',
  opsChannel: 'C087P172QLF',
  airtableProjectUrl: 'https://airtable.com/appSs3Jhav8TAxBkg/tblcAZMc0kF3drvsm/'
};
"""

N = []
# --- A. Brief shared with client (poll every minute) ---
N.append(trigger("briefShared", "n8n-nodes-base.airtableTrigger", 1, "Airtable: Brief Status Changed", [0, 0],
    {"pollTimes": {"item": [{"mode": "everyMinute"}]},
     "authentication": "airtableTokenApi",
     "baseId": {"__rl": True, "mode": "id", "value": "appSs3Jhav8TAxBkg"},
     "tableId": {"__rl": True, "mode": "id", "value": T_PROJECTS},
     "triggerField": "Brief Status Changed At",
     "additionalFields": {"formula": "{Brief Status}='Shared with Client'",
                          "fields": "Project Name,Brief Status,Portal Token,Contact Name,Slack INT Channel ID,Slack EXT Channel ID"}},
    [{"id": "recXXXXXXXXXXXXXX", "fields": {"Project Name": "Acme: Website Redesign", "Brief Status": "Shared with Client", "Portal Token": "abc"}}],
    credentials=AIRTABLE_CRED))

N.append(code("composeShared", "Compose Brief Shared", [240, 0], CONFIG_JS + r"""
const out = [];
for (const item of $input.all()) {
  const r = item.json;
  const f = r.fields || {};
  if (f['Brief Status'] !== 'Shared with Client' || !f['Portal Token']) continue;
  const url = CONFIG.portalUrl + '/p/' + f['Portal Token'] + '/brief';
  const first = String(f['Contact Name'] || '').split(' ')[0] || 'there';
  if (f['Slack EXT Channel ID']) out.push({ json: { kind: 'slack', channel: f['Slack EXT Channel ID'], text: '📄 Hi ' + first + ', your project brief is ready!\nIt covers goals, scope (and what is not included), the plan, and how we will work together:\n' + url + '\nPlease approve it or request changes within *2 business days* so we can book the kickoff.' } });
  out.push({ json: { kind: 'slack', channel: f['Slack INT Channel ID'] || CONFIG.opsChannel, text: '📤 Brief shared with the client for *' + (f['Project Name'] || 'project') + '*. Waiting on approval (2 business days).' } });
  out.push({ json: { kind: 'airtable', table: 'tblcAZMc0kF3drvsm', id: r.id, fields: { 'Brief Shared At': new Date().toISOString(), 'Stage': '3. Brief Review' } } });
}
return out;
""", [{"kind": "slack", "channel": "C1", "text": "hi"}]))

# --- C. Moodboard sent to client (poll every minute) ---
N.append(trigger("moodboardSent", "n8n-nodes-base.airtableTrigger", 1, "Airtable: Moodboard Status Changed", [0, -200],
    {"pollTimes": {"item": [{"mode": "everyMinute"}]},
     "authentication": "airtableTokenApi",
     "baseId": {"__rl": True, "mode": "id", "value": "appSs3Jhav8TAxBkg"},
     "tableId": {"__rl": True, "mode": "id", "value": "tblBl9EIAInz4oqBl"},
     "triggerField": "Status Changed At",
     "additionalFields": {"formula": "{Status}='Sent'",
                          "fields": "Name,Status,Type,Moodboard Link,EXT Channel ID,INT Channel ID,Contact Name"}},
    [{"id": "recXXXXXXXXXXXXXX", "fields": {"Name": "Acme · Website", "Status": "Sent"}}],
    credentials=AIRTABLE_CRED))

N.append(code("composeMoodboard", "Compose Moodboard Sent", [240, -200], r"""
const out = [];
for (const item of $input.all()) {
  const r = item.json;
  const f = r.fields || {};
  if (f['Status'] !== 'Sent') continue;
  const ext = (f['EXT Channel ID'] || [])[0];
  const int = (f['INT Channel ID'] || [])[0] || 'C087P172QLF';
  const first = String((f['Contact Name'] || [])[0] || '').split(' ')[0] || 'there';
  if (ext) out.push({ json: { kind: 'slack', channel: ext, text: '🎨 Hi ' + first + ', your moodboard is ready! Swipe through ' + (f['Type'] || 'design') + ' references and tell us what you love. It takes about 5 minutes and shapes everything we design next:\n' + f['Moodboard Link'] + '\nPlease complete it within *3 business days*.' } });
  out.push({ json: { kind: 'slack', channel: int, text: ext ? '🎨 Moodboard sent to the client: *' + (f['Name'] || '') + '*. Summary will land here when they finish.' : '⚠️ Moodboard *' + (f['Name'] || '') + '* is marked Sent but the project has no ext- channel. Share manually: ' + f['Moodboard Link'] } });
  out.push({ json: { kind: 'airtable', table: 'tblBl9EIAInz4oqBl', id: r.id, fields: { 'Sent At': new Date().toISOString() } } });
}
return out;
""", [{"kind": "slack", "channel": "C1", "text": "hi"}]))

# --- B. Daily run (weekdays 09:00) ---
N.append(trigger("daily", "n8n-nodes-base.scheduleTrigger", 1.3, "Weekdays 09:00", [0, 400],
    {"rule": {"interval": [{"field": "cronExpression", "expression": "0 0 9 * * 1-5"}]}}, [{}]))

N.append(airtable("getProjects", "Airtable: Active Projects", [240, 400], "GET", "/" + T_PROJECTS,
    query=[("filterByFormula", "AND({Portal Token}!='', {Stage}!='11. Complete')"), ("pageSize", "100")],
    output=[{"records": []}]))

N.append(airtable("getPulses", "Airtable: Open Pulse Surveys", [480, 400], "GET", "/" + T_PULSE,
    query=[("filterByFormula", "OR(AND({Status}='Scheduled', IS_BEFORE({Scheduled For}, DATEADD(TODAY(), 1, 'days'))), {Status}='Sent')"), ("pageSize", "100")],
    output=[{"records": []}], execute_once=True))

N.append(code("planDaily", "Plan Daily Actions", [720, 400], CONFIG_JS + r"""
const now = Date.now();
const H = 3600e3;
const today = new Date().toISOString().slice(0, 10);
const projects = ($('Airtable: Active Projects').first().json.records || []);
const pulses = ($input.first().json.records || []);
const out = [];
const slack = (channel, text) => channel && out.push({ json: { kind: 'slack', channel, text } });
const patch = (table, id, fields) => out.push({ json: { kind: 'airtable', table, id, fields } });
const digest = { red: [], amber: [], waiting: [] };

for (const p of projects) {
  const f = p.fields || {};
  const name = f['Project Name'] || 'Project';
  const intCh = f['Slack INT Channel ID'] || CONFIG.opsChannel;
  const extCh = f['Slack EXT Channel ID'];
  const link = CONFIG.airtableProjectUrl + p.id;
  const first = String(f['Contact Name'] || '').split(' ')[0] || 'there';
  const since = (field) => f[field] ? (now - Date.parse(f[field])) / H : 0;
  if (f['Health'] === 'Red') digest.red.push(name);
  if (f['Health'] === 'Amber') digest.amber.push(name);

  // Onboarding nudges: 48h (client) then 96h (team calls them).
  if (f['Stage'] === '1. Onboarding Sent' && !f['Onboarding Completed At']) {
    const sent = f['Onboarding Reminders Sent'] || 0;
    const hrs = since('Onboarding Sent At');
    const url = CONFIG.portalUrl + '/p/' + f['Portal Token'] + '/onboarding';
    if (hrs >= 48 && sent < 1) {
      slack(extCh, '👋 Hi ' + first + ', a quick reminder to complete your onboarding questionnaire so we can prepare your project brief: ' + url);
      patch('tblcAZMc0kF3drvsm', p.id, { 'Onboarding Reminders Sent': 1 });
    } else if (hrs >= 96 && sent < 2) {
      slack(intCh, '⏰ *' + name + '*: onboarding still not completed after 4 days. Project Lead, please call or message the client today. ' + link);
      patch('tblcAZMc0kF3drvsm', p.id, { 'Onboarding Reminders Sent': 2, 'Health': 'Amber' });
    }
    digest.waiting.push(name + ' (onboarding)');
  }

  // Brief waiting on us (internal review > 1 business day).
  if (f['Brief Status'] === 'Internal Review' && since('Brief Status Changed At') >= 24) {
    slack(intCh, '⏰ *' + name + '*: the brief has been waiting for internal review for ' + Math.floor(since('Brief Status Changed At') / 24) + ' day(s). Review and share it today: ' + (f['Brief Preview Link'] || link));
  }
  // Brief waiting on the client (> 2 business days).
  if (f['Brief Status'] === 'Shared with Client' && since('Brief Shared At') >= 48) {
    slack(intCh, '⏰ *' + name + '*: the client has not approved the brief for ' + Math.floor(since('Brief Shared At') / 24) + ' days. Follow up with them today.');
    digest.waiting.push(name + ' (brief approval)');
  }
  if (f['Brief Status'] === 'Changes Requested' && since('Brief Status Changed At') >= 24) {
    slack(intCh, '⏰ *' + name + '*: the client requested brief changes over a day ago. Update and re-share today (Regenerate Brief Link in Airtable): ' + link);
  }

  // Client update discipline (Mon plan / Thu update).
  if (f['Next Client Update Due'] && f['Next Client Update Due'] < today) {
    slack(intCh, '📣 *' + name + '*: a client update was due on ' + f['Next Client Update Due'] + '. Post it in the ext- channel, then update *Latest Update* and *Next Client Update Due* in Airtable.');
  }
  const activeDelivery = /^(5|6|7|8|9|10)\./.test(f['Stage'] || '');
  if (activeDelivery && f['Health'] !== 'Red' && (!f['Last Client Update At'] || since('Last Client Update At') >= 5 * 24)) {
    slack(intCh, '⚠️ *' + name + '*: no client update logged in 5+ days. Post one today and log it in Airtable (Latest Update / Last Client Update At).');
    if (f['Health'] !== 'Amber') patch('tblcAZMc0kF3drvsm', p.id, { 'Health': 'Amber' });
  }
}

// Pulse surveys: send, remind after 3 days, expire after 10.
for (const s of pulses) {
  const f = s.fields || {};
  const ext = (f['EXT Channel ID'] || [])[0];
  const int = (f['INT Channel ID'] || [])[0] || CONFIG.opsChannel;
  const url = CONFIG.portalUrl + '/s/' + f['Token'];
  const project = (f['Project Name'] || [])[0] || 'your project';
  if (f['Status'] === 'Scheduled') {
    if (!ext) { slack(int, '⚠️ ' + f['Survey'] + ' is due but the project has no ext- channel ID. Send manually: ' + url); continue; }
    slack(ext, '🙏 Quick ' + f['Type'] + ' check-in: how are we doing on ' + project + '? It takes 2 minutes and goes straight to the team: ' + url);
    slack(int, '📨 ' + f['Type'] + ' check-in sent for *' + project + '*.');
    patch('tblY8jSdQoMN8vgGZ', s.id, { 'Status': 'Sent', 'Sent At': new Date().toISOString() });
  } else if (f['Status'] === 'Sent' && f['Sent At']) {
    const days = (now - Date.parse(f['Sent At'])) / (24 * H);
    if (days >= 10) patch('tblY8jSdQoMN8vgGZ', s.id, { 'Status': 'Expired' });
    else if (days >= 3 && !f['Reminder Sent'] && ext) {
      slack(ext, 'Friendly reminder: we would love your quick feedback on ' + project + ' (2 minutes): ' + url);
      patch('tblY8jSdQoMN8vgGZ', s.id, { 'Reminder Sent': true });
    }
  }
}

// Morning digest for ops.
const lines = ['☀️ *Client OS daily digest*'];
lines.push('🔴 Red: ' + (digest.red.join(', ') || 'none'));
lines.push('🟠 Amber: ' + (digest.amber.join(', ') || 'none'));
lines.push('⏳ Waiting on clients: ' + (digest.waiting.join(', ') || 'none'));
slack(CONFIG.opsChannel, lines.join('\n'));
return out;
""", [{"kind": "slack", "channel": "C1", "text": "hi"}]))

N.append(switch_on("routeKind", "Route Action", [960, 200], "{{ $json.kind }}", ["slack", "airtable"]))

N.append(slack("postSlack", "Slack: Post Message", [1200, 120], "chat.postMessage",
    Expr("{{ JSON.stringify({ channel: $json.channel, text: $json.text }) }}")))

N.append(airtable("patchRecord", "Airtable: Update Record", [1200, 320], "PATCH",
    Expr(AIRTABLE + "/{{ $json.table }}/{{ $json.id }}"),
    body=Expr("{{ JSON.stringify({ typecast: true, fields: $json.fields }) }}"), continue_on_error=True))

NOTE = sticky_note("note", (
    "## Client OS · WF-C3 Brief Shared + Daily Run\n\n"
    "**Brief shared:** polls Airtable every minute. When *Brief Status* becomes *Shared with Client*, the client gets the brief link in `ext-` and the team is told in `int-`.\n\n"
    "**Weekdays 09:00 (server time):** sends due Pulse Surveys (Week 1 / Month 1 / Quarterly), 3-day reminders and expiry at 10 days. "
    "Also onboarding nudges (48h client, 96h team), overdue brief reviews and approvals, overdue client updates (Health → Amber), "
    "and a morning digest in #designme-operations.\n\nEdit `CONFIG` in both Code nodes for the portal URL."), [0, -400], height=340)

COMPOSITION = """
export default workflow('client-os-wf-c3', 'Client OS · WF-C3 Brief Shared + Daily Run')
  .add(briefShared)
  .to(composeShared)
  .to(routeKind.onCase(0, postSlack).onCase(1, patchRecord))
  .add(moodboardSent)
  .to(composeMoodboard)
  .to(routeKind)
  .add(daily)
  .to(getProjects)
  .to(getPulses)
  .to(planDaily)
  .to(routeKind)
  .add(note);
"""

if __name__ == "__main__":
    print(render(N, [NOTE], COMPOSITION))
