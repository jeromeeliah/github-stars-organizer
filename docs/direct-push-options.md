# Direct Push Options

## Purpose

How GitHub Stars Organizer moves categorized repositories onto GitHub Lists, what works today, and what to tell open-source users.

## Current Recommendation

1. Fetch stars with REST `GET /user/starred` (fine-grained **Starring: Read** is enough).
2. File locally. JSON/Markdown exports always work.
3. Optional Lists write uses **GraphQL**, not REST `/user/lists` (that path 404s).
4. Probe `viewer { lists }` first. If it works, allow subset push and last-resort shelf replace.
5. Create lists **private**. Subset push reuses a list by exact name and **merges** membership. **Replace GitHub Lists with these shelves** names lists after the desk, re-files stars onto those shelves only, and **deletes leftovers after confirm**. At the 32-list cap it rewrites existing lists instead of creating a 33rd.
6. If GraphQL writes fail (usually missing `user` scope), fall back to exports.
7. A browser extension on `github.com` remains the long-term fallback if GraphQL is blocked for an account. Playwright is maintainer-only.

## Option 1: GraphQL Lists (shipped)

Implemented in [`src/githubApi.js`](../src/githubApi.js):

- `viewer { lists { items } }` — `fetchExistingLists`
- `createUserList` — `createList` (`isPrivate: true` unless the caller overrides)
- `updateUserList` — `updateList` (rename; keep current visibility)
- `deleteUserList` — `deleteList` (leftovers after a confirmed replace)
- `updateUserListsForItem` — `addRepoToList` (merge) and `setRepoLists` (replace)

Official reference: [GraphQL `createUserList`](https://docs.github.com/en/graphql/reference/mutations#createuserlist), [`updateUserList`](https://docs.github.com/en/graphql/reference/mutations#updateuserlist), [`deleteUserList`](https://docs.github.com/en/graphql/reference/mutations#deleteuserlist), and [`updateUserListsForItem`](https://docs.github.com/en/graphql/reference/mutations#updateuserlistsforitem).

`updateUserListsForItem` **replaces** the repo's full list membership. Subset push therefore loads current membership from `viewer.lists` items, then resubmits the merged id set. Desk replace submits only the matching shelf.

### Token

| Job | Token |
| --- | --- |
| Fetch stars | Fine-grained PAT, **Starring: Read** |
| Unstar / restar | Fine-grained **Starring: write**, or classic **`public_repo`** |
| Read/write Lists | Classic PAT with the **`user`** scope |
| Private starred repos | Classic **`repo`** as well |

Fine-grained **Starring: Read** cannot currently create Lists.

### Product Position

This is the default Lists path. Label the `user` scope in the UI. Exports must still work when writes are denied.

## Option 2: Browser Extension Fallback

Automate GitHub's native Stars UI from an extension, using the logged-in session. Use if GraphQL `user` is unacceptable for a given account. Not shipped.

## Option 3: Playwright or Chrome Automation

Maintainer-only. Not an end-user flow.

## Official GitHub Documentation Status

As of 8 Oct 2026:

- Stars UI / Lists preview: `https://docs.github.com/get-started/exploring-projects-on-github/saving-repositories-with-stars`
- REST starring (read): `https://docs.github.com/en/rest/activity/starring`
- GraphQL list mutations: `https://docs.github.com/en/graphql/reference/mutations#createuserlist`
- REST `GET /user/lists` still 404s

## Open-Source Copy

> Fetch needs **Starring: Read**. Unstar needs **Starring: write** or classic **`public_repo`**. Optional Lists push uses GraphQL (not REST `/user/lists`) and a classic PAT with the **user** scope. New lists are private. At 32 lists, replace existing Lists with the desk shelves after confirm. If GitHub denies the write, export JSON or Markdown and file in the Stars UI.
