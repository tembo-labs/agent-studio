import "server-only";

// Typed client for the Rust API's /internal/runs surface. Auth is a
// shared bearer (INTERNAL_API_TOKEN env var); the web container reaches
// the API service via the docker network at API_INTERNAL_URL.

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8080";

function authHeader(): Record<string, string> {
  const token = process.env.INTERNAL_API_TOKEN;
  if (!token) {
    throw new Error(
      "INTERNAL_API_TOKEN is required for web → api calls. " +
        "Set it in .env and pass it through docker-compose.yml.",
    );
  }
  return { Authorization: `Bearer ${token}` };
}

export type CreateRunInput = {
  workspaceId: string;
  userId: string;
  agentName: string;
  agentPath: string;
  model: string;
  instructions: string;
  userMessage?: string;
};

export type CreateRunResponse = { runId: string };

export type RunRecord = {
  id: string;
  workspaceId: string;
  agentName: string;
  agentPath: string;
  model: string;
  status: "queued" | "running" | "succeeded" | "failed";
  output: string;
  errorMessage: string | null;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
};

type ApiRunRecord = {
  id: string;
  workspace_id: string;
  agent_name: string;
  agent_path: string;
  model: string;
  status: RunRecord["status"];
  output: string;
  error_message: string | null;
  created_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
};

function fromApi(r: ApiRunRecord): RunRecord {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    agentName: r.agent_name,
    agentPath: r.agent_path,
    model: r.model,
    status: r.status,
    output: r.output,
    errorMessage: r.error_message,
    createdBy: r.created_by,
    createdAt: r.created_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    tokensInput: r.tokens_input,
    tokensOutput: r.tokens_output,
  };
}

export async function createRun(input: CreateRunInput): Promise<CreateRunResponse> {
  const res = await fetch(`${API_URL}/internal/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    cache: "no-store",
    body: JSON.stringify({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      agent_name: input.agentName,
      agent_path: input.agentPath,
      model: input.model,
      instructions: input.instructions,
      user_message: input.userMessage ?? "",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Run API returned ${res.status}: ${text.slice(0, 400)}`);
  }
  const body = (await res.json()) as { run_id: string };
  return { runId: body.run_id };
}

export async function getRun(runId: string): Promise<RunRecord | null> {
  const res = await fetch(`${API_URL}/internal/runs/${encodeURIComponent(runId)}`, {
    method: "GET",
    headers: { ...authHeader() },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Run API returned ${res.status}: ${text.slice(0, 400)}`);
  }
  const body = (await res.json()) as ApiRunRecord;
  return fromApi(body);
}
