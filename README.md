# GitHub Stars Organizer

```
     +-----+-----+-----+-----+
     |  *  |  *  |  *  |     |
     | /|\ | /|\ | /|\ |     |
     +-----+-----+-----+-----+
     |  *  |     |  *  |  *  |
     | /|\ |     | /|\ | /|\ |
     +-----+-----+-----+-----+
     |     |  *  |  *  |  *  |
     |     | /|\ | /|\ | /|\ |
     +-----+-----+-----+-----+
```

Fetch your starred repositories in the browser, file the ones you have not sorted, and download JSON or Markdown. The token stays in the tab. Optional GitHub Lists push uses GraphQL and a classic PAT with the `user` scope.

![The review desk before a token is pasted](docs/desk.png)

```bash
npm test
npm run start
```

Open [http://localhost:4173/](http://localhost:4173/). There is no `npm install`. Do not open the HTML file directly; the page needs a local server for ES modules.

To fetch stars, create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) for your own account with **Starring: Read**. To also write GitHub Lists, use a [classic PAT with the `user` scope](https://github.com/settings/tokens/new?scopes=user&description=github-stars-organizer-lists) (add `repo` only if you star private repositories). Paste it into the page. It is sent only to `api.github.com` and is never written to this browser or to an export.

The desk opens on the unfiled inbox. Filing a row shrinks the queue. Manual moves survive a re-score. `j`/`k` move, `f` files the suggestion, `s` skips, `r` is Read Later, `u` undoes the last filing in this tab. JSON is the reload file. Markdown is the list you can share. Lists write is GraphQL only (REST `/user/lists` 404s). New lists are **private** and reused by name. At GitHub's 32-list cap, **Replace GitHub Lists with these shelves** renames existing lists to the desk names and deletes leftovers after confirm.
