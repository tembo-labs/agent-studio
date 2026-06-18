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

Pagination: the list query is `messengerConversationsByCategory` with variables
`(query:(predicateUnions:List((conversationCategoryPredicate:(category:INBOX)))),
count:20,mailboxUrn:<urn>,nextCursor:<token>)`. The cursor is an OPAQUE token
returned at `data.messengerConversationsByCategoryQuery.metadata.nextCursor` —
pass it back as `nextCursor` to get the next (older) page. The `category:INBOX`
predicate also makes LinkedIn exclude archived threads server-side.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from urllib.parse import quote

import httpx

import tas_tools

VOYAGER_BASE = "https://www.linkedin.com/voyager/api"
# Both rotate per LinkedIn release — see module docstring to re-capture (filter
# Network by messengerConversations / messengerMessages).
CONV_LIST_QUERY_ID = "messengerConversations.9501074288a12f3ae9e3c7ea243bccbf"
MESSAGES_QUERY_ID = "messengerMessages.5846eeb71c981f11e0134cb6626cc314"
# How many recent messages of each thread to pull for context.
THREAD_DEPTH = 15
# Pagination safety cap: how many pages of the conversation list to walk back
# while looking for fresh threads (each page ≈ 20 conversations). Bounds the work
# when most of the recent backlog is already archived/handled.
MAX_PAGES = 6


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
    """Top the Tasks Inbox up to AT MOST `limit` active LinkedIn threads, and
    return the (possibly empty) set of fresh ones to stage: {convId, name,
    headline, lastMessage, messages}. `convId` is the conversation entity urn the
    reply/archive executor passes back to LinkedIn.

    `limit` is a CAP on inbox real-estate, not a fetch count. Run this on a
    schedule (e.g. every 6h): it keeps your LinkedIn queue at no more than `limit`
    open items so you chip away at the backlog without it taking over the inbox.

    LinkedIn returns ~20 conversations per page (across categories incl.
    archived). We:
      • drop threads archived on LinkedIn (you already filed them away);
      • drop threads already OPEN in the inbox (they still count toward the cap,
        but we don't re-stage them);
      • drop threads already handled/snoozed UNLESS a newer reply landed (that
        reopens them);
      • walk back page by page (up to MAX_PAGES) until we've found enough fresh
        survivors to reach `limit` active items — so an inbox full of archived/
        handled threads doesn't starve the queue. Returns [] when already full.
    """
    headers = _session()
    with httpx.Client(timeout=30, headers=headers, follow_redirects=True) as client:
        my_id = _profile_id(client)
        mailbox = f"urn:li:fsd_profile:{my_id}"

        # Inbox state: which LinkedIn threads are already tracked (+ how fresh),
        # and which are currently OPEN (occupying a cap slot). Best-effort — if
        # TAS is unreachable we fall back to staging up to `limit` (the producer
        # still de-dups server-side).
        tracked, active_refs = _inbox_state()
        budget = max(0, limit - len(active_refs))
        print(
            f"[linkedin] cap={limit} active={len(active_refs)} "
            f"tracked={len(tracked)} budget={budget}",
            file=sys.stderr,
        )
        if budget == 0:
            return []  # inbox already full — don't even hit LinkedIn

        # Walk back through pages via the opaque nextCursor, collecting fresh
        # threads until we reach the budget or run out of conversations.
        out: list[dict] = []
        seen: set = set()
        cursor: str | None = None
        for _ in range(MAX_PAGES):
            page, cursor = _fetch_conversation_page(client, mailbox, my_id, cursor)
            if not page:
                break  # empty / errored page — stop
            fresh_page = [c for c in page if c["convId"] not in seen]
            if not fresh_page:
                break  # no progress (same convs returned) — stop
            for c in fresh_page:
                seen.add(c["convId"])
            for c in fresh_page:
                if not c.get("archived") and _worth_surfacing(c, tracked, active_refs):
                    out.append(c)
                    if len(out) >= budget:
                        break
            if len(out) >= budget or not cursor:
                break  # filled the budget, or no more pages

        out = out[:budget]
        print(
            f"[linkedin] scanned={len(seen)} surfaced={len(out)} "
            f"({[c['convId'].rsplit(':', 1)[-1] for c in out]})",
            file=sys.stderr,
        )
        # Enrich the survivors with recent thread history (best-effort: the list
        # response only carries the latest message). A failed thread fetch leaves
        # messages empty — the item still has lastMessage.
        for conv in out:
            conv.pop("archived", None)
            conv["messages"] = _fetch_messages(client, conv["convId"], my_id)
    return out


def _worth_surfacing(c: dict, tracked: dict, active_refs: set) -> bool:
    """Should this conversation be staged into the inbox?"""
    cid = c["convId"]
    if cid in active_refs:
        return False  # already open in the inbox — counts toward the cap
    if cid not in tracked:
        return True  # brand-new thread
    prev = tracked[cid]
    la = c.get("lastActivityAt")
    # Tracked but handled/snoozed: reopen ONLY on strictly-newer activity.
    # Legacy items (prev is None) stay suppressed — can't prove freshness.
    return prev is not None and isinstance(la, int) and la > prev


