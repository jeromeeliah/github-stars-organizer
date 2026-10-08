# Changelog

## Unreleased

### Added

- Compact ASCII cellar-rack mark in the README, reused as a tiny `pre` above the app title.
- Keyboard filing on the inbox: `j`/`k` move, `f` files the current suggestion, `s` skips (reviewed, same shelf), `r` files Read Later, `u` undoes the last filing in this tab. Keys stay quiet while typing.
- GitHub Lists push uses documented GraphQL (`viewer.lists`, `createUserList`, `updateUserList`, `deleteUserList`, `updateUserListsForItem`). New lists are private. Subset push merges membership. REST `/user/lists` is a 404.

### Changed

- Lists write needs a classic PAT with the `user` scope. Fine-grained **Starring: Read** still fetches stars. Exports still work when Lists write is denied.
- **Replace GitHub Lists with these shelves** names lists after the desk, re-files stars onto those shelves only, and deletes leftovers after confirm. At the 32-list cap it rewrites existing lists instead of creating a 33rd. It does not silently alias onto unrelated lists.
- README shows the empty desk. Entry file is `index.html`. Onboarding lives under `docs/`.
- The public repo is clone-and-run only. No hosted app, no telemetry. The token still goes only to GitHub on user-started requests.

## [0.1.2] — 2026-09-27

### Changed

- Markdown export is a shareable list: shelf, stars, language, description. Rule-match lines are no longer in the file. JSON stays the reload copy.
- Public tree is the desk and the queue. Workshop notes stay local. Clear control says **Clear saved filings**.

## [0.1.1] — 2026-09-27

### Added

- Compact-granular taxonomy concept: spec, layer-stack diagram, and tickets P1-4…P1-8 plus P3-3. No filing-code change.
- Desk hygiene: skip link to inbox, polite live status, `:focus-visible`, `100dvh`, `tabular-nums`, `content-visibility` on rows, and a confirm before **Clear this cellar**.
- Public README: one screen for run, token, and what the desk does. File map and launch notes stay in onboarding.

### Notes

- Keyboard triage (P0-4) and wine-list Markdown (P1-1) stay ahead.

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

- Public remote: https://github.com/jeromeeliah/github-stars-organizer — tag `v0.1.0` is on `fac4a67`. PR #1 and PR #7 are merged to `main`.
- Lists write remains undocumented and optional. Exports are the reliable product surface.
- Keyboard triage (P0-4) and wine-list Markdown polish (P1-1) are still backlog.
