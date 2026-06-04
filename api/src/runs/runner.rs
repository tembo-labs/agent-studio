//! The actual run task. Lifecycle:
//!   queued → running → succeeded | failed
//! Output and error_message are written back to the run row so the web
//! poller can render them. Both supported frameworks (Pydantic AI,
//! Cargo AI) run as passthrough subprocess calls into the upstream
//! tool — see the per-framework modules for the wire details.

use anyhow::{anyhow, Context};
use chrono::Utc;
use uuid::Uuid;

use crate::runs::{cargo_ai, pydantic};
use crate::workspace::{
    get_workspace_secret_plaintext, list_active_composio_connections,
    list_active_native_connections, SecretKind,
};
use crate::AppState;

#[derive(Debug, Clone, Copy)]
pub enum Framework {
    Pydantic,
    CargoAi,
}

#[derive(Debug, Clone, Copy)]
pub enum SpecFormat {
    Yaml,
    Json,
}

impl SpecFormat {
    fn as_pydantic(self) -> pydantic::SpecFormat {
        match self {
            SpecFormat::Yaml => pydantic::SpecFormat::Yaml,
            SpecFormat::Json => pydantic::SpecFormat::Json,
        }
    }
}

pub struct RunContext {
    pub run_id: Uuid,
    pub workspace_id: Uuid,
    /// The user this run acts as for credential lookups (manual
    /// runs = the requesting user; scheduled runs = the automation's
    /// owner_user_id). Drives which Composio connections the
    /// Pydantic wrapper attaches to the agent's session.
    pub acting_user_id: String,
    /// `provider:model` (e.g. `openai:gpt-4o-mini`). Cargo AI needs
    /// the split; Pydantic passthrough lets pydantic-ai parse the
    /// model field straight out of the spec and only uses this for
    /// run-row metadata.
    pub model: String,
    pub user_message: String,
    pub framework: Framework,
    /// Raw agent file content as it sits in the repo. Required for
    /// both frameworks now that both are passthrough.
    pub spec_content: Option<String>,
    /// Spec content format — YAML or JSON. Drives Python wrapper's
    /// --fmt flag (Pydantic) or selects the JSON parser (Cargo AI).
    pub spec_format: SpecFormat,
}

struct RunOutcome {
    output: String,
    usage: Option<Usage>,
}

// Provider-neutral usage shape. Both pydantic-ai's usage and any
// future framework's normalise into this before crossing into the
// run row so the column semantics ({tokens_input, tokens_output})
// stay consistent regardless of who produced them.
#[derive(Debug, Clone, Copy)]
struct Usage {
    input_tokens: i32,
    output_tokens: i32,
}

/// Drive a single run from queued through to terminal state. Always
/// updates the run row even on error so the UI never sees a row stuck
/// in `running` forever.
pub async fn execute_run(state: &AppState, ctx: RunContext) {
    if let Err(e) = mark_running(state, ctx.run_id).await {
        tracing::error!(run_id = %ctx.run_id, ?e, "mark_running failed");
        // Best-effort write the failure to the run row so the UI sees it.
        let _ = mark_failed(state, ctx.run_id, &format!("internal: {e}")).await;
        return;
    }

    match run_inner(state, &ctx).await {
        Ok(outcome) => {
            if let Err(e) = mark_succeeded(
                state,
                ctx.run_id,
                &outcome.output,
                outcome.usage,
                &ctx.model,
            )
            .await
            {
                tracing::error!(run_id = %ctx.run_id, ?e, "mark_succeeded failed");
            }
            let body = if outcome.output.trim().is_empty() {
                ":white_check_mark: Done (no output).".to_string()
            } else {
                outcome.output.clone()
            };
            deliver_slack_result(state, ctx.run_id, &body).await;
        }
        Err(e) => {
            let reason = format!("{e:#}");
            tracing::warn!(run_id = %ctx.run_id, ?e, "run failed");
            if let Err(db_err) = mark_failed(state, ctx.run_id, &reason).await {
                tracing::error!(run_id = %ctx.run_id, ?db_err, "mark_failed failed");
            }
            deliver_slack_result(
                state,
                ctx.run_id,
                &format!(":warning: Run failed: {reason}"),
            )
            .await;
        }
    }
}

