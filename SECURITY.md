# Security Policy

## Supported Versions

This project is pre-`1.0`. Security fixes are applied on the latest development line rather than maintained release branches.

## Reporting a Vulnerability

Please do not open a public GitHub issue for security-sensitive reports.

Instead, report vulnerabilities privately to the maintainer through GitHub's private vulnerability reporting if it is enabled on the repository. If private reporting is not enabled yet, contact the maintainer directly before publishing details.

When reporting, include:

- A short description of the issue
- Steps to reproduce
- What data or capability is exposed
- Whether the issue involves tokens, exports, browser storage, or direct GitHub List push
- Any proof-of-concept details that help reproduction

## Scope

Security-sensitive areas in this project include:

- Fine-grained token handling in the browser session
- Exported JSON and Markdown content
- Direct push to GitHub Lists through undocumented endpoints
- Any future browser extension or automation-based GitHub integration

## Expectations

- The app should not store tokens persistently
- The app should not send user data anywhere except GitHub API requests initiated by the user
- Documentation should stay honest about undocumented or experimental GitHub behavior

## Disclosure

Please allow time for triage and a fix before public disclosure. Coordinated disclosure is strongly preferred.
