//! HTTP surface for the runs subsystem. Two endpoints:
//!
//!   POST /internal/runs      — web triggers a run, returns run id
//!   GET  /internal/runs/:id  — web polls for status + output
//!
//! Both gated by the bearer middleware in `crate::auth`.

use axum::{
    extract::{Path, State},
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
    pub model: String,
    pub instructions: String,
    /// Optional user message; v0.1 leaves it empty (US-0.1-06 ran for "empty input").
    #[serde(default)]
    pub user_message: Option<String>,
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

    sqlx::query(
        r#"INSERT INTO run
            (id, workspace_id, agent_name, agent_path, model, status, created_by, user_message)
            VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7)"#,
    )
    .bind(run_id)
    .bind(req.workspace_id)
    .bind(&req.agent_name)
    .bind(&req.agent_path)
    .bind(&req.model)
    .bind(&req.user_id)
    .bind(&user_message)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("db insert: {e}")))?;

    let task_state = state.clone();
    let model = req.model;
    let instructions = req.instructions;
    let workspace_id = req.workspace_id;

    tokio::spawn(async move {
        runner::execute_run(
            &task_state,
            runner::RunContext {
                run_id,
                workspace_id,
                model,
                instructions,
                user_message,
            },
        )
        .await;
    });

    Ok(Json(CreateRunResponse { run_id }))
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
    pub error_message: Option<String>,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub tokens_input: Option<i32>,
    pub tokens_output: Option<i32>,
}

pub async fn get_run(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RunRecord>, StatusCode> {
    let row: Option<RunRecord> = sqlx::query_as(
        r#"SELECT id, workspace_id, agent_name, agent_path, model, status,
                  output, error_message, created_by, created_at,
                  started_at, completed_at, tokens_input, tokens_output
             FROM run WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    row.map(Json).ok_or(StatusCode::NOT_FOUND)
}
