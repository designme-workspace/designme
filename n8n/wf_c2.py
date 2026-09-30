"""WF-C2 · Portal events router."""
import os
from sdk import *

SECRET = os.environ.get("EVENTS_SECRET", "REPLACE_WITH_N8N_EVENTS_WEBHOOK_SECRET")
CLIENTS_SPACE = "90152844857"

N = []
N.append(trigger("portalEvents", "n8n-nodes-base.webhook", 2.1, "Portal Events", [0, 0],
    {"httpMethod": "POST", "path": "client-os-portal-events", "responseMode": "onReceived",
     "options": {"onlyRunIf": Expr("{{ $json.headers['x-designme-secret'] === '" + SECRET + "' }}")}},
    [{"headers": {}, "body": {"type": "brief.ready", "projectId": "recXXXXXXXXXXXXXX", "expectationGaps": [], "openQuestions": []}}]))

N.append(code("normalizeEvent", "Normalize Event", [240, 0], r"""
const b = $input.first().json.body || {};
if (!b.type || !/^rec[A-Za-z0-9]{14}$/.test(String(b.projectId || ''))) return [];
return [{ json: b }];
""", [{"type": "brief.ready", "projectId": "recXXXXXXXXXXXXXX"}]))

N.append(airtable("getProject", "Airtable: Get Project", [480, 0], "GET",
    Expr(AIRTABLE + "/" + T_PROJECTS + "/{{ $json.projectId }}"),
    output=[{"id": "recXXXXXXXXXXXXXX", "fields": {"Project Name": "Acme: Website Redesign", "Slack INT Channel ID": "C1", "Slack EXT Channel ID": "C2"}}]))

