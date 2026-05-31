# Deploying TAS to AWS

Two supported shapes, both running the published GHCR images
(`ghcr.io/tembo/tas-api`, `ghcr.io/tembo/tas-web` — public, no ECR
needed):

- **Path A — single EC2 box + `docker compose`.** Closest to TAS's
  single-node, single-tenant design. One VM, one command, the bundled
  Postgres or RDS. Start here unless you have a reason not to.
- **Path B — ECS Fargate + RDS.** Managed containers, no host to patch.
  More moving parts (task defs, Service Connect, ALB, Secrets Manager).

> **Architecture note (applies to both): use `x86_64`.** The images are
> `linux/amd64` only today — do **not** pick Graviton/`arm64` instances
> or the `ARM64` Fargate platform until arm64 images ship.

The only AWS-specific wrinkle versus Vercel/Railway is **TLS**: AWS
doesn't hand you HTTPS for free, and better-auth needs an HTTPS origin
in production (secure cookies + the Google OAuth redirect). Each path
below says how to terminate TLS.

---

## Architecture target

```
Browser ──HTTPS──► TLS termination ──► web:3000 ──► api:8080 ──► Postgres
                   (Caddy / ALB+ACM)      │            │            │
                                          └─ both query Postgres ───┘
```

`api:8080` is never public — it's reached only by `web` over the local
Docker network (Path A) or the VPC (Path B). Only `web` sits behind TLS.

---

## Path A — single EC2 instance (recommended)

### 1. Launch the instance

- **AMI:** Amazon Linux 2023 or Ubuntu 22.04+, **x86_64**.
- **Size:** `t3.small` (2 GB) is enough for a light single-tenant load;
  `t3.medium` if you expect concurrent runs. The api pulls model
  responses over the network — CPU, not the bottleneck.
- **Storage:** 20 GB+ gp3 EBS (Postgres data lives here in Path A).
- **Security group:** inbound `443` (and `80` for the ACME redirect)
  from the internet; `22` from your IP only. Nothing else — `web:3000`
  and `api:8080` stay on the box.

### 2. Install Docker + Compose

```bash
# Amazon Linux 2023
sudo dnf -y install docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
# Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

Log out/in so the `docker` group applies.

### 3. Compose file + secrets

Pull `compose.release.yaml` and `.env.example` from the repo (or `scp`
them up), then fill in `.env`:

```bash
cp .env.example .env
# Generate the three required secrets:
#   openssl rand -base64 32   → BETTER_AUTH_SECRET
#   openssl rand -base64 32   → TAS_ENCRYPTION_KEY
#   openssl rand -base64 32   → INTERNAL_API_TOKEN
# Set BETTER_AUTH_URL + NEXT_PUBLIC_BETTER_AUTH_URL to your https domain.
# Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
# Pin TAS_VERSION to a released version.
```

`TAS_ENCRYPTION_KEY` and `INTERNAL_API_TOKEN` are shared by both
services automatically (they read the same `.env`). Keep `.env` off
version control; for stronger handling, pull them from SSM Parameter
Store at boot instead.

### 4. Terminate TLS with Caddy

Add a Caddy reverse proxy in front of `web`. Create `Caddyfile`:

```
tas.example.com {
    reverse_proxy web:3000
}
```

And a `compose.tls.yaml` overlay:

```yaml
services:
  caddy:
    image: caddy:2
    restart: unless-stopped
    depends_on: [web]
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
volumes:
  caddy_data:
```

Caddy fetches and renews a Let's Encrypt cert automatically. (Prefer an
ALB? See Path B's TLS step — it works the same on a single instance with
a target group pointing at the box's port 3000.)

### 5. DNS + Google OAuth

- Point an A record (`tas.example.com`) at the instance's Elastic IP.
- Set the Google OAuth client's authorized redirect URI to
  `https://tas.example.com/api/auth/callback/google`.

### 6. Start + verify

```bash
docker compose -f compose.release.yaml -f compose.tls.yaml pull
docker compose -f compose.release.yaml -f compose.tls.yaml up -d
```

The api applies DB migrations on boot. Open `https://tas.example.com`,
sign in with Google — the first user becomes workspace admin on first
workspace creation.

### Postgres options (Path A)

- **Bundled container (default):** Postgres runs in the stack, data on
  the EBS volume. Fine for single-node. **Back up** with a cron'd
  `pg_dump` to S3 — EBS snapshots alone aren't transaction-consistent.
- **RDS instead:** drop the `postgres` service and point `DATABASE_URL`
  at an RDS Postgres 16 instance (managed backups, no `pg_dump` cron).
  Put RDS in the same VPC, security group open to the instance only.

