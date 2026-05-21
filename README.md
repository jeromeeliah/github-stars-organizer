# GitHub Stars Organizer

A lightweight, privacy-first browser tool for reviewing and organizing starred GitHub repositories.

The app fetches your stars in the browser, categorizes them with transparent local rules, lets you add custom taxonomy categories, and exports portable Markdown/JSON files. GitHub Lists sync is treated as experimental because GitHub does not currently expose a stable documented public REST workflow for managing Star Lists.

## Why This Exists

Existing stars managers often become hosted dashboards, AI workspaces, or full knowledge bases. This project aims to stay small and predictable:

- Local-first browser workflow
- No backend account
- Token is not stored
- Categorization rules are visible and editable
- Exports work even when GitHub Lists sync is unavailable

## Run Locally

```bash
npm test
npm run start
```

Then open `http://localhost:4173/github_stars_organizer.html`.

## Token Guidance

Use the least-privilege GitHub token available for your workflow. The token is held only in memory for the current browser session and is sent only to GitHub API requests.

Recommended setup:

- Generate a fine-grained token at `https://github.com/settings/personal-access-tokens/new`
- Choose your own account as the resource owner
- Enable `Starring: Read` under user permissions
- Allow repository access only to the repositories you want included if you need private starred repositories

Supported token prefixes:

- `github_pat_`
- `ghp_`
- other classic GitHub token prefixes such as `gho_`, `ghu_`, `ghs_`, and `ghr_`

## Current Features

- Fetch starred repositories with GitHub REST pagination
- Categorize using local tokenized rules
- Show confidence and matched-rule explanations
- Add custom categories manually
- Move repositories between categories before export
- Filter by category, search text, or `Needs review only`
- Select a subset and apply a category in one action
- Try pushing a selected subset directly to one GitHub List when the experimental endpoint is available
- Export minimized portable JSON
- Export Markdown report
- Export/import taxonomy JSON
- Optional experimental GitHub Lists sync

## Development

This project intentionally has no runtime npm dependencies. Tests use Node's built-in test runner.

```bash
npm test
```

Key files:

- `github_stars_organizer.html` - browser entry point and app layout
- `src/app.js` - DOM/UI behavior
- `src/organizer.js` - pure categorization and export logic
- `src/githubApi.js` - GitHub API boundary
- `tests/` - Node tests for pure modules

## Open Source Basics

- License: [MIT](./LICENSE)
- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Direct push strategy: [docs/direct-push-options.md](./docs/direct-push-options.md)
- GitHub launch guide: [docs/open-source-github-launch.md](./docs/open-source-github-launch.md)

## Open Source Positioning

The project is best positioned as a small bridge between a messy starred-repo backlog and useful categories or GitHub Lists, not as a hosted stars dashboard.

The differentiator is trust: transparent rules, local execution, useful exports, and careful fallback behavior when GitHub Lists are unavailable.
