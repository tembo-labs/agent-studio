# syntax=docker/dockerfile:1.7
FROM rust:1.93-slim-bookworm AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        pkg-config libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock* ./
COPY src ./src
COPY migrations ./migrations

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release && \
    cp /app/target/release/tas-api /app/tas-api

# Install cargo-ai as a standalone binary the runtime stage can copy
# out. Pinned to a known-good version; bump it deliberately so we
# can vet the upstream changelog before pulling in new behavior. The
# rustls-tls feature on its `reqwest` dependency means the binary
# doesn't need OpenSSL at runtime.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/tmp/cargo-ai-target \
    CARGO_TARGET_DIR=/tmp/cargo-ai-target \
    cargo install --locked --version 0.3.0 --root /opt/cargo-ai cargo-ai

FROM debian:bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates libssl3 curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/tas-api /usr/local/bin/tas-api
COPY --from=builder /opt/cargo-ai/bin/cargo-ai /usr/local/bin/cargo-ai

ENV API_BIND_ADDR=0.0.0.0:8080
EXPOSE 8080
CMD ["tas-api"]
