"""WF-C4 · Attio deal marked Paid → Airtable project → onboarding.

One Attio deal = one Project. The Attio company is the Client, so a client
with several deals gets several Projects under one Client record (and WF-C1
reuses their int-/ext- channels and ClickUp folder).
"""
import os
from sdk import *

START_KEY = os.environ.get("START_ONBOARDING_KEY", "REPLACE_WITH_START_ONBOARDING_KEY")
START_URL = "https://n8n-uzay.srv1834652.hstgr.cloud/webhook/9897a6b7-7863-445f-a74a-60aa3358b431/client-os-start-onboarding"
T_DEALS = "tblEaxP5Nml7neANT"
ATTIO = "https://api.attio.com/v2"
ATTIO_CRED = {"httpBearerAuth": {"id": "zvMFAuhWorZ3CxtR", "name": "Attio DesignMe Ops"}}
DEALS_OBJECT_ID = "145282d1-c97f-4b1f-a231-c3b9fb1393e6"


def attio(var, name, position, url, output):
    return node(var, "n8n-nodes-base.httpRequest", 4.4, name, position, {
        "method": "GET", "url": url,
        "authentication": "genericCredentialType", "genericAuthType": "httpBearerAuth",
        "options": {"response": {"response": {"neverError": True}}},
    }, output, credentials=ATTIO_CRED, onError="continueRegularOutput")


N = []
N.append(trigger("attioHook", "n8n-nodes-base.webhook", 2.1, "Attio: Deal Updated", [0, 0],
    {"httpMethod": "POST", "path": "client-os-attio-deals", "responseMode": "onReceived", "options": {}},
    [{"body": {"events": [{"event_type": "record.updated", "id": {"object_id": DEALS_OBJECT_ID, "record_id": "00000000-0000-0000-0000-000000000000"}}]}}]))

N.append(code("pickDeals", "Pick Deal IDs", [240, 0], r"""
const DEALS_OBJECT_ID = '""" + DEALS_OBJECT_ID + r"""';
const events = ($input.first().json.body || {}).events || [];
const ids = [...new Set(events
  .filter(e => e && e.id && e.id.object_id === DEALS_OBJECT_ID && e.id.record_id)
  .map(e => e.id.record_id))];
// Only the record id is trusted from the webhook; everything else is re-read from Attio.
return ids.filter(id => /^[0-9a-f-]{36}$/.test(id)).map(id => ({ json: { dealId: id } }));
""", [{"dealId": "00000000-0000-0000-0000-000000000000"}]))

N.append(attio("getDeal", "Attio: Get Deal", [480, 0], Expr(ATTIO + "/objects/deals/records/{{ $json.dealId }}"),
    [{"data": {"id": {"record_id": "00000000-0000-0000-0000-000000000000"}, "web_url": "https://app.attio.com", "values": {}}}]))

N.append(code("checkPaid", "Is Deal Paid?", [720, 0], r"""
const CONFIG = { paidStage: 'Paid' };
const out = [];
for (const item of $input.all()) {
  const d = item.json.data;
  if (!d || !d.values) continue;
  const v = d.values;
  const one = (k) => (v[k] || [])[0] || {};
  const stage = (one('stage').status || {}).title || '';
  if (stage.toLowerCase() !== CONFIG.paidStage.toLowerCase()) continue;
  const service = String(one('service').value || '');
  const services = [];
  if (/brand|logo|identity/i.test(service)) services.push('Branding');
  if (/web ?site|landing|webflow|framer/i.test(service)) services.push('Website Design', 'Website Development');
  if (/product|ui|ux|app|mobile|saas|dashboard/i.test(service)) services.push('Product / UI-UX');
  const value = one('value');
  out.push({ json: {
    dealId: d.id.record_id,
    dealUrl: d.web_url || '',
    dealName: String(one('name').value || 'New deal'),
    amount: value.currency_value || 0,
    currency: value.currency_code || 'USD',
    service,
    services,
    notes: String(one('notes').value || ''),
    paymentMethod: (one('payment_method').option || {}).title || '',
    dealEmail: String(one('email_6').value || '').trim(),
    companyId: one('associated_company').target_record_id || '',
    personId: one('associated_people').target_record_id || '',
    ownerId: one('owner').referenced_actor_type === 'workspace-member' ? one('owner').referenced_actor_id : ''
  } });
}
return out;
""", [{"dealId": "00000000-0000-0000-0000-000000000000", "dealUrl": "https://app.attio.com", "dealName": "Acme", "amount": 10000, "currency": "USD", "service": "Website", "services": ["Website Design", "Website Development"], "notes": "", "paymentMethod": "", "dealEmail": "", "companyId": "c1", "personId": "p1", "ownerId": "o1"}]))

N.append(airtable("findDeal", "Airtable: Find Existing Deal", [960, 0], "GET", "/" + T_DEALS,
    query=[("filterByFormula", Expr("{Attio Deal ID}='{{ $json.dealId }}'")), ("maxRecords", "1")],
    output=[{"records": []}]))