async fn run_inner(state: &AppState, ctx: &RunContext) -> anyhow::Result<RunOutcome> {
    match ctx.framework {
        Framework::CargoAi => {
            // Cargo AI still needs the provider:model split to set
            // its --server / --model CLI flags; pydantic-ai parses
            // its own model field out of the spec.
            let (provider, model) = ctx.model.split_once(':').ok_or_else(|| {
                anyhow!(
                    "agent's model field must be `provider:model` (got `{}`)",
                    ctx.model
                )
            })?;
            run_cargo_ai(state, ctx, provider, model).await
        }
        Framework::Pydantic => run_pydantic(state, ctx).await,
    }
}

async fn run_cargo_ai(
    state: &AppState,
    ctx: &RunContext,
    provider: &str,
    model: &str,
) -> anyhow::Result<RunOutcome> {
    // Today cargo-ai 0.3.0 only ships OpenAI + Ollama providers, so
    // an Anthropic Cargo AI agent has no upstream to talk to. We
    // unblock that once our cargo-ai Anthropic-provider PR lands;
    // until then, surface the limitation explicitly rather than
    // silently failing inside cargo-ai.
    if provider != "openai" {
        return Err(anyhow!(
            "Cargo AI agents currently only run against `openai:` models. \
             The bundled cargo-ai CLI doesn't yet support `{}` — track the upstream PR \
             in https://github.com/analyzer1/cargo-ai for Anthropic support.",
            provider
        ));
    }

    let spec_json = ctx
        .spec_content
        .as_deref()
        .ok_or_else(|| anyhow!("Cargo AI run is missing the agent's raw JSON"))?;

    let api_key = get_workspace_secret_plaintext(
        &state.db,
        &state.encryption_key,
        ctx.workspace_id,
        SecretKind::OpenAiApiKey,
    )
    .await
    .context(
        "Couldn't load this workspace's OpenAI API key. \
         Set it under Settings → OpenAI API key.",
    )?;

    let result = cargo_ai::invoke(cargo_ai::CargoAiArgs {
        spec_json,
        provider,
        model,
        api_key: &api_key,
        user_message: &ctx.user_message,
    })
    .await?;

    // cargo-ai writes the agent reply through a synthetic emit
    // action (see cargo_ai::synthesize_emit_action), so every
    // content line lands prefixed with `[Action N: _tas_emit_output] reply: …`.
    // Strip that wrapping for the user-facing transcript; raw stdout
    // is still recoverable via docker logs if anything goes wrong.
    // Token usage isn't currently surfaced by cargo-ai (queued as an
    // upstream PR); we record None and the run page hides the
    // "Consumed" row gracefully.
    let reply = extract_emit_reply(&result.stdout);
    let mut transcript = String::new();
    if !ctx.user_message.is_empty() {
        transcript.push_str("user> ");
        transcript.push_str(&ctx.user_message);
        transcript.push_str("\n\n");
    }
    if reply.trim().is_empty() {
        // Defensive: if the emit action didn't fire (older cargo-ai
        // version, schema with no `properties`, action runtime
        // failure), fall back to the raw stdout so the user at least
        // sees what cargo-ai produced.
        transcript.push_str(result.stdout.trim_end());
    } else {
        transcript.push_str(reply.trim_end());
    }
    // cargo-ai's stderr is operational noise ("Initialized Cargo AI
    // Home at …") — keep it out of the user transcript; it still
    // lands in docker logs if anything goes wrong.

    Ok(RunOutcome {
        output: transcript,
        usage: None,
    })
}

