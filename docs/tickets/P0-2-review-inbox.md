# Ticket P0-2 — Review inbox

Branch: `feat/p0-review-inbox`
Worktree: `.worktrees/p0-review-inbox`

Default landing is the inbox. Exclude `manual`, Read Later, and reviewed rows. Filing must shrink the queue. Needs-review metric switches the inbox. Fold 401/403/429 and empty-vs-filter copy into fetch/empty states.

Depends on P0-1 if you need filings to survive refresh; can land UI-first against RAM state.
