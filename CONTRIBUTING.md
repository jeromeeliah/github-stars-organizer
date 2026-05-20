# Contributing

Thanks for contributing to GitHub Stars Organizer.

## Workflow

1. Create a branch for your change.
2. Keep changes focused and easy to review.
3. Run the test suite before opening a pull request.
4. Update documentation when behavior or project positioning changes.

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
