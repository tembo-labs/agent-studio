import "server-only";

import type { InboxOption } from "@/lib/inbox-api";

import { linkedinExecutor } from "./linkedin";
import { nativeMcpExecutor } from "./native-mcp";

// Registry that turns an inbox option's `execute` descriptor into a real action.
// Keyed by `execute.provider`. The executor runs SYNCHRONOUSLY when the human
// clicks the option's button. The descriptor comes from the STORED item option
// (never from the client), so a caller can only trigger actions the producing
// agent declared.

export type InboxExecutorArgs = {
  workspaceId: string;
  /** The clicking human — needed to resolve their per-user connections. */
  userId: string;
  op: string;
  params?: Record<string, unknown>;
  /** The human's (possibly edited) reply text, for reply-type options. */
  text?: string;
};

export type InboxExecutor = (args: InboxExecutorArgs) => Promise<void>;

const REGISTRY: Record<string, InboxExecutor> = {
  linkedin: linkedinExecutor,
  "native-mcp": nativeMcpExecutor,
};

/**
 * Run the chosen option's action. No-op when the option has no `execute`
 * descriptor (e.g. "Ignore" — the item just resolves). Throws on an unknown
 * provider or a handler error; the caller surfaces it and does NOT resolve the
 * item.
 */
export async function executeInboxOption(
  workspaceId: string,
  userId: string,
  option: InboxOption,
  text?: string,
): Promise<void> {
  if (!option.execute) return;
  const handler = REGISTRY[option.execute.provider];
  if (!handler) {
    throw new Error(`No executor registered for provider "${option.execute.provider}".`);
  }
  await handler({
    workspaceId,
    userId,
    op: option.execute.op,
    params: option.execute.params,
    text,
  });
}
