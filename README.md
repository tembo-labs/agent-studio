<div align="center">
  <a href="https://github.com/tembo/agent-studio">
    <img alt="Tembo Agent Studio logo" src=".github/assets/tas.svg" width="128" height="128">
  </a>
  <h1>Tembo Agent Studio</h1>

<a href="https://tembo.io"><img alt="Made by Tembo" src="https://img.shields.io/badge/MADE%20BY%20TEMBO-0f172a.svg?style=for-the-badge&labelColor=000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB2aWV3Qm94PSIwIDAgMzIgMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbD0ibm9uZSI%2BPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNi41IDcpIiBmaWxsPSIjZmZmZmZmIj48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTguMDUyNjggOC4wNTU4NkM4LjUwNDM4IDIuNTUyNjcgMy45ODI0NiAtMC4zOTg3MjYgLTAuMDAwMTM1NDIyIDAuMDQzNDM0NFYzLjg0ODMzQzIuNTkyOTkgMy4yNTg1NiA0Ljg2ODU1IDUuNDg1OTYgNC4yNDAxNSA4LjA1NTg2SDguMDUyNjhaIi8%2BPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMC4wMjY0IDguMDU1ODZDOS41NzQ3MiAyLjU1MjY3IDE0LjA5NjYgLTAuMzk4NzI2IDE4LjA3OTIgMC4wNDM0MzQ0VjMuODQ4MzNDMTUuNDg2MSAzLjI1ODU2IDEzLjIxMDUgNS40ODU5NiAxMy44MzkgOC4wNTU4NkgxMC4wMjY0WiIvPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNy4xOTUzNyA5Ljk0NDE0QzYuNzQzNjYgMTUuNDQ3MyAxMS4yNjU2IDE4LjM5ODcgMTUuMjQ4MiAxNy45NTY2VjE0LjE1MTdDMTIuNjU1MSAxNC43NDE0IDEwLjM3OTUgMTIuNTE0IDExLjAwNzkgOS45NDQxNEg3LjE5NTM3WiIvPjwvZz48L3N2Zz4%3D"></a>
<a href="https://github.com/tembo/agent-studio/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/tembo/agent-studio.svg?style=for-the-badge&labelColor=000000"></a>
<a href="https://github.com/tembo/agent-studio/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/tembo/agent-studio.svg?style=for-the-badge&labelColor=000000"></a>
<a href="https://github.com/tembo/agent-studio/discussions"><img alt="Join the community on GitHub" src="https://img.shields.io/badge/Join%20the%20community-blueviolet.svg?style=for-the-badge&logo=Github&labelColor=000000&logoWidth=20"></a>

</div>

> Self-hosted control plane for AI agents. Definitions live in Git, every
> change becomes a PR, and runs, audit logs, and identity stay in your
> environment.

Tembo Agent Studio (TAS) treats agents like production software instead of
editable prompts in a vendor console. Agent definitions live in a repository
you own. New agents, edits, and "this run was wrong" feedback all produce the
same reviewable artifact your team already trusts: a pull request.

## Why TAS

- **Git is the system of record.** Agent definitions are files in your repo.
- **Every change is a PR.** Human or AI author, the output is always a diff.
- **Runtime stays in your environment.** Runs, audit history, and identity stay
  tied to your stack.
- **Drift is governed.** Agents can evolve without turning into opaque prompt
  sprawl.

