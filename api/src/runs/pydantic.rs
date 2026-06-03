//! Subprocess wrapper that runs a Pydantic AgentSpec via the bundled
//! Python wrapper (api/scripts/run_pydantic.py, copied into the
//! runtime image at /usr/local/bin/run_pydantic.py — see
//! api/Dockerfile). The wrapper imports the real `pydantic_ai`
//! library and calls `Agent.from_spec(...).run(user_message)`, so
//! agents get the full Pydantic AI feature set (structured output,
//! model_settings, retries, instrumentation, etc.) instead of the
//! hand-rolled "send instructions + user message" path the Rust
//! runner used before.
//!
//! Auth: provider API keys are passed as environment variables. The
//! wrapper script doesn't know or care which provider is being
//! called; we set both AnthropicApiKey and OpenAiApiKey when they're
//! available so the dispatch happens inside pydantic-ai based on the
//! agent's `model:` field.
//!
//! Output protocol: the wrapper writes the agent's reply followed by
//! an optional `__TAS_USAGE__:{json}` sentinel line carrying token
//! counts. `parse_output` peels the sentinel off so the run row's
//! transcript stays clean and the token columns get populated.

use anyhow::{anyhow, bail, Context};
use serde::Deserialize;
use std::process::Stdio;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use uuid::Uuid;

const PYDANTIC_PY: &str = "/opt/pydantic-ai/bin/python3";
const PYDANTIC_SCRIPT: &str = "/usr/local/bin/run_pydantic.py";
const USAGE_SENTINEL: &str = "__TAS_USAGE__:";
const STALE_CONNECTION_MARKER: &str = "__TAS_STALE_CONNECTION__:";

pub struct PydanticArgs<'a> {
    /// Raw spec content as it sits in the repo (YAML or JSON).
    pub spec_content: &'a str,
    /// Spec format — drives the wrapper's `--fmt` flag. The runner
    /// knows this from the file extension.
    pub spec_format: SpecFormat,
    /// Freeform user input. Empty string means "no input"; the
    /// wrapper defaults to "Hello." in that case so pydantic-ai's
    /// run loop has a prompt.
    pub user_message: &'a str,
    /// Workspace's OpenAI API key, if set. Wired into the
    /// subprocess as OPENAI_API_KEY so pydantic-ai's OpenAI client
    /// picks it up.
    pub openai_api_key: Option<&'a str>,
    /// Workspace's Anthropic API key, if set.
    pub anthropic_api_key: Option<&'a str>,
    /// Workspace's Composio API key, if set. Surfaced to the Python
    /// wrapper as `TAS_COMPOSIO_API_KEY`; the wrapper only uses it
    /// when the agent's spec declares `connections:`.
    pub composio_api_key: Option<&'a str>,
    /// The Composio `user_id` to scope connections under. We use
    /// the workspace UUID — Composio's per-user isolation is the
    /// boundary between workspaces sharing one Composio key.
    /// Surfaced as `TAS_COMPOSIO_USER_ID`.
    pub composio_user_id: Option<&'a str>,
    /// JSON-encoded `{toolkit_slug: composio_connection_id}` map for
    /// the workspace's ACTIVE composio connections. Surfaced as
    /// `TAS_COMPOSIO_CONNECTED_ACCOUNTS`. Without this the runtime
    /// session reports the connections as inactive even though the
    /// workspace authorized them.
    pub composio_connected_accounts_json: Option<&'a str>,
    /// JSON-encoded `{provider: {name: {mcp_url, access_token}}}` map
    /// of the workspace's ACTIVE native-MCP connections, decrypted.
    /// Surfaced as `TAS_NATIVE_MCP_CONNECTIONS`. The Python wrapper
    /// builds one MCPServerStreamableHTTP toolset per declared
    /// (provider, name) slot, with the bearer token in
    /// Authorization headers.
    pub native_mcp_connections_json: Option<&'a str>,
    /// Workspace + user the run executes under. Used to flip a
    /// `workspace_composio_connection` row's status to `STALE` if
    /// the Python wrapper detects Composio's
    /// `ToolRouterV2_InvalidConnectedAccountIds` error — the cached
    /// id no longer matches a connection that user owns.
    pub workspace_id: Uuid,
    pub acting_user_id: &'a str,
    pub db: &'a sqlx::PgPool,
}

#[derive(Debug, Clone, Copy)]
pub enum SpecFormat {
    Yaml,
    Json,
}

impl SpecFormat {
    fn as_arg(self) -> &'static str {
        match self {
            SpecFormat::Yaml => "yaml",
            SpecFormat::Json => "json",
        }
    }
}

pub struct PydanticResult {
    /// Agent reply, with the usage sentinel stripped out.
    pub output: String,
    pub usage: Option<PydanticUsage>,
}

