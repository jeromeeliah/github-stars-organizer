# Contributing

Thanks for contributing to GitHub Stars Organizer.

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
