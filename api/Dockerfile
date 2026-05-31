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

# python3 + pip are runtime deps because the Pydantic AI agent path
# shells out to a small Python wrapper (api/scripts/run_pydantic.py)
# that uses the real pydantic-ai library. Mirrors how cargo-ai is
# installed as a bundled binary one stage up — both frameworks now
# get their full power instead of a Rust-side hand-rolled subset.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates libssl3 curl \
        python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install pydantic-ai into a venv so it doesn't fight Debian's
# PEP-668 system-package lockdown. Pinned the same way cargo-ai is —
# version bumps go through PR review so we can vet the changelog.
ENV PYDANTIC_AI_VENV=/opt/pydantic-ai
ENV PYDANTIC_AI_PY="${PYDANTIC_AI_VENV}/bin/python3"
# `[mcp]` pulls in the MCP client deps so MCPServerStreamableHTTP is
# available — that's how Composio exposes its toolkits to pydantic-ai
# at run time. `composio` is the Python SDK we use to spin up a
# Composio session keyed by workspace + toolkit list and read the
# MCP URL back. composio is unpinned for now while the SDK is still
# stabilising; rev-up via PR once we want a known version.
RUN python3 -m venv "${PYDANTIC_AI_VENV}" && \
    "${PYDANTIC_AI_VENV}/bin/pip" install --no-cache-dir \
        'pydantic-ai[mcp]==1.102.0' pyyaml==6.0.2 composio

COPY --from=builder /app/tas-api /usr/local/bin/tas-api
COPY --from=builder /opt/cargo-ai/bin/cargo-ai /usr/local/bin/cargo-ai
COPY scripts/run_pydantic.py /usr/local/bin/run_pydantic.py

# Drop to a non-root user for the runtime. The run path shells out to
# cargo-ai and the pydantic venv but writes nothing to disk (spec in via
# stdin, result out via stdout — see runs/pydantic.rs `env_clear()`), so
# no app-owned writable dir is needed; the binaries + venv under
# /usr/local/bin and /opt are world read+execute. A real passwd entry
# (--create-home) keeps getpwuid-based HOME lookups working even though
# the subprocess env is cleared.
RUN groupadd --system --gid 1001 tas \
    && useradd --system --uid 1001 --gid tas --create-home --home-dir /home/tas tas
ENV HOME=/home/tas

ENV API_BIND_ADDR=0.0.0.0:8080
EXPOSE 8080
USER tas
CMD ["tas-api"]
