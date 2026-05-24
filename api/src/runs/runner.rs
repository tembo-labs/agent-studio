//! The actual run task. Lifecycle:
//!   queued → running → succeeded | failed
//! Output and error_message are written back to the run row so the web
//! poller can render them. Dispatches on the model's `provider:` prefix
//! (anthropic | openai) so each provider's response shape is normalised
//! into a common RunOutcome.

use anyhow::{anyhow, Context};
use chrono::Utc;
use uuid::Uuid;

use crate::providers::{anthropic, openai};
use crate::workspace::{get_workspace_secret_plaintext, SecretKind};
use crate::AppState;

pub struct RunContext {
    pub run_id: Uuid,
    pub workspace_id: Uuid,
    pub model: String,
    pub instructions: String,
    pub user_message: String,
}

struct RunOutcome {
    output: String,
    usage: Option<Usage>,
}

// Provider-neutral usage shape. Both anthropic::Usage and
// openai::Usage normalise into this before crossing into the run
// row so the column semantics ({tokens_input, tokens_output}) stay
// consistent regardless of which provider produced them.
#[derive(Debug, Clone, Copy)]
struct Usage {
    input_tokens: i32,
    output_tokens: i32,
}

impl From<anthropic::Usage> for Usage {
    fn from(u: anthropic::Usage) -> Self {
        Self {
            input_tokens: u.input_tokens,
            output_tokens: u.output_tokens,
        }
    }
}

impl From<openai::Usage> for Usage {
    fn from(u: openai::Usage) -> Self {
        Self {
            input_tokens: u.input_tokens,
            output_tokens: u.output_tokens,
        }
    }
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
            if let Err(e) =
                mark_succeeded(state, ctx.run_id, &outcome.output, outcome.usage).await
            {
                tracing::error!(run_id = %ctx.run_id, ?e, "mark_succeeded failed");
            }
        }
        Err(e) => {
            let reason = format!("{e:#}");
            tracing::warn!(run_id = %ctx.run_id, ?e, "run failed");
            if let Err(db_err) = mark_failed(state, ctx.run_id, &reason).await {
                tracing::error!(run_id = %ctx.run_id, ?db_err, "mark_failed failed");
            }
        }
    }
}

async fn run_inner(state: &AppState, ctx: &RunContext) -> anyhow::Result<RunOutcome> {
    // Model format is `provider:model`, e.g. `anthropic:claude-sonnet-4-6`.
    let (provider, model) = ctx
        .model
        .split_once(':')
        .ok_or_else(|| anyhow!("agent's model field must be `provider:model` (got `{}`)", ctx.model))?;

    match provider {
        "anthropic" => run_anthropic(state, ctx, model).await,
        "openai" => run_openai(state, ctx, model).await,
        other => Err(anyhow!(
            "Provider `{other}` is not enabled in this TAS build. \
             Supported: `anthropic`, `openai`."
        )),
    }
}

async fn run_anthropic(
    state: &AppState,
    ctx: &RunContext,
    model: &str,
) -> anyhow::Result<RunOutcome> {
    let api_key = get_workspace_secret_plaintext(
        &state.db,
        &state.encryption_key,
        ctx.workspace_id,
        SecretKind::AnthropicApiKey,
    )
    .await
    .context(
        "Couldn't load this workspace's Anthropic API key. \
         Set it under Settings → Anthropic API key.",
    )?;

    // The Anthropic Messages API requires at least one non-empty user
    // turn. "Hello." is the most neutral starter we can send: it reads
    // as a natural opening and lets the agent's instructions drive the
    // reply, rather than the model commenting on the input itself.
    // v0.3's rich HITL forms (US-0.3-01) are the right home for real
    // structured input.
    let user_message = if ctx.user_message.is_empty() {
        "Hello."
    } else {
        ctx.user_message.as_str()
    };

    let result = anthropic::invoke(
        &state.http,
        &api_key,
        anthropic::InvokeArgs {
            model,
            instructions: &ctx.instructions,
            user_message,
            max_tokens: 1024,
        },
    )
    .await?;

    let _ = result.stop_reason;
    Ok(RunOutcome {
        output: render_output(&ctx.user_message, &result.text),
        usage: result.usage.map(Usage::from),
    })
}

async fn run_openai(
    state: &AppState,
    ctx: &RunContext,
    model: &str,
) -> anyhow::Result<RunOutcome> {
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

    let user_message = if ctx.user_message.is_empty() {
        "Hello."
    } else {
        ctx.user_message.as_str()
    };

    let result = openai::invoke(
        &state.http,
        &api_key,
        openai::InvokeArgs {
            model,
            instructions: &ctx.instructions,
            user_message,
            max_tokens: 1024,
        },
    )
    .await?;

    let _ = result.stop_reason;
    Ok(RunOutcome {
        output: render_output(&ctx.user_message, &result.text),
        usage: result.usage.map(Usage::from),
    })
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
    sqlx::query(
        "UPDATE run SET status = 'running', started_at = $1 WHERE id = $2",
    )
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
) -> anyhow::Result<()> {
    let (tokens_in, tokens_out) = match usage {
        Some(u) => (Some(u.input_tokens), Some(u.output_tokens)),
        None => (None, None),
    };
    sqlx::query(
        "UPDATE run SET status = 'succeeded', output = $1, completed_at = $2, \
                        tokens_input = $3, tokens_output = $4 \
                  WHERE id = $5",
    )
    .bind(output)
    .bind(Utc::now())
    .bind(tokens_in)
    .bind(tokens_out)
    .bind(run_id)
    .execute(&state.db)
    .await?;
    Ok(())
}

async fn mark_failed(
    state: &AppState,
    run_id: Uuid,
    reason: &str,
) -> anyhow::Result<()> {
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
