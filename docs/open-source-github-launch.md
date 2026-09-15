# Open Source GitHub Launch Guide

## Goal

Prepare GitHub Stars Organizer to live as a maintainable open-source project on GitHub with clear positioning, contributor guidance, and a realistic roadmap.

## Recommended Positioning

Describe the project as:

> Fetch your GitHub stars in the browser, sort them with rules you can see and edit, and download Markdown/JSON — no account, token stays in RAM, GitHub Lists push is optional and may not work.

The longer cellar goal lives in [docs/cellar-goal.md](cellar-goal.md). Stay away from claiming fully reliable GitHub Lists automation, hosted sync, or AI-only categorization.

## Repository Setup

Before publishing the repository:

1. Choose the final GitHub repository name and short description.
2. Push the current branch history and open a pull request into `main`.
3. Enable GitHub Issues and Discussions.
4. Enable branch protection on `main`.
5. Add repository topics such as `github`, `stars`, `organizer`, `productivity`, `browser-app`, and `opensource`.
6. Add a social preview image once the UI has been visually verified.

## Minimum Project Surface

These files should exist before public launch:

- [README.md](/Users/jeromeeliah/Developer/tools/github-stars-organizer/README.md:1)
- [LICENSE](/Users/jeromeeliah/Developer/tools/github-stars-organizer/LICENSE:1)
- [CONTRIBUTING.md](/Users/jeromeeliah/Developer/tools/github-stars-organizer/CONTRIBUTING.md:1)
- [SECURITY.md](/Users/jeromeeliah/Developer/tools/github-stars-organizer/SECURITY.md:1)
- [docs/direct-push-options.md](/Users/jeromeeliah/Developer/tools/github-stars-organizer/docs/direct-push-options.md:1)
- [docs/implementation-plan.md](/Users/jeromeeliah/Developer/tools/github-stars-organizer/docs/implementation-plan.md:1)

## Suggested First GitHub Additions

Add these after the initial public push:

1. Issue templates:
   `bug report`, `feature request`, `direct push compatibility report`
2. Pull request template:
   summary, testing, token/privacy impact, GitHub Lists impact
3. `SECURITY.md`:
   how to report vulnerabilities, especially anything involving tokens
4. `CHANGELOG.md`:
   keep release notes crisp from the first public version onward

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

Once the repository exists on GitHub:

1. Push `main`
2. Push `feature/open-source-ready-organizer`
3. Open a pull request
4. Merge after manual UI verification
5. Tag the first release, for example `v0.1.0`
6. Publish release notes that clearly call out experimental direct push
