# Contributing

Small, focused changes are welcome.

```bash
npm test
npm run start
```

Open `http://localhost:4173/`.

Before a pull request: `npm test`, then file one row and export Markdown. The token stays in the tab. Refresh may clear it. Filings should still be there.

Do not persist tokens. GitHub Lists write uses GraphQL and a classic PAT with the `user` scope. See [docs/direct-push-options.md](docs/direct-push-options.md).