#[derive(Debug, Deserialize, Default)]
pub struct PydanticUsage {
    /// pydantic-ai 1.x publishes both `input_tokens` and the legacy
    /// `request_tokens` for compatibility; we deserialize both and
    /// the runner picks whichever it can find when writing the run
    /// row.
    #[serde(default)]
    pub input_tokens: Option<i32>,
    #[serde(default)]
    pub output_tokens: Option<i32>,
    #[serde(default)]
    pub request_tokens: Option<i32>,
    #[serde(default)]
    pub response_tokens: Option<i32>,
    #[serde(default)]
    pub total_tokens: Option<i32>,
}

impl PydanticUsage {
    /// Best-effort (input, output) extraction across pydantic-ai
    /// version skew — newer releases use `input_tokens` /
    /// `output_tokens`, older ones use `request_tokens` /
    /// `response_tokens`. Either pair is acceptable; we don't need
    /// both.
    pub fn input_output(&self) -> Option<(i32, i32)> {
        let input = self.input_tokens.or(self.request_tokens)?;
        let output = self.output_tokens.or(self.response_tokens)?;
        Some((input, output))
    }
}

pub async fn invoke(args: PydanticArgs<'_>) -> anyhow::Result<PydanticResult> {
    let mut cmd = Command::new(PYDANTIC_PY);
    cmd.arg(PYDANTIC_SCRIPT)
        .arg("--fmt")
        .arg(args.spec_format.as_arg())
        .arg("--user-message")
        .arg(args.user_message)
        .env_clear()
        .env("PATH", "/usr/local/bin:/usr/bin:/bin")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Provider keys flow in via env so the wrapper script doesn't
    // have to know which provider the agent's model: string points
    // to — pydantic-ai's own dispatch handles that.
    if let Some(k) = args.openai_api_key {
        cmd.env("OPENAI_API_KEY", k);
    }
    if let Some(k) = args.anthropic_api_key {
        cmd.env("ANTHROPIC_API_KEY", k);
    }
    // Composio creds — only used by the wrapper when the agent's
    // spec declares `connections:`. Always set both vars together
    // (workspace_id has no value to the wrapper without the API key)
    // or skip both.
    if let (Some(key), Some(uid)) = (args.composio_api_key, args.composio_user_id) {
        cmd.env("TAS_COMPOSIO_API_KEY", key);
        cmd.env("TAS_COMPOSIO_USER_ID", uid);
    }
    if let Some(accounts_json) = args.composio_connected_accounts_json {
        cmd.env("TAS_COMPOSIO_CONNECTED_ACCOUNTS", accounts_json);
    }
    // Native MCP — independent of Composio. Only set when the
    // workspace's acting user has any active native connections;
    // wrapper treats absence as "no native entries possible" so
    // missing slots fail with a clean message rather than a JSON
    // decode error.
    if let Some(native_json) = args.native_mcp_connections_json {
        cmd.env("TAS_NATIVE_MCP_CONNECTIONS", native_json);
    }

    let mut child = cmd.spawn().context("failed to spawn pydantic-ai wrapper")?;

    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| anyhow!("pydantic-ai wrapper stdin not captured"))?;
        stdin
            .write_all(args.spec_content.as_bytes())
            .await
            .context("failed to write spec to pydantic-ai wrapper stdin")?;
    }

    let output = child
        .wait_with_output()
        .await
        .context("pydantic-ai wrapper failed to complete")?;

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();

    if !output.status.success() {
        // Pull out any stale-connection markers the wrapper emitted
        // before bailing — they tell us *which* slot Composio's API
        // refused. We flip those rows to STALE so the sidebar shows
        // a Connect alert next time the user lands, and the failure
        // reason becomes actionable ("reconnect X") instead of a
        // raw 400.
        let (stale_slots, cleaned_stderr) = parse_stale_markers(&stderr);
        for slot in &stale_slots {
            mark_connection_stale(
                args.db,
                args.workspace_id,
                args.acting_user_id,
                &slot.toolkit,
                &slot.name,
            )
            .await;
        }

        if !stale_slots.is_empty() {
            // Friendlier replacement message — the raw Composio
            // payload still rides along after a separator so a
            // determined operator can see the upstream error.
            let labels = stale_slots
                .iter()
                .map(|s| {
                    if s.name == "default" {
                        s.toolkit.clone()
                    } else {
                        format!("{}/{}", s.toolkit, s.name)
                    }
                })
                .collect::<Vec<_>>()
                .join(", ");
            bail!(
                "Composio rejected the cached connection for: {labels}. \
                 Open the Connections page, click Disconnect on that \
                 slot, then Reconnect to re-authorize.\n\n\
                 ──── raw error ────\n{}",
                cleaned_stderr
                    .trim()
                    .chars()
                    .take(16_000)
                    .collect::<String>()
            );
        }

        let snippet = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr.clone()
        };
        // Cap at 16 KB — enough for a full Python traceback with
        // multiple call sites plus the exception message. The DB
        // column is TEXT (no length limit on Postgres's side) and
        // the run-detail UI scrolls long messages, so the cap is
        // here only to keep one runaway error from filling a row.
        bail!(
            "pydantic-ai wrapper exited with status {}: {}",
            output.status,
            snippet.trim().chars().take(16_000).collect::<String>()
        );
    }

    Ok(parse_output(&stdout))
}

