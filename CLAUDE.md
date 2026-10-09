# GitHub Stars Organizer

Privacy-first, browser-only stars review desk. No backend, no runtime npm deps, no accounts. Human map: `docs/onboarding.md`. Visitor landing: `README.md`.

## Commands

```bash
npm test                 # Node built-in test runner (node --test)
npm run start            # python3 -m http.server 4173
```

Open `http://localhost:4173/`. There is no `npm install` for the product (`package.json` has no `dependencies`).

## Architecture

- `index.html` — shell, CSS, token field
- `src/app.js` — DOM, in-memory session, event handlers (not unit-tested)
- `src/organizer.js` — pure rules, scoring, exports (tested)
- `src/cellarStore.js` — persist, sticky filings, inbox and keyboard helpers (tested)
- `src/githubApi.js` — GitHub REST stars (fetch/unstar/restar) + GraphQL Lists (tested)
- `docs/` — notes, not runtime

Keep categorization/export pure so Node can test it. Keep GitHub I/O in `githubApi.js`. Do not add a bundler, framework, or server to the core app.

## Boundaries

- Never persist the GitHub token (`localStorage`, IndexedDB, cookies, env files, exports).
- Send the token only to `api.github.com`, only on user-initiated requests.
- GitHub Lists write uses GraphQL (`createUserList`, `updateUserList`, `deleteUserList`, `updateUserListsForItem`), not REST `/user/lists`. New lists are private. Writes need a classic PAT with the `user` scope. Last-resort replace rewrites lists to desk names and deletes leftovers after confirm; at the 32-list cap it does not create a 33rd list. Exports must still work when Lists fail.
- Do not open the app via `file://` — ES module imports fail. Use `npm run start`.
- Do not treat Playwright or Chrome automation as an end-user flow.

## Git

Worktrees live in `.worktrees/` (gitignored). Branch prefixes: `docs/` for documentation, `feat/p0-` … `feat/p3-` for product work. See `docs/git-workflow.md`. Public remote: `https://github.com/jeromeeliah/github-stars-organizer`. Do not add a second remote.

## Diagrams

Editorial HTML+SVG diagrams live in `docs/diagrams/`. Marker: `.diagram-design` → profile `stars-cellar`. The skill checkout stays local.
