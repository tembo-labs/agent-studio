"""Helpers for TAS agent sidecar tool modules.

A Pydantic agent can declare `tools_module: foo.py` — a sibling Python
file of deterministic functions the model calls as tools. Those
functions often need to reach an external system (read from Attio, write
back, …). In TAS, **auth always flows through the Connections system** —
a tool never carries its own hardcoded key. This module is the bridge:
it hands a tool the credentials of a connection the agent already holds,
so the tool can do deterministic I/O (e.g. with httpx) over it.

    import httpx
    import tas_tools

    def list_companies() -> list[dict]:
        '''Return all Attio companies.'''
        c = tas_tools.connection("attio")
        r = httpx.get(
            "https://api.attio.com/v2/objects/companies/records/query",
            headers={"Authorization": f"Bearer {c.access_token}"},
        )
        r.raise_for_status()
        return r.json()["data"]

    tools = [list_companies]

Two kinds of credential flow through here:

- `connection(provider)` — a **Native-MCP** connection's OAuth access token,
  which is a real provider token that also works against the provider's REST
  API. (Composio brokers auth for LLM tool-calling and doesn't hand out raw
  downstream tokens, so Composio-only services stay LLM-driven.)
- `secret(name)` — a **Secret**: a free-form, workspace-level API key an admin
  set under Connections → Secrets (e.g. Clay), for services that authenticate
  with a plain key:

    import httpx
    import tas_tools

    def enrich(domain: str) -> dict:
        '''Enrich a company domain via Clay.'''
        key = tas_tools.secret("clay")
        r = httpx.post(
            "https://api.clay.com/v1/enrich",
            headers={"Authorization": f"Bearer {key}"},
            json={"domain": domain},
        )
        r.raise_for_status()
        return r.json()

    tools = [enrich]
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

# Same env var the wrapper reads to build native-MCP toolsets — the
# decrypted, run-scoped credentials for the acting user's ACTIVE native
# connections, shaped `{provider: {name: {mcp_url, access_token}}}`.
_NATIVE_ENV = "TAS_NATIVE_MCP_CONNECTIONS"

# Decrypted workspace Secrets for this run, a flat `{slug: value}` map. Only
# present when the agent has a tools module (secrets feed Python tools only).
_SECRETS_ENV = "TAS_SECRETS"


@dataclass(frozen=True)
class Connection:
    """An active Native-MCP connection's credentials for this run."""

    provider: str
    name: str
    #: OAuth bearer token — also valid against the provider's REST API.
    access_token: str
    #: The provider's MCP endpoint URL (for talking MCP directly).
    mcp_url: str


def _load() -> dict:
    raw = os.environ.get(_NATIVE_ENV)
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def connection(provider: str, name: str = "default") -> Connection:
    """Return the credentials for one of the agent's connections.

    `provider` is the Native-MCP provider slug (e.g. "attio", "pylon");
    `name` is the connection slot ("default" unless the spec used a named
    slot). Raises a clear ValueError if that connection isn't active for
    this run — the agent must declare it under `connections:` and the
    acting user must have authorized it under Connections.
    """
    by_name = _load().get(provider)
    if not isinstance(by_name, dict) or not by_name:
        raise ValueError(
            f'no active "{provider}" connection for this run — declare it '
            f"under the agent's connections: and authorize it in Connections"
        )
    entry = by_name.get(name)
    if not isinstance(entry, dict):
        available = ", ".join(sorted(by_name)) or "(none)"
        raise ValueError(
            f'no "{provider}" connection named "{name}" for this run '
            f"(available: {available})"
        )
    token = entry.get("access_token")
    url = entry.get("mcp_url")
    if not token or not url:
        raise ValueError(
            f'the "{provider}"/"{name}" connection is missing credentials '
            f"for this run"
        )
    return Connection(
        provider=provider, name=name, access_token=token, mcp_url=url
    )


def _load_secrets() -> dict:
    raw = os.environ.get(_SECRETS_ENV)
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def secret(name: str) -> str:
    """Return a workspace Secret's value by name (e.g. "clay").

    Secrets are free-form API keys an admin set under Connections → Secrets.
    They're shared across the workspace and read only by sidecar tools.
    Raises a clear ValueError if the named secret isn't set for this run —
    an admin must add it under Connections → Secrets.
    """
    secrets = _load_secrets()
    value = secrets.get(name)
    if not isinstance(value, str) or not value:
        available = ", ".join(sorted(secrets)) or "(none)"
        raise ValueError(
            f'no workspace secret named "{name}" for this run — add it under '
            f"Connections → Secrets (available: {available})"
        )
    return value