#[derive(Debug, Deserialize)]
struct StaleConnectionMarker {
    toolkit: String,
    name: String,
    #[serde(default)]
    #[allow(dead_code)]
    connection_id: String,
}

/// Pull every `__TAS_STALE_CONNECTION__:[json]` line out of stderr
/// and return (parsed markers, stderr with those lines removed).
/// Each marker line carries a JSON array of {toolkit, name,
/// connection_id} entries (the wrapper sometimes flags multiple
/// slots in one go when several share a stale id).
fn parse_stale_markers(stderr: &str) -> (Vec<StaleConnectionMarker>, String) {
    let mut markers: Vec<StaleConnectionMarker> = Vec::new();
    let mut cleaned: Vec<&str> = Vec::new();
    for line in stderr.lines() {
        if let Some(payload) = line.trim().strip_prefix(STALE_CONNECTION_MARKER) {
            match serde_json::from_str::<Vec<StaleConnectionMarker>>(payload) {
                Ok(parsed) => markers.extend(parsed),
                Err(e) => {
                    tracing::warn!(
                        ?e,
                        "stale-connection marker failed to parse — keeping line in stderr"
                    );
                    cleaned.push(line);
                }
            }
        } else {
            cleaned.push(line);
        }
    }
    (markers, cleaned.join("\n"))
}

async fn mark_connection_stale(
    db: &sqlx::PgPool,
    workspace_id: Uuid,
    user_id: &str,
    toolkit: &str,
    name: &str,
) {
    // Best-effort. A failure here means the next run will hit the
    // same Composio 400 — annoying but not catastrophic, and the
    // run's failure reason already names the slot for the user.
    let res = sqlx::query(
        "UPDATE workspace_composio_connection
            SET status = 'STALE', updated_at = NOW()
          WHERE workspace_id = $1 AND user_id = $2
            AND toolkit_slug = $3 AND name = $4",
    )
    .bind(workspace_id)
    .bind(user_id)
    .bind(toolkit)
    .bind(name)
    .execute(db)
    .await;
    if let Err(e) = res {
        tracing::warn!(?e, %toolkit, %name, "failed to mark composio connection stale");
    }
}

/// Strip the trailing `__TAS_USAGE__:{json}` sentinel (if present)
/// out of the wrapper's stdout, returning the user-facing output
/// and the parsed usage payload. A missing or malformed sentinel
/// is non-fatal — we just record no usage rather than failing the
/// run because token counts aren't critical.
fn parse_output(stdout: &str) -> PydanticResult {
    let mut output_lines: Vec<&str> = Vec::new();
    let mut usage = None;
    for line in stdout.lines() {
        if let Some(json_part) = line.strip_prefix(USAGE_SENTINEL) {
            if let Ok(parsed) = serde_json::from_str::<PydanticUsage>(json_part) {
                usage = Some(parsed);
            }
            // Drop the sentinel line either way — never let it leak
            // into the user-facing transcript.
            continue;
        }
        output_lines.push(line);
    }
    // Re-join with `\n` and trim trailing blank lines so the run
    // row's output column doesn't carry rendering noise.
    let joined = output_lines.join("\n");
    PydanticResult {
        output: joined.trim_end().to_string(),
        usage,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_plain_output_with_no_sentinel() {
        let stdout = "Hello there!\nHow can I help?\n";
        let result = parse_output(stdout);
        assert_eq!(result.output, "Hello there!\nHow can I help?");
        assert!(result.usage.is_none());
    }

    #[test]
    fn strips_usage_sentinel_and_keeps_output_clean() {
        let stdout = "Hello there!\n__TAS_USAGE__:{\"input_tokens\":42,\"output_tokens\":7}\n";
        let result = parse_output(stdout);
        assert_eq!(result.output, "Hello there!");
        let usage = result.usage.expect("usage parsed");
        assert_eq!(usage.input_output(), Some((42, 7)));
    }

    #[test]
    fn tolerates_legacy_request_response_token_names() {
        let stdout = "ok\n__TAS_USAGE__:{\"request_tokens\":11,\"response_tokens\":3}\n";
        let result = parse_output(stdout);
        let usage = result.usage.expect("usage parsed");
        assert_eq!(usage.input_output(), Some((11, 3)));
    }

    #[test]
    fn malformed_sentinel_is_silently_dropped() {
        let stdout = "ok\n__TAS_USAGE__:not-json\n";
        let result = parse_output(stdout);
        assert_eq!(result.output, "ok");
        assert!(result.usage.is_none());
    }
}
