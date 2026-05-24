//! Subprocess wrapper that runs a Cargo AI agent via the bundled
//! `cargo-ai` CLI (installed into the runtime image at
//! /usr/local/bin/cargo-ai, see api/Dockerfile).
//!
//! Strategy: take the simplified Cargo AI agent JSON the web layer
//! already produces, translate it into the schema cargo-ai 0.3.0
//! expects (version + inputs + agent_schema + actions), pipe the
//! translated JSON to `cargo-ai run --stdin` with the provider /
//! model / token passed on the command line, and capture stdout +
//! stderr for the run row.
//!
//! Why translate at runtime instead of changing our wire format:
//! users keep writing the simple `actions: [{id, type, prompt}]`
//! shape they already know; we get cargo-ai's full execution
//! engine underneath. Day-one this is an LLM-only feature gap from
//! the action graph — the v0.1 simplification dropped HTTP/exec —
//! so the translation collapses every llm action's prompt into one
//! `inputs[]` text block. HTTP / exec actions land in a follow-up
//! once we agree on the user-facing schema.

use anyhow::{anyhow, bail, Context};
use serde_json::{json, Map, Value};
use std::process::Stdio;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

/// Cargo AI's strict schema version. Mirrors what their own
/// adder_test.json / weather_test.json declare on the 0.3.x line.
/// Bump together with the cargo-ai version in api/Dockerfile.
const CARGO_AI_SCHEMA_VERSION: &str = "2026-03-03.r1";

const CARGO_AI_BIN: &str = "/usr/local/bin/cargo-ai";

pub struct CargoAiArgs<'a> {
    /// The raw, simplified Cargo AI agent JSON as it sits in the repo —
    /// e.g. `agents/cargo-ai/test.json`. The translator below converts
    /// it to cargo-ai's expected schema before sending it to the CLI.
    pub spec_json: &'a str,
    /// The provider half of `runtime_vars.model` (e.g. "openai"). Maps
    /// to cargo-ai's `--server` flag.
    pub provider: &'a str,
    /// The model half of `runtime_vars.model` (e.g. "gpt-4o-mini").
    pub model: &'a str,
    /// Provider API key — passed to cargo-ai as `--token`, bypassing
    /// its profile / keychain auth flow.
    pub api_key: &'a str,
    /// Optional freeform user input to append as an extra `inputs[]`
    /// block. Empty string means "no user input"; cargo-ai treats
    /// what's in the JSON as the full prompt.
    pub user_message: &'a str,
}

pub struct CargoAiResult {
    pub stdout: String,
    pub stderr: String,
}

pub async fn invoke(args: CargoAiArgs<'_>) -> anyhow::Result<CargoAiResult> {
    let translated = translate_spec(args.spec_json, args.user_message)
        .context("couldn't translate Cargo AI spec into cargo-ai's expected schema")?;

    let mut child = Command::new(CARGO_AI_BIN)
        .arg("run")
        .arg("--stdin")
        .arg("--server")
        .arg(args.provider)
        .arg("--model")
        .arg(args.model)
        .arg("--token")
        .arg(args.api_key)
        .arg("--no-update-check")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("failed to spawn cargo-ai")?;

    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| anyhow!("cargo-ai child stdin not captured"))?;
        stdin
            .write_all(translated.as_bytes())
            .await
            .context("failed to write translated spec to cargo-ai stdin")?;
    }

    let output = child
        .wait_with_output()
        .await
        .context("cargo-ai process failed to complete")?;

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();

    if !output.status.success() {
        // Surface whatever cargo-ai wrote to stderr so the run row's
        // failure reason has actionable detail, not just an exit
        // code.
        let snippet = if stderr.trim().is_empty() {
            stdout.clone()
        } else {
            stderr.clone()
        };
        bail!(
            "cargo-ai exited with status {}: {}",
            output.status,
            snippet.trim().chars().take(800).collect::<String>()
        );
    }

    Ok(CargoAiResult { stdout, stderr })
}

