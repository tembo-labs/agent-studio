"""Sidecar tools for the linkedin-inbox agent.

Pulls recent LinkedIn conversations via the unofficial Voyager API using the
workspace's stored session (li_at + JSESSIONID cookie). Uses httpx (already in
the runner venv) — no extra dependency.

⚠️ UNVERIFIED: Voyager is undocumented and changes; the endpoint + response
shape below follow the long-standing classic messaging API but must be checked
against a live session and adjusted. Errors are surfaced (not swallowed) so a
bad cookie / changed shape shows up clearly in the run output.

Auth: LinkedIn's CSRF scheme requires the `csrf-token` header to equal the
JSESSIONID value; the User-Agent should match the browser the li_at came from.
"""

from __future__ import annotations

import httpx

import tas_tools

VOYAGER_BASE = "https://www.linkedin.com/voyager/api"


def _session() -> dict:
    li_at = tas_tools.secret("linkedin_li_at")
    jsession = tas_tools.secret("linkedin_jsessionid").strip('"')
    try:
        user_agent = tas_tools.secret("linkedin_user_agent")
    except Exception:
        user_agent = (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        )
    return {
        "cookie": f'li_at={li_at}; JSESSIONID="{jsession}"',
        "csrf-token": jsession,
        "x-restli-protocol-version": "2.0.0",
        "user-agent": user_agent,
        "accept": "application/json",
    }


def _conv_id(entity_urn: str) -> str:
    # "urn:li:fs_conversation:2-abc==" / "urn:li:fsd_conversation:2-abc==" → "2-abc=="
    return entity_urn.rsplit(":", 1)[-1] if entity_urn else entity_urn


def fetch_recent_conversations(limit: int = 3) -> list[dict]:
    """Return up to `limit` recent LinkedIn conversations.

    Each item: { convId, name, headline, lastMessage }. `convId` is what the
    Inbox action executor passes back to LinkedIn for reply/archive, so the read
    and write sides must agree on its format (the id after the conversation urn
    prefix).
    """
    headers = _session()
    with httpx.Client(timeout=30, headers=headers) as client:
        resp = client.get(
            f"{VOYAGER_BASE}/messaging/conversations",
            params={"keyVersion": "LEGACY_INBOX"},
        )
        resp.raise_for_status()
        data = resp.json()

    out: list[dict] = []
    for el in (data.get("elements") or [])[:limit]:
        entity_urn = el.get("entityUrn", "")
        # Participant name (first non-self participant).
        name = "Unknown"
        headline = ""
        for p in el.get("participants", []):
            mm = (
                p.get("com.linkedin.voyager.messaging.MessagingMember", {})
                .get("miniProfile", {})
            )
            if mm:
                name = " ".join(
                    x for x in [mm.get("firstName"), mm.get("lastName")] if x
                ) or name
                headline = mm.get("occupation", "") or headline
                break
        # Last message body.
        last = ""
        events = el.get("events", [])
        if events:
            ev = events[0].get("eventContent", {})
            msg = ev.get("com.linkedin.voyager.messaging.event.MessageEvent", {})
            last = msg.get("body", "") or ""
        out.append(
            {
                "convId": _conv_id(entity_urn),
                "name": name,
                "headline": headline,
                "lastMessage": last,
            }
        )
    return out


tools = [fetch_recent_conversations]