N.append(code("skipKnown", "Skip If Project Exists", [1200, 0], r"""
const deals = $('Is Deal Paid?').all();
const out = [];
$input.all().forEach((r, i) => {
  const rec = (r.json.records || [])[0];
  // Idempotent: a deal that already has a Project is never set up twice.
  if (rec && ((rec.fields || {}).Projects || []).length) return;
  out.push({ json: deals[i].json });
});
return out;
""", [{"dealId": "00000000-0000-0000-0000-000000000000", "companyId": "c1", "personId": "p1", "ownerId": "o1"}]))

N.append(attio("getCompany", "Attio: Get Company", [1440, 0],
    Expr(ATTIO + "/objects/companies/records/{{ $json.companyId || 'none' }}"),
    [{"data": {"values": {"name": [{"value": "Acme"}], "domains": [{"domain": "acme.com"}]}}}]))
N.append(attio("getPerson", "Attio: Get Contact", [1680, 0],
    Expr(ATTIO + "/objects/people/records/{{ $('Skip If Project Exists').item.json.personId || 'none' }}"),
    [{"data": {"values": {"name": [{"full_name": "Jane Doe"}], "email_addresses": [{"email_address": "jane@acme.com"}]}}}]))
N.append(attio("getOwner", "Attio: Get Deal Owner", [1920, 0],
    Expr(ATTIO + "/workspace_members/{{ $('Skip If Project Exists').item.json.ownerId || 'none' }}"),
    [{"data": {"email_address": "luke@designme.agency"}}]))

N.append(code("plan", "Plan Records", [2160, 0], r"""
const deals = $('Skip If Project Exists').all();
const companies = $('Attio: Get Company').all();
const people = $('Attio: Get Contact').all();
const out = [];
$input.all().forEach((o, i) => {
  const d = deals[i].json;
  const cv = ((companies[i].json.data || {}).values) || {};
  const pv = ((people[i].json.data || {}).values) || {};
  const company = String(((cv.name || [])[0] || {}).value || d.dealName);
  const domain = ((cv.domains || [])[0] || {}).domain || '';
  const contactName = String(((pv.name || [])[0] || {}).full_name || '');
  const contactEmail = (d.dealEmail || ((pv.email_addresses || [])[0] || {}).email_address || '').toLowerCase();
  const ownerEmail = ((o.json.data || {}).email_address) || '';
  const label = d.services.includes('Branding') && d.services.length === 1 ? 'Branding'
    : d.services.includes('Product / UI-UX') && !d.services.includes('Website Design') ? 'Product'
    : d.services.length ? 'Website' : 'Project';
  const projectName = d.dealName && d.dealName !== company ? d.dealName : company + ': ' + label;
  const today = new Date().toISOString().slice(0, 10);
  const currency = ['EUR', 'USD', 'GBP', 'PLN'].includes(d.currency) ? d.currency : undefined;
  const scope = [d.notes, '', 'Sold in Attio: ' + (d.service || 'n/a') + ' · ' + d.amount + ' ' + d.currency].join('\n').trim();
  out.push({ json: Object.assign({}, d, {
    company, contactName, contactEmail, ownerEmail, projectName,
    clientUpsert: { performUpsert: { fieldsToMergeOn: ['Attio Record ID'] }, typecast: true, records: [{ fields: {
      'Client Name': company,
      'Attio Record ID': d.companyId || ('deal-' + d.dealId),
      'Attio Link': d.companyId ? 'https://app.attio.com/design-me/companies/record/' + d.companyId : d.dealUrl,
      ...(domain ? { 'Website': 'https://' + domain } : {}),
      ...(contactName ? { 'Primary Contact': contactName } : {}),
      ...(contactEmail ? { 'Contact Email': contactEmail } : {})
    } }] },
    dealUpsert: { performUpsert: { fieldsToMergeOn: ['Attio Deal ID'] }, typecast: true, records: [{ fields: {
      'Deal Name': projectName,
      'Attio Deal ID': d.dealId,
      'Attio Link': d.dealUrl,
      'Deal Type': 'Project',
      'Status': 'Active',
      'Deal Value': d.amount,
      ...(currency ? { 'Currency': currency } : {}),
      'Won Date': today,
      'Notes': 'Services: ' + (d.service || 'n/a')
    } }] },
    project: { typecast: true, fields: {
      'Project Name': projectName,
      'Service Type': d.services,
      'Stage': '0. Awaiting Payment',
      'Contact Name': contactName,
      ...(contactEmail ? { 'Contact Email': contactEmail } : {}),
      'Proposal Scope': scope
    } }
  }) });
});
return out;
""", [{"dealId": "00000000-0000-0000-0000-000000000000", "company": "Acme", "projectName": "Acme: Website", "ownerEmail": "luke@designme.agency", "amount": 10000, "currency": "USD", "notes": "", "clientUpsert": {}, "dealUpsert": {}, "project": {"fields": {}}}]))

