import "server-only";

import { getSecretConnectionValue } from "@/lib/secret-connections";

// Minimal LinkedIn Voyager (internal API) client for the WRITE operations the
// Inbox executor needs: send a message, archive a conversation. Reads the
// session from workspace secrets — same unofficial li_at-session approach as
// Unipile/linkedout, just unmanaged (see plan). Voyager is undocumented and
// changes; the exact endpoints/payloads below follow the long-standing classic
// messaging shape and may need adjustment against a live session.
//
// Auth model: LinkedIn's CSRF scheme requires the `csrf-token` header to equal
// the JSESSIONID cookie value, and the User-Agent must match the browser the
// li_at was minted in (mismatch → session disconnect). All three are stored as
// workspace secrets.

const SECRET_LI_AT = "linkedin_li_at";
const SECRET_JSESSIONID = "linkedin_jsessionid";
const SECRET_USER_AGENT = "linkedin_user_agent";

const VOYAGER_BASE = "https://www.linkedin.com/voyager/api";

type Session = { liAt: string; jsessionid: string; userAgent: string };

async function loadSession(workspaceId: string): Promise<Session> {
  const [liAt, jsessionid, userAgent] = await Promise.all([
    getSecretConnectionValue(workspaceId, SECRET_LI_AT),
    getSecretConnectionValue(workspaceId, SECRET_JSESSIONID),
    getSecretConnectionValue(workspaceId, SECRET_USER_AGENT),
  ]);
  if (!liAt || !jsessionid) {
    throw new Error(
      `LinkedIn session not configured — set the ${SECRET_LI_AT} and ${SECRET_JSESSIONID} secrets under Connections → Secrets.`,
    );
  }
  return {
    liAt,
    jsessionid,
    // A sensible default UA if none stored, but matching the cookie's origin
    // browser is strongly recommended to avoid disconnects.
    userAgent:
      userAgent ??
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  };
}

function headers(s: Session): Record<string, string> {
  // JSESSIONID is sent as a quoted cookie value, but the csrf-token header is
  // the same value WITHOUT surrounding quotes.
  const jsession = s.jsessionid.replace(/^"|"$/g, "");
  return {
    cookie: `li_at=${s.liAt}; JSESSIONID="${jsession}"`,
    "csrf-token": jsession,
    "x-restli-protocol-version": "2.0.0",
    "user-agent": s.userAgent,
    accept: "application/json",
    "content-type": "application/json; charset=UTF-8",
  };
}

async function voyager(
  s: Session,
  path: string,
  init: { method: string; body?: unknown },
): Promise<void> {
  const res = await fetch(`${VOYAGER_BASE}${path}`, {
    method: init.method,
    headers: headers(s),
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429 || res.status === 999) {
      throw new Error(
        `LinkedIn rate-limited the request (${res.status}). Back off and retry later.`,
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "LinkedIn rejected the session (401/403) — the li_at cookie may be expired or the user-agent mismatched. Re-capture the cookie.",
      );
    }
    throw new Error(`LinkedIn Voyager ${init.method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
}

/**
 * Send a message into an existing conversation. `convId` is LinkedIn's
 * conversation id (the read side / linkedin-api returns it). Classic Voyager
 * messaging "create event" shape.
 */
export async function sendMessage(
  workspaceId: string,
  convId: string,
  text: string,
): Promise<void> {
  const s = await loadSession(workspaceId);
  await voyager(s, `/messaging/conversations/${encodeURIComponent(convId)}/events?action=create`, {
    method: "POST",
    body: {
      eventCreate: {
        value: {
          "com.linkedin.voyager.messaging.create.MessageCreate": {
            body: text,
            attachments: [],
            attributedBody: { text, attributes: [] },
            mediaAttachments: [],
          },
        },
      },
    },
  });
}

/**
 * Archive (or unarchive) a conversation via a Voyager partial update.
 */
export async function archiveConversation(
  workspaceId: string,
  convId: string,
  archived = true,
): Promise<void> {
  const s = await loadSession(workspaceId);
  await voyager(s, `/messaging/conversations/${encodeURIComponent(convId)}`, {
    method: "POST",
    body: { patch: { $set: { archived } } },
  });
}