Authoring is delegated to the [Tembo Coding Agent Platform](https://tembo.io):
TAS is the control plane, Tembo is the system that turns natural-language change
requests into repository changes.

## What You Can Do Today

- Self-host the full stack with Docker Compose, from source or from published
  GHCR images.
- Sign in with Google, Microsoft Entra ID, or a generic OIDC provider.
- Connect a GitHub repository as the source of truth for agent definitions.
- Create, edit, and run agents in two frameworks: Pydantic AgentSpec and Cargo
  AI.
- Open PRs from chat-based authoring and from run feedback.
- Schedule agents with Automations or trigger them from external events.
- Manage per-user connections to external systems such as Slack, Gmail, Google
  Sheets, Notion, and GitHub.
- Inspect operational dashboards, run history, and append-only audit trails.
- Manage workspace membership with API-enforced roles.

See [`CHANGELOG.md`](./CHANGELOG.md) for shipped work and
[`ROADMAP.md`](./ROADMAP.md) for what is next.

## Quickstart

### 1. Prepare `.env`

```bash
cp .env.example .env
```

At minimum, set these required secrets:

- `BETTER_AUTH_SECRET`
- `TAS_ENCRYPTION_KEY`
- `INTERNAL_API_TOKEN`

Generate each with:

```bash
openssl rand -base64 32
```

You will also need at least one configured sign-in provider before anyone can
log in:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, or
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and
  `MICROSOFT_TENANT_ID`, or
- `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET`

Set `INSTANCE_ADMIN_EMAILS` to bootstrap the first instance admin. Without it,
the instance is invite-only and nobody gets the admin surface on first sign-in.

### 2. Start the stack

Build from source:

```bash
docker compose up --build
```

Or run published images:

```bash
docker compose -f compose.release.yaml pull
docker compose -f compose.release.yaml up -d
```

### 3. Open the app

Once healthy:

- Web: `http://localhost:3000`
- API health: `http://localhost:8080/health`
- Postgres: `localhost:5432`

The API applies database migrations automatically on boot via `sqlx::migrate!()`.

### 4. Finish workspace setup

After the first admin signs in:

1. Create a workspace.
2. Connect the GitHub repository that stores your agent definitions.
3. Add an Anthropic and/or OpenAI API key in workspace settings so agents can
   run.
4. Optionally add a Tembo API key to enable chat-to-PR authoring and
   improvement requests.

The full zero-to-running checklist lives in
[Customer setup](https://tembo.github.io/agent-studio/customer-setup/).

## Deployment Paths

- **Local or self-managed host:** [`docker-compose.yml`](./docker-compose.yml)
  builds from source.
- **Prebuilt images from GHCR:** [`compose.release.yaml`](./compose.release.yaml)
  pulls `ghcr.io/tembo/tas-api` and `ghcr.io/tembo/tas-web`.
- **Managed platforms:** see the deployment guides for
  [Railway](https://tembo.github.io/agent-studio/deploy-railway/),
  [AWS](https://tembo.github.io/agent-studio/deploy-aws/), and
  [Vercel](https://tembo.github.io/agent-studio/deploy-vercel/).

## Local Development

Prerequisites:

- Docker or OrbStack
- Node `22+`
- `pnpm`
- Rust `1.93+`

Run everything with Docker:

```bash
docker compose up --build
```

Run only Postgres in Docker and develop the app code on the host:

```bash
docker compose up -d postgres
```

API:

```bash
cd api
cargo run
```

Web:

```bash
cd web
pnpm install
pnpm dev
```

Useful commands:

```bash
# web
cd web
pnpm lint
pnpm test

# api
cd api
cargo test
```

## Repository Layout

```text
agent-studio/
├── web/        Next.js control plane UI
├── api/        Rust API, orchestration layer, and Postgres migrations
├── docs/       Astro Starlight user manual
├── agents/     Seed agent fixtures
├── context/    Phase docs, demos, and planning material
├── docker-compose.yml
└── compose.release.yaml
```

Repo-specific contributor guidance lives in [`AGENTS.md`](./AGENTS.md). If you
change product behavior, update the user docs under [`docs/`](./docs) in the
same change.

## Documentation

The product manual is published at
[`tembo.github.io/agent-studio`](https://tembo.github.io/agent-studio/) and the
source lives under [`docs/`](./docs).

Recommended entry points:

- [Introduction](https://tembo.github.io/agent-studio/introduction/)
- [Getting started](https://tembo.github.io/agent-studio/getting-started/)
- [Customer setup](https://tembo.github.io/agent-studio/customer-setup/)
- [Authoring agents](https://tembo.github.io/agent-studio/authoring-agents/)
- [Running agents](https://tembo.github.io/agent-studio/running-agents/)
- [Connections](https://tembo.github.io/agent-studio/connections/)
- [Automations & triggers](https://tembo.github.io/agent-studio/automations-triggers/)

## License

[MIT](./LICENSE)
