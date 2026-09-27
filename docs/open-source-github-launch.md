# Open Source GitHub Launch Guide

## Goal

Prepare GitHub Stars Organizer to live as a maintainable open-source project on GitHub with clear positioning, contributor guidance, and a realistic roadmap.

## Recommended Positioning

Describe the project as:

> Fetch your GitHub stars in the browser, sort them with rules you can see and edit, and download Markdown/JSON — no account, token stays in RAM, GitHub Lists push is optional and may not work.

The longer cellar goal lives in [docs/cellar-goal.md](cellar-goal.md). Stay away from claiming fully reliable GitHub Lists automation, hosted sync, or AI-only categorization.

## Repository Setup

Done on the public remote (`jeromeeliah/github-stars-organizer`, public, Issues on):

1. Repository name and short description.
2. History pushed; PR #1 (`feature/open-source-ready-organizer` → `main`) is open.
3. GitHub Issues enabled. P0-1/2/3 closed as shipped; P0-4 and P1-1 remain open.

Still open:

4. Enable Discussions if you want a community surface.
5. Enable branch protection on `main`.
6. Add repository topics such as `github`, `stars`, `organizer`, `productivity`, `browser-app`, and `opensource`.
7. Add a social preview image once the UI has been visually verified.

## Minimum Project Surface

These files already exist on the public remote:

- [README.md](../README.md)
- [LICENSE](../LICENSE)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [SECURITY.md](../SECURITY.md)
- [docs/direct-push-options.md](direct-push-options.md)
- [docs/implementation-plan.md](implementation-plan.md)

## Suggested First GitHub Additions

Already on this branch: issue templates (`bug report`, `feature request`, `direct push compatibility report`), pull request template, and `SECURITY.md`.

Already on the public remote:

1. `CHANGELOG.md` — v0.1.0 notes are in the repo; keep them crisp from here onward
2. Tickets migrated to GitHub Issues — P0-1/2/3 closed as shipped; P0-4 and P1-1 remain open

## Release Messaging

The first public release should emphasize:

- Local-first execution
- Transparent categorization rules
- Fine-grained token guidance
- Export-first reliability
- Experimental direct push

Avoid launch language that implies:

- guaranteed GitHub Lists compatibility
- hosted syncing
- server-side storage
- AI-only categorization magic

## Suggested GitHub README Flow

The README should keep this order:

1. What the project is
2. Why it exists
3. Quick start
4. Token setup
5. How direct push works
6. Export workflow
7. Contribution guidance

## Maintainer Checklist

Before announcing the project publicly:

1. Run `npm test`
2. Open the app locally and do a manual browser pass
3. Test with a fine-grained token that has `Starring: Read`
4. Confirm the export files are readable
5. Confirm the direct-push messaging is still accurate
6. Decide whether to ship the experimental Lists push enabled by default

## Roadmap Recommendation

Canonical queue: [docs/backlog.md](backlog.md). v1 is persist + review inbox + sticky filings + wine-list Markdown. Lists and the browser extension are not the launch demo.

## Setup Steps For GitHub Publication

Already done: `main` and `feature/open-source-ready-organizer` are on the remote; PR #1 is open; tag `v0.1.0` points at the feature tip.

Still to do:

1. Merge PR #1 after a manual UI pass
2. Confirm release notes still call out experimental direct push