async fn run_pydantic(state: &AppState, ctx: &RunContext) -> anyhow::Result<RunOutcome> {
    let spec_content = ctx
        .spec_content
        .as_deref()
        .ok_or_else(|| anyhow!("Pydantic run is missing the agent's raw spec content"))?;

    // Load whichever provider keys the workspace has set. Either
    // (or both) may be absent; pydantic-ai inside the subprocess
    // looks up the env var matching the agent's `model:` field, and
    // surfaces a clean "missing API key" error if its specific
    // provider isn't wired up. Treating absent keys as None here
    // means a workspace with only one provider configured can still
    // run agents that point at that provider.
    let openai_key = get_workspace_secret_plaintext(
        &state.db,
        &state.encryption_key,
        ctx.workspace_id,
        SecretKind::OpenAiApiKey,
    )
    .await
    .ok();
    let anthropic_key = get_workspace_secret_plaintext(
        &state.db,
        &state.encryption_key,
        ctx.workspace_id,
        SecretKind::AnthropicApiKey,
    )
    .await
    .ok();
    // Composio key is optional — only needed if the agent's spec
    // declares `connections:`. The Python wrapper enforces the
    // "needed but missing" case with a clearer error than we could
    // here without parsing the spec twice.
    let composio_key = get_workspace_secret_plaintext(
        &state.db,
        &state.encryption_key,
        ctx.workspace_id,
        SecretKind::ComposioApiKey,
    )
    .await
    .ok();
    // Composio user_id we pass through is the composite
    // `${workspace_id}:${acting_user_id}` so Composio's vault stays
    // isolated per (workspace, user) — mirrors what the web side
    // hands to composio.connectedAccounts.link.
    let composio_user_id = format!("{}:{}", ctx.workspace_id, ctx.acting_user_id);
    // Pre-resolved nested `{toolkit_slug: {name: connection_id}}`
    // map for the acting user's ACTIVE composio connections.
    // Composio's Tool Router session needs the explicit
    // connection_id per declared slot when manage_connections=false;
    // otherwise sessions report the toolkits as inactive even when
    // the user authorized them.
    let composio_connected_accounts_json: Option<String> = if composio_key.is_some() {
        let triples =
            list_active_composio_connections(&state.db, ctx.workspace_id, &ctx.acting_user_id)
                .await
                .unwrap_or_default();
        if triples.is_empty() {
            None
        } else {
            let mut by_toolkit: std::collections::BTreeMap<
                String,
                serde_json::Map<String, serde_json::Value>,
            > = std::collections::BTreeMap::new();
            for (toolkit, name, id) in triples {
                by_toolkit
                    .entry(toolkit)
                    .or_default()
                    .insert(name, serde_json::Value::String(id));
            }
            let mut top = serde_json::Map::new();
            for (toolkit, inner) in by_toolkit {
                top.insert(toolkit, serde_json::Value::Object(inner));
            }
            Some(serde_json::Value::Object(top).to_string())
        }
    } else {
        None
    };

    // Native-MCP credentials — decrypted in the runtime so the
    // Python wrapper never holds the encryption key. JSON shape:
    // `{provider: {name: {mcp_url, access_token}}}`. Independent of
    // Composio; an agent can mix both sources in its spec.
    let native_mcp_connections_json: Option<String> = {
        // Refresh-before-use: mint fresh access tokens for any native
        // connections at/near expiry before we read and hand them to
        // the wrapper. Best-effort — a failed refresh falls through to
        // the existing stale-marking path if the token then 401s.
        if let Err(e) = crate::native_oauth::refresh_expiring_native_connections(
            &state.db,
            &state.encryption_key,
            &state.http,
            ctx.workspace_id,
            &ctx.acting_user_id,
        )
        .await
        {
            tracing::warn!(
                ?e,
                "native MCP refresh sweep errored; proceeding with existing tokens"
            );
        }
        let rows = list_active_native_connections(
            &state.db,
            &state.encryption_key,
            ctx.workspace_id,
            &ctx.acting_user_id,
        )
        .await
        .unwrap_or_default();
        if rows.is_empty() {
            None
        } else {
            let mut by_provider: std::collections::BTreeMap<
                String,
                serde_json::Map<String, serde_json::Value>,
            > = std::collections::BTreeMap::new();
            for row in rows {
                let mut entry = serde_json::Map::new();
                entry.insert(
                    "mcp_url".to_string(),
                    serde_json::Value::String(row.mcp_url),
                );
                entry.insert(
                    "access_token".to_string(),
                    serde_json::Value::String(row.access_token),
                );
                by_provider
                    .entry(row.provider)
                    .or_default()
                    .insert(row.name, serde_json::Value::Object(entry));
            }
            let mut top = serde_json::Map::new();
            for (provider, inner) in by_provider {
                top.insert(provider, serde_json::Value::Object(inner));
            }
            Some(serde_json::Value::Object(top).to_string())
        }
    };

    if openai_key.is_none() && anthropic_key.is_none() {
        // Pydantic-ai would fail inside the subprocess with a less
        // friendly message; intercept here so the run row's error
        // surface tells the customer exactly what to do.
        return Err(anyhow!(
            "No provider API keys set for this workspace. \
             Add either an OpenAI or Anthropic API key under \
             Settings → API keys before running an agent."
        ));
    }

    let result = pydantic::invoke(pydantic::PydanticArgs {
        spec_content,
        spec_format: ctx.spec_format.as_pydantic(),
        user_message: &ctx.user_message,
        openai_api_key: openai_key.as_deref(),
        anthropic_api_key: anthropic_key.as_deref(),
        composio_api_key: composio_key.as_deref(),
        composio_user_id: composio_key.as_ref().map(|_| composio_user_id.as_str()),
        composio_connected_accounts_json: composio_connected_accounts_json.as_deref(),
        native_mcp_connections_json: native_mcp_connections_json.as_deref(),
        workspace_id: ctx.workspace_id,
        acting_user_id: ctx.acting_user_id.as_str(),
        db: &state.db,
    })
    .await?;

    let usage = result
        .usage
        .as_ref()
        .and_then(pydantic::PydanticUsage::input_output)
        .map(|(input, output)| Usage {
            input_tokens: input,
            output_tokens: output,
        });

    Ok(RunOutcome {
        output: render_output(&ctx.user_message, &result.output),
        usage,
    })
}

