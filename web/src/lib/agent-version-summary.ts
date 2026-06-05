import "server-only";

import { getWorkspaceSecretPlaintext } from "@/lib/workspace";

// Generate a short, human summary of what changed between two agent spec
// versions, for the Versions list + the "draft has unreleased changes"
// banner. Uses the workspace's Anthropic key (cheap Haiku call). Never
// throws and never blocks a promotion — any failure returns a deterministic
// fallback string.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const SUMMARY_MODEL = "claude-haiku-4-5";

const SYSTEM = [
  "You summarize the difference between two versions of an AI agent's",
  "definition file (YAML or JSON). Write 1-3 short bullet points describing",
  "what changed in plain language a non-engineer can follow — focus on",
  "behavior (instructions, model, tools/connections, schedule, labels), not",
  "formatting. If nothing meaningful changed, say so. Output only the bullets,",
  "no preamble.",
].join(" ");

async function tryGetKey(workspaceId: string): Promise<string | null> {
  try {
    return await getWorkspaceSecretPlaintext(workspaceId, "anthropic_api_key");
  } catch {
    return null;
  }
}

/**
 * Summarize the change from `previous` -> `next` spec content.
 * - previous === null  => "Initial version." (no API call)
 * - no key / API error => "Promoted to stable." (promotion still succeeds)
 */
export async function summarizeSpecDiff(args: {
  workspaceId: string;
  agentName: string;
  previous: string | null;
  next: string;
}): Promise<string> {
  const { workspaceId, agentName, previous, next } = args;
  if (previous === null) return "Initial version.";
  if (previous === next) return "No changes.";

  const apiKey = await tryGetKey(workspaceId);
  if (!apiKey) return "Promoted to stable.";

  const userMessage = [
    `Agent: ${agentName}`,
    "",
    "PREVIOUS version:",
    "```",
    previous.slice(0, 12000),
    "```",
    "",
    "NEW version:",
    "```",
    next.slice(0, 12000),
    "```",
  ].join("\n");

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      cache: "no-store",
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) return "Promoted to stable.";
    const data = (await res.json()) as {
      content?: { type?: string; text?: string }[];
    };
    const text =
      data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("")
        .trim() ?? "";
    return text || "Promoted to stable.";
  } catch {
    return "Promoted to stable.";
  }
}
