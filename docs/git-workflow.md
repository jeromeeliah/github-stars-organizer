# Git workflow

This repo has **no GitHub remote yet**. Work stays local: branches, worktrees, and ticket files. When a remote exists, map each `docs/backlog.md` ticket to a GitHub issue with `gh issue create` and put `Fixes #N` on the feature PR.

## Current branches

| Branch | Worktree | Purpose |
| --- | --- | --- |
| `main` | (none checked out here) | Prototype baseline |
| `feature/open-source-ready-organizer` | repo root | OSS-ready app + community files |
| `docs/agent-context` | `.worktrees/docs-agent-context` | `CLAUDE.md`, `ONBOARDING.md`, diagram-design marker |
| `docs/current-state-diagrams` | `.worktrees/docs-diagrams` | Editorial HTML diagrams |
| `docs/cellar-backlog` | `.worktrees/docs-backlog` | Goal, tickets, git rules, review notes |

Product work uses `feat/p0-*` … `feat/p3-*` worktrees created from **this** branch so tickets travel with the code.

## Commands

```bash
# list
git worktree list
git branch --list 'docs/*' 'feat/*'

# new P0 sitting (example)
git worktree add .worktrees/p0-review-inbox -b feat/p0-review-inbox docs/cellar-backlog

# remove a finished worktree after merge
git worktree remove .worktrees/p0-review-inbox
```

`.worktrees/` is gitignored. Do not commit machine-specific `diagram-design` symlinks; see `.cursor/skills/README.md` on `docs/agent-context`.

## Rules

- One concern per branch. Do not mix persist, inbox, and Cuvée on one PR.
- `docs/` branches are mergeable independently. `feat/*` branches stack on `docs/cellar-backlog` until that docs merge lands on the app line.
- Never persist tokens. Never force-push `main`.
- No GitHub Issues until a remote exists; the ticket table in `docs/backlog.md` is the queue.
