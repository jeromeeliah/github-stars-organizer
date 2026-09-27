# Contributing

Small fixes and focused changes are welcome.

## Workflow

1. Pick a ticket in [docs/backlog.md](docs/backlog.md) and create a `feat/pN-…` branch (see [docs/git-workflow.md](docs/git-workflow.md)).
2. Prefer a git worktree under `.worktrees/` so docs and app branches do not collide.
3. Keep changes focused and easy to review.
4. Run `npm test` before opening a pull request.
5. Update documentation when behavior or project positioning changes.

## Local Development

```bash
npm test
npm run start
```

Open `http://localhost:4173/github_stars_organizer.html`.

## Manual QA (desk)

Local only. There is no GitHub Actions workflow yet (that is P2-3).

1. `npm test`
2. `npm run start` and open `http://localhost:4173/github_stars_organizer.html`
3. Skip link reaches `#inbox`
4. Fetch (or load a cellar snapshot): default view is the unfiled inbox
5. Search a repo name; the list filters
6. File one row into a category; inbox count shrinks
7. **Clear this cellar** → cancel; the cellar stays
8. Export JSON or Markdown; the download is readable

Token stays in the password field only. Refresh may empty it; filings should still be in the cellar.

## Project Principles

- Keep the app local-first and dependency-light.
- Prefer transparent rule-based behavior over hidden magic.
- Treat GitHub Lists sync as experimental unless GitHub publishes a stable public API.
- Avoid storing tokens or sending data anywhere except GitHub API requests.

## Pull Requests

Good pull requests usually include:

- A short summary of the user-facing change
- Notes about testing
- Any API or privacy implications

For project context before larger changes, read:

- `docs/direct-push-options.md`
- `docs/open-source-github-launch.md`
