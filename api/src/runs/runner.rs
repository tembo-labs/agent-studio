//! The actual run task. Lifecycle:
//!   queued → running → succeeded | failed
//! Output and error_message are written back to the run row so the web
//! poller can render them. Anthropic is the only provider wired in v0.1;
//! other providers slot in as additional `match` arms once supported.

use anyhow::{anyhow, Context};
use chrono::Utc;
use uuid::Uuid;

use crate::providers::anthropic;
use crate::workspace::{get_workspace_secret_plaintext, SecretKind};
use crate::AppState;

pub struct RunContext {
    pub run_id: Uuid,
    pub workspace_id: Uuid,
    pub model: String,
    pub instructions: String,
    pub user_message: String,
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
        Ok(output) => {
            if let Err(e) = mark_succeeded(state, ctx.run_id, &output).await {
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

async fn run_inner(state: &AppState, ctx: &RunContext) -> anyhow::Result<String> {
    // Model format is `provider:model`, e.g. `anthropic:claude-sonnet-4-6`.
    let (provider, model) = ctx
        .model
        .split_once(':')
        .ok_or_else(|| anyhow!("agent's model field must be `provider:model` (got `{}`)", ctx.model))?;

    match provider {
        "anthropic" => run_anthropic(state, ctx, model).await,
        other => Err(anyhow!(
            "Provider `{other}` is not enabled in this TAS build. \
             v0.1 supports anthropic; other providers land in follow-up slices."
        )),
    }
}

async fn run_anthropic(
    state: &AppState,
    ctx: &RunContext,
    model: &str,
) -> anyhow::Result<String> {
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

    // Empty user message is fine — exercises the agent's instructions
    // directly. The UI labels this clearly in v0.1.
    let user_message = if ctx.user_message.is_empty() {
        "(v0.1 manual run with empty input — exercising the agent's instructions)"
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

    let mut out = String::new();
    if !ctx.user_message.is_empty() {
        out.push_str("user> ");
        out.push_str(&ctx.user_message);
        out.push_str("\n\n");
    }
    out.push_str(&result.text);
    if let Some(reason) = result.stop_reason {
        out.push_str("\n\n[stop_reason=");
        out.push_str(&reason);
        out.push(']');
    }
    Ok(out)
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
) -> anyhow::Result<()> {
    sqlx::query(
        "UPDATE run SET status = 'succeeded', output = $1, completed_at = $2 WHERE id = $3",
    )
    .bind(output)
    .bind(Utc::now())
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
