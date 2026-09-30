"""Builds the Airtable AI automation payloads (Airtable AI runs the model, no API key).

python3 airtable/build_automations.py brief|moodboard  -> prints create_automation JSON.
"""
import json, sys

T_PROJECTS = "tblcAZMc0kF3drvsm"
T_MOODBOARDS = "tblBl9EIAInz4oqBl"
F = {  # Projects fields
    "name": "fldJ2JVgKBv7vV2wn", "services": "fldH7opaQ8VUDVwfI", "target": "fldUqGzSPmn2ZtAuM",
    "scope": "fldUnFsZ8O8NnYVmr", "answers": "fld7loM0vLoD81pbM", "notes": "fldt2nJFZJHysoKQu",
    "status": "fldNGKdIwZ6uN3ZXA",
}
M = {  # Moodboards fields
    "status": "fld7Fe2O4pGFiq6DB", "type": "fldgh3eXmYvoP3R1W", "responses": "fld4aB8cWzDzpU8G1",
    "notes": "fldgYrKIUXgwOWSvu",
}

def ref(*path, key="trigger"):
    return {"$ref": key, "path": list(path)}

def cell(fid):
    return ref("cellValuesByFieldId", fid)

S = {"type": "string"}
def arr(x): return {"type": "array", "items": x}
def obj(**props): return {"type": "object", "properties": props}

BRIEF_SCHEMA = obj(
    project_title=S, executive_summary=S,
    client_snapshot=obj(company=S, audience=S, positioning=S),
    objectives=arr(obj(objective=S, success_metric=S)),
    scope=obj(in_scope=arr(S), out_of_scope=arr(S), assumptions=arr(S)),
    deliverables=arr(obj(name=S, description=S, service=S)),
    phases=arr(obj(name=S, timing=S, goal=S, activities=arr(S), client_inputs=arr(S), approval_gate=S)),
    design_direction=obj(feel_words=arr(S), visual_direction=S, references=S),
    dos=arr(S), donts=arr(S), client_responsibilities=arr(S), agency_commitments=arr(S),
    communication_plan=obj(channels=S, cadence=S, feedback_turnaround=S, decision_maker=S),
    risks=arr(obj(risk=S, mitigation=S)), open_questions=arr(S),
    internal=obj(expectation_gaps=arr(S), team_watchouts=arr(S), suggested_upsells=arr(S)),
)

DIRECTION_SCHEMA = obj(
    headline=S, summary=S, keywords=arr(S), loves=arr(S), avoid=arr(S),
    colour=S, typography=S, imagery=S, layout=S, designer_notes=arr(S), open_questions=arr(S),
)

BRIEF_INSTRUCTIONS = """You are the senior project strategist at DesignMe, a design agency doing website design and development, branding, and product (UI/UX) design.

Turn the signed proposal plus the client's onboarding answers into a Project Brief. The brief is shared with the client and becomes the single source of truth for the team, so it must remove ambiguity between what the client expects and what we will deliver.

Rules:
- The proposal defines scope. If the client's answers ask for more than, or something different from, the proposal, do not add it to scope. List it kindly in scope.out_of_scope (e.g. "Copywriting. Can be added as a separate scope.") and bluntly in internal.expectation_gaps. If there is no proposal, treat scope as unconfirmed and say so in internal.team_watchouts.
- Be specific to this client. Quote their words where it helps. No generic agency filler.
- dos and donts are concrete design and working instructions for our designers, drawn from what the client said.
- Phases follow our process: Discovery, Moodboard, Design, (Development if in scope), Revisions, Handover. Relative timing only (e.g. "Week 1-2"). Never invent calendar dates.
- Missing or contradictory information goes into open_questions. Do not guess.
- Client-facing text is warm, confident, plain English: "we" = DesignMe, "you" = the client. executive_summary is 3-5 sentences.
- Internal notes from the DesignMe team, if any, override everything else.
- Use these operating standards in communication_plan and agency_commitments: we reply within 1 business day at the latest (usually same day); every Monday a plan for the week and every Thursday a progress update in the shared Slack channel; consolidated feedback from one decision-maker within 2 business days; 2 revision rounds per deliverable; written approval at the end of each phase; Slack Connect for day-to-day, email for formal documents; check-ins after week 1, month 1, then every 3 months.

Onboarding answers are JSON keyed by question id (e.g. why_now, must_avoid, decision_maker). scale_* keys are 1-5 between two poles, e.g. scale_classic_modern: 1 = Classic, 5 = Modern.
"""

