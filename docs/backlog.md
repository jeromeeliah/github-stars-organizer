# Backlog

Remote: [jeromeeliah/github-stars-organizer](https://github.com/jeromeeliah/github-stars-organizer). P0-1/2/3 were migrated to Issues and closed as shipped on PR #1; remaining backlog items stay as open Issues. This file remains the narrative queue.

Joint pass (2026-09-15): [UX review](docs/reviews/ux-faang.md) + [indie review](docs/reviews/indie-hacker.md). Details in those notes.

**MVP swap vs the story map:** keep persist / inbox / keyboard. Replace the standalone “honest empty states” card with **sticky filings** (manual/Read Later/reviewed rows must not re-scatter when rules change). Fold 401/403/429 copy into fetch.

**Persistence compromise:** JSON round-trip is the portable snapshot. Same-origin IndexedDB may cache the same cellar (taxonomy, assignments, reviewed flags, last star list). Never the token. Indie preference for “export is the snapshot” and UX need for refresh-survival are both met if import of `github-stars-organized.json` ships in the same P0 as the cache.

## P0 — cellar that survives a refresh

| Id | Branch / worktree | Ticket |
| --- | --- | --- |
| P0-1 | `feat/p0-persist-cellar` · done in `a9db0de` | Persist taxonomy, assignments, reviewed flags, optional star snapshot. Never the token. Import portable JSON. Clear-this-cellar control. |
| P0-2 | `feat/p0-review-inbox` · done in `a9db0de` | Default landing is the inbox. Exclude `manual`, Read Later, and reviewed. Filing must shrink the queue. Needs-review metric is the inbox switch. |
| P0-3 | `feat/p0-sticky-filings` · done in `a9db0de` | Adding a category or re-score must not throw away human moves. Lock filed rows. |
| P0-4 | `feat/p0-keyboard-filing` | After P0-2: `j/k`, file/skip/Read Later, undo last. Do not block export-first OSS on this if inbox already ships. |
| P0-5 | folded into `0.1.0` fetch | Shipped: 401/403/429 sentences and rate-limit reset time. Empty cellar vs zero stars vs filter miss still worth a copy pass if a sitting is already in fetch. |

Taxonomy concept (2026-09-26): compact shelves + optional grain. Spec: [docs/superpowers/specs/2026-09-26-cellar-taxonomy-design.md](superpowers/specs/2026-09-26-cellar-taxonomy-design.md). Diagram: [docs/diagrams/taxonomy-layers.html](diagrams/taxonomy-layers.html).

Desk hygiene (2026-09-26, this branch): skip link, live status, `:focus-visible`, `100dvh`, confirm on cellar clear. Notes: [docs/reviews/ux-wig-2026-09-26.md](reviews/ux-wig-2026-09-26.md).

Deferred (vanilla desk, not the Expo app): “where am I” orientation chrome and restrained motion. Do not start that sitting from this branch.

## P1 — OCD affordances

| Id | Suggested branch | Ticket |
| --- | --- | --- |
| P1-1 | `feat/p1-wine-list-export` | Wine-list Markdown without `Matched: keyword:` debug. README screenshot. JSON stays the reload file. |
| P1-2 | `feat/p1-stale-bottles` | Never-opened / stale **queue**, after wine-list. Not a rank formula. |
| P1-3 | `feat/p1-facet-filters` | Language / archived / license as **filters**, not categories. |
| P1-4 | `feat/p1-taxonomy-editor` | Rename (stable id), edit keywords, delete or merge. Do not block v1. [ticket](tickets/P1-4-taxonomy-editor.md) |
| P1-5 | `feat/p1-candidate-chips` | Render unused top-3 `candidates` as accept / other / Read Later. [ticket](tickets/P1-5-candidate-chips.md) |
| P1-6 | `feat/p1-activity-sort` | Show `pushed_at` + archived; sort inbox / stars / recent push / cooling. No heat score. [ticket](tickets/P1-6-activity-sort.md) |
| P1-7 | `feat/p1-granular-flag` | Optional `parentId` children; flag default off. After P1-4. [ticket](tickets/P1-7-granular-flag.md) |
| P1-8 | `feat/p1-new-bucket-suggestions` | Topic/token clusters → “create this shelf?” No model. After P1-4. [ticket](tickets/P1-8-new-bucket-suggestions.md) |

## P2 — GitHub where starring happens

| Id | Suggested branch | Ticket |
| --- | --- | --- |
| P2-1 | `feat/p2-browser-extension` | File this repo into a shelf on `github.com`. Retention, not acquisition. |
| P2-2 | `feat/p2-lists-dom-fallback` | Lists via GitHub UI if REST write is dead. |
| P2-3 | `feat/p2-ci-public-launch` | `npm test` CI, stop `"private": true`, GitHub Pages of the empty app. |

## P3 — Cuvée (optional module)

Core must run with `cuvee/` deleted. Do not mention in v1 README.

| Id | Suggested branch | Ticket |
| --- | --- | --- |
| P3-1 | `feat/p3-cuvee-overlay` | Theme + reduced-motion cork-pop. |
| P3-2 | `feat/p3-weekly-tasting` | Seven neglected bottles. Habit product; after overlay exists. |
| P3-3 | `feat/p3-sommelier-notes` | BYO key or local model. Notes only, including optional obsolescence **guess**. Never silent recategorize. Never the GitHub token. [ticket](tickets/P3-3-sommelier-notes.md) |
| P3-4 | — | Hosted share page: **cut**. Consuming an export is fine as a gist; do not build a dashboard. |

## Cuts from current app (bugs/hygiene, not new features)

- Demote **Push all non-empty categories**. Prefer subset push. Do not create a list that already exists by name.
- Adding a category currently re-runs `categorizeRepos` and drops manual moves (`src/app.js`) — fixed by P0-3.
- `file://` remains documented; keep PAT guidance.
- Playwright `scripts/github-stars-bridge.mjs` stays maintainer-only.
- Match-debug lines out of public Markdown (P1-1).

## Create a P0 worktree

```bash
git worktree add .worktrees/p0-persist-cellar -b feat/p0-persist-cellar docs/cellar-backlog
```
