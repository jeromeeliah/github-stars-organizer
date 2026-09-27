# GitHub Stars Organizer

Privacy-first, browser-only stars review desk. No backend, no runtime npm deps, no accounts. Human map: `ONBOARDING.md`. Visitor landing: `README.md`.

## Commands

```bash
npm test                 # Node built-in test runner (node --test)
npm run start            # python3 -m http.server 4173
```

Open `http://localhost:4173/github_stars_organizer.html`. There is no `npm install` for the product (`package.json` has no `dependencies`).

## Architecture

- `github_stars_organizer.html` — shell, CSS, token field
- `src/app.js` — DOM, in-memory session, event handlers (not unit-tested)
- `src/organizer.js` — pure rules, scoring, exports (tested)
- `src/cellarStore.js` — persist, sticky filings, inbox helpers (tested)
- `src/githubApi.js` — only GitHub REST boundary (tested)
- `docs/` — notes, not runtime

Keep categorization/export pure so Node can test it. Keep GitHub I/O in `githubApi.js`. Do not add a bundler, framework, or server to the core app.

## Boundaries

- Never persist the GitHub token (`localStorage`, IndexedDB, cookies, env files, exports).
- Send the token only to `api.github.com`, only on user-initiated requests.
- GitHub Lists write (`/user/lists`) is experimental and undocumented. Label it that way. Exports must still work when Lists fail.
- Do not open the app via `file://` — ES module imports fail. Use `npm run start`.
- Do not treat Playwright or Chrome automation as an end-user flow.

## Git

Worktrees live in `.worktrees/` (gitignored). Branch prefixes: `docs/` for documentation, `feat/p0-` … `feat/p3-` for product work. See `docs/git-workflow.md`. Public remote: `https://github.com/jeromeeliah/github-stars-organizer`. Do not add a second remote.

## Diagrams

Editorial HTML+SVG diagrams live in `docs/diagrams/`. Marker: `.diagram-design` → profile `stars-cellar`. The skill checkout stays local.