// Pull the agent's reply out of cargo-ai's mixed stdout. Every line
// emitted by the synthetic action is prefixed with
// `[Action N: _tas_emit_output] ` — first content line follows with
// `reply: <text>`, continuation lines just `<text>`. The action also
// emits its own progress noise (`started`, `step N/N exec started; …`,
// `completed · <duration>`) under the same prefix. We strip the
// prefix on every match, drop the noise patterns, strip an optional
// `reply: ` on the first line, and concatenate the rest.
fn extract_emit_reply(stdout: &str) -> String {
    const ACTION_NAME: &str = ": _tas_emit_output] ";
    let mut out = String::new();
    for line in stdout.lines() {
        let Some(idx) = line.find(ACTION_NAME) else {
            continue;
        };
        let mut content = &line[idx + ACTION_NAME.len()..];
        if is_action_progress_noise(content) {
            continue;
        }
        if let Some(stripped) = content.strip_prefix("reply: ") {
            content = stripped;
        }
        if !out.is_empty() {
            out.push('\n');
        }
        out.push_str(content);
    }
    out
}

// cargo-ai narrates exec steps with these lifecycle lines. We don't
// want them in the user-facing transcript — they're operational
// noise, not agent content. Match by prefix so cargo-ai can add
// trailing context (duration, exit code, etc.) without breaking us.
fn is_action_progress_noise(content: &str) -> bool {
    content == "started" || content.starts_with("step ") || content.starts_with("completed")
}

// Common output framing across providers. When the user supplied a
// message we prefix it with "user> " so the saved output reads as a
// transcript; otherwise we render just the agent's text.
fn render_output(user_message: &str, text: &str) -> String {
    let mut out = String::new();
    if !user_message.is_empty() {
        out.push_str("user> ");
        out.push_str(user_message);
        out.push_str("\n\n");
    }
    out.push_str(text);
    out
}

async fn mark_running(state: &AppState, run_id: Uuid) -> anyhow::Result<()> {
    sqlx::query("UPDATE run SET status = 'running', started_at = $1 WHERE id = $2")
        .bind(Utc::now())
        .bind(run_id)
        .execute(&state.db)
        .await?;
    Ok(())
}

async fn mark_succeeded(
    state: &AppState,
    run_id: Uuid,
    output: &str,
    usage: Option<Usage>,
    model: &str,
) -> anyhow::Result<()> {
    let (tokens_in, tokens_out) = match usage {
        Some(u) => (Some(u.input_tokens), Some(u.output_tokens)),
        None => (None, None),
    };
    // Persist the cost estimate now, with the model + tokens
    // already in hand, so the runs-list UI doesn't have to map
    // model→rate on every render. None when usage is missing
    // (cargo-ai) or the model isn't in our pricing table.
    let cost_usd: Option<f64> = match (tokens_in, tokens_out) {
        (Some(i), Some(o)) => crate::pricing::estimate_run_cost(model, i, o),
        _ => None,
    };
    sqlx::query(
        "UPDATE run SET status = 'succeeded', output = $1, completed_at = $2, \
                        tokens_input = $3, tokens_output = $4, cost_usd = $5 \
                  WHERE id = $6",
    )
    .bind(output)
    .bind(Utc::now())
    .bind(tokens_in)
    .bind(tokens_out)
    .bind(cost_usd)
    .bind(run_id)
    .execute(&state.db)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::extract_emit_reply;

    #[test]
    fn extracts_reply_lines_drops_progress_lines() {
        let stdout = "\
Using explicit --token override; bypassing profile auth-mode resolution.
using: profile=none auth=api_key server=openai model=gpt-4o-mini
run: sequential
[Action 1: _tas_emit_output] started
[Action 1: _tas_emit_output] step 1/1 exec started; waiting for command to finish...
[Action 1: _tas_emit_output] reply: greeting: Hi there!
[Action 1: _tas_emit_output] mood: cheerful
[Action 1: _tas_emit_output] completed · 3ms

Run complete · 3.7s total
";
        let reply = extract_emit_reply(stdout);
        assert_eq!(reply, "greeting: Hi there!\nmood: cheerful");
    }

    #[test]
    fn keeps_multiline_content_continuation_lines() {
        // Real shape we see from cargo-ai when an exec emits a
        // multi-line value: the first content line carries the
        // `reply:` prefix, every continuation line just has the
        // bracket prefix and the raw text. Continuation lines must
        // not be dropped (that's the bug we hit in the wild).
        let stdout = "\
[Action 1: _tas_emit_output] reply: **Weather Report:**
[Action 1: _tas_emit_output] Current conditions are partly cloudy.
[Action 1: _tas_emit_output] High of 72°F, low of 55°F.
[Action 1: _tas_emit_output] completed · 3ms
";
        let reply = extract_emit_reply(stdout);
        assert_eq!(
            reply,
            "**Weather Report:**\nCurrent conditions are partly cloudy.\nHigh of 72°F, low of 55°F."
        );
    }

    #[test]
    fn returns_empty_when_no_emit_lines_present() {
        let stdout = "Run complete · 1.0s total\n";
        assert!(extract_emit_reply(stdout).is_empty());
    }
}

