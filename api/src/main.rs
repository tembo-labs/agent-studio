use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Context;
use axum::{Router, middleware, routing::get, routing::post};
use sqlx::postgres::PgPoolOptions;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::EnvFilter;

mod auth;
mod crypto;
mod native_oauth;
mod pricing;
mod routes;
mod runs;
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
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,tas_api=debug")))
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
        .route("/runs/:id", get(runs::handlers::get_run))
        .layer(middleware::from_fn(auth::require_internal_token))
        .layer(axum::Extension(internal_token));

    let app = Router::new()
        .route("/health", get(routes::health::health))
        .nest("/internal", internal_routes)
        .with_state(state)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive());

    tracing::info!("tas-api listening on {bind_addr}");
    let listener = tokio::net::TcpListener::bind(bind_addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
