"""Pydantic AI runner wrapper invoked by api/src/runs/pydantic.rs.

Reads a Pydantic AgentSpec (YAML or JSON) from stdin, runs the
agent against the user message passed on the CLI, and prints the
result to stdout. Mirrors the cargo-ai shellout shape so the Rust
runner has parallel knobs for both frameworks.

Auth: provider API keys come in via environment variables the
caller sets before spawn (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.).
pydantic-ai picks them up from the provider's SDK conventionally —
no constructor wiring needed.

Composio connections: when the spec declares `connections:` and
TAS_COMPOSIO_API_KEY + TAS_COMPOSIO_USER_ID are present in the
environment, we ask Composio for a Tool Router session scoped to the
declared toolkits and attach it to the Agent as an MCP toolset.
That's how slack / google-sheets / etc. become callable.

stdout protocol: free-form agent output, followed by a single
sentinel line `__TAS_USAGE__:{...json...}` carrying usage counts
when pydantic-ai reports them. The Rust runner strips the
sentinel before writing the user-facing transcript and feeds the
JSON into the run row's token columns.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import traceback

import yaml
from pydantic_ai import Agent


USAGE_SENTINEL = "__TAS_USAGE__:"


def parse_spec(content: str, fmt: str) -> dict:
    if fmt == "yaml":
        loaded = yaml.safe_load(content)
    elif fmt == "json":
        loaded = json.loads(content)
    else:
        raise ValueError(f"unsupported spec format: {fmt!r}")
    if not isinstance(loaded, dict):
        raise ValueError("AgentSpec must parse to a top-level object")
    return loaded


def usage_payload(usage_obj) -> dict:
    """Pull whatever fields pydantic-ai reports into a flat dict.

    The Usage object's exact attribute set has shifted across
    pydantic-ai versions; we read defensively so a minor upstream
    rename doesn't crash the runner — the Rust side treats missing
    fields as None.
    """
    if usage_obj is None:
        return {}
    out = {}
    for attr in (
        "input_tokens",
        "output_tokens",
        "request_tokens",
        "response_tokens",
        "total_tokens",
        "requests",
    ):
        val = getattr(usage_obj, attr, None)
        if val is not None:
            out[attr] = val
    return out


def parse_connections(spec: dict) -> list[tuple[str, str, list[str]]]:
    """Extract `connections:` as `[(toolkit, name, [tool_slug, …])]`.

    `name` is the user-scoped slot ("default", "work", "personal")
    that determines which workspace_composio_connection row backs
    the slot at run time. An empty tool list means "all tools from
    this toolkit"; a non-empty list narrows the Composio session
    to exactly those tools.

    Accepted shapes (loose → most explicit):

        # Loose — slot defaults to "default"
        connections:
          - slack
          - googlesheets

        # Narrow tools, default slot
        connections:
          - slack: [SLACK_SEND_MESSAGE]
          - googlesheets: { tools: [GOOGLESHEETS_BATCH_GET] }

        # Named slot
        connections:
          - gmail: { name: work }
          - gmail: { name: personal, tools: [GMAIL_SEND_EMAIL] }

        # Verbose form
        connections:
          - { type: slack, name: alt, tools: [SLACK_SEND_MESSAGE] }
    """
    raw = spec.get("connections")
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError(
            "`connections:` must be a list of toolkit slugs "
            "(e.g. `connections: [slack, googlesheets]`)"
        )
    out: list[tuple[str, str, list[str]]] = []
    for item in raw:
        if isinstance(item, str):
            out.append((item.strip(), "default", []))
            continue
        if not isinstance(item, dict):
            raise ValueError(
                f"`connections:` entry must be a string or object, "
                f"got {type(item).__name__}"
            )
        # Verbose form: `{type: slack, name: alt, tools: [...]}`.
        slug_from_verbose = item.get("type") or item.get("toolkit")
        if isinstance(slug_from_verbose, str):
            name = (
                str(item.get("name")).strip().lower()
                if isinstance(item.get("name"), str) and item.get("name").strip()
                else "default"
            )
            tools = _coerce_tools_value(item.get("tools"))
            out.append((slug_from_verbose.strip(), name, tools))
            continue
        # Compact form: `{slack: [...]}` or `{slack: {name, tools}}`.
        if len(item) == 1:
            slug, body = next(iter(item.items()))
            name = "default"
            if isinstance(body, dict):
                if isinstance(body.get("name"), str) and body.get("name").strip():
                    name = body["name"].strip().lower()
            tools = _coerce_tools_value(body)
            out.append((str(slug).strip(), name, tools))
            continue
        raise ValueError(
            f"`connections:` entry has no toolkit slug: {item!r}"
        )
    return [(slug, name, tools) for (slug, name, tools) in out if slug]


def _coerce_tools_value(value) -> list[str]:
    """Accept either a raw list (compact form) or a dict with a
    `tools:` key (verbose form). Anything else means "all tools"."""
    if isinstance(value, list):
        return [str(t).strip() for t in value if isinstance(t, str) and t.strip()]
    if isinstance(value, dict):
        inner = value.get("tools")
        if isinstance(inner, list):
            return [str(t).strip() for t in inner if isinstance(t, str) and t.strip()]
    return []


COMPOSIO_TOOL_USE_PREAMBLE_LOOSE = """\
You are an automated agent running inside Tembo Agent Studio. \
This run was triggered by a user or a schedule — it is not an \
interactive chat. When you reply, your message goes into a run log \
the user reviews later; nobody is on the other end to answer \
follow-up questions in real time.

