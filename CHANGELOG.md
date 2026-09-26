# Changelog

## [0.1.0] — 2026-09-26

First public cut of the local-first stars cellar.

### Added

- Same-origin cellar cache (IndexedDB) for taxonomy, assignments, reviewed flags, and the last star snapshot. The GitHub token is never written.
- Import of `github-stars-organized.json` and a **Clear this cellar** control.
- Review inbox as the default landing. Filing a row marks it reviewed and shrinks the queue.
- Sticky filings: adding a category or re-scoring keeps manual / Read Later / reviewed rows.
- Honest 401 / 403 / 429 copy, including rate-limit reset time when GitHub sends it.
- MIT license, README, CONTRIBUTING, SECURITY, issue/PR templates, and cellar backlog docs.

### Changed

- GitHub Lists: reuse a list that already exists by name. Full-category push is labeled last-resort. Subset push stays the preferred experimental path.

### Notes

- Public remote: https://github.com/jeromeeliah/github-stars-organizer — tag `v0.1.0` points at the feature tip; merge PR #1 into `main` after UI verify.
- Lists write remains undocumented and optional. Exports are the reliable product surface.
- Keyboard triage (P0-4) and wine-list Markdown polish (P1-1) are still backlog.

## Unreleased

Nothing yet.