async fn mark_failed(state: &AppState, run_id: Uuid, reason: &str) -> anyhow::Result<()> {
    sqlx::query(
        "UPDATE run SET status = 'failed', error_message = $1, completed_at = $2 WHERE id = $3",
    )
    .bind(reason)
    .bind(Utc::now())
    .bind(run_id)
    .execute(&state.db)
    .await?;
    Ok(())
}

// Slack's chat.postMessage caps text at 40k chars; keep replies readable
// and well under the limit.
const SLACK_TEXT_LIMIT: usize = 3500;

#[derive(sqlx::FromRow)]
struct SlackDeliveryRow {
    channel: String,
    thread_ts: Option<String>,
    bot_token: Vec<u8>,
}

/// Post a Slack-dispatched run's result back into the thread it came from.
/// Best-effort: no delivery row (the common case — most runs aren't from
/// Slack), an already-delivered row, an uninstalled app, or a Slack API
/// hiccup are all logged and swallowed so the run itself is never affected.
async fn deliver_slack_result(state: &AppState, run_id: Uuid, body: &str) {
    let row = match sqlx::query_as::<_, SlackDeliveryRow>(
        "SELECT d.channel, d.thread_ts, a.bot_token \
           FROM slack_delivery d \
           JOIN workspace_slack_app a ON a.id = d.slack_app_id \
          WHERE d.run_id = $1 AND d.delivered_at IS NULL AND a.bot_token IS NOT NULL",
    )
    .bind(run_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return,
        Err(e) => {
            tracing::warn!(run_id = %run_id, ?e, "slack delivery lookup failed");
            return;
        }
    };

    let token = match state.encryption_key.decrypt(&row.bot_token) {
        Ok(t) => t,
        Err(e) => {
            tracing::warn!(run_id = %run_id, ?e, "slack bot token decrypt failed");
            return;
        }
    };

    let text: String = if body.chars().count() > SLACK_TEXT_LIMIT {
        let truncated: String = body.chars().take(SLACK_TEXT_LIMIT).collect();
        format!("{truncated}\n…(truncated)")
    } else {
        body.to_string()
    };

    let mut payload = serde_json::json!({ "channel": row.channel, "text": text });
    if let Some(ts) = &row.thread_ts {
        payload["thread_ts"] = serde_json::Value::String(ts.clone());
    }

    let resp = state
        .http
        .post("https://slack.com/api/chat.postMessage")
        .bearer_auth(&token)
        .json(&payload)
        .send()
        .await;
    match resp {
        Ok(r) => {
            // Slack returns 200 with {ok:false, error} on logical failures.
            match r.json::<serde_json::Value>().await {
                Ok(j) if j.get("ok").and_then(|v| v.as_bool()) == Some(true) => {}
                Ok(j) => {
                    tracing::warn!(
                        run_id = %run_id,
                        error = ?j.get("error"),
                        "slack chat.postMessage returned not-ok"
                    );
                }
                Err(e) => {
                    tracing::warn!(run_id = %run_id, ?e, "slack response parse failed");
                }
            }
        }
        Err(e) => {
            tracing::warn!(run_id = %run_id, ?e, "slack chat.postMessage send failed");
            return;
        }
    }

    if let Err(e) = sqlx::query("UPDATE slack_delivery SET delivered_at = now() WHERE run_id = $1")
        .bind(run_id)
        .execute(&state.db)
        .await
    {
        tracing::warn!(run_id = %run_id, ?e, "slack delivery mark failed");
    }
}
