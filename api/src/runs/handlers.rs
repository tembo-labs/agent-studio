//! HTTP surface for the runs subsystem. Two endpoints:
//!
//!   POST /internal/runs      — web triggers a run, returns run id
//!   GET  /internal/runs/:id?workspace_id=... — web polls for status + output
//!
//! Both gated by the bearer middleware in `crate::auth`.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::runs::runner;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateRunRequest {
    pub workspace_id: Uuid,
    pub user_id: String,
    pub agent_name: String,
    pub agent_path: String,
    /// `provider:model` (e.g. `openai:gpt-4o-mini`). Used by cargo-ai
    /// to set CLI flags; for Pydantic it's saved to the run row for
    /// the UI but the actual provider/model dispatch happens inside
    /// pydantic-ai based on the spec.
    pub model: String,
    /// Optional user message; v0.1 leaves it empty (US-0.1-06 ran for "empty input").
    #[serde(default)]
    pub user_message: Option<String>,
    /// Agent framework. Both supported frameworks ("pydantic-agentspec"
    /// and "cargo-ai") run as passthrough subprocess calls into the
    /// upstream tool. Defaults to "pydantic-agentspec" when omitted to
    /// keep older callers working.
    #[serde(default)]
    pub framework: Option<String>,
    /// Raw agent file content as it sits in the repo. Required for
    /// both frameworks now.
    #[serde(default)]
    pub spec_content: Option<String>,
    /// Spec format — `"yaml"` or `"json"`. Defaults to "json" so
    /// existing cargo-ai callers (which always send JSON) don't need
    /// to change.
    #[serde(default)]
    pub spec_format: Option<String>,
    /// Optional sidecar Python module (the Pydantic agent's
    /// `tools_module:`) whose functions the wrapper exposes to the
    /// model as tools. The web layer reads it from the repo at dispatch
    /// time; transient like spec_content (not persisted on the run row).
    #[serde(default)]
    pub tools_module_content: Option<String>,
    /// Where the run came from. Defaults to "manual" so existing
    /// callers (Run-now button, chat) don't need to change. The
    /// scheduler passes "schedule" + automation_id when firing on
    /// a cron.
    #[serde(default)]
    pub trigger: Option<String>,
    #[serde(default)]
    pub automation_id: Option<Uuid>,
    /// Which agent version produced spec_content. Recorded on the run row
    /// for provenance. NULL = a draft/live run or a pre-feature caller.
    #[serde(default)]
    pub agent_version_id: Option<Uuid>,
    /// Human label for the version ("v3" | "draft"), shown in the runs UI.
    #[serde(default)]
    pub agent_version_label: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateRunResponse {
    pub run_id: Uuid,
}

pub async fn create_run(
    State(state): State<AppState>,
    Json(req): Json<CreateRunRequest>,
) -> Result<Json<CreateRunResponse>, (StatusCode, String)> {
    let run_id = Uuid::new_v4();

    let user_message = req.user_message.unwrap_or_default();
    let acting_user_id = req.user_id;
    // Reject unknown trigger values up front so we surface bad
    // callers instead of silently coercing to 'manual'.
    let trigger = match req.trigger.as_deref() {
        None | Some("manual") => "manual",
        Some("schedule") => "schedule",
        Some("event") => "event",
        Some(other) => {
            return Err((StatusCode::BAD_REQUEST, format!("unknown trigger: {other}")));
        }
    };

    sqlx::query(
        r#"INSERT INTO run
            (id, workspace_id, agent_name, agent_path, model, status,
             created_by, user_message, trigger, automation_id,
             agent_version_id, agent_version_label)
            VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7, $8, $9, $10, $11)"#,
    )
    .bind(run_id)
    .bind(req.workspace_id)
    .bind(&req.agent_name)
    .bind(&req.agent_path)
    .bind(&req.model)
    .bind(&acting_user_id)
    .bind(&user_message)
    .bind(trigger)
    .bind(req.automation_id)
    .bind(req.agent_version_id)
    .bind(&req.agent_version_label)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db insert: {e}")))?;

    let task_state = state.clone();
    let model = req.model;
    let workspace_id = req.workspace_id;
    let framework = req
        .framework
        .as_deref()
        .map(parse_framework)
        .unwrap_or(runner::Framework::Pydantic);
    let spec_content = req.spec_content;
    let tools_module_content = req.tools_module_content;
    let spec_format = match req.spec_format.as_deref() {
        Some("yaml") => runner::SpecFormat::Yaml,
        // JSON is the default so cargo-ai callers (which never
        // bothered with this field) keep working without changes.
        None | Some("json") => runner::SpecFormat::Json,
        Some(other) => {
            return Err((
                StatusCode::BAD_REQUEST,
                format!("unknown spec_format: {other}"),
            ));
        }
    };

    tokio::spawn(async move {
        runner::execute_run(
            &task_state,
            runner::RunContext {
                run_id,
                workspace_id,
                acting_user_id,
                model,
                user_message,
                framework,
                spec_content,
                spec_format,
                tools_module_content,
            },
        )
        .await;
    });

    Ok(Json(CreateRunResponse { run_id }))
}

// Tolerate either of our two canonical framework strings. Anything
// else (typos, future frameworks) falls back to pydantic so a single
// malformed request doesn't take down the runner.
fn parse_framework(s: &str) -> runner::Framework {
    match s {
        "cargo-ai" => runner::Framework::CargoAi,
        _ => runner::Framework::Pydantic,
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RunRecord {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub agent_name: String,
    pub agent_path: String,
    pub model: String,
    pub status: String,
    pub output: String,
    /// Live partial output while status='running' (NULL once terminal).
    pub streamed_output: Option<String>,
    pub error_message: Option<String>,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub tokens_input: Option<i32>,
    pub tokens_output: Option<i32>,
    pub trigger: String,
    pub automation_id: Option<Uuid>,
    pub agent_version_id: Option<Uuid>,
    pub agent_version_label: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GetRunQuery {
    pub workspace_id: Uuid,
}

pub async fn get_run(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<GetRunQuery>,
) -> Result<Json<RunRecord>, StatusCode> {
    let row: Option<RunRecord> = sqlx::query_as(
        r#"SELECT id, workspace_id, agent_name, agent_path, model, status,
                  output, streamed_output, error_message, created_by, created_at,
                  started_at, completed_at, tokens_input, tokens_output,
                  trigger, automation_id, agent_version_id, agent_version_label
             FROM run
             WHERE id = $1 AND workspace_id = $2"#,
    )
    .bind(id)
    .bind(query.workspace_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    row.map(Json).ok_or(StatusCode::NOT_FOUND)
}