def _fetch_conversation_page(
    client: httpx.Client, mailbox: str, my_id: str, cursor: str | None
) -> tuple[list[dict], str | None]:
    """One page of the INBOX conversation list. Returns (parsed, next_cursor).
    `cursor` is the opaque nextCursor token from the previous page (None for the
    first / newest page); pass next_cursor back in to page to OLDER threads.

    The first page must succeed (raises with diagnostics on failure / empty).
    Later pages are best-effort: a request that errors or returns nothing just
    stops the walk (returns ([], None)) rather than failing the run."""
    # RestLi variables, matching the browser EXACTLY: literal parens / separator
    # colons; the URN's OWN colons percent-encoded; the cursor fully encoded
    # (it's base64 with =,/,+). The category:INBOX predicate excludes archived.
    mailbox_enc = mailbox.replace(":", "%3A")
    variables = (
        "(query:(predicateUnions:List((conversationCategoryPredicate:(category:INBOX))))"
        f",count:20,mailboxUrn:{mailbox_enc}"
    )
    if cursor:
        variables += f",nextCursor:{quote(cursor, safe='')}"
    variables += ")"
    url = f"{VOYAGER_BASE}/voyagerMessagingGraphQL/graphql?queryId={CONV_LIST_QUERY_ID}&variables={variables}"
    resp = client.get(url)
    if resp.status_code >= 400:
        if cursor is None:
            raise RuntimeError(
                f"LinkedIn {resp.status_code} on messengerConversations. "
                f"Body: {resp.text[:300]!r}. "
                f"Sent URL: {str(resp.request.url)!r}. "  # reveals any double-encoding
                f"mailbox: {mailbox!r}."
            )
        return [], None  # older page failed — stop gracefully
    data = resp.json()
    parsed = _parse_conversations(data, my_id)
    if not parsed and cursor is None:
        # 200 but parser missed the shape — dump the GraphQL payload so we can
        # fix the paths in one pass.
        gql = data.get("data") or {}
        raise RuntimeError(
            "Parsed 0 conversations. data.data keys=" + repr(list(gql.keys()))
            + " | payload=" + json.dumps(gql)[:1800]
        )
    return parsed, _next_cursor(data)


def _next_cursor(data: dict) -> str | None:
    """The opaque pagination token from the conversation-list response, at
    data.<rootField>.metadata.nextCursor. None when there are no older pages."""
    gql = data.get("data") or {}
    for v in gql.values():
        if isinstance(v, dict):
            md = v.get("metadata")
            if isinstance(md, dict):
                nc = md.get("nextCursor")
                if isinstance(nc, str) and nc:
                    return nc
    return None


def _inbox_state() -> tuple[dict, set]:
    """Read the Tasks Inbox to enforce the cap + de-dup. Returns:
      • tracked:     {convId: externalTs|None} over LinkedIn items of ANY status
                     (so we don't re-stage a thread unless a newer reply arrives);
      • active_refs: convIds currently OPEN (unresolved AND not snoozed) — these
                     occupy the cap, so `limit - len(active_refs)` is the budget.

    Best-effort — returns ({}, set()) if TAS is unreachable, so the run still
    proceeds (the producer de-dups server-side; this just can't enforce the cap).
    Reaches TAS over its own REST API using the `tembo-agent-studio` Native-MCP
    connection's token (the mcp_url's origin also serves /api/v1)."""
    try:
        conn = tas_tools.connection("tembo-agent-studio")
    except Exception:
        return {}, set()
    origin = conn.mcp_url.rsplit("/mcp", 1)[0].rstrip("/")
    try:
        r = httpx.get(
            f"{origin}/api/v1/inbox",
            params={"source": "linkedin", "limit": 200},
            headers={"Authorization": f"Bearer {conn.access_token}"},
            timeout=20,
        )
        if r.status_code >= 400:
            return {}, set()
        items = (r.json() or {}).get("inbox_items") or []
    except Exception:
        return {}, set()

    now = datetime.now(timezone.utc)
    tracked: dict = {}
    active_refs: set = set()
    for it in items:
        ref = it.get("externalRef")
        if not (isinstance(ref, str) and ref):
            continue
        ts = it.get("externalTs")
        tracked[ref] = ts if isinstance(ts, int) else None
        if it.get("status") not in ("open", "claimed", "awaiting_human"):
            continue  # done / dismissed — not occupying the inbox
        if _is_future(it.get("snoozedUntil"), now):
            continue  # snoozed — hidden, doesn't occupy a cap slot
        active_refs.add(ref)
    return tracked, active_refs


def _is_future(iso: object, now: datetime) -> bool:
    """True if `iso` (an ISO-8601 string) is in the future relative to `now`."""
    if not (isinstance(iso, str) and iso):
        return False
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return False
    return dt > now


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
