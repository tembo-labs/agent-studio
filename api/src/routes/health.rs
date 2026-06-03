use axum::{extract::State, http::StatusCode, Json};
use serde::Serialize;

use crate::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub db: &'static str,
}

pub async fn health(State(state): State<AppState>) -> (StatusCode, Json<HealthResponse>) {
    let db = match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db)
        .await
    {
        Ok(_) => "ok",
        Err(err) => {
            tracing::warn!(?err, "db health check failed");
            "degraded"
        }
    };

    let status_code = if db == "ok" {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (status_code, Json(HealthResponse { status: "ok", db }))
}
