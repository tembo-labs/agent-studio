# DEMO_SCRIPT_01: Phase `0.1` Foundation

## Objective

Show that a new customer can:
1. Deploy TAS.
2. Authenticate through better-auth.
3. Connect repo + Tembo API key.
4. Create/import an agent.
5. Run the agent and inspect logs.

Target duration: **12-15 minutes**.

## Audience

- Platform admin
- Security/IT stakeholder
- Team lead evaluating first rollout

## Prerequisites

- Running Docker environment.
- A configured better-auth setup connected to the customer IdP.
- A GitHub repository ready for agent definitions.
- A Tembo API access key with required permissions.
- A sample agent JSON file (for example: `agents/arr-guardian/agent.json`).

## Demo Flow

### 1) Intro (1 minute)

Narration:
- "This demo covers only Phase 0.1 foundation capabilities."
- "We are proving secure access, system connectivity, and first successful run."

### 2) Deploy TAS (2 minutes)

Actions:
- Start TAS with Docker.
- Open the TAS UI.

Narration:
- "Agent Studio is self-hosted in your environment."
- "No advanced automation yet; first we establish a stable operating baseline."

### 3) Sign In with better-auth (2 minutes)

Actions:
- Click Sign In.
- Complete login via the customer identity provider.
- Show workspace landing screen.

Narration:
- "Authentication is handled through better-auth so identity and policy stay under your existing control model."

### 4) Workspace Onboarding (3 minutes)

Actions:
- Create a workspace.
- Connect the GitHub repository.
- Add the Tembo API access key.
- Save configuration.

Narration:
- "At 0.1, Tembo integration is API-key based."
- "MCP connectivity is planned for a future phase once public Tembo MCP is available."

### 5) Create or Import Agent (2 minutes)

Actions:
- Add/import a starter agent definition.
- Open the agent detail page.

Narration:
- "We now have an auditable, version-controlled baseline agent in the workspace."

### 6) Run Agent and Review Logs (3 minutes)

Actions:
- Trigger a manual run.
- Wait for completion.
- Show run status and output/log details.

Narration:
- "This validates end-to-end system wiring: auth, repo, Tembo integration, and runtime execution."

### 7) Close (1-2 minutes)

Narration:
- "Phase 0.1 delivers operational readiness."
- "Phase 0.2 adds chat-driven creation/updates, scheduling, and PR policy controls."

## Success Criteria

- User signs in through customer IdP via better-auth.
- Workspace stores valid repo connection and Tembo API key.
- At least one agent is present and runnable.
- A manual run completes with visible logs/status.

## Optional Q&A Prompts

- "How would this map to your internal SSO and role model?"
- "Which team should own Tembo API key rotation?"
- "What first production workflow should be migrated into the first 0.1 agent?"
