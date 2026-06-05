---
title: Improvements
description: Turn run feedback into a pull request, and track it from submission to merge.
---

**Improvements** close the loop from "this run was wrong" to a reviewed change.

## Submitting an improvement

From any [run](/agent-studio/running-agents/), use **Improve the Agent** and
describe what should change ("the response was too long — keep answers under
three sentences"). TAS hands the feedback to the
[Tembo Coding Agent Platform](https://tembo.io), which opens a pull request
against your repo. (This needs a Tembo API key in **Settings**.)

## Tracking

The **Improvements** page lists submissions and their status. TAS correlates the
merged pull request back to your submission, so you can see whether a fix landed
without leaving the studio. Because the change is a PR, it goes through the same
review as any other edit — feedback adapts the agent, but the adaptation stays
governed.

:::note
If submitting seems to do nothing, it's usually a stale browser tab from a
previous deployment — refresh and try again. See
[Troubleshooting](/agent-studio/troubleshooting/).
:::
