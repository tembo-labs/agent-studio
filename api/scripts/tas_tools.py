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

Only Native-MCP connections are exposed here: their OAuth access tokens
are real provider tokens that also work against the provider's REST API.
Composio brokers auth for LLM tool-calling and does not hand out raw
downstream tokens, so Composio-only services stay LLM-driven (or wait for
a future raw-API-key connection type).
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

# Same env var the wrapper reads to build native-MCP toolsets — the
# decrypted, run-scoped credentials for the acting user's ACTIVE native
# connections, shaped `{provider: {name: {mcp_url, access_token}}}`.
_NATIVE_ENV = "TAS_NATIVE_MCP_CONNECTIONS"


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
