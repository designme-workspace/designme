"""Tiny generator for n8n Workflow SDK code.

The n8n MCP parser only accepts literal SDK code (no helper functions, string
concatenation or .join()), so workflows are described in Python and rendered
to plain SDK JavaScript here.
"""
import json

AIRTABLE = "https://api.airtable.com/v0/appSs3Jhav8TAxBkg"
T_PROJECTS = "tblcAZMc0kF3drvsm"
T_CLIENTS = "tblZK7NcIJrkv4GPJ"
T_PULSE = "tblY8jSdQoMN8vgGZ"

AIRTABLE_CRED = {"airtableTokenApi": {"id": "GbzJx7zsX1Ywdnwl", "name": "Airtable PAT DesignMe Account"}}
SLACK_CRED = {"slackOAuth2Api": {"id": "HY8euXCVnpikfvKd", "name": "DesignMe Slack Bot"}}
CLICKUP_CRED = {"clickUpOAuth2Api": {"id": "tnv5KnUf3RIDby2Y", "name": "ClickUp account"}}
STRIPE_CRED = {"stripeApi": {"id": "h26FwSV4vNMPpXXS", "name": "Adrian Personal Stripe API"}}


class Expr:
    """An n8n expression, rendered as expr('...')."""

    def __init__(self, s):
        self.s = s


def js(v):
    if isinstance(v, Expr):
        return "expr(" + json.dumps(v.s, ensure_ascii=False) + ")"
    if isinstance(v, dict):
        return "{ " + ", ".join(f"{json.dumps(k)}: {js(val)}" for k, val in v.items()) + " }"
    if isinstance(v, list):
        return "[" + ", ".join(js(x) for x in v) + "]"
    return json.dumps(v, ensure_ascii=False)


class Node:
    def __init__(self, var, builder, spec):
        self.var = var
        self.builder = builder
        self.spec = spec

    def render(self):
        return f"const {self.var} = {self.builder}({js(self.spec)});"


def node(var, type_, version, name, position, parameters, output, credentials=None, **extra):
    config = {"name": name, "position": position, "parameters": parameters}
    if credentials:
        config["credentials"] = credentials
    config.update(extra)
    return Node(var, "node", {"type": type_, "version": version, "config": config, "output": output})


def trigger(var, type_, version, name, position, parameters, output, credentials=None):
    config = {"name": name, "position": position, "parameters": parameters}
    if credentials:
        config["credentials"] = credentials
    return Node(var, "trigger", {"type": type_, "version": version, "config": config, "output": output})


def code(var, name, position, js_code, output):
    return node(var, "n8n-nodes-base.code", 2, name, position,
                {"mode": "runOnceForAllItems", "jsCode": js_code.strip()}, output)


def http(var, name, position, method, url, cred_type, credentials, body=None, query=None,
         never_error=False, continue_on_error=False, output=None, execute_once=False):
    params = {
        "method": method,
        "url": url,
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": cred_type,
    }
    if query:
        params["sendQuery"] = True
        params["specifyQuery"] = "keypair"
        params["queryParameters"] = {"parameters": [{"name": k, "value": v} for k, v in query]}
    if body is not None:
        params.update({"sendBody": True, "contentType": "json", "specifyBody": "json", "jsonBody": body})
    if never_error:
        params["options"] = {"response": {"response": {"neverError": True}}}
    extra = {}
    if continue_on_error:
        extra["onError"] = "continueRegularOutput"
    if execute_once:
        extra["executeOnce"] = True
    return node(var, "n8n-nodes-base.httpRequest", 4.4, name, position, params,
                output or [{"ok": True}], credentials=credentials, **extra)


def slack(var, name, position, method, body, output=None):
    return http(var, name, position, "POST", "https://slack.com/api/" + method, "slackOAuth2Api",
                SLACK_CRED, body=body, never_error=True, continue_on_error=True,
                output=output or [{"ok": True, "channel": {"id": "C0000000000"}}])


def airtable(var, name, position, method, path, body=None, query=None, output=None, **kw):
    return http(var, name, position, method, path if isinstance(path, Expr) else AIRTABLE + path,
                "airtableTokenApi", AIRTABLE_CRED, body=body, query=query,
                output=output or [{"id": "recXXXXXXXXXXXXXX", "fields": {}}], **kw)


def clickup(var, name, position, method, url, body=None, output=None, **kw):
    return http(var, name, position, method, url, "clickUpOAuth2Api", CLICKUP_CRED, body=body,
                output=output or [{"id": "123"}], **kw)


def if_true(var, name, position, left_expr):
    return Node(var, "ifElse", {"version": 2.2, "config": {"name": name, "position": position, "parameters": {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose"},
            "conditions": [{"leftValue": Expr(left_expr), "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
            "combinator": "and",
        }}}})


def switch_on(var, name, position, left_expr, values):
    rules = [{
        "outputKey": v,
        "renameOutput": True,
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "conditions": [{"leftValue": Expr(left_expr), "operator": {"type": "string", "operation": "equals"}, "rightValue": v}],
            "combinator": "and",
        },
    } for v in values]
    return Node(var, "switchCase", {"version": 3.4, "config": {"name": name, "position": position, "parameters": {
        "mode": "rules", "rules": {"values": rules}, "options": {}}}})


def sticky_note(var, content, position, width=620, height=380, color=4):
    return f"const {var} = sticky({json.dumps(content, ensure_ascii=False)}, [], {{ color: {color}, position: {json.dumps(position)}, width: {width}, height: {height} }});"


def render(nodes, stickies, composition):
    head = "import { workflow, node, trigger, sticky, ifElse, switchCase, expr } from '@n8n/workflow-sdk';\n\n"
    body = "\n\n".join(n.render() for n in nodes)
    notes = "\n\n".join(stickies)
    return head + body + "\n\n" + notes + "\n\n" + composition.strip() + "\n"
