# Backlog — User Stories

Stories with no scheduled milestone. Each carries provenance
(`Moved from: vX.Y`) and a short "why deferred" so future scope
discussions don't have to rediscover the reasoning.

Format mirrors the in-phase user stories: Connextra + Acceptance
Criteria.

---

## US-BACKLOG-01 — Org-level policy templates

> **Moved from:** v0.4 (US-0.4-03) on 2026-05-27.
>
> **Why deferred:** Requires the org concept (a scope above
> workspace) plus a generic policy-resolver substrate and at least
> one concrete enforceable policy. Substrate-shaped — comparable
> in size to v0.3 Connections or v0.4 audit. The other v0.4
> stories landed without it, and ordering it ahead of v0.5
> (adaptive intelligence) is no longer a hard constraint now that
> the audit + RBAC half of governance is in place. Pull forward
> when a concrete customer use case lands or when v0.4 needs the
> exit-bar item that depends on it (the "deviation view").

**As an** Org Admin, **I want** to set org-level policy templates
(e.g., "customer-facing agents require review") that workspaces
inherit, **so that** I do not have to chase each workspace admin
to enforce baseline rules.

**Acceptance Criteria**

- Workspaces inherit org defaults on creation.
- Overriding an inherited policy at the workspace level produces a
  changelog event with a required justification field.
- A view at the org level shows which workspaces are deviating
  from defaults and why.
- A workspace can tighten an inherited policy without an audit-
  required justification; loosening always requires one.

**Substrate this implies** (none of which exists in the codebase
as of the move date):

- `org` + `org_member` tables (single-tenant deployments auto-
  create one default org).
- `policy_template` table — org-scoped, versioned, typed value.
- `workspace_policy_override` table — `(workspace_id, policy_key)`
  with a non-null `justification` text field.
- Resolver: `getEffectivePolicy(workspaceId, policyKey)` that
  returns inherited-or-overridden.
- `compareTightening(prev, next)` per policy → drives the
  "justification required when loosening" branch.
- Two new audit kinds: `policy.template_changed`,
  `policy.overridden` (US-0.4-05's policy half closes for free
  once this substrate ships).

**Concrete policies worth templating** (any subset; the cheapest
is enough to prove the substrate):

- `default_member_role` — what role new workspace members get
  when an admin adds them (operator | viewer). Smallest
  enforcement surface.
- `allowed_model_providers` — allowlist of providers an agent's
  `model:` field may name. Enforces at every run path.
- `allowed_composio_toolkits` — allowlist of toolkit slugs that
  can be authorized in a workspace. Enforces at the Composio
  OAuth authorize route.
- `improvements_delivery_mode` — PR vs YOLO direct-commit.
  Already a workspace-level setting; promoting to a template
  needs Tembo CAP's direct-commit mode (separately tracked).

**Open design question:** the org-route surface in a single-tenant
deployment. "One org per deployment, auto-created" is the simplest
mental model but the UX implication is a `/org` route that most
users never visit. Alternative: hang policy-template management
off Settings → Policy with admin gating. Cleaner UX, less honest
to the AC's "org-level view."
