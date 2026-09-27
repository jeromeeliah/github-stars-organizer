# UX review (ex-FAANG full-stack)

2026-09-15. Read-only pass over the HTML/JS desk and the current-state diagrams.

## Verdict

The desk is honest and local-first. It is a **one-sitting filter**, not a cellar. Refresh wipes work. “Needs review” is a checkbox over everything that is not high-confidence, including repos you just filed by hand.

## P0

1. **Session amnesia.** RAM-only `state`. Export JSON has no import. Adding a category re-runs `categorizeRepos` and drops manual moves.
2. **Inbox is not a queue.** `reviewOnly` starts false. `confidence === "manual"` still matches “needs review.” Filing does not shrink the pile.
3. **No keyboard triage.** Mouse + 16-option `<select>` cannot finish 2k stars.

## P1

- Confidence noise: language-only hits become “medium”; unused `candidates`; medium/low/manual share one warn color.
- Empty/error: rate-limit `reset` parsed but unused; 403 dumped raw; Lists “push all” always `createList`s.

## Keep

Visible PAT contract, experimental Lists labeling, inspectable rules, Read Later / Uncategorized as real buckets, paper-desk visual language.

## MVP

Yes to persist (never token), review inbox as default, keyboard filing. **Swap** standalone empty-states for **sticky filings**. Fold 401/403/429 into fetch.

## Cuvée

Opt-in overlay on inbox rows only. BYO key, never GitHub token, never default categorizer. Gimmicky: default-on LLM, tasting notes on every card, gamified “seven bottles.”
