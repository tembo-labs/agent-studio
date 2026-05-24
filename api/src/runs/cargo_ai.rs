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
    /// Actions in the source spec the translator couldn't run as
    /// declared — either fully skipped (`exec`, unknown kinds,
    /// http without a url) or partially translated (http with
    /// method/headers/body where only the URL fetch carried over).
    /// The runner uses `severity` to decide whether to render a
    /// loud warning or a quieter note.
    pub dropped_actions: Vec<DroppedAction>,
}

#[derive(Debug, Clone)]
pub struct DroppedAction {
    pub id: String,
    pub kind: String,
    pub severity: DroppedSeverity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DroppedSeverity {
    /// The action didn't run at all (exec, unknown kind, missing
    /// required field). The model never saw its output.
    Skipped,
    /// Part of the action ran (e.g. the URL was fetched) but custom
    /// shaping was ignored. Surface as a quieter note so users
    /// know without thinking the run is broken.
    Partial,
}

pub async fn invoke(args: CargoAiArgs<'_>) -> anyhow::Result<CargoAiResult> {
    let TranslationResult {
        json: translated,
        dropped_actions,
    } = translate_spec(args.spec_json, args.user_message)
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

    Ok(CargoAiResult {
        stdout,
        stderr,
        dropped_actions,
    })
}

struct TranslationResult {
    json: String,
    dropped_actions: Vec<DroppedAction>,
}

/// Translate our simplified Cargo AI agent JSON into the schema
/// cargo-ai 0.3.0 actually validates. Drops fields cargo-ai doesn't
/// know (`name`, `description`, `runtime_vars`), keeps `agent_schema`
/// verbatim, and walks `actions[]` in order to build cargo-ai's
/// `inputs[]`:
///
///   - `type: "llm"` actions contribute their `prompt` as a
///     `{ "type": "text", "text": ... }` input.
///   - `type: "http"` actions become `{ "type": "url", "url": ... }`
///     inputs — cargo-ai fetches the URL before the LLM call and
///     includes the body in the prompt context. Method/headers/body
///     are ignored (cargo-ai's URL input is GET-only); we log a
///     dropped-actions warning for those carry-overs separately so
///     users know.
///   - Anything else (`exec`, unknown kinds) is recorded as a
///     dropped action so the runner can surface it.
///
/// Order across kinds is preserved so a downstream LLM prompt that
/// expected to reference fetched URL content sees that content
/// upstream in `inputs[]`.
///
/// Finally the freeform `user_message` (when present) is appended
/// as a trailing text input so chat-thread runs flow naturally.
fn translate_spec(
    simplified_json: &str,
    user_message: &str,
) -> anyhow::Result<TranslationResult> {
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

    let mut inputs: Vec<Value> = Vec::with_capacity(actions.len() + 1);
    let mut llm_action_count = 0;
    let mut dropped_actions = Vec::new();
    for action in actions {
        let Some(a) = action.as_object() else { continue };
        let kind = a
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("(unknown)")
            .to_string();
        let id = a
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("(unnamed)")
            .to_string();
        match kind.as_str() {
            "llm" => {
                if let Some(p) = a.get("prompt").and_then(Value::as_str) {
                    inputs.push(json!({ "type": "text", "text": p }));
                    llm_action_count += 1;
                }
            }
            "http" => {
                let Some(url) = a.get("url").and_then(Value::as_str) else {
                    // Action declared http but has no URL — keep it
                    // visible so the user can fix the spec.
                    dropped_actions.push(DroppedAction {
                        id: id.clone(),
                        kind: "http (missing url)".to_string(),
                        severity: DroppedSeverity::Skipped,
                    });
                    continue;
                };
                inputs.push(json!({ "type": "url", "url": url }));
                // Method / headers / body don't translate cleanly to
                // cargo-ai's GET-only URL input. Note them as a
                // Partial drop so the warning stays quiet — the URL
                // still fetched, the agent still got data.
                let has_extras = a.get("method").is_some()
                    || a.get("headers").is_some()
                    || a.get("body").is_some();
                if has_extras {
                    dropped_actions.push(DroppedAction {
                        id: id.clone(),
                        kind: "http (method/headers/body ignored, URL fetched as GET)".to_string(),
                        severity: DroppedSeverity::Partial,
                    });
                }
            }
            _ => {
                dropped_actions.push(DroppedAction {
                    id,
                    kind,
                    severity: DroppedSeverity::Skipped,
                });
            }
        }
    }
    if llm_action_count == 0 {
        bail!("agent has no `type: \"llm\"` actions with prompts — nothing to send to the model");
    }

    if !user_message.is_empty() {
        inputs.push(json!({ "type": "text", "text": format!("User input: {}", user_message) }));
    }

    // cargo-ai validates the LLM response against agent_schema but
    // doesn't print it — the validated output only drives downstream
    // `actions`. With our v1 translation those would be empty, so the
    // user would see no result. Bridge by synthesising one always-
    // true action per top-level schema property that echoes its
    // value, so the run's stdout contains the model's reply. Once
    // our upstream PR adds a --emit-output flag we delete this
    // synthesis and pass that flag instead.
    let emit_actions = synthesize_emit_actions(&agent_schema);

    let mut out = Map::new();
    out.insert("version".to_string(), json!(CARGO_AI_SCHEMA_VERSION));
    out.insert("inputs".to_string(), Value::Array(inputs));
    out.insert("agent_schema".to_string(), agent_schema);
    out.insert("actions".to_string(), Value::Array(emit_actions));

    Ok(TranslationResult {
        json: Value::Object(out).to_string(),
        dropped_actions,
    })
}

/// Build one cargo-ai action per top-level field of the agent_schema
/// that always fires and exec-echoes the value, so the model's
/// response reaches the run row's output. Falls back to an empty
/// vec when the schema has no `properties` block — cargo-ai already
/// handles "no-output" agents on its own (empty_action_only_output).
fn synthesize_emit_actions(agent_schema: &Value) -> Vec<Value> {
    let Some(props) = agent_schema
        .get("properties")
        .and_then(|p| p.as_object())
    else {
        return Vec::new();
    };

    let mut steps = Vec::with_capacity(props.len());
    for (field_name, _) in props {
        // Emit one line per field as "field: value" so multi-field
        // agents read clearly. `printf` is portable across the
        // bookworm-slim runtime image and Alpine-based hosts; the
        // first arg is a format string, the rest are values.
        steps.push(json!({
            "kind": "exec",
            "program": "printf",
            "args": ["%s: %s\n", field_name, { "var": field_name }],
        }));
    }

    if steps.is_empty() {
        return Vec::new();
    }

    vec![json!({
        "name": "_tas_emit_output",
        // Always-true logic so the action fires for every run.
        "logic": { "==": [1, 1] },
        "run": steps,
    })]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn http_actions_become_url_inputs_and_arent_dropped() {
        let simplified = serde_json::json!({
            "agent_schema": { "properties": { "answer": { "type": "string" } } },
            "actions": [
                { "id": "fetch_weather", "type": "http", "url": "https://api.example.com/weather" },
                { "id": "summarize", "type": "llm", "prompt": "Summarize the fetched data." }
            ]
        })
        .to_string();
        let out = translate_spec(&simplified, "").unwrap();
        // No HTTP actions show up as dropped — they were translated
        // into cargo-ai URL inputs, which the runtime will actually
        // fetch before the LLM call.
        assert!(out.dropped_actions.is_empty());
        let parsed: Value = serde_json::from_str(&out.json).unwrap();
        let inputs = parsed["inputs"].as_array().unwrap();
        // Order preserved: URL first, then the LLM prompt text.
        assert_eq!(inputs.len(), 2);
        assert_eq!(inputs[0]["type"], "url");
        assert_eq!(inputs[0]["url"], "https://api.example.com/weather");
        assert_eq!(inputs[1]["type"], "text");
        assert_eq!(inputs[1]["text"], "Summarize the fetched data.");
    }

    #[test]
    fn http_with_extras_notes_dropped_request_shaping() {
        // cargo-ai's URL input is GET-only — method/headers/body in
        // the source agent get fetched but the custom shaping is
        // surfaced as a dropped entry so users know to revisit.
        let simplified = serde_json::json!({
            "agent_schema": { "properties": { "ok": { "type": "string" } } },
            "actions": [
                {
                    "id": "post_data",
                    "type": "http",
                    "url": "https://api.example.com/x",
                    "method": "POST",
                    "headers": { "X-Token": "abc" }
                },
                { "id": "summarize", "type": "llm", "prompt": "summarize" }
            ]
        })
        .to_string();
        let out = translate_spec(&simplified, "").unwrap();
        assert_eq!(out.dropped_actions.len(), 1);
        assert_eq!(out.dropped_actions[0].id, "post_data");
        assert!(out.dropped_actions[0].kind.starts_with("http (method"));
        assert_eq!(out.dropped_actions[0].severity, DroppedSeverity::Partial);
        // The URL was still fetched — verify it landed in inputs.
        let parsed: Value = serde_json::from_str(&out.json).unwrap();
        let inputs = parsed["inputs"].as_array().unwrap();
        assert_eq!(inputs[0]["type"], "url");
    }

    #[test]
    fn exec_actions_still_drop() {
        let simplified = serde_json::json!({
            "agent_schema": { "properties": { "x": { "type": "string" } } },
            "actions": [
                { "id": "notify", "type": "exec", "program": "echo" },
                { "id": "summarize", "type": "llm", "prompt": "say hi" }
            ]
        })
        .to_string();
        let out = translate_spec(&simplified, "").unwrap();
        assert_eq!(out.dropped_actions.len(), 1);
        assert_eq!(out.dropped_actions[0].kind, "exec");
        assert_eq!(out.dropped_actions[0].severity, DroppedSeverity::Skipped);
    }

    #[test]
    fn http_without_url_is_dropped_with_explicit_kind() {
        let simplified = serde_json::json!({
            "agent_schema": { "properties": { "x": { "type": "string" } } },
            "actions": [
                { "id": "bad", "type": "http" },
                { "id": "summarize", "type": "llm", "prompt": "say hi" }
            ]
        })
        .to_string();
        let out = translate_spec(&simplified, "").unwrap();
        assert_eq!(out.dropped_actions.len(), 1);
        assert_eq!(out.dropped_actions[0].id, "bad");
        assert!(out.dropped_actions[0].kind.contains("missing url"));
    }

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
        assert!(out.dropped_actions.is_empty());
        let parsed: Value = serde_json::from_str(&out.json).unwrap();
        assert_eq!(parsed["version"], CARGO_AI_SCHEMA_VERSION);
        assert_eq!(parsed["agent_schema"]["properties"]["greeting"]["type"], "string");
        let inputs = parsed["inputs"].as_array().unwrap();
        assert_eq!(inputs.len(), 2);
        assert_eq!(inputs[0]["text"], "Greet warmly.");
        assert_eq!(inputs[1]["text"], "User input: Hi there!");
        // The synthesised emit action surfaces each schema field
        // through stdout — without it cargo-ai would silently drop
        // the validated LLM response.
        let actions = parsed["actions"].as_array().unwrap();
        assert_eq!(actions.len(), 1);
        assert_eq!(actions[0]["name"], "_tas_emit_output");
        let steps = actions[0]["run"].as_array().unwrap();
        assert_eq!(steps[0]["program"], "printf");
        assert_eq!(steps[0]["args"][1], "greeting");
        assert_eq!(steps[0]["args"][2]["var"], "greeting");
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
