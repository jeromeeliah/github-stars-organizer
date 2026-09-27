# Git workflow

Public remote: [jeromeeliah/github-stars-organizer](https://github.com/jeromeeliah/github-stars-organizer). Map remaining tickets to GitHub Issues with `gh issue create` and put `Fixes #N` on the feature PR. The ticket table in [docs/backlog.md](backlog.md) stays the narrative queue.

## Current branches

| Branch | Worktree | Purpose |
| --- | --- | --- |
| `main` | (none checked out here) | Prototype baseline |
| `feature/open-source-ready-organizer` | PR #1 (open) | OSS-ready app + cellar P0-1/2/3 |
| `docs/agent-context` | `.worktrees/docs-agent-context` | `CLAUDE.md`, `ONBOARDING.md`, diagram-design marker |
| `docs/current-state-diagrams` | `.worktrees/docs-diagrams` | Editorial HTML diagrams |
| `docs/cellar-backlog` | `.worktrees/docs-backlog` | Goal, tickets, git rules, review notes |
| `docs/cellar-taxonomy-concept` | (this checkout) | Compact-granular spec, diagrams, P1-4…P1-8 tickets, desk hygiene |

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
- Issues exist for shipped P0-1/2/3 (closed) and open P0-4 / P1-1. New tickets still start in `docs/backlog.md`.
