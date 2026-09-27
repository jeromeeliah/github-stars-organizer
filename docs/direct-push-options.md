# Direct Push Options

## Purpose

This document explains how GitHub Stars Organizer can move categorized repositories into GitHub Lists, what is technically possible today, and which path the project should recommend for an open-source release.

## Current Recommendation

Use this order of operations:

1. Try the undocumented GitHub Lists endpoint from the app.
2. If it works for the current account, allow direct push from the browser app.
3. If it does not work, fall back to exports.
4. For a stronger long-term direct-push story, build a browser extension that automates GitHub's native UI while using the user's logged-in session.
5. Treat Playwright or Codex Chrome automation as a maintainer-only migration tool, not the primary product flow.

## Option 1: Undocumented GitHub Lists Endpoint

The app currently attempts direct push through the endpoints in [`src/githubApi.js`](../src/githubApi.js):

- `GET /user/lists`
- `POST /user/lists`
- `POST /user/lists/{id}/items`

### Benefits

- Fastest and cleanest user experience
- Works entirely inside the browser app
- Supports category-level push and selected-subset push

### Risks

- GitHub does not document these endpoints as a stable public Lists API
- Permission requirements are not officially documented
- Behavior can change or disappear without notice

### Product Position

Keep this path enabled, but always label it as experimental and capability-checked.

## Option 2: Browser Extension Fallback

Build a GitHub browser extension that runs on `github.com`, reads a selected subset from the organizer, and uses the real GitHub Stars UI to add repositories to lists.

### Benefits

- Uses the user's existing authenticated GitHub session
- Depends on documented user-facing UI rather than an undocumented REST write contract
- More practical for open-source users than a Playwright setup

### Risks

- GitHub DOM changes can break the workflow
- Slower than a real API
- Requires installation and browser permissions

### Product Position

This is the best long-term fallback if direct push remains strategically important.

## Option 3: Playwright or Chrome Automation

Use Playwright or Chrome automation to open GitHub, navigate the Stars UI, and click list-management controls on behalf of the user.

### Benefits

- Can work even when the hidden API is unavailable
- Useful for one-off migrations or maintainer operations

### Risks

- Brittle and session-dependent
- Hard to package as a reliable end-user workflow
- More complex support burden for an open-source project

### Product Position

Do not make this the default product path. Keep it as an operator tool or debugging aid.

## Official GitHub Documentation Status

As of May 21, 2026:

- GitHub documents Lists through the Stars UI and labels them public preview:
  `https://docs.github.com/get-started/exploring-projects-on-github/saving-repositories-with-stars`
- GitHub documents reading starred repositories in the REST API and documents fine-grained token support for that read path:
  `https://docs.github.com/en/rest/activity/starring`
- GitHub does not document a stable public REST write API for GitHub Lists.

## Token Guidance

For reading stars, recommend a fine-grained personal access token:

1. Open `https://github.com/settings/personal-access-tokens/new`
2. Choose the user's account as the resource owner
3. Enable `Starring: Read` under user permissions
4. If private starred repositories should be included, allow repository access to the repositories that matter

Because GitHub does not document a stable Lists write API, there is no official permission recipe for direct list creation through the hidden endpoint.

## Open-Source Recommendation

For the public GitHub project, describe direct push like this:

> Direct push is best-effort. The app first checks whether GitHub's hidden Lists endpoint responds for your account. If it does, the app can push categories or selected subsets directly. If it does not, export Markdown or JSON and manage the lists manually through GitHub's native Stars UI.

If Lists write stays dead, the next product path is a browser extension on `github.com`, not Playwright.