You have these Composio tool-router meta-tools available:

- `COMPOSIO_SEARCH_TOOLS` — find specific tools by natural-language \
description.
- `COMPOSIO_GET_TOOL_SCHEMAS` — fetch the input schema for one or more \
tool slugs.
- `COMPOSIO_MULTI_EXECUTE_TOOL` — invoke one or more tools.

Authorized toolkits for this agent: {toolkits}. The workspace has \
already authorized these connections; do not ask the user to authorize \
anything.

Default behaviour: read your agent instructions below, search for the \
tools you need, execute them, and reply with a short summary of what \
happened. Treat any user message (including an empty one) as "go do \
the job"; the instructions below tell you what the job is.

--- Agent instructions ---
"""

COMPOSIO_TOOL_USE_PREAMBLE_DIRECT = """\
You are an automated agent running inside Tembo Agent Studio. \
This run was triggered by a user or a schedule — it is not an \
interactive chat. When you reply, your message goes into a run log \
the user reviews later; nobody is on the other end to answer \
follow-up questions in real time.

The tools you need are already attached to this session — call them \
directly by name.

Authorized toolkits for this agent: {toolkits}. The workspace has \
already authorized these connections; do not ask the user to authorize \
anything.

Default behaviour: read your agent instructions below, call the \
attached tools to do the job, and reply with a short summary of what \
happened. Treat any user message (including an empty one) as "go do \
the job"; the instructions below tell you what the job is.