/// Translate our simplified Cargo AI agent JSON into the schema
/// cargo-ai 0.3.0 actually validates. Drops fields cargo-ai doesn't
/// know (`name`, `description`, `runtime_vars`), folds every `type:
/// "llm"` action's prompt into a single inputs[] text block, keeps
/// `agent_schema` verbatim, and appends the user's freeform input
/// (when present) as a trailing text input.
fn translate_spec(simplified_json: &str, user_message: &str) -> anyhow::Result<String> {
    let parsed: Value =
        serde_json::from_str(simplified_json).context("agent JSON was not valid JSON")?;
    let obj = parsed
        .as_object()
        .ok_or_else(|| anyhow!("agent JSON must be a top-level object"))?;

    let agent_schema = obj
        .get("agent_schema")
        .ok_or_else(|| anyhow!("agent JSON is missing `agent_schema` (required by cargo-ai)"))?
        .clone();

    let actions = obj
        .get("actions")
        .and_then(|v| v.as_array())
        .ok_or_else(|| anyhow!("agent JSON is missing `actions[]`"))?;

    let mut llm_prompts = Vec::new();
    for action in actions {
        let Some(a) = action.as_object() else { continue };
        let is_llm = a.get("type").and_then(Value::as_str) == Some("llm");
        if !is_llm {
            continue;
        }
        if let Some(p) = a.get("prompt").and_then(Value::as_str) {
            llm_prompts.push(p.to_string());
        }
    }
    if llm_prompts.is_empty() {
        bail!("agent has no `type: \"llm\"` actions with prompts — nothing to send to the model");
    }

    let mut inputs: Vec<Value> = Vec::with_capacity(llm_prompts.len() + 1);
    for p in llm_prompts {
        inputs.push(json!({ "type": "text", "text": p }));
    }
    if !user_message.is_empty() {
        inputs.push(json!({ "type": "text", "text": format!("User input: {}", user_message) }));
    }

    let mut out = Map::new();
    out.insert("version".to_string(), json!(CARGO_AI_SCHEMA_VERSION));
    out.insert("inputs".to_string(), Value::Array(inputs));
    out.insert("agent_schema".to_string(), agent_schema);
    // cargo-ai requires `actions[]` to be present; our v1 has nothing
    // to put there (no HTTP / exec side effects), so we send an empty
    // array. Action graph support lands in a follow-up.
    out.insert("actions".to_string(), Value::Array(Vec::new()));

    Ok(Value::Object(out).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn translates_simplified_into_cargo_ai_schema() {
        let simplified = serde_json::json!({
            "name": "demo",
            "description": "say hi",
            "agent_schema": {
                "type": "object",
                "properties": { "greeting": { "type": "string" } }
            },
            "runtime_vars": { "model": "openai:gpt-4o-mini" },
            "actions": [
                { "id": "greet", "type": "llm", "prompt": "Greet warmly." }
            ]
        })
        .to_string();
        let out = translate_spec(&simplified, "Hi there!").unwrap();
        let parsed: Value = serde_json::from_str(&out).unwrap();
        assert_eq!(parsed["version"], CARGO_AI_SCHEMA_VERSION);
        assert_eq!(parsed["actions"], serde_json::json!([]));
        assert_eq!(parsed["agent_schema"]["properties"]["greeting"]["type"], "string");
        let inputs = parsed["inputs"].as_array().unwrap();
        assert_eq!(inputs.len(), 2);
        assert_eq!(inputs[0]["text"], "Greet warmly.");
        assert_eq!(inputs[1]["text"], "User input: Hi there!");
    }

    #[test]
    fn rejects_specs_without_llm_actions() {
        let simplified = serde_json::json!({
            "agent_schema": {},
            "actions": [
                { "id": "fetch", "type": "http", "url": "https://example.com" }
            ]
        })
        .to_string();
        assert!(translate_spec(&simplified, "").is_err());
    }
}