N.append(code("buildActions", "Build Messages", [720, 0], r"""
const CONFIG = {
  opsChannel: 'C087P172QLF',
  kickoffBookingUrl: 'https://cal.com/designme-luke/30min',
  airtableProjectUrl: 'https://airtable.com/appSs3Jhav8TAxBkg/tblcAZMc0kF3drvsm/'
};
const e = $('Normalize Event').first().json;
const p = $input.first().json;
const f = p.fields || {};
const name = f['Project Name'] || 'Project';
const intCh = f['Slack INT Channel ID'] || CONFIG.opsChannel;
const extCh = f['Slack EXT Channel ID'];
const record = CONFIG.airtableProjectUrl + p.id;
const bullets = (arr) => (arr || []).map(x => '• ' + x).join('\n');
const msgs = [];
switch (e.type) {
  case 'onboarding.completed':
    msgs.push({ channel: intCh, text: '📝 *' + name + '*: the client completed onboarding.' + (e.decisionMaker ? '\nDecision-maker: ' + e.decisionMaker : '') + (e.deadline ? '\nHard deadline: ' + e.deadline : '') + '\nThe AI brief is generating (about 2 minutes) and the ClickUp board is being created.' });
    break;
  case 'brief.ready':
    msgs.push({ channel: intCh, text: [
      '🧠 *' + name + '*: brief draft ready for review (target: within 1 business day).',
      'Preview (team only): ' + (f['Brief Preview Link'] || record),
      (e.expectationGaps || []).length ? '\n⚠️ *Expectation gaps*\n' + bullets(e.expectationGaps) : '',
      (e.openQuestions || []).length ? '\n❓ *Open questions for kickoff*\n' + bullets(e.openQuestions) : '',
      '\nNeeds fixes? Add them to *Brief Internal Notes* and open the *Regenerate Brief Link*. Happy with it? Set *Brief Status* to *Shared with Client*: ' + record
    ].filter(Boolean).join('\n') });
    break;
  case 'brief.failed':
    msgs.push({ channel: intCh, text: '🚨 *' + name + '*: brief generation failed (' + (e.error || 'unknown error') + '). Retry with the Regenerate Brief Link: ' + record });
    msgs.push({ channel: CONFIG.opsChannel, text: '🚨 Brief generation failed for *' + name + '*: ' + (e.error || 'unknown error') });
    break;
  case 'brief.changes_requested':
    msgs.push({ channel: intCh, text: '✏️ *' + name + '*: ' + (e.requestedBy || 'the client') + ' requested changes to the brief:\n>' + String(e.feedback || '').replace(/\n/g, '\n>') + '\nAdd corrections to *Brief Internal Notes*, open the *Regenerate Brief Link*, then share again (within 1 business day): ' + record });
    break;
  case 'brief.approved':
    msgs.push({ channel: intCh, text: '✅ *' + name + '*: brief approved by ' + (e.approvedBy || 'the client') + '. Book the kickoff within 3 business days. Week 1 / Month 1 / Quarterly check-ins are scheduled.' });
    if (extCh) msgs.push({ channel: extCh, text: '🎉 Thanks ' + (e.approvedBy || '') + ' for approving the project brief! It is now our shared source of truth.\n*Next step:* the kickoff call. Grab a time that suits you: ' + CONFIG.kickoffBookingUrl });
    break;
  case 'moodboard.completed': {
    const c = e.counts || {};
    msgs.push({ channel: intCh, text: [
      '🎨 *' + name + '*: moodboard completed (' + (c.love || 0) + ' loved · ' + (c.like || 0) + ' liked · ' + (c.dislike || 0) + ' passed).',
      '*' + (e.headline || '') + '*' + ((e.keywords || []).length ? ' · ' + e.keywords.join(', ') : ''),
      (e.designerNotes || []).length ? '\n🧭 *Designer notes*\n' + bullets(e.designerNotes) : '',
      (e.avoid || []).length ? '\n🚫 *Avoid*\n' + bullets(e.avoid) : '',
      (e.openQuestions || []).length ? '\n❓ *Clarify with the client*\n' + bullets(e.openQuestions) : '',
      '\nFull direction: https://airtable.com/appSs3Jhav8TAxBkg/tblBl9EIAInz4oqBl/' + e.moodboardId
    ].filter(Boolean).join('\n') });
    if (extCh) msgs.push({ channel: extCh, text: '🎨 Thanks for going through the moodboard! Your summary is in your project hub, and your designer is reviewing your picks now.' });
    break;
  }
  case 'moodboard.failed':
    msgs.push({ channel: intCh, text: '🚨 *' + name + '*: the client finished the moodboard but the AI summary failed (' + (e.error || 'unknown') + '). Their picks are saved in Airtable (Moodboards). Set Status back to In Progress and ask the dev team, or summarise manually.' });
    break;
  case 'pulse.completed': {
    const nps = e.NPS;
    const cat = nps >= 9 ? 'Promoter' : nps >= 7 ? 'Passive' : 'Detractor';
    const stars = (k) => e[k] ? e[k] + '/5' : 'n/a';
    msgs.push({ channel: intCh, text: [
      '📊 *' + name + '*: ' + (e.pulseType || '') + ' check-in received',
      'NPS *' + nps + '* (' + cat + ') · Communication ' + stars('Communication') + ' · Quality ' + stars('Quality') + ' · Timeliness ' + stars('Timeliness'),
      e['Expectations Met'] ? 'Expectations: ' + e['Expectations Met'] : '',
      e['Going Well'] ? '👍 ' + e['Going Well'] : '',
      e['Could Improve'] ? '🔧 ' + e['Could Improve'] : '',
      e['Open To Testimonial'] ? '🌟 Open to a testimonial + Clutch review. Send the $1,000 design-time offer.' : ''
    ].filter(Boolean).join('\n') });
    if (e.followUpNeeded) msgs.push({ channel: CONFIG.opsChannel, text: '🚨 *Unhappy client*: ' + name + ' scored NPS ' + nps + ' (' + (e.pulseType || '') + '). Call them within 1 business day, then fill *Follow-up Owner* and *Follow-up Notes* in Pulse Surveys. Project health is now Red.' });
    break;
  }
}
return [{ json: { type: e.type, event: e, project: p, messages: msgs } }];
""", [{"type": "brief.ready", "event": {}, "project": {"id": "recXXXXXXXXXXXXXX", "fields": {}}, "messages": [{"channel": "C1", "text": "hi"}]}]))