--- Agent instructions ---
"""


def build_agent(
    spec: dict,
    toolsets: list | None = None,
    connections: list[str] | None = None,
    direct_tools: bool = False,
) -> Agent:
    """Construct a pydantic_ai.Agent from a TAS AgentSpec dict.

    pydantic-ai 1.x has no `Agent.from_spec` / `from_file` factory
    (despite some upstream docs still referencing it), so we hand-map
    the AgentSpec fields onto the Agent(...) constructor kwargs.

    `toolsets` is the Composio MCP toolset list when the agent
    declared `connections:`; otherwise None (no tools). When
    connections are present, we prepend an explanatory preamble to
    the agent's instructions so the model knows the Composio meta
    tools exist and how to use them — without this, models tend to
    hedge ("just say the word") because the agent's own
    instructions reference services in natural language and the
    model can't connect them to the tool surface.

    Out of scope for this MVP path:
      - output_schema (would need to dynamically build a Pydantic
        model from the JSON schema; defaulting to str output)
      - capabilities (no general translation to builtin_tools yet)
      - deps_schema (deps come from the caller; runtime supplies none)
    """
    model = spec.get("model")
    if not isinstance(model, str) or not model.strip():
        raise ValueError("AgentSpec is missing a non-empty `model` string")

    kwargs = {}
    instructions = spec.get("instructions")
    if isinstance(instructions, str) and instructions.strip():
        if connections:
            template = (
                COMPOSIO_TOOL_USE_PREAMBLE_DIRECT
                if direct_tools
                else COMPOSIO_TOOL_USE_PREAMBLE_LOOSE
            )
            preamble = template.format(toolkits=", ".join(connections))
            kwargs["instructions"] = preamble + instructions
        else:
            kwargs["instructions"] = instructions
    name = spec.get("name")
    if isinstance(name, str) and name.strip():
        kwargs["name"] = name
    model_settings = spec.get("model_settings")
    if isinstance(model_settings, dict) and model_settings:
        kwargs["model_settings"] = model_settings
    retries = spec.get("retries")
    if isinstance(retries, int):
        kwargs["retries"] = retries
    instrument = spec.get("instrument")
    if isinstance(instrument, bool):
        kwargs["instrument"] = instrument
    if toolsets:
        kwargs["toolsets"] = toolsets

    return Agent(model, **kwargs)


def build_composio_toolset(connections: list[tuple[str, str, list[str]]]):
    """Create a Composio Tool Router session for the declared toolkits
    and wrap it in an MCPServerStreamableHTTP so pydantic-ai can call
    the tools.

    Returns `(mcp, used_direct_tools)`. `used_direct_tools` is True
    when every declared toolkit narrowed its tool list — in that case
    we use the DIRECT_TOOLS preset, preload only those tool schemas,
    and skip the search/execute meta-tools entirely (much cheaper per
    run). Otherwise we fall back to the default Tool Router with the
    search + multi-execute meta-tools (cheap input context, but the
    model spends extra round trips discovering tools).

    Returns `(None, False)` when `connections` is empty.
    """
    if not connections:
        return (None, False)

    api_key = os.environ.get("TAS_COMPOSIO_API_KEY")
    user_id = os.environ.get("TAS_COMPOSIO_USER_ID")
    if not api_key:
        raise ValueError(
            "Agent declares `connections:` but no Composio API key is "
            "set for this workspace. Add it under Settings → Composio API key."
        )
    if not user_id:
        raise ValueError(
            "Agent declares `connections:` but the Composio user_id was "
            "not provided by the runner (TAS_COMPOSIO_USER_ID missing)."
        )

    # Imports are deferred so workspaces that never use connections
    # don't pay the import cost (and so a broken composio install
    # doesn't crash agents that don't need it).
    from composio import Composio
    from pydantic_ai.mcp import MCPServerStreamableHTTP

    # The Rust runner pre-resolves the workspace's active connections
    # from workspace_composio_connection and ships them as a JSON map
    # `{toolkit_slug: composio_connection_id}`. Composio's Tool Router
    # session does NOT auto-discover the user's active connections
    # when manage_connections=False — passing `connected_accounts`
    # explicitly is what makes them show up as is_active in the
    # session and therefore exposes their tools to the agent.
    # Rust runner ships the nested map `{toolkit: {name: connection_id}}`.
    # Each declared (toolkit, name) slot resolves to a specific
    # connection_id below. Composio's Tool Router needs the explicit
    # connected_accounts pass when manage_connections=false; otherwise
    # the session reports the toolkits inactive even when the user
    # authorized them.
    accounts_json = os.environ.get("TAS_COMPOSIO_CONNECTED_ACCOUNTS")
    nested: dict[str, dict[str, str]] = {}
    if accounts_json:
        try:
            parsed = json.loads(accounts_json)
            if isinstance(parsed, dict):
                for tk, inner in parsed.items():
                    if isinstance(inner, dict):
                        nested[str(tk)] = {
                            str(k): str(v)
                            for k, v in inner.items()
                            if isinstance(v, str)
                        }
        except json.JSONDecodeError:
            pass

    resolved: dict[str, str] = {}
    missing: list[str] = []
    for (toolkit, name, _tools) in connections:
        cid = nested.get(toolkit, {}).get(name)
        if cid is None:
            slot_label = toolkit if name == "default" else f"{toolkit}/{name}"
            missing.append(slot_label)
        else:
            resolved[toolkit] = cid
    if missing:
        raise ValueError(
            "Agent declares connections "
            f"{missing!r} but the run's acting user has no active "
            "Composio connection for them. Authorize them under "
            "Settings → Connections and try again."
        )

    # Narrowed tools per toolkit — only included when the agent
    # specified explicit slugs. When every slot is narrowed we flip
    # to DIRECT_TOOLS so only those schemas land in the model's
    # context (no search/execute meta-tools, no extra round trip).
    tools_param: dict[str, list[str]] = {
        toolkit: tools for (toolkit, _name, tools) in connections if tools
    }
    all_narrowed = bool(connections) and all(
        bool(tools) for (_, _, tools) in connections
    )

    composio = Composio(api_key=api_key)
    create_kwargs: dict = {
        "user_id": user_id,
        "toolkits": sorted({tk for (tk, _, _) in connections}),
        "connected_accounts": resolved,
        "manage_connections": False,
        "workbench": {"enable": False},
    }
    if tools_param:
        create_kwargs["tools"] = tools_param
    if all_narrowed:
        from composio import SESSION_PRESET_DIRECT_TOOLS
        create_kwargs["session_preset"] = SESSION_PRESET_DIRECT_TOOLS

    session = composio.create(**create_kwargs)
    mcp = MCPServerStreamableHTTP(
        session.mcp.url,
        headers={"x-api-key": api_key},
    )
    return (mcp, all_narrowed)


async def run(spec: dict, user_message: str) -> None:
    connections = parse_connections(spec)
    toolsets: list = []
    mcp, used_direct_tools = build_composio_toolset(connections)
    if mcp is not None:
        toolsets.append(mcp)

    # Preamble framing differs between DIRECT_TOOLS (tools attached
    # by name) and loose mode (model has to discover via meta-tools).
    # Both variants share the "act, don't chat" instructions because
    # Sonnet-tier models will hedge regardless of which path they're
    # on without explicit imperative framing.
    preamble_toolkits = (
        sorted({slug for (slug, _name, _tools) in connections})
        if mcp is not None
        else None
    )
    agent = build_agent(
        spec,
        toolsets=toolsets or None,
        connections=preamble_toolkits,
        direct_tools=used_direct_tools,
    )

    # MCP toolsets are async context managers — pydantic-ai keeps the
    # connection to Composio's MCP server alive for the duration of
    # the run, then tears it down on exit.
    if toolsets:
        async with agent:
            # Diagnostic: list the tools pydantic-ai actually exposes
            # to the model after the MCP context is entered. Lands in
            # the api container logs so we can tell from the outside
            # whether the model had tools available at all when it
            # decided to hedge.
            try:
                tool_names: list[str] = []
                for ts in toolsets:
                    if hasattr(ts, "list_tools"):
                        listed = await ts.list_tools()
                        for t in listed:
                            name = getattr(t, "name", None) or (
                                t.get("name") if isinstance(t, dict) else None
                            )
                            if name:
                                tool_names.append(name)
                sys.stderr.write(
                    f"[tas] MCP toolset exposes {len(tool_names)} tools: "
                    f"{tool_names[:10]}{'…' if len(tool_names) > 10 else ''}\n"
                )
            except Exception as e:
                sys.stderr.write(f"[tas] list_tools probe failed: {e}\n")
            result = await agent.run(user_message)
    else:
        result = await agent.run(user_message)

    sys.stdout.write(str(result.output))
    sys.stdout.write("\n")
    usage = usage_payload(getattr(result, "usage", None))
    if usage:
        sys.stdout.write(f"{USAGE_SENTINEL}{json.dumps(usage)}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a Pydantic AI AgentSpec.")
    parser.add_argument(
        "--fmt",
        choices=("yaml", "json"),
        required=True,
        help="Spec content format (the Rust caller knows this from the file extension).",
    )
    parser.add_argument(
        "--user-message",
        default="",
        help="Freeform user input to pass as the agent's prompt.",
    )
    args = parser.parse_args()

    content = sys.stdin.read()

    try:
        spec = parse_spec(content, args.fmt)
    except Exception as e:
        sys.stderr.write(f"failed to parse spec: {e}\n")
        return 2

    # Pydantic AI's run loop wants a non-empty prompt. When the user
    # didn't supply one (manual "Run now" with empty dialog, or a
    # scheduled automation that has no input message), send a
    # directive instead of "Hello." — models treat "Hello." as an
    # invitation to greet and chat. A neutral execution directive
    # nudges them to read their instructions and act.
    prompt = (
        args.user_message
        if args.user_message
        else "Execute the job described in your instructions."
    )

    try:
        asyncio.run(run(spec, prompt))
    except Exception as e:
        # Print the traceback to stderr so the run row's
        # error_message has actionable context, then exit non-zero
        # so the Rust runner marks the run as failed.
        traceback.print_exc(file=sys.stderr)
        sys.stderr.write(f"\npydantic-ai run failed: {e}\n")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
