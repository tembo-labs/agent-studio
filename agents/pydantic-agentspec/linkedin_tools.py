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
from urllib.parse import quote

import httpx

import tas_tools

VOYAGER_BASE = "https://www.linkedin.com/voyager/api"
# Both rotate per LinkedIn release — see module docstring to re-capture (filter
# Network by messengerConversations / messengerMessages).
CONV_LIST_QUERY_ID = "messengerConversations.0d5e6781bbee71c3e51c8843c6519f48"
MESSAGES_QUERY_ID = "messengerMessages.5846eeb71c981f11e0134cb6626cc314"
# How many recent messages of each thread to pull for context.
THREAD_DEPTH = 15


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
    # Prefer the user's OWN miniProfile urn from the parsed body (regex-first-match
    # could grab some other included entity).
    try:
        me = r.json()
    except Exception:
        me = {}
    data = me.get("data") if isinstance(me.get("data"), dict) else {}
    urn = data.get("*miniProfile") or me.get("*miniProfile") or data.get("entityUrn")
    if isinstance(urn, str) and ":" in urn:
        return urn.rsplit(":", 1)[-1]
    m = re.search(r"(?:fs_miniProfile|fsd_profile|fs_profile):([A-Za-z0-9_-]{15,})", r.text)
    if not m:
        raise RuntimeError(f"Couldn't find profile id in /me response: {r.text[:400]!r}")
    return m.group(1)


def _text(v) -> str:
    """LinkedIn GraphQL wraps display strings as {'text': '...'}; also accept raw."""
    if isinstance(v, dict):
        return v.get("text") or ""
    return v or ""


def fetch_recent_conversations(limit: int = 3) -> list[dict]:
    """Up to `limit` recent LinkedIn conversations worth triaging: {convId, name,
    headline, lastMessage, messages}. `convId` is the conversation entity urn the
    reply/archive executor passes back to LinkedIn.

    LinkedIn's list returns the default page (~20 most recent, across categories
    incl. archived). We skip two kinds of threads so the agent spends its slots
    on genuinely-fresh ones:
      • Archived on LinkedIn (you already filed it away).
      • Already in the Tasks Inbox (snoozed / in-progress / handled) UNLESS a
        newer reply has landed since we surfaced it — that reopens it.
    Then we take the `limit` newest survivors and enrich those with thread
    history.
    """
    headers = _session()
    with httpx.Client(timeout=30, headers=headers, follow_redirects=True) as client:
        my_id = _profile_id(client)
        mailbox = f"urn:li:fsd_profile:{my_id}"
        # RestLi variables format, matching the browser EXACTLY: literal parens,
        # literal `mailboxUrn:` separator colon, but the URN's OWN colons percent-
        # encoded → (mailboxUrn:urn%3Ali%3Afsd_profile%3AID). Encoding the
        # separator colon too is a 400. Build the query by hand so httpx keeps it.
        mailbox_enc = mailbox.replace(":", "%3A")
        variables = f"(mailboxUrn:{mailbox_enc})"
        url = f"{VOYAGER_BASE}/voyagerMessagingGraphQL/graphql?queryId={CONV_LIST_QUERY_ID}&variables={variables}"
        resp = client.get(url)
        if resp.status_code >= 400:
            raise RuntimeError(
                f"LinkedIn {resp.status_code} on messengerConversations. "
                f"Body: {resp.text[:300]!r}. "
                f"Sent URL: {str(resp.request.url)!r}. "  # reveals any double-encoding
                f"mailbox: {mailbox!r}."
            )
        data = resp.json()
        parsed = _parse_conversations(data, my_id)  # ALL conversations on the page
        if not parsed:
            # 200 but parser missed the shape — dump the GraphQL payload so we can
            # fix the paths in one pass.
            gql = data.get("data") or {}
            raise RuntimeError(
                "Parsed 0 conversations. data.data keys=" + repr(list(gql.keys()))
                + " | payload=" + json.dumps(gql)[:1800]
            )

        # Skip archived-on-LinkedIn threads.
        candidates = [c for c in parsed if not c.get("archived")]

        # Skip threads already tracked in the Tasks Inbox, unless a NEWER reply
        # arrived since we last surfaced them (then they reopen). Best-effort: if
        # TAS is unreachable the producer still de-dups server-side.
        tracked = _tracked_linkedin_refs()

        def worth_surfacing(c: dict) -> bool:
            if c["convId"] not in tracked:
                return True
            prev = tracked[c["convId"]]
            la = c.get("lastActivityAt")
            # Reopen only on strictly-newer activity; legacy items (prev is None)
            # stay suppressed since we can't prove freshness.
            return prev is not None and isinstance(la, int) and la > prev

        out = [c for c in candidates if worth_surfacing(c)][:limit]

        # Enrich the survivors with recent thread history (best-effort: the list
        # response only carries the latest message). A failed thread fetch leaves
        # messages empty — the item still has lastMessage.
        for conv in out:
            conv.pop("archived", None)
            conv["messages"] = _fetch_messages(client, conv["convId"], my_id)
    return out