WRITE_BRIEF_JS = r"""
const cfg = input.config();
const b = cfg.brief || {};
const table = base.getTable('Projects');
const lines = [b.executive_summary || '', '', 'Objectives:'];
for (const o of b.objectives || []) lines.push('• ' + o.objective + ' (' + o.success_metric + ')');
const gaps = (b.internal && b.internal.expectation_gaps) || [];
if (gaps.length) { lines.push('', '⚠️ Expectation gaps:'); gaps.forEach(g => lines.push('• ' + g)); }
if ((b.open_questions || []).length) { lines.push('', 'Open questions for kickoff:'); b.open_questions.forEach(q => lines.push('• ' + q)); }
await table.updateRecordAsync(cfg.recordId, {
  'Brief JSON': JSON.stringify(b, null, 2),
  'Brief Summary': lines.join('\n').trim(),
  'Brief Status': { name: 'Internal Review' },
  'Stage': { name: '3. Brief Review' },
});
"""

def brief_automation():
    prompt = {"template": [
        BRIEF_INSTRUCTIONS,
        "\n# Project\nName: ", cell(F["name"]),
        "\nServices: ", {"fn": "map", "args": [cell(F["services"]), {"fn": "propertyGetter", "args": ["name"]}]},
        "\nTarget delivery date: ", cell(F["target"]),
        "\n\n# Signed proposal / scope of work\n", cell(F["scope"]),
        "\n\n# Client onboarding answers (JSON)\n", cell(F["answers"]),
        "\n\n# Internal notes from the DesignMe team (highest priority)\n", cell(F["notes"]),
        "\n\nWrite the Project Brief.",
    ]}
    return {
        "name": "Client OS · AI project brief",
        "description": "When a project's Brief Status becomes Queued (client finished onboarding, or the team clicked Regenerate Brief Link), Airtable AI writes the project brief from the proposal, onboarding answers and internal notes, saves it to Brief JSON / Brief Summary and sets Brief Status to Internal Review. n8n then posts it to the int- channel for review.",
        "trigger": {"type": "recordMatchesConditions", "inputs": {"tableId": T_PROJECTS, "filtersObj": {
            "operator": "and", "operands": {"tuple": [{"operator": "=", "operands": {"tuple": [F["status"], "selQvecZoGz348QXA"]}}]}}}},
        "nodes": [
            {"key": "markGenerating", "type": "updateRecord", "description": "Mark the brief as generating",
             "inputs": {"tableId": T_PROJECTS, "rowId": {"template": [ref("id")]}, "updateRecordMethod": "customFields",
                        "fields": {F["status"]: {"id": "selGYl5xKPWQD4H9v"}}}},
            {"key": "writeBrief", "type": "aiGenerateStructuredOutput", "description": "Write the project brief with Airtable AI",
             "inputs": {"prompt": prompt, "model": "default", "outputSchema": {"response": BRIEF_SCHEMA}}},
            {"key": "saveBrief", "type": "customScript",
             "description": "Takes the AI brief from the previous step and saves it on the triggering Projects record: the full brief as JSON in 'Brief JSON', a readable summary (executive summary, objectives, expectation gaps, open questions) in 'Brief Summary', sets 'Brief Status' to 'Internal Review' and 'Stage' to '3. Brief Review'. No external calls.",
             "inputs": {"script": WRITE_BRIEF_JS.strip(), "inputObj": {
                 "recordId": ref("id"),
                 "brief": {"fn": "insertAsData", "args": [ref("response", key="writeBrief")]}}}},
        ],
    }

DIGEST_JS = r"""
const cfg = input.config();
let responses = {};
try { responses = JSON.parse(cfg.responses || '{}'); } catch (e) {}
const lib = base.getTable('Moodboard Library');
const ids = Object.keys(responses);
const { records } = await lib.selectRecordsAsync({ fields: ['Title', 'Category', 'Style Tags', 'Description'] });
const byId = new Map(records.map(r => [r.id, r]));
const label = { love: 'LOVED', like: 'LIKED', dislike: 'NOT FOR ME' };
const lines = [];
for (const rating of ['love', 'like', 'dislike']) {
  for (const id of ids.filter(i => responses[i].rating === rating)) {
    const r = byId.get(id);
    if (!r) continue;
    const note = responses[id].note ? ' | client note: "' + responses[id].note + '"' : '';
    lines.push('[' + label[rating] + '] ' + r.getCellValueAsString('Category') + ': ' + r.getCellValueAsString('Title') +
      ' | tags: ' + r.getCellValueAsString('Style Tags') + ' | ' + r.getCellValueAsString('Description') + note);
  }
}
output.set('digest', lines.join('\n'));
"""