N.append(code("splitMessages", "Split Messages", [960, -160], r"""
return $input.first().json.messages.filter(m => m.channel && m.text).map(m => ({ json: m }));
""", [{"channel": "C1", "text": "hi"}]))

N.append(slack("postSlack", "Slack: Post Message", [1200, -160], "chat.postMessage",
    Expr("{{ JSON.stringify({ channel: $json.channel, text: $json.text }) }}")))

N.append(switch_on("routeType", "Needs Setup?", [960, 160], "{{ $json.type }}", ["onboarding.completed", "brief.approved"]))

# --- onboarding.completed → ClickUp board from templates ---
N.append(clickup("listFolders", "ClickUp: List Client Folders", [1200, 80], "GET",
    "https://api.clickup.com/api/v2/space/" + CLIENTS_SPACE + "/folder?archived=false",
    output=[{"folders": [{"id": "901", "name": "Acme"}]}]))

N.append(code("planClickUp", "Plan ClickUp Board", [1440, 80], r"""
const TEMPLATES = {
  website: { listId: '1200690000006948', label: 'Website' },
  branding: { listId: '1200690000006949', label: 'Branding' },
  product: { listId: '1200690000006950', label: 'Product' }
};
const p = $('Build Messages').first().json.project;
const f = p.fields || {};
const services = f['Service Type'] || [];
const clientName = (f['Client Name'] || [])[0] || String(f['Project Name'] || 'Client').split(':')[0].trim();
const existing = ($input.first().json.folders || []).find(x => x.name.toLowerCase() === clientName.toLowerCase());
const picks = [];
if (services.includes('Website Design') || services.includes('Website Development')) picks.push(TEMPLATES.website);
if (services.includes('Branding')) picks.push(TEMPLATES.branding);
if (services.includes('Product / UI-UX')) picks.push(TEMPLATES.product);
if (!picks.length) picks.push(TEMPLATES.website);
return [{ json: {
  projectId: p.id,
  projectName: f['Project Name'] || clientName,
  clientName,
  folderId: f['ClickUp Folder ID'] || (existing ? existing.id : ''),
  includeDev: services.includes('Website Development'),
  kickoff: f['Kickoff Date'] || '',
  templates: picks
} }];
""", [{"projectId": "recXXXXXXXXXXXXXX", "projectName": "Acme: Website Redesign", "clientName": "Acme", "folderId": "", "includeDev": True, "kickoff": "", "templates": [{"listId": "1200690000006948", "label": "Website"}]}]))

N.append(clickup("createFolder", "ClickUp: Create Client Folder", [1680, 80], "POST",
    "https://api.clickup.com/api/v2/space/" + CLIENTS_SPACE + "/folder",
    body=Expr("{{ JSON.stringify({ name: $json.clientName }) }}"), never_error=True, continue_on_error=True,
    output=[{"id": "901", "name": "Acme"}]))

N.append(code("resolveFolder", "Resolve Folder & Templates", [1920, 80], r"""
const plan = $('Plan ClickUp Board').first().json;
const created = $input.first().json;
const folderId = plan.folderId || created.id || '';
if (!folderId) throw new Error('Could not create or find the ClickUp folder for ' + plan.clientName + ': ' + JSON.stringify(created));
return plan.templates.map(t => ({ json: Object.assign({}, plan, { folderId, template: t }) }));
""", [{"projectId": "recXXXXXXXXXXXXXX", "projectName": "Acme: Website Redesign", "folderId": "901", "includeDev": True, "kickoff": "", "template": {"listId": "1200690000006948", "label": "Website"}}]))

N.append(clickup("getTemplateTasks", "ClickUp: Get Template Tasks", [2160, 80], "GET",
    Expr("https://api.clickup.com/api/v2/list/{{ $json.template.listId }}/task?include_markdown_description=true&subtasks=false&order_by=created&reverse=true"),
    output=[{"tasks": [{"name": "🚀 Kickoff call", "markdown_description": "…", "due_date": "1893974400000"}]}]))

