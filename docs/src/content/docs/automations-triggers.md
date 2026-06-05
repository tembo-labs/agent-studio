---
title: Automations & triggers
description: Run agents on a schedule or fire them from external events.
---

Beyond on-demand [runs](/agent-studio/running-agents/), agents can run on their
own — on a clock or in response to something happening.

## Automations (schedules)

An **automation** runs an agent on a cron schedule. You pick the agent, the
schedule, an optional input message, and an **owner** — the automation runs as
that owner, so it uses the owner's [connection](/agent-studio/connections/)
credentials. You can also choose whether a schedule runs the agent's stable
version or its live draft.

## Triggers (events)

A **trigger** fires an agent from an external event — a new Gmail message, a
Slack mention, a GitHub PR event, and so on — via Composio. Like automations, an
event run executes as the trigger's owner.

:::note
The owner/acting-user model is the same across manual runs, automations, and
triggers — it determines which credentials a run uses. See
[Core concepts → acting user](/agent-studio/core-concepts/).
:::

Each fired run shows up in [Runs](/agent-studio/dashboard-and-runs/) attributed
to its trigger (manual / schedule / event) so you can tell automated activity
from hand runs.

## External webhooks

An **external webhook** lets any outside system fire an agent by POSTing to a
TAS URL — useful when the event source isn't a Composio toolkit. **Clay** is the
first-class example: Clay sends an enriched row to TAS, and the agent does the
work (e.g. upsert Attio, enroll a sequence).

Create one on the agent's detail page, under **External webhooks**:

1. **Add a webhook** with a name (and, as an admin, an owner to run as). TAS
   shows the **endpoint URL** and a **bearer token** — copy both now; the token
   is shown only once (rotate to issue a new one).
2. The caller POSTs to the URL with the token in an `Authorization: Bearer`
   header and a JSON body. TAS verifies the token, queues a run, and acks
   immediately (HTTP 202) — fire-and-forget. The agent receives the request body
   as its input (envelope: `{ "trigger_type": "webhook", "webhook": "<name>",
   "payload": <your JSON> }`), and its instructions + `tools_module` interpret
   the fields.

```bash
curl -X POST https://<your-tas>/api/hooks/webhook/<id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"sam@acme.com","domain":"acme.com"}'
```

### Wiring it into Clay

In Clay, add an **HTTP API** column: method **POST**, the endpoint URL, a header
`Authorization: Bearer <token>` (Clay's encrypted "Headers account" is built for
this), and a JSON body mapped from your table columns. Clay fires a request per
row; each one queues a run.

The agent typically needs a [Secret](/agent-studio/connections/#secrets-api-keys)
or [connection](/agent-studio/connections/) to write results back (to Clay,
Attio, etc.) from its [Python tools](/agent-studio/sidecar-python-tools/) — the
webhook only starts the run.

Runs fired this way appear in [Runs](/agent-studio/dashboard-and-runs/) as
**Event**. Bad/missing token → 401, a disabled webhook → 403, too many in a
short window → 429.
