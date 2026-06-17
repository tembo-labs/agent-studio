//! Subprocess wrapper that runs an Eve agent (github.com/vercel/eve) via the
//! bundled Node harness (api/scripts/run_eve.mjs, copied into the runtime image
//! at /usr/local/bin/run_eve.mjs — see api/Dockerfile).
//!
//! Unlike Pydantic/Cargo, an Eve agent is a *directory of TypeScript files*, not
//! a single spec. We ship that directory as a `{ repoPath: content }` map (the
//! same shape Pydantic uses for Agent Skills) in `TAS_EVE_FILES`; the harness
//! materializes it, builds it, and runs ONE turn fully in-process with no
//! listening HTTP server (see api/scripts/EVE_SPIKE_NOTES.md for how).
//!
//! Output protocol is identical to the Pydantic wrapper — the harness emits the
//! assistant reply plus `__TAS_STEPS__:` / `__TAS_USAGE__:` sentinels — so we
//! reuse the pydantic sentinel parsers verbatim.

use anyhow::{anyhow, Context};
use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::Command;

use crate::runs::pydantic::{self, PydanticResult, RunStep, ToolCall};

const EVE_NODE: &str = "/usr/local/bin/node";
const EVE_SCRIPT: &str = "/usr/local/bin/run_eve.mjs";
/// Persistent pnpm store so per-run `pnpm install` is mostly hardlinks.
/// Provisioned as a writable dir in api/Dockerfile.
const EVE_PNPM_STORE: &str = "/opt/eve-store";

pub struct EveArgs<'a> {
    /// The agent directory as `{ project-relative path: content }` — the web
    /// layer strips the `agents/eve/<name>/` prefix so paths are project-root
    /// relative (e.g. `agent/agent.ts`).
    pub agent_files: &'a HashMap<String, String>,
    /// Freeform user input. Empty string means "no input"; the harness
    /// defaults to "Hello." so the turn has a prompt.
    pub user_message: &'a str,
    /// Provider keys — the agent's direct `@ai-sdk` provider reads these from
    /// env. (Eve's default gateway routing needs Vercel creds, so TAS agents
    /// use a direct provider; see the Eve guide.)
    pub openai_api_key: Option<&'a str>,
    pub anthropic_api_key: Option<&'a str>,
}

/// Run the harness and return the parsed result plus tool calls + steps. Mirrors
/// `pydantic::invoke`'s contract: tool calls/steps come back on both the success
/// and failure path so a failed run still records what it did.
pub async fn invoke(
    args: EveArgs<'_>,
) -> (anyhow::Result<PydanticResult>, Vec<ToolCall>, Vec<RunStep>) {
    let files_json = match serde_json::to_string(args.agent_files) {
        Ok(s) => s,
        Err(e) => {
            return (
                Err(anyhow!("failed to serialize Eve agent files: {e}")),
                Vec::new(),
                Vec::new(),
            )
        }
    };

    let output = match spawn_and_wait(&args, &files_json).await {
        Ok(o) => o,
        Err(e) => return (Err(e), Vec::new(), Vec::new()),
    };

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let steps = pydantic::extract_steps(&stdout);
    let tool_calls = if steps.is_empty() {
        pydantic::extract_tool_calls(&stdout)
    } else {
        pydantic::flatten_step_tool_calls(&steps)
    };

    if !output.status.success() {
        let snippet = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr.clone()
        };
        return (
            Err(anyhow!(
                "eve runner exited with status {}: {}",
                output.status,
                snippet.trim().chars().take(16_000).collect::<String>()
            )),
            tool_calls,
            steps,
        );
    }

    (Ok(pydantic::parse_output(&stdout)), tool_calls, steps)
}

async fn spawn_and_wait(
    args: &EveArgs<'_>,
    files_json: &str,
) -> anyhow::Result<std::process::Output> {
    let mut cmd = Command::new(EVE_NODE);
    cmd.arg(EVE_SCRIPT)
        .env_clear()
        // pnpm + node + eve CLI live on PATH; HOME is needed by pnpm.
        .env("PATH", "/usr/local/bin:/usr/bin:/bin")
        .env("HOME", "/tmp")
        .env("TAS_EVE_FILES", files_json)
        .env("TAS_MESSAGE", args.user_message)
        .env("TAS_EVE_PNPM_STORE", EVE_PNPM_STORE)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(k) = args.openai_api_key {
        cmd.env("OPENAI_API_KEY", k);
    }
    if let Some(k) = args.anthropic_api_key {
        cmd.env("ANTHROPIC_API_KEY", k);
    }

    let child = cmd.spawn().context("failed to spawn eve runner (node)")?;
    let output = child
        .wait_with_output()
        .await
        .context("eve runner process failed to complete")?;
    Ok(output)
}
