use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Context;
use axum::{middleware, routing::get, routing::post, Router};
use sqlx::postgres::PgPoolOptions;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

mod auth;
mod crypto;
mod native_oauth;
mod pricing;
mod routes;
mod runs;
mod slack_mrkdwn;
mod workspace;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub http: reqwest::Client,
    pub encryption_key: Arc<crypto::MasterKey>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,tas_api=debug")),
        )
        .init();

    let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?;
    // Default to the IPv6 unspecified address, which is dual-stack on
    // Linux (binds IPv4 too via v4-mapped addrs) — so plain Docker
    // Compose keeps working while IPv6-only private networks (e.g.
    // Railway service-to-service) reach the api with no config.
    let bind_addr: SocketAddr = std::env::var("API_BIND_ADDR")
        .unwrap_or_else(|_| "[::]:8080".to_string())
        .parse()
        .context("API_BIND_ADDR must be a valid socket address")?;

    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .context("failed to connect to Postgres")?;

    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .context("failed to apply database migrations")?;

    // Reconcile orphaned runs on boot. A run executes as an in-memory tokio task
    // owning a subprocess, so any run still 'queued'/'running' when the api last
    // stopped (crash, deploy, restart) is orphaned — its task is gone and nothing
    // will ever finalize it, so the row would hang in 'running' forever and look
    // like it's still working. Mark them failed with a clear reason. (Durable,
    // resumable execution is the larger #170 effort.)
    match sqlx::query(
        "UPDATE run SET status = 'failed', \
                completed_at = now(), streamed_output = NULL, \
                error_message = COALESCE(error_message, \
                    'Interrupted — the server restarted while this run was in progress.') \
          WHERE status IN ('queued', 'running')",
    )
    .execute(&db)
    .await
    {
        Ok(res) if res.rows_affected() > 0 => {
            tracing::warn!(
                count = res.rows_affected(),
                "marked orphaned in-flight runs as failed on boot"
            );
        }
        Ok(_) => {}
        Err(e) => tracing::error!(?e, "failed to reconcile orphaned runs on boot"),
    }

    let encryption_key = Arc::new(crypto::MasterKey::from_env()?);
    let internal_token = auth::InternalToken::from_env()?;
    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .context("failed to build reqwest client")?;

    let state = AppState {
        db,
        http,
        encryption_key,
    };

    let internal_routes = Router::new()
        .route("/runs", post(runs::handlers::create_run))
        .route("/runs/{id}", get(runs::handlers::get_run))
        .layer(middleware::from_fn(auth::require_internal_token))
        .layer(axum::Extension(internal_token));

    let app = Router::new()
        .route("/health", get(routes::health::health))
        .nest("/internal", internal_routes)
        .with_state(state)
        .layer(TraceLayer::new_for_http());
    // No CORS layer: the api serves only /health and bearer-gated /internal
    // routes, all server-to-server (the web container over the internal
    // network) — never browser cross-origin. A permissive layer was needless
    // attack surface (#48); add a scoped one only if a browser ever calls this.

    tracing::info!("tas-api listening on {bind_addr}");
    let listener = tokio::net::TcpListener::bind(bind_addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
