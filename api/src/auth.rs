//! Internal-service bearer auth. The web container talks to us with the
//! shared `INTERNAL_API_TOKEN` env var. `/health` stays public so an
//! operator can probe the container; everything under `/internal/*` is
//! gated by this middleware.

use axum::{
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};

#[derive(Clone)]
pub struct InternalToken(pub String);

impl InternalToken {
    pub fn from_env() -> anyhow::Result<Self> {
        let v = std::env::var("INTERNAL_API_TOKEN")
            .map_err(|_| anyhow::anyhow!(
                "INTERNAL_API_TOKEN must be set to gate /internal/* routes"
            ))?;
        if v.trim().is_empty() {
            return Err(anyhow::anyhow!("INTERNAL_API_TOKEN must not be empty"));
        }
        Ok(Self(v))
    }
}

pub async fn require_internal_token(
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let expected = req
        .extensions()
        .get::<InternalToken>()
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?
        .0
        .clone();

    let presented = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|v| v.trim());

    match presented {
        Some(t) if constant_time_eq(t.as_bytes(), expected.as_bytes()) => {
            Ok(next.run(req).await)
        }
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}
