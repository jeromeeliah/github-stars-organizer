# Changelog

## Unreleased

### Added

- Same-origin cellar cache (IndexedDB) for taxonomy, assignments, reviewed flags, and the last star snapshot. The GitHub token is never written.
- Import of `github-stars-organized.json` and a **Clear this cellar** control.
- Review inbox as the default landing. Filing a row marks it reviewed and shrinks the queue.
- Sticky filings: adding a category or re-scoring keeps manual / Read Later / reviewed rows.
- Honest 401 / 403 / 429 copy, including rate-limit reset time when GitHub sends it.

### Changed

- GitHub Lists: reuse a list that already exists by name. Full-category push is labeled last-resort. Subset push stays the preferred experimental path.

### Notes

- No public GitHub remote or `v0.1.0` tag yet. Lists write remains undocumented and optional.
