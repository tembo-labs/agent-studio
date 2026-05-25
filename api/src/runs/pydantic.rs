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

const PYDANTIC_PY: &str = "/opt/pydantic-ai/bin/python3";
const PYDANTIC_SCRIPT: &str = "/usr/local/bin/run_pydantic.py";
const USAGE_SENTINEL: &str = "__TAS_USAGE__:";

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
        let snippet = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr.clone()
        };
        bail!(
            "pydantic-ai wrapper exited with status {}: {}",
            output.status,
            snippet.trim().chars().take(800).collect::<String>()
        );
    }

    Ok(parse_output(&stdout))
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
