# Shipped Phases

Phase folders that have already shipped (per [`CHANGELOG.md`](../../CHANGELOG.md)).
Kept here as historical record + load-bearing reference for current
work — the v0.4 audit-substrate decision cites v0.3's structured
events; the v0.2 PR-policy carve-out is referenced from the backlog
PR-policy memo; etc. Moving them out of the root `context/` keeps
the active phase folders uncluttered without making the shipped
docs feel deprecated.

Each subfolder mirrors the structure of an in-flight phase:
`README.md`, `BLOG_POST.md`, `USER_STORIES.md`, `DEMO_SCRIPT.md` —
read them as the contract the phase shipped against.

## Index

| Phase | Folder | Theme |
| ----- | ------ | ----- |
| 0.1 | [`0.1/`](./0.1/) | Foundation |
| 0.2 | [`0.2/`](./0.2/) | Authoring velocity |
| 0.3 | [`0.3/`](./0.3/) | Operational surface |

When a phase finishes, move its folder here and update the link
sweep (see `git log --grep "context/shipped"` for the established
pattern).
