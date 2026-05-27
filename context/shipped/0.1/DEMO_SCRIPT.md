# v0.1 Demo Script

**Target audience:** prospective pilot customer — platform/IT lead plus a curious operator.
**Target duration:** 12–15 minutes.
**Goal of the demo:** convince the room that TAS is safe to install, easy to wire, and produces a real run today.

## Pre-Demo Checklist (Off-Screen)

- TAS instance deployed in a clean throwaway environment.
- IdP adapter pre-configured (Okta dev tenant works).
- A test Git repo with **no** existing agent definitions — we want to show it empty first.
- A valid Tembo API key in the presenter's clipboard manager (never typed live).
- Browser zoom set to 125% so the back of the room can read.

## Flow (with rough timings)

### 1. Deploy (0:00 – 2:00)
**Show:** terminal with the demo machine.
**Do:** run `docker compose up -d` against the published Compose file. Show `docker compose ps` reaching healthy.
**Say:**
> "Everything you're about to see runs inside your environment. No data leaves the VM. The whole product is in this Compose file."

### 2. First sign-in via IdP (2:00 – 4:00)
**Show:** browser at `https://tas.demo.local`.
**Do:** click "Sign in with Okta", complete the SSO loop, land on the workspace bootstrap screen.
**Say:**
> "TAS auth runs on better-auth. It plugs into whatever IdP you already use. This is the same Okta tenant your team would use to log in to anything else."

### 3. Create workspace, connect repo (4:00 – 6:30)
**Show:** the onboarding wizard.
**Do:**
- Name the workspace `acme-pilot`.
- Connect the pre-staged Git repo.
- Walk through the "TAS validated read/write access" confirmation.

**Say:**
> "From this point on, every agent definition in this workspace is a file in this repo. If you want to know what an agent looked like last Tuesday, you `git log` it."

### 4. Add Tembo API key (6:30 – 7:30)
**Show:** workspace settings → integrations.
**Do:** paste the API key, save, show that the UI masks it after save.
**Say:**
> "API key is scoped to this workspace. We never display the full key again. A 'rotate' button is right there if your secrets policy says so."

### 5. Create / import an agent (7:30 – 10:00)
**Show:** the workspace agent list (empty).
**Do:**
- Click "New agent".
- Pick the **"Daily inbox triage"** starter template.
- Walk through the two fields the template prompts for (inbox label, summary destination).
- Save.

**Say:**
> "v0.1 ships with a small starter library. The format under the hood is a single YAML or JSON file per agent — declarative, diffable, lives in your repo. We support Pydantic AI `AgentSpec` as the primary format and import from Cargo AI JSON, but at v0.1 we're not asking your team to learn either. In v0.2 you'll create these from chat instead."

### 6. Run manually and show logs (10:00 – 13:00)
**Show:** the new agent's detail page.
**Do:**
- Click "Run now".
- Watch status go `queued → running → succeeded`.
- Click into the run.
- Scroll through the log tail.

**Say:**
> "Run status is real, not a spinner. Failed runs surface the last lines of output and a clear failure reason. We'll get into richer dashboards in v0.3, but day-one operators have what they need."

### 7. Recap and roadmap pointer (13:00 – 15:00)
**Show:** the four-phase roadmap slide (one slide).
**Say:**
> "What you just saw is v0.1: deploy, auth, connect, run. That's all v0.1 promises. v0.2 adds chat-to-PR authoring. v0.3 layers on audit and rich HITL. v0.4 closes the loop from user corrections back to source. We ship them in that order because each one depends on the last being solid."

## Live-Demo Failure Plan

| If… | Then say… |
| --- | --------- |
| The IdP loop fails | "We had a redirect mismatch in this tenant — happens once per environment. I'll show the sign-in screenshot and continue with a local user." |
| The run hangs in `queued` | "Let me show you a previous run while this one settles — same flow, same logs." |
| The repo connect step fails | "Worth showing the error message — this is exactly the kind of actionable error we built v0.1 around. Let me re-paste the deploy key." |

## Success Criteria (Demo)

- Sign-in via real IdP works on the first attempt **or** the failure plan is enacted without breaking the narrative.
- Repo and API key are persisted and visible after refresh.
- Exactly one successful agent run completes with logs visible in under 60 seconds.
- The audience leaves understanding that v0.1 is intentionally narrow, with a clear story for v0.2+.

## Common Questions & Crisp Answers

- **"Where does our data go?"** Inside your environment. The demo machine has no outbound calls except to your IdP and the Tembo API you authorized.
- **"Can we use GitLab / self-hosted Git?"** GitHub at v0.1. GitLab and self-hosted Git on the roadmap — open question we'd like pilot feedback on.
- **"Does TAS need OpenAI / Anthropic keys?"** Those live inside agent definitions in your repo, not in TAS itself. TAS is the control plane.
- **"When is v0.2 chat authoring?"** On the public roadmap; we'll share the date when v0.1 has cleared its exit bar.
