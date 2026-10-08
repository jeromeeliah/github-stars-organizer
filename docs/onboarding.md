# Codebase Onboarding

Privacy-first **browser app** for reviewing starred GitHub repos. No backend, no runtime npm deps, no server database. Same-origin IndexedDB may cache the cellar; the GitHub token never goes there. Categorization is local tokenized rules; GitHub Lists write is optional GraphQL (`user` scope).

## Quick Start

```bash
npm test
npm run start
```

Open `http://localhost:4173/`.

- **Node** is required for tests (`node --test`). **Python 3** is required for `npm run start` (`python3 -m http.server 4173`).
- Do **not** open the HTML via `file://` — ES module imports will fail.
- There is no `npm install` for the product. `package.json` has no `dependencies`.
- Paste a GitHub PAT in the UI (not an env file). Fine-grained token with **Starring: Read** is enough to fetch stars.

## Architecture

Single package, vanilla HTML + ES modules. No Next.js, Vite, Express, or monorepo tooling.

```
index.html                    # layout, CSS, token field
src/app.js                    # DOM, session state, event handlers
src/organizer.js              # rules, scoring, exports (pure, tested)
src/cellarStore.js            # IndexedDB cellar, sticky filings, inbox, keyboard helpers (tested)
src/githubApi.js              # only GitHub REST boundary
tests/                        # Node built-in test runner
docs/                         # notes, not runtime
```

**Start here:** `README.md` → `index.html` → `src/organizer.js` → `src/cellarStore.js` → `src/githubApi.js` → `src/app.js`.

Keep categorization and export **pure** so Node can test them. Keep GitHub I/O in `src/githubApi.js`.

Version `0.1.2`, `"private": true`. `"private"` blocks `npm publish`. The GitHub repository is public. Quality gate is local `npm test` plus a manual browser pass — there is no CI workflow.

## Data Models

**No server database, ORM, or migrations.** Same-origin IndexedDB (`src/cellarStore.js`) may cache taxonomy, assignments, reviewed flags, and the last star snapshot so a refresh keeps filings. The GitHub token is never written. Portable JSON export/import is the durable snapshot.

Session lives in `src/app.js` `state`: token (RAM only), raw repos, taxonomy, grouped results, selection/filters, inbox cursor, and a tab-only undo stack. Reload restores the cellar from IndexedDB or an imported JSON file; the token field stays empty. Inbox keys: `j`/`k` move, `f` file suggestion, `s` skip, `r` Read Later, `u` undo.

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

Outbound GitHub calls from `src/githubApi.js` (`https://api.github.com`, `X-GitHub-Api-Version: 2022-11-28`, `Authorization: Bearer <token>`):

| Method | Path | Function | Purpose |
| --- | --- | --- | --- |
| GET | `/user/starred?per_page=100` | `fetchAllStars` | Paginate stars via `Link: rel="next"` |
| POST | `/graphql` `viewer.lists` | `fetchExistingLists` | Read GitHub Lists (GraphQL) |
| POST | `/graphql` `createUserList` | `createList` | Create a **private** list |
| POST | `/graphql` `updateUserList` | `updateList` | Rename / describe an existing list |
| POST | `/graphql` `deleteUserList` | `deleteList` | Delete leftover lists after a confirmed replace |
| POST | `/graphql` `updateUserListsForItem` | `addRepoToList` / `setRepoLists` | Merge (subset) or replace (desk resync) membership |

REST `/user/lists` 404s. There is no REST Lists path. Treat Lists write as optional. If GraphQL writes fail (usually missing `user` scope), the UI should still export JSON/Markdown/taxonomy.

## Authentication

No Auth.js, Clerk, OAuth, middleware, or protected routes.

The user pastes a PAT into a password field (`autocomplete="off"`). `isLikelyGitHubToken` in `src/organizer.js` accepts `github_pat_` and classic prefixes `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`. The token is copied to `state.token` and **must not be persisted**. It is sent only to GitHub, only on user-initiated requests (`SECURITY.md`).

Minimum documented scope for fetch: fine-grained **Starring: Read**. Lists write: classic PAT with the **`user`** scope. Fine-grained tokens cannot currently create Lists. New lists are private.

## Deployment

The supported product is **clone and run**. There is no hosted instance, no GitHub Pages site, and no telemetry. Nothing in-repo for Docker, Vercel, Netlify, Fly, Terraform, or GitHub Actions. `.github/` has issue/PR templates only. There is no deploy workflow.

The files are still static (`index.html` + `src/*.js`). A static host would serve them, but that is not shipped. No build step, no env vars. User data still goes only to `api.github.com` on requests the user starts.

## Key Files to Know

- `src/organizer.js` — product brain: taxonomy, scoring, confidence, portable JSON/Markdown
- `src/cellarStore.js` — IndexedDB cache, JSON import, sticky filings, inbox and keyboard helpers; never the token
- `src/githubApi.js` — stars pagination + GraphQL Lists; keep all GitHub HTTP here
- `src/app.js` — UI state machine; do not bury categorization rules here
- `index.html` — entry URL and token/privacy copy
- `tests/organizer.test.js` / `tests/githubApi.test.js` / `tests/cellarStore.test.js` — required before behavior changes
- `docs/direct-push-options.md` — why Lists are experimental
- `README.md` — how to run it and where the token goes

## Gotchas

1. **HTTP server required** — ES modules need `npm run start` (or any static server), not `file://`.
2. **Zero product dependencies** — do not add a bundler or backend without an explicit product decision.
3. **Lists write needs `user`** — GraphQL `createUserList` / `updateUserList` / `deleteUserList` / `updateUserListsForItem`. REST `/user/lists` 404s. Exports still work without that scope.
4. **Token is tab-scoped** — refresh loses it; filings stay in this browser. That is intended.
5. **Local notes stay local** — `brain/`, `docs/agents/`, and `scripts/` are gitignored.
6. **No CI** — `npm test` is the gate. The PR template also expects a manual browser pass.
7. **GitHub max 32 Lists** — **Replace GitHub Lists with these shelves** names lists after the desk, re-files stars onto those shelves only, and deletes leftovers after confirm. At the cap it rewrites existing lists instead of creating a 33rd. Uncategorized never becomes a List. Subset push still only reuses a list by exact name.
