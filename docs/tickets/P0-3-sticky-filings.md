# Ticket P0-3 — Sticky filings

Branch: `feat/p0-sticky-filings`
Worktree: `.worktrees/p0-sticky-filings`

Adding a category or re-running `categorizeRepos` must not throw away human moves. Lock filed / manual / Read Later rows. Today `addManualCategory` → `recategorize()` rescores everything.

Coordinate with P0-1 assignment storage.
