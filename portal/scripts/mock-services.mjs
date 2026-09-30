// Local mocks for Airtable, the Claude API and the n8n events webhook, so the
// whole portal flow can be exercised without real credentials:
//   node scripts/mock-services.mjs
//   AIRTABLE_TOKEN=x AIRTABLE_API_URL=http://localhost:4010 ANTHROPIC_API_KEY=x \
//   ANTHROPIC_BASE_URL=http://localhost:4010 N8N_EVENTS_WEBHOOK_URL=http://localhost:4010/events \
//   INTERNAL_API_KEY=dev npm run dev
import http from "node:http";

const records = {
  recTESTPROJECT0001: {
    id: "recTESTPROJECT0001",
    createdTime: new Date().toISOString(),
    fields: {
      "Project Name": "Acme: Website Redesign",
      "Service Type": ["Website Design", "Website Development"],
      Stage: "1. Onboarding Sent",
      "Portal Token": "test-token-1234567890",
      "Contact Name": "Jane Doe",
      "Proposal Scope": "8-page Webflow marketing site. 2 revision rounds. Client provides copy.",
      "Slack INT Channel": "int-acme",
      "Slack EXT Channel": "ext-acme",
    },
  },
  recTESTPULSE000001: {
    id: "recTESTPULSE000001",
    createdTime: new Date().toISOString(),
    fields: { Survey: "Acme · Week 1", Project: ["recTESTPROJECT0001"], Type: "Week 1", Status: "Sent", Token: "pulse-token-1234567890" },
  },
};
// Moodboard fixtures: 8 library references + one moodboard for the test project.
const palette = ["#111827", "#f97316", "#3d3bf3", "#16a34a", "#e11d48", "#f5f5f4", "#0ea5e9", "#a855f7"];
const categories = ["Hero Sections", "Hero Sections", "Typography", "Typography", "Colour", "Colour", "Layout & Structure", "Layout & Structure"];
palette.forEach((color, i) => {
  const id = `recLIB${String(i).padStart(11, "0")}`;
  records[id] = {
    id,
    createdTime: new Date().toISOString(),
    table: "tblOMsPPa1k2s03Dy",
    fields: {
      Title: `Reference ${i + 1}`,
      Image: [{ url: `http://localhost:4010/img/${i}.svg` }],
      "Service Type": ["Website"],
      Category: categories[i],
      "Style Tags": i % 2 ? ["Bold"] : ["Minimal"],
      Active: true,
    },
  };
});
records.recMOODBOARD00001 = {
  id: "recMOODBOARD00001",
  createdTime: new Date().toISOString(),
  table: "tblBl9EIAInz4oqBl",
  fields: { Name: "Acme · Website moodboard", Project: ["recTESTPROJECT0001"], Type: "Website", Status: "Sent", "Contact Name": ["Jane Doe"], "Intro Message": "Go with your gut!" },
};
records.recTESTPROJECT0001.fields.Moodboards = ["recMOODBOARD00001"];
export const events = [];

const direction = {
  headline: "Calm, confident and quietly bold",
  summary: "You are drawn to generous whitespace with one strong accent colour.",
  keywords: ["minimal", "confident", "warm"],
  loves: ["Big editorial headlines"],
  avoid: ["Busy gradients"],
  colour: "Warm neutrals with one saturated accent",
  typography: "Large grotesk headlines",
  imagery: "Real product shots",
  layout: "Airy, 12-column, strong grid",
  designer_notes: ["Lead with type, not imagery"],
  open_questions: ["Dark mode?"],
};

const brief = {
  project_title: "Acme website redesign",
  executive_summary: "We will redesign and build Acme's 8-page Webflow site.",
  client_snapshot: { company: "Acme", audience: "Ops leaders", positioning: "Simple automation" },
  objectives: [{ objective: "Increase demo bookings", success_metric: "+30% demo requests in 90 days" }],
  scope: { in_scope: ["8 pages in Webflow"], out_of_scope: ["Copywriting. Can be added as a separate scope."], assumptions: ["Client provides copy"] },
  deliverables: [{ name: "Homepage", description: "Design and build", service: "Website Design" }],
  phases: [{ name: "Discovery", timing: "Week 1", goal: "Align", activities: ["Kickoff call"], client_inputs: ["Brand assets"], approval_gate: "Discovery summary" }],
  design_direction: { feel_words: ["bold", "calm"], visual_direction: "Clean", references: "Linear, Stripe" },
  dos: ["Use real product screenshots"],
  donts: ["No handshake stock photos"],
  client_responsibilities: ["Consolidated feedback in 2 days"],
  agency_commitments: ["Updates Mon/Thu"],
  communication_plan: { channels: "Slack", cadence: "Mon/Thu", feedback_turnaround: "2 business days", decision_maker: "Jane Doe (CEO)" },
  risks: [{ risk: "Copy late", mitigation: "Copy deadline in week 2" }],
  open_questions: ["Who owns DNS?"],
  internal: { expectation_gaps: ["Client expects copywriting; not in proposal"], team_watchouts: [], suggested_upsells: ["Copywriting"] },
};

const read = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const body = await read(req);
  if (url.pathname === "/events") { events.push(JSON.parse(body)); console.log("[n8n event]", body); return json(res, 200, {}); }
  if (url.pathname === "/__state") return json(res, 200, { records, events });
  if (url.pathname.startsWith("/img/")) {
    const i = Number(url.pathname.match(/(\d+)/)[1]);
    res.writeHead(200, { "Content-Type": "image/svg+xml" });
    return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${palette[i]}"/><text x="40" y="320" font-size="64" font-family="sans-serif" fill="${i === 5 ? "#111" : "#fff"}">${categories[i]}</text></svg>`);
  }
  if (url.pathname === "/v1/messages") {
    const parsed = JSON.parse(body);
    console.log("[claude] model=%s betas=%s fallbacks=%s format=%s", parsed.model, req.headers["anthropic-beta"], parsed.fallbacks, parsed.output_config?.format?.type);
    return json(res, 200, {
      id: "msg_mock", type: "message", role: "assistant", model: parsed.model, stop_reason: "end_turn", stop_sequence: null,
      content: [{ type: "text", text: JSON.stringify(String(parsed.system).includes("moodboard") ? direction : brief) }], usage: { input_tokens: 1, output_tokens: 1 },
    });
  }
  const m = url.pathname.match(/^\/v0\/[^/]+\/([^/]+)(?:\/([^/]+))?$/);
  if (m) {
    const [, , id] = m;
    if (req.method === "GET" && id) return records[id] ? json(res, 200, records[id]) : json(res, 404, {});
    if (req.method === "GET" && m[1] === "tblOMsPPa1k2s03Dy") {
      return json(res, 200, { records: Object.values(records).filter((r) => r.table === "tblOMsPPa1k2s03Dy") });
    }
    if (req.method === "GET") {
      const formula = url.searchParams.get("filterByFormula") ?? "";
      const [, field, value] = formula.match(/^\{(.+)\}='(.*)'$/) ?? [];
      return json(res, 200, { records: Object.values(records).filter((r) => r.fields[field] === value) });
    }
    if (req.method === "PATCH" && records[id]) {
      Object.assign(records[id].fields, JSON.parse(body).fields);
      console.log("[airtable] PATCH %s %s", id, Object.keys(JSON.parse(body).fields).join(", "));
      return json(res, 200, records[id]);
    }
  }
  json(res, 404, { error: "not mocked", path: url.pathname });
}).listen(4010, () => console.log("mocks on :4010"));
