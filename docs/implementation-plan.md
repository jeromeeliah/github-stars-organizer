# Open Source Organizer Implementation Plan

## Goal

Make the prototype suitable for an open-source release by turning it into a local-first GitHub stars review tool with tested categorization logic, manual taxonomy controls, safe exports, and cautious experimental GitHub Lists sync.

## Architecture

The app stays browser-only and dependency-light. Pure behavior lives in modules that can be tested with Node's built-in test runner, while the HTML file only provides layout and styling.

## Increments

1. Establish git baseline and feature branch.
2. Extract categorization and export logic into `src/organizer.js`.
3. Add tests for token validation, tokenized matching, custom categories, grouped results, and minimized exports.
4. Add `src/githubApi.js` as the only GitHub API boundary with pagination and rate-limit metadata.
5. Rebuild the UI around review, manual category additions, repo moves, taxonomy import/export, and guarded Lists sync.
6. Add README documentation for local use, privacy posture, architecture, and open-source positioning.
7. Run automated tests and browser verification before merging.

## Category Model

Default categories represent primary buckets:

- AI & ML
- AI Agents & Automation
- Developer Tools
- Web & App Development
- Data & Analytics
- Infrastructure & DevOps
- Security & Privacy
- Databases & Storage
- Languages & Frameworks
- Learning & Reference
- Design & Creative
- Business & Finance
- Science & Research
- Productivity
- Read Later
- Uncategorized

Future facets should stay separate from primary categories: language, platform, intent, maturity, license, archived status, and recent activity.

## Review Gates

Each implementation increment should have:

- A failing test before new behavior where practical
- Fresh `npm test` verification
- Separate agent review before commit
- A focused commit message