N.append(clickup("createList", "ClickUp: Create Project List", [2400, 80], "POST",
    Expr("https://api.clickup.com/api/v2/folder/{{ $('Resolve Folder & Templates').item.json.folderId }}/list"),
    body=Expr("{{ JSON.stringify({ name: $('Resolve Folder & Templates').item.json.projectName + ' · ' + $('Resolve Folder & Templates').item.json.template.label }) }}"),
    output=[{"id": "9015000000", "name": "Acme · Website", "url": "https://app.clickup.com/..."}]))

N.append(code("buildTasks", "Build Tasks (shift dates)", [2640, 80], r"""
const ANCHOR = new Date(Date.UTC(2030, 0, 7));
const DEV = /^(🛠️|🧪|🌐)/;
const plans = $('Resolve Folder & Templates').all();
const templates = $('ClickUp: Get Template Tasks').all();
const lists = $input.all();
const isWeekend = d => d.getUTCDay() === 0 || d.getUTCDay() === 6;
function businessDaysBetween(a, b) {
  let n = 0; const d = new Date(a);
  while (d < b) { d.setUTCDate(d.getUTCDate() + 1); if (!isWeekend(d)) n++; }
  return n;
}
function addBusinessDays(a, n) {
  const d = new Date(a);
  while (n > 0) { d.setUTCDate(d.getUTCDate() + 1); if (!isWeekend(d)) n--; }
  return d;
}
function defaultKickoff() {
  const d = new Date(); d.setUTCHours(0, 0, 0, 0);
  return addBusinessDays(d, 3);
}
const out = [];
lists.forEach((l, i) => {
  const plan = plans[i].json;
  let kickoff = plan.kickoff ? new Date(plan.kickoff + 'T00:00:00Z') : defaultKickoff();
  while (isWeekend(kickoff)) kickoff.setUTCDate(kickoff.getUTCDate() + 1);
  const tasks = (templates[i].json.tasks || []).slice().sort((a, b) => Number(a.due_date || 0) - Number(b.due_date || 0));
  for (const t of tasks) {
    if (!plan.includeDev && plan.template.label === 'Website' && (DEV.test(t.name) || /staging/i.test(t.name))) continue;
    const body = { name: t.name, markdown_content: t.markdown_description || t.description || '' };
    if (t.due_date) {
      const day = new Date(Math.floor((Number(t.due_date) + 6 * 3600e3) / 86400e3) * 86400e3);
      const due = addBusinessDays(kickoff, businessDaysBetween(ANCHOR, day));
      due.setUTCHours(17, 0, 0, 0);
      body.due_date = due.getTime();
      body.due_date_time = false;
    }
    out.push({ json: { listId: l.json.id, body } });
  }
});
return out;
""", [{"listId": "9015000000", "body": {"name": "🚀 Kickoff call", "markdown_content": "…", "due_date": 1893974400000}}]))

N.append(clickup("createTask", "ClickUp: Create Task", [2880, 80], "POST",
    Expr("https://api.clickup.com/api/v2/list/{{ $json.listId }}/task"),
    body=Expr("{{ JSON.stringify($json.body) }}"), continue_on_error=True,
    output=[{"id": "abc", "name": "🚀 Kickoff call"}]))

N.append(code("summarizeBoard", "Summarize Board", [3120, 80], r"""
const plan = $('Plan ClickUp Board').first().json;
const lists = $('ClickUp: Create Project List').all().map(l => l.json);
const created = $input.all().filter(t => t.json.id).length;
const folderUrl = 'https://app.clickup.com/9015730430/v/f/' + $('Resolve Folder & Templates').first().json.folderId;
const p = $('Build Messages').first().json.project;
return [{ json: {
  projectId: plan.projectId,
  patch: { typecast: true, fields: {
    'ClickUp Folder ID': $('Resolve Folder & Templates').first().json.folderId,
    'ClickUp List ID': lists.map(l => l.id).join(','),
    'ClickUp List URL': lists[0] && lists[0].url ? lists[0].url : folderUrl
  } },
  channel: (p.fields || {})['Slack INT Channel ID'] || 'C087P172QLF',
  text: '📋 ClickUp board ready for *' + plan.projectName + '*: ' + created + ' tasks across ' + lists.map(l => l.name).join(', ') + '.\n' + lists.map(l => l.url || '').filter(Boolean).join('\n') + '\nDue dates are counted from ' + (plan.kickoff ? 'the kickoff date (' + plan.kickoff + ')' : 'an estimated kickoff 3 business days from now') + '. Adjust if the kickoff moves, assign owners, and share the folder with the client as a guest (folder only).'
} }];
""", [{"projectId": "recXXXXXXXXXXXXXX", "patch": {"fields": {}}, "channel": "C1", "text": "hi"}]))