WRITE_DIRECTION_JS = r"""
const cfg = input.config();
const d = cfg.direction || {};
await base.getTable('Moodboards').updateRecordAsync(cfg.recordId, {
  'Direction JSON': JSON.stringify(d, null, 2),
  'Summary': (d.headline || '') + '\n\n' + (d.summary || ''),
  'Designer Notes': (d.designer_notes || []).map(n => '• ' + n).join('\n'),
  'Completed At': new Date().toISOString(),
  'Status': { name: 'Completed' },
});
"""

MOOD_INSTRUCTIONS = """You are the design director at DesignMe, a design agency. A client just went through a moodboard, rating design references as LOVED, LIKED or NOT FOR ME, sometimes with a note. Each reference below is described by its category, title, style tags and a short description written by our designers.

Find the patterns across what they loved versus rejected: colour, contrast, typography, imagery, layout density, tone, craft details. The client's own notes outrank your inferences. Be specific ("high-contrast serif headlines on warm off-white", not "clean and modern"). Where choices contradict each other, say so in open_questions rather than papering over it.

Client-facing fields (headline, summary, keywords, loves, avoid, colour, typography, imagery, layout) are warm plain English addressed to the client as "you"; summary is 3-5 sentences; headline is one short line; 5-8 keywords. layout covers layout, composition and density (or logo construction for branding). designer_notes are blunt, concrete instructions for the designer and are never shown to the client.
"""

def moodboard_automation():
    prompt = {"template": [
        MOOD_INSTRUCTIONS,
        "\nMoodboard type: ", ref("cellValuesByFieldId", M["type"], "name"),
        "\n\n# Rated references\n", ref("digest", key="digest"),
        "\n\n# Client's closing notes\n", cell(M["notes"]),
        "\n\nWrite the moodboard direction.",
    ]}
    return {
        "name": "Client OS · AI moodboard summary",
        "description": "When a client finishes the moodboard swiper (Status becomes In Progress with responses saved), Airtable AI turns their loved / liked / rejected references into a written direction and designer notes, then marks the moodboard Completed. n8n posts the summary to Slack.",
        "trigger": {"type": "recordMatchesConditions", "inputs": {"tableId": T_MOODBOARDS, "filtersObj": {
            "operator": "and", "operands": {"tuple": [
                {"operator": "=", "operands": {"tuple": [M["status"], "selxO3WRO84aUtVFP"]}},
                {"operator": "isNotEmpty", "operands": {"tuple": [M["responses"]]}}]}}}},
        "nodes": [
            {"key": "digest", "type": "customScript",
             "description": "Reads the client's ratings from 'Responses JSON' on the triggering moodboard, looks up each rated reference in the 'Moodboard Library' table (Title, Category, Style Tags, Description) and outputs one text line per reference labelled LOVED, LIKED or NOT FOR ME, including the client's note. No external calls.",
             "inputs": {"script": DIGEST_JS.strip(), "inputObj": {"responses": cell(M["responses"])}},
             "outputSchema": [{"name": "digest", "type": "string"}]},
            {"key": "writeDirection", "type": "aiGenerateStructuredOutput", "description": "Write the moodboard direction with Airtable AI",
             "inputs": {"prompt": prompt, "model": "default", "outputSchema": {"response": DIRECTION_SCHEMA}}},
            {"key": "saveDirection", "type": "customScript",
             "description": "Saves the AI direction on the triggering Moodboards record: full JSON in 'Direction JSON', headline + summary in 'Summary', bulleted 'Designer Notes', 'Completed At' = now, and 'Status' = 'Completed'. No external calls.",
             "inputs": {"script": WRITE_DIRECTION_JS.strip(), "inputObj": {
                 "recordId": ref("id"),
                 "direction": {"fn": "insertAsData", "args": [ref("response", key="writeDirection")]}}}},
        ],
    }

if __name__ == "__main__":
    which = sys.argv[1]
    print(json.dumps(brief_automation() if which == "brief" else moodboard_automation(), ensure_ascii=False))
