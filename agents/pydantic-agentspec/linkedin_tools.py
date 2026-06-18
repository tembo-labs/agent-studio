"""Sidecar tools for the linkedin-inbox agent.

Reads recent LinkedIn conversations via the (unofficial) Voyager **GraphQL**
messaging API using the stored session cookie. Uses httpx (already in the runner
venv) — no extra dependency.

⚠️ UNOFFICIAL + VERSION-SENSITIVE: LinkedIn's messaging moved to GraphQL with a
rotating `queryId` hash. The CONV_LIST_QUERY_ID below was captured from a live
session; if this 500s/404s again, re-capture it: linkedin.com/messaging →
DevTools → Network → filter `messengerConversations` → reload → copy the
queryId from the request URL.

Auth: cookie (li_at + JSESSIONID) + csrf-token header == JSESSIONID value; the
User-Agent must be the DESKTOP browser the cookie came from (a mobile UA gets
403'd by the desktop API).
"""

from __future__ import annotations

import json
import re

import httpx

import tas_tools

VOYAGER_BASE = "https://www.linkedin.com/voyager/api"
# Rotating per LinkedIn release — see module docstring to re-capture.
CONV_LIST_QUERY_ID = "messengerConversations.0d5e6781bbee71c3e51c8843c6519f48"


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
        "x-li-lang": "en_US",
        "accept-language": "en-US,en;q=0.9",
    }


def _profile_id(client: httpx.Client) -> str:
    """Your own profile id (the ACoAA… in urn:li:fsd_profile:…), needed as the
    mailbox for the conversation list. Derived from /voyager/api/me so nothing
    account-specific is hard-coded."""
    r = client.get(f"{VOYAGER_BASE}/me")
    if r.status_code >= 400:
        raise RuntimeError(f"LinkedIn /me {r.status_code}: {r.text[:300]!r}")
    m = re.search(r"(?:fs_miniProfile|fsd_profile|fs_profile):([A-Za-z0-9_-]{15,})", r.text)
    if not m:
        raise RuntimeError(f"Couldn't find profile id in /me response: {r.text[:300]!r}")
    return m.group(1)


def _text(v) -> str:
    """LinkedIn GraphQL wraps display strings as {'text': '...'}; also accept raw."""
    if isinstance(v, dict):
        return v.get("text") or ""
    return v or ""


def fetch_recent_conversations(limit: int = 3) -> list[dict]:
    """Up to `limit` recent LinkedIn conversations: {convId, name, headline,
    lastMessage}. `convId` is the conversation entity urn the reply/archive
    executor passes back to LinkedIn."""
    headers = _session()
    with httpx.Client(timeout=30, headers=headers, follow_redirects=True) as client:
        mailbox = f"urn:li:fsd_profile:{_profile_id(client)}"
        # RestLi variables format: literal parens, colons percent-encoded — matches
        # what the browser sends. Build the query string by hand so httpx doesn't
        # reshape it.
        variables = f"(mailboxUrn:{mailbox})".replace(":", "%3A")
        url = f"{VOYAGER_BASE}/voyagerMessagingGraphQL/graphql?queryId={CONV_LIST_QUERY_ID}&variables={variables}"
        resp = client.get(url)
        if resp.status_code >= 400:
            raise RuntimeError(
                f"LinkedIn {resp.status_code} on messengerConversations. "
                f"Body: {resp.text[:400]!r}. UA={headers.get('user-agent')!r}"
            )
        data = resp.json()

    out = _parse_conversations(data, limit)
    if not out:
        # Field paths likely drifted — surface the actual shape so we can fix the
        # parser in one pass instead of guessing.
        types = sorted({
            e.get("$type", "?") for e in data.get("included", []) if isinstance(e, dict)
        })
        raise RuntimeError(
            "Parsed 0 conversations. data keys=" + repr(list(data.keys()))
            + " | included $types=" + repr(types)
            + " | sample=" + json.dumps(data.get("included", [])[:1])[:1200]
        )
    return out


def _parse_conversations(data: dict, limit: int) -> list[dict]:
    """Best-effort parse of the messenger GraphQL response. The list lives in
    `included` as com.linkedin.messenger.* entities cross-referenced by urn."""
    included = [e for e in data.get("included", []) if isinstance(e, dict)]
    by_urn = {e.get("entityUrn"): e for e in included if e.get("entityUrn")}

    def is_type(e, suffix):
        return str(e.get("$type", "")).endswith(suffix)

    convs = [e for e in included if is_type(e, ".Conversation")]
    out: list[dict] = []
    for c in convs[: limit * 3]:  # over-fetch; we slice after sorting
        urn = c.get("entityUrn", "")
        # Participants: resolve participant urns → member name/headline.
        name, headline = "Unknown", ""
        parts = c.get("conversationParticipants") or c.get("*conversationParticipants") or []
        for p in parts:
            pe = by_urn.get(p) if isinstance(p, str) else p
            if not isinstance(pe, dict):
                continue
            member = (
                (pe.get("participantType") or {}).get("member")
                or (pe.get("participantType") or {}).get("organization")
                or {}
            )
            fn, ln = _text(member.get("firstName")), _text(member.get("lastName"))
            nm = (fn + " " + ln).strip() or _text(member.get("name"))
            if nm:
                name = nm
                headline = _text(member.get("headline"))
                break
        # Last message body.
        last = ""
        msgs = c.get("messages") or {}
        elems = msgs.get("elements") if isinstance(msgs, dict) else None
        if elems:
            last = _text((elems[-1] or {}).get("body"))
        out.append({"convId": urn, "name": name, "headline": headline, "lastMessage": last})
    return out[:limit]


tools = [fetch_recent_conversations]
