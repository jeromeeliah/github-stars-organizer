# Codebase Onboarding

Privacy-first **browser app** for reviewing starred GitHub repos. No backend, no runtime npm deps, no server database. Same-origin IndexedDB may cache the cellar; the GitHub token never goes there. Categorization is local tokenized rules; GitHub Lists sync is experimental.

## Quick Start

```bash
npm test
npm run start
```

Open `http://localhost:4173/github_stars_organizer.html`.

- **Node** is required for tests (`node --test`). **Python 3** is required for `npm run start` (`python3 -m http.server 4173`).
- Do **not** open the HTML via `file://` — ES module imports will fail.
- There is no `npm install` for the product. `package.json` has no `dependencies`.
- Paste a GitHub PAT in the UI (not an env file). Fine-grained token with **Starring: Read** is enough to fetch stars.

## Architecture

Single package, vanilla HTML + ES modules. No Next.js, Vite, Express, or monorepo tooling.

```
github_stars_organizer.html   # layout, CSS, token field
src/app.js                    # DOM, session state, event handlers
src/organizer.js              # rules, scoring, exports (pure, tested)
src/cellarStore.js            # IndexedDB cellar, sticky filings, inbox (tested)
src/githubApi.js              # only GitHub REST boundary
tests/                        # Node built-in test runner
docs/                         # product/architecture notes, not runtime
scripts/github-stars-bridge.mjs  # maintainer Playwright helper (not the app)
```

**Start here:** `README.md` → `github_stars_organizer.html` → `src/organizer.js` → `src/cellarStore.js` → `src/githubApi.js` → `src/app.js`.

Intended split (from `docs/implementation-plan.md`): keep categorization/export **pure** so Node can test it; keep the HTML as shell; keep GitHub I/O in one module.

Version `0.1.1`, `"private": true`. `"private"` blocks `npm publish`. The GitHub repository is public. Quality gate is local `npm test` plus a manual browser pass — there is no CI workflow.

## Data Models

**No server database, ORM, or migrations.** Same-origin IndexedDB (`src/cellarStore.js`) may cache taxonomy, assignments, reviewed flags, and the last star snapshot so a refresh keeps filings. The GitHub token is never written. Portable JSON export/import is the durable snapshot.

Session lives in `src/app.js` `state`: token (RAM only), raw repos, taxonomy, grouped results, selection/filters. Reload restores the cellar from IndexedDB or an imported JSON file; the token field stays empty.

Logical shapes in `src/organizer.js`:

| Shape | Role |
| --- | --- |
| **Category** | `id`, `name`, `description`, `keywords`, `languages`, optional `manual` / `isDefault` |
| **CategorizationResult** | `repo` + `primaryCategory` + scored `candidates` + `confidence` + `explanations` |
| **Grouped output** | `generatedAt`, `categories[]` (each with repos), `results`, `taxonomy`, `metrics` |
| **Portable repo** | minimized export fields (`id`, `owner`, `name`, `url`, `category`, …) |

Default buckets include AI & ML, AI Agents, Developer Tools, Web, Data, Infra, Security, Databases, Languages, Learning, Design, Business, Science, Productivity, plus **Read Later** (manual) and **Uncategorized** (fallback). Facets like license or archived status are *not* primary categories.

## API Reference

**No app server and no local routes.** `npm run start` only serves static files.

Outbound **GitHub REST v3** from `src/githubApi.js` (`https://api.github.com`, `X-GitHub-Api-Version: 2022-11-28`, `Authorization: Bearer <token>`):

| Method | Path | Function | Purpose |
| --- | --- | --- | --- |
| GET | `/user/starred?per_page=100` | `fetchAllStars` | Paginate stars via `Link: rel="next"` |
| GET | `/user/lists` | `fetchExistingLists` | Probe experimental Lists API |
| POST | `/user/lists` | `createList` | Create a list |
| POST | `/user/lists/{id}/items` | `addRepoToList` | Add `{ repository_id }` |

Treat Lists as optional. If those calls fail, the UI should still export JSON/Markdown/taxonomy.

`scripts/github-stars-bridge.mjs` is Playwright against `https://github.com/stars`, not an HTTP API.

## Authentication

No Auth.js, Clerk, OAuth, middleware, or protected routes.

The user pastes a PAT into a password field (`autocomplete="off"`). `isLikelyGitHubToken` in `src/organizer.js` accepts `github_pat_` and classic prefixes `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`. The token is copied to `state.token` and **must not be persisted**. It is sent only to GitHub, only on user-initiated requests (`SECURITY.md`).

Minimum documented scope for fetch: fine-grained **Starring: Read**. Lists write has **no stable public permission recipe** — account-dependent, experimental.

## Deployment

Nothing in-repo for Docker, Vercel, Netlify, Fly, Terraform, or GitHub Actions. Ship the repo root as static files (`github_stars_organizer.html` + `src/*.js`) on any static host. No build step, no env vars.

`.github/` has issue/PR templates only. Launch checklist lives in `docs/open-source-github-launch.md`; it is not automated.

## Key Files to Know

- `src/organizer.js` — product brain: taxonomy, scoring, confidence, portable JSON/Markdown
- `src/cellarStore.js` — IndexedDB cache, JSON import, sticky filings, inbox helpers; never the token
- `src/githubApi.js` — stars pagination + experimental Lists; keep all GitHub HTTP here
- `src/app.js` — UI state machine; do not bury categorization rules here
- `github_stars_organizer.html` — entry URL and token/privacy copy
- `tests/organizer.test.js` / `tests/githubApi.test.js` / `tests/cellarStore.test.js` — required before behavior changes
- `docs/direct-push-options.md` — why Lists are experimental and what fallbacks exist
- `docs/implementation-plan.md` — architecture increments and category model
- `README.md` — human source of truth for run/token/positioning
- `.cursor/skills/codebase-onboarding/SKILL.md` — repo-local skill that regenerates this file

## Gotchas

1. **HTTP server required** — ES modules need `npm run start` (or any static server), not `file://`.
2. **Zero product dependencies** — do not add a bundler or backend without an explicit product decision. The Playwright bridge is unlisted in `package.json` and needs Playwright installed separately; it is maintainer-only.
3. **Lists will break** — undocumented `/user/lists` paths. Exports are the reliable path.
4. **Token is tab-scoped** — refresh loses it; filings stay in the cellar. That is intended.
5. **`brain/`** — local agent notes, not the app. Prefer README + this file for onboarding.
6. **No CI** — `npm test` is the gate. PR template also expects a manual browser pass.
