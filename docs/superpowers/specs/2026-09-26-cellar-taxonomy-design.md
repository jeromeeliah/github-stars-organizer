# Cellar taxonomy — compact shelves, optional grain

Date: 2026-09-26
Status: concept (docs only; no `src/*` in this pass)
Recommendation: **compact-granular**

Companion diagram: [docs/diagrams/taxonomy-layers.html](../../diagrams/taxonomy-layers.html).
Backlog rows: [docs/backlog.md](../../backlog.md) P1-3…P1-8, P3-3.

## Problem

The desk already scores starred repos into a flat default taxonomy, lets the user add a category, and keeps human moves sticky. It does not rename, merge, or delete shelves. It computes top-3 `candidates` and never shows them. It stores `pushed_at`, forks, and archived and does not show or sort by them.

Discovery sites (Agenorit, findarepo, Product Hunt, GitTrend) optimize for **this week’s browse**. A cellar answers **where did I put that CLI I starred 18 months ago?** Copying an AI-exploded chip row into the defaults makes the pile unfinishable. Empty defaults fail the first sitting.

## Locked decisions

1. Ship about **14 primary shelves + Self-Hosted**. Keep **Read Later** (`manual`) and **Uncategorized** (`isDefault`) reserved.
2. **Language, archived, license, activity window** are facets and sorts, never shelves.
3. A **Granular** flag (default off) reveals optional children (example: AI Agents → Automation / Memory / Skills). Those Agenorit-style Agentic chips are children, not shipped defaults.
4. **Custom add, rename, edit keywords, delete, merge** are first-class. Rename changes display `name`; **`id` stays stable** so sticky filings survive.
5. **No model in the core.** Per-repo suggestions are unused `candidates`. New-bucket suggestions are topic/token clusters. GitHub Models is retired (2026-07-30) and is not a path.
6. **BYOK notes** (including “might be overhauled / obsolete”) are a later optional module. Notes only. Never silent recategorize. Never the GitHub token.
7. **No composite heat score.** Show stars (traction) and last push (activity) as two inspectable numbers. P1-2 stale bottles stays a queue, not a rank formula.
8. This concept is **post-v1 / P1–P3**. Indie v1 cuts stay: no AI in the README; taxonomy editor does not block OSS launch.

## Four layers (do not collapse)

| Layer | Job | Not |
| --- | --- | --- |
| **Primary shelf** | One filing home. `categorizeRepo` → `primaryCategory`. | Language, “hot this week,” archived |
| **Granular child** | Optional, `parentId` set. Child wins if it scores; else parent. Filing may land on parent or child. Lists export may flatten to parent (GitHub’s 32-list ceiling is real). | A second independent score that double-counts the parent |
| **Facet** | Filter the visible pile: language, archived, license, activity window | A category id |
| **Signal** | Row badges + sort: stars, `pushed_at`, archived | A shelf or a magic total |

Human overrides sit across layers: file (sticky `categoryId`), rename/custom (taxonomy), BYOK notes (P3, not assignment).

## Default shelf set (when code happens)

Keep current [`DEFAULT_CATEGORY_INPUT`](../../../src/organizer.js) coverage. **Add Self-Hosted.** Rename in place toward shared wording without adopting six Agentic chips:

- Web & App Development → Web & Frontend
- Data & Analytics → Data Engineering
- Infrastructure & DevOps → DevOps & Infra
- Productivity → Productivity & Knowledge
- Learning & Reference → Learning & Guides
- AI Agents & Automation stays the parent; Automation / Memory / Skills / Security / Science become granular children of AI Agents or AI & ML when the flag is on

Do not delete Languages & Frameworks, Business & Finance, or Science & Research from defaults. Users who want Agenorit-dense AI can turn Granular on or add custom shelves.

## Category record (later code)

Today `createCategory` is flat: `id`, `name`, `description`, `keywords`, `languages`, `manual`, `isDefault`.

Add optional `parentId` (empty on primaries). Rename must not change `id`. `recordAssignment` / `applyStickyFilings` already key on `categoryId` — that contract stays.

Scoring rule when Granular is on: score children first among a parent’s family; if a child scores, it is the primary; otherwise the parent. Never add parent keyword hits on top of a winning child.

## Feature split (do not implement together)

| Id | What ships | Depends on |
| --- | --- | --- |
| P1-3 | Language / archived / license as **filters** | Inbox exists |
| P1-4 | Taxonomy editor: rename, edit keywords/description, delete → Uncategorized or merge | Sticky filings (shipped) |
| P1-5 | Render top-3 `candidates` as accept / other / Read Later | Scoring (shipped) |
| P1-6 | Show `pushed_at` + archived on the row; sort inbox / stars / recent push / cooling | Snapshot fields (shipped) |
| P1-7 | Granular flag + `parentId`; default off | P1-4 (stable ids, editor) |
| P1-8 | Cluster unmatched topics/tokens; “create this shelf?” with rename | P1-4 |
| P1-2 | Stale / never-opened **queue** (unchanged intent) | P1-1 wine-list |
| P3-3 | BYO OpenAI-compatible key or later on-device. Suggestion notes + optional obsolescence guess, labeled as a guess. Never file. Never GitHub token. | Optional `cuvee/`; core runs if deleted |

P1-5 is the first filing-desk win: it uses code that already exists and does not rewrite the taxonomy.

## Success / non-goals

Success: a stranger with 1k–3k stars can file from visible suggestions, rename a shelf without losing sticky filings, see activity and traction at a glance, and turn Granular on without the default desk exploding.

Non-goals: hosted dashboard, silent LLM recategorize, GitHub Models, Product Hunt launch taxonomy as defaults, a single heat number, implementing `src/*` in this docs pass.

## Errors and testing (when code happens)

- Rename collision: reject if another category already has that `name` slug *as a new id*; renaming in place keeps the old id.
- Delete last non-default scoring shelf: refuse, or force Uncategorized-only with a confirm.
- Merge: move assignments from source id to target id, then drop source.
- Granular off: children hidden from chips and filters; assignments to a child remain sticky and still group under that child (do not silently promote to parent).
- Tests stay in `tests/organizer.test.js` and `tests/cellarStore.test.js`: createCategory parentId, rename-stable id, sticky after rename, child-wins scoring, flatten-for-export.

## Open challenge (accepted)

If one user’s cellar is 60% agents, compact defaults will feel wrong. That is a **personal taxonomy** problem. Custom shelves + Granular solve it without baking 2026 FOMO into every stranger’s first run.