---

## Path B — ECS Fargate + RDS

Two Fargate services (`web`, `api`) in one cluster, RDS for Postgres,
an ALB for public TLS, Secrets Manager for the shared secrets.

### 1. RDS Postgres

- Postgres **16**, `x86`/any class, in private subnets.
- `gen_random_uuid()` is built in (PG13+); no extension setup needed.
- Security group: inbound `5432` from the ECS task security group only.
- Record the connection string as `DATABASE_URL`.

### 2. Secrets Manager

Store these and reference them from the task definitions (so they never
sit in plaintext task JSON):

- `DATABASE_URL`
- `TAS_ENCRYPTION_KEY`, `INTERNAL_API_TOKEN` — **one value each, shared
  by both task defs.** Mismatch = undecryptable secrets / 401s.
- `BETTER_AUTH_SECRET` (web only)
- `GOOGLE_CLIENT_SECRET` (web only)

### 3. Task definitions (pull the public images)

**`api` task** — image `ghcr.io/tembo/tas-api:<version>`, port `8080`,
no public ingress. Env: `DATABASE_URL`, `TAS_ENCRYPTION_KEY`,
`INTERNAL_API_TOKEN`, `RUST_LOG=info,tas_api=debug`. (AWS VPC networking
is IPv4, so the default bind is reachable — no `API_BIND_ADDR` needed.)

**`web` task** — image `ghcr.io/tembo/tas-web:<version>`, port `3000`.
Env: `DATABASE_URL`, `TAS_ENCRYPTION_KEY`, `INTERNAL_API_TOKEN`,
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://<domain>`,
`NEXT_PUBLIC_BETTER_AUTH_URL=https://<domain>`,
`API_INTERNAL_URL=http://api.<namespace>:8080`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, optional `TAS_INSTANCE_NAME`.

> Pulling from GHCR doesn't need credentials (the images are public). If
> you'd rather keep images in-account, mirror them to **ECR** and
> reference the ECR URI instead.

### 4. web → api private networking

Enable **ECS Service Connect** (or Cloud Map) on the cluster so `web`
resolves `api` by name. Set `API_INTERNAL_URL` to the api service's
Service Connect DNS (`http://api.<namespace>:8080`). The api service
needs **no** load balancer — it's internal only.

### 5. Public TLS (ALB + ACM)

- Request an **ACM** cert for your domain (same region as the ALB).
- Application Load Balancer: HTTPS:443 listener with the ACM cert →
  target group → the `web` service on port `3000`. Redirect `:80→:443`.
- Route 53 (or your DNS): point the domain at the ALB.
- Set `BETTER_AUTH_URL` / `NEXT_PUBLIC_BETTER_AUTH_URL` to
  `https://<domain>` and the Google redirect URI to
  `https://<domain>/api/auth/callback/google`.

### 6. Deploy + verify

Bring up the `api` service first (it migrates the RDS schema on boot),
then `web`. Hit the domain, sign in, trigger a run, confirm it lands in
`/runs`.

---

## Operational notes

- **Upgrades.** Bump `TAS_VERSION` (Path A) or the image tag in both
  task defs (Path B) and redeploy; the api migrates on boot. Pin
  versions, not `latest`, for reproducible rollouts.
- **Scheduler + webhooks run on `web`.** The `automation` cron
  (`instrumentation.ts`) and Composio trigger webhooks
  (`/api/hooks/composio/{workspace}`) live in the web container — keep at
  least one `web` task running; don't scale it to zero.
- **Secrets parity.** `TAS_ENCRYPTION_KEY` and `INTERNAL_API_TOKEN` must
  be byte-for-byte identical on web and api. Rotating `TAS_ENCRYPTION_KEY`
  orphans every existing workspace secret.
- **Backups.** RDS handles this; the bundled Postgres (Path A) does not —
  schedule `pg_dump` to S3.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `exec format error` on container start. | Ran the `amd64` image on Graviton/`arm64`. Use an `x86_64` instance / `X86_64` Fargate platform. |
| Sign-in succeeds, then a 401 loop. | `BETTER_AUTH_URL` isn't the real HTTPS origin, or TLS isn't actually terminating in front of `web` (cookies need `https`). |
| Runs queue but never start. | web can't reach api: wrong `API_INTERNAL_URL`, or (Path B) Service Connect not enabled. `/internal/*` 401s mean `INTERNAL_API_TOKEN` mismatch. |
| `failed to decrypt secret` in api logs. | `TAS_ENCRYPTION_KEY` differs between web and api. |
| api can't reach Postgres. | RDS security group doesn't allow the task/instance SG on `5432`, or `DATABASE_URL` host is wrong. |