N.append(airtable("upsertClient", "Airtable: Upsert Client", [2400, 0], "PATCH", "/" + T_CLIENTS,
    body=Expr("{{ JSON.stringify($json.clientUpsert) }}"), output=[{"records": [{"id": "recCCCCCCCCCCCCCC"}], "createdRecords": ["recCCCCCCCCCCCCCC"]}]))
N.append(airtable("upsertDeal", "Airtable: Upsert Deal", [2640, 0], "PATCH", "/" + T_DEALS,
    body=Expr("{{ JSON.stringify(Object.assign({}, $('Plan Records').item.json.dealUpsert, { records: [{ fields: Object.assign({}, $('Plan Records').item.json.dealUpsert.records[0].fields, { 'Client': [$('Airtable: Upsert Client').item.json.records[0].id] }) }] })) }}"),
    output=[{"records": [{"id": "recDDDDDDDDDDDDDD"}]}]))
N.append(airtable("createProject", "Airtable: Create Project", [2880, 0], "POST", "/" + T_PROJECTS,
    body=Expr("{{ JSON.stringify({ typecast: true, fields: Object.assign({}, $('Plan Records').item.json.project.fields, { 'Client': [$('Airtable: Upsert Client').item.json.records[0].id], 'Deal': [$json.records[0].id] }) }) }}"),
    output=[{"id": "recPPPPPPPPPPPPPP", "fields": {}}]))
N.append(airtable("setLead", "Airtable: Set Project Lead", [3120, 0], "PATCH",
    Expr(AIRTABLE + "/" + T_PROJECTS + "/{{ $json.id }}"),
    body=Expr("{{ JSON.stringify({ fields: { 'Project Lead': { email: $('Plan Records').item.json.ownerEmail } } }) }}"),
    never_error=True, continue_on_error=True))

P = "$('Plan Records').item.json"
N.append(http("startOnboarding", "Start Onboarding (WF-C1)", [3360, 0], "GET", START_URL,
    "httpHeaderAuth", None,
    query=[("projectId", Expr("{{ $('Airtable: Create Project').item.json.id }}")), ("key", START_KEY),
           ("source", "Attio"), ("amount", Expr("{{ " + P + ".amount }}")), ("currency", Expr("{{ " + P + ".currency }}")),
           ("reference", Expr("{{ " + P + ".dealUrl }}"))],
    never_error=True, continue_on_error=True))
N[-1].spec["config"]["parameters"]["authentication"] = "none"
del N[-1].spec["config"]["parameters"]["nodeCredentialType"]
N[-1].spec["config"].pop("credentials", None)

N.append(slack("notifyOps", "Slack: Notify Ops", [3600, 0], "chat.postMessage",
    Expr("{{ JSON.stringify({ channel: 'C087P172QLF', text: '🤝 Attio deal *' + " + P + ".projectName + '* marked Paid. Project created in Airtable and onboarding started.' + (" + P + ".notes ? '' : '\\n⚠️ The deal has no Notes, so *Proposal Scope* only lists the services sold. Paste the signed proposal into Proposal Scope before the client finishes onboarding: https://airtable.com/appSs3Jhav8TAxBkg/" + T_PROJECTS + "/' + $('Airtable: Create Project').item.json.id) + (" + P + ".contactEmail ? '' : '\\n⚠️ No contact email on the Attio deal or person. Add it to the project and invite the client to Slack manually.') + (" + P + ".services.length ? '' : '\\n⚠️ Could not map the Attio Service \"' + " + P + ".service + '\" to Website / Branding / Product. Set Service Type on the project.') }) }}")))

NOTE = sticky_note("note", (
    "## Client OS · WF-C4 Attio Paid → Project\n\n"
    "Attio webhook (deal stage changes). When a deal's stage becomes **Paid**:\n"
    "1. Upserts the **Client** (by Attio company) and the **Deal** (by Attio deal ID) in Airtable.\n"
    "2. Creates a new **Project** linked to both, with services, contact, deal owner as Project Lead and the deal Notes as Proposal Scope.\n"
    "3. Calls WF-C1's start link, which creates/reuses the client's `int-`/`ext-` channels and sends onboarding.\n\n"
    "One deal = one project, so repeat clients just get a new deal in Attio. A deal that already has a project is skipped. "
    "Change the stage name in **Is Deal Paid?** → `CONFIG.paidStage`."), [0, -420], height=360)

COMPOSITION = """
export default workflow('client-os-wf-c4', 'Client OS · WF-C4 Attio Paid → Project')
  .add(attioHook)
  .to(pickDeals)
  .to(getDeal)
  .to(checkPaid)
  .to(findDeal)
  .to(skipKnown)
  .to(getCompany)
  .to(getPerson)
  .to(getOwner)
  .to(plan)
  .to(upsertClient)
  .to(upsertDeal)
  .to(createProject)
  .to(setLead)
  .to(startOnboarding)
  .to(notifyOps)
  .add(note);
"""

if __name__ == "__main__":
    print(render(N, [NOTE], COMPOSITION))