def _tracked_linkedin_refs() -> dict:
    """`{convId: externalTs|None}` for LinkedIn items already in the Tasks Inbox
    (any status). Lets us skip threads we've already surfaced unless a newer reply
    arrives. Best-effort — returns {} if TAS is unreachable (the producer still
    de-dups server-side, so this is an optimization, not the correctness gate).

    Reaches TAS over its own REST API using the `tembo-agent-studio` Native-MCP
    connection's token (the mcp_url's origin also serves /api/v1)."""
    try:
        conn = tas_tools.connection("tembo-agent-studio")
    except Exception:
        return {}
    origin = conn.mcp_url.rsplit("/mcp", 1)[0].rstrip("/")
    try:
        r = httpx.get(
            f"{origin}/api/v1/inbox",
            params={"source": "linkedin", "limit": 200},
            headers={"Authorization": f"Bearer {conn.access_token}"},
            timeout=20,
        )
        if r.status_code >= 400:
            return {}
        items = (r.json() or {}).get("inbox_items") or []
    except Exception:
        return {}
    refs: dict = {}
    for it in items:
        ref = it.get("externalRef")
        if isinstance(ref, str) and ref:
            ts = it.get("externalTs")
            refs[ref] = ts if isinstance(ts, int) else None
    return refs


def _fetch_messages(client: httpx.Client, conv_urn: str, my_id: str) -> list[dict]:
    """Recent messages of one thread, oldest→newest: [{from, text}]. Best-effort
    — returns [] on any error so it can't break the conversation list."""
    try:
        var = f"(conversationUrn:{quote(conv_urn, safe='')})"
        url = f"{VOYAGER_BASE}/voyagerMessagingGraphQL/graphql?queryId={MESSAGES_QUERY_ID}&variables={var}"
        r = client.get(url)
        if r.status_code >= 400:
            return []
        gql = (r.json() or {}).get("data") or {}
    except Exception:
        return []

    elements: list = []
    for v in gql.values():
        if isinstance(v, dict) and isinstance(v.get("elements"), list):
            elements = v["elements"]
            break

    rows: list[tuple] = []
    for m in elements:
        body = _text(m.get("body"))
        if not body:
            continue
        sender = m.get("sender") or {}
        member = (sender.get("participantType") or {}).get("member") or {}
        ent = member.get("entityUrn") or sender.get("hostIdentityUrn") or ""
        pid = ent.rsplit(":", 1)[-1] if isinstance(ent, str) else ""
        who = "me" if (my_id and pid == my_id) else (_text(member.get("firstName")) or "them")
        ts = m.get("deliveredAt") or m.get("createdAt") or 0
        rows.append((ts if isinstance(ts, int) else 0, who, body))

    # Order oldest→newest when timestamps are present; else keep server order.
    if any(ts for ts, _, _ in rows):
        rows.sort(key=lambda r: r[0])
    return [{"from": who, "text": text} for _, who, text in rows[-THREAD_DEPTH:]]


def _parse_conversations(data: dict, my_id: str) -> list[dict]:
    """Parse ALL conversations in the messenger GraphQL response (caller filters
    + slices). Conversations are inline at data.data.<rootField>.elements (pure
    GraphQL — no `included`). Each carries an `archived` flag derived from its
    LinkedIn categories so the caller can drop filed-away threads."""
    gql = data.get("data") or {}
    elements: list = []
    for v in gql.values():
        if isinstance(v, dict) and isinstance(v.get("elements"), list):
            elements = v["elements"]
            break
    # Fallback: older normalized shape with com.linkedin.messenger.* in `included`.
    if not elements:
        elements = [
            e
            for e in data.get("included", [])
            if isinstance(e, dict) and str(e.get("$type", "")).endswith(".Conversation")
        ]

    out: list[dict] = []
    for c in elements:
        urn = c.get("entityUrn") or c.get("conversationUrn") or ""
        if not urn:
            continue
        # Archived? Voyager tags conversations with category enums; an archived
        # thread carries "ARCHIVE". Check the list field + a couple of fallbacks
        # so we drop filed-away threads regardless of the exact shape.
        cats = c.get("categories") or c.get("category") or []
        if isinstance(cats, str):
            cats = [cats]
        archived = any("ARCHIVE" in str(x).upper() for x in cats) or bool(c.get("archived"))
        # Pick the OTHER participant (skip me). Participants are inline here.
        name, headline, fallback = "", "", ""
        for p in c.get("conversationParticipants") or []:
            member = (p.get("participantType") or {}).get("member") or {}
            ent = member.get("entityUrn") or p.get("hostIdentityUrn") or ""
            pid = ent.rsplit(":", 1)[-1] if isinstance(ent, str) else ""
            nm = (_text(member.get("firstName")) + " " + _text(member.get("lastName"))).strip()
            if not nm:
                continue
            if my_id and pid == my_id:
                fallback = fallback or nm
                continue
            name = nm
            headline = _text(member.get("headline"))
            break
        name = name or fallback or "Unknown"
        # Last message preview, if the list includes it.
        last = ""
        msgs = c.get("messages") or {}
        melems = msgs.get("elements") if isinstance(msgs, dict) else None
        if melems:
            last = _text((melems[-1] or {}).get("body"))
        out.append(
            {
                "convId": urn,
                "name": name,
                "headline": headline,
                "lastMessage": last,
                # Epoch-ms freshness marker → externalTs (reopen on new activity).
                "lastActivityAt": c.get("lastActivityAt"),
                "archived": archived,
            }
        )
    return out


tools = [fetch_recent_conversations]