N.append(airtable("saveBoard", "Airtable: Save ClickUp Links", [3360, 80], "PATCH",
    Expr(AIRTABLE + "/" + T_PROJECTS + "/{{ $json.projectId }}"),
    body=Expr("{{ JSON.stringify($json.patch) }}"), continue_on_error=True))

N.append(slack("postBoard", "Slack: Board Ready (INT)", [3600, 80], "chat.postMessage",
    Expr("{{ JSON.stringify({ channel: $('Summarize Board').item.json.channel, text: $('Summarize Board').item.json.text }) }}")))

# --- brief.approved → schedule pulse surveys ---
N.append(code("buildPulses", "Build Pulse Schedule", [1200, 320], r"""
const p = $('Build Messages').first().json.project;
const f = p.fields || {};
function token() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let bytes;
  try { bytes = new Uint8Array(32); globalThis.crypto.getRandomValues(bytes); }
  catch (e) { bytes = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)); }
  return Array.from(bytes, b => chars[b % 62]).join('');
}
const start = f['Kickoff Date'] ? new Date(f['Kickoff Date'] + 'T00:00:00Z') : new Date();
const plusDays = n => { const d = new Date(start); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const name = f['Project Name'] || 'Project';
const records = [['Week 1', 7], ['Month 1', 30], ['Quarterly', 90]].map(([type, days]) => ({ fields: {
  'Survey': name + ' · ' + type,
  'Project': [p.id],
  'Type': type,
  'Status': 'Scheduled',
  'Token': token(),
  'Scheduled For': plusDays(days)
} }));
return [{ json: { body: { typecast: true, records } } }];
""", [{"body": {"records": []}}]))

N.append(airtable("createPulses", "Airtable: Create Pulse Surveys", [1440, 320], "POST", "/" + T_PULSE,
    body=Expr("{{ JSON.stringify($json.body) }}"), output=[{"records": []}]))

NOTE = sticky_note("note", (
    "## Client OS · WF-C2 Portal Events\n\n"
    "Receives events from the client portal (header `X-DesignMe-Secret` must match; set the same value as "
    "`N8N_EVENTS_WEBHOOK_SECRET` in Vercel).\n\n"
    "• Every event → Slack messages to the project's `int-` channel (and `ext-` / #designme-operations where relevant).\n"
    "• `onboarding.completed` → ClickUp: client folder in *Clients* (reused if it exists) + one list per service from "
    "*Knowledge Base → Templates*, due dates shifted from the template anchor (2030-01-07) to kickoff.\n"
    "• `brief.approved` → Week 1 / Month 1 / Quarterly Pulse Surveys in Airtable (sent by WF-C3)."), [0, -460], height=360)

COMPOSITION = """
export default workflow('client-os-wf-c2', 'Client OS · WF-C2 Portal Events')
  .add(portalEvents)
  .to(normalizeEvent)
  .to(getProject)
  .to(buildActions)
  .to(splitMessages)
  .to(postSlack)
  .add(buildActions)
  .to(routeType
    .onCase(0, listFolders.to(planClickUp).to(createFolder).to(resolveFolder).to(getTemplateTasks).to(createList).to(buildTasks).to(createTask).to(summarizeBoard).to(saveBoard).to(postBoard))
    .onCase(1, buildPulses.to(createPulses)))
  .add(note);
"""

if __name__ == "__main__":
    print(render(N, [NOTE], COMPOSITION))
