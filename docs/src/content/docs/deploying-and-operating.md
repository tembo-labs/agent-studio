---
title: Deploying & operating
description: How to self-host a TAS instance and where the operational guides live.
---

TAS is **self-hosted first** — identity, data, and runtime stay in your
environment. This page orients you; the detailed, step-by-step runbooks are the
other pages in this section.

## Ways to run it

- **Local / from source** — `docker compose up --build` brings up web, API, and
  Postgres. Good for evaluation and development.
- **From prebuilt images** — `compose.release.yaml` pulls pinned images from
  GHCR instead of compiling from source.
- **Managed hosts** — the full stack on **Railway** or **AWS** (ECS Fargate +
  RDS), or the web tier on **Vercel** with the API on a long-lived host.

## The step-by-step guides

- **[Customer setup](/agent-studio/customer-setup/)** — start here. A
  zero-to-running checklist of everything to procure and do, from accounts and
  keys through first sign-in.
- **[Deploy on Railway](/agent-studio/deploy-railway/)** — full stack on Railway
  from published images.
- **[Deploy on AWS](/agent-studio/deploy-aws/)** — ECS Fargate + RDS.
- **[Deploy on Vercel](/agent-studio/deploy-vercel/)** — web on Vercel, API on
  Fly/Render, managed Postgres.

## Architecture in one breath

A Next.js web control plane, a Rust (axum + sqlx) API that owns the runtime and
Postgres migrations, and a Postgres database. Agent definitions live in your
connected GitHub repo; the API runs agents as subprocess calls into the bundled
`pydantic-ai` wrapper.

## Versioning

Production instances pin to explicit CalVer release tags (e.g. `v2026.6.8`);
released container images are published to GHCR with signatures and SBOMs. See
`CHANGELOG.md` for what's in each release.
