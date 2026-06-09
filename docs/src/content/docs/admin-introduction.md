---
title: Introduction
description: Setting up and operating a Tembo Agent Studio instance — self-hosting, the Tembo API key, roles, and administration.
---

The admin-side companion to the [operator introduction](/agent-studio/introduction/).
This covers standing up and running a Tembo Agent Studio (TAS) instance, rather
than building and running agents in one.

TAS is **self-hostable first**: identity, data, and runtime stay inside your
environment. You deploy it on your own infrastructure, point it at a Git repo
you own, set provider keys, and invite your team.

## How it fits with Tembo

TAS is the **control plane**. The authoring step — turning a chat message into a
diff — is delegated to the [Tembo Coding Agent Platform](https://tembo.io). You
plug a **Tembo API key** into workspace settings, and TAS uses it to open pull
requests against your repo: new agents from chat, and "improve the agent"
submissions from any run. TAS calls out to Tembo coding agents the way a CI
system calls out to compilers.

Until a Tembo API key is set, chat-to-PR authoring stays hidden — running
existing agents only needs an LLM provider key (Anthropic or OpenAI).

## What admins manage

- **[Settings](/agent-studio/settings/)** — repository, LLM provider keys, the
  Tembo API key, Composio, Slack apps, and branding.
- **[Audit & roles](/agent-studio/audit-and-roles/)** — the append-only audit
  timeline and the viewer / operator / workspace-admin model (plus instance
  admins).
- **[Slack apps](/agent-studio/slack-apps/)** — installing and scoping the
  workspace Slack apps that launch agents.

## Deploying & operating

- **[Overview](/agent-studio/deploying-and-operating/)** — architecture and
  day-2 operations.
- **[Setup checklist](/agent-studio/customer-setup/)** — from zero to a working
  instance.
- Platform guides: [Railway](/agent-studio/deploy-railway/),
  [AWS](/agent-studio/deploy-aws/), and [Vercel](/agent-studio/deploy-vercel/).
