# GitHub Stars Organizer

Fetch your starred repositories in the browser, file the ones you have not sorted, and download JSON or Markdown. The token stays in the tab. Pushing a subset to a GitHub List is optional and may fail.

No account, no backend, and no `npm install`.

## Run

```bash
npm test
npm run start
```

Open `http://localhost:4173/github_stars_organizer.html`.

The page loads ES modules, so open that URL. Opening the HTML file directly will not work.

## Token

Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) for your own account with **Starring: Read**. Paste it into the page. It stays in memory for that tab and is sent only to `api.github.com`. Refresh clears it.

Filings can remain in this browser. The token is never written there, and it is never included in an export.

If you need private starred repositories, grant the token access to those repositories.

## What it does

- Opens on the unfiled inbox. Filing a row shrinks the queue.
- Sorts with local rules you can read and extend.
- Keeps a manual move when the rules run again.
- Exports a Markdown list and a JSON reload file. Import `github-stars-organized.json` to load it again.
- Can try an experimental subset push to one GitHub List. Export still works when that call fails.

## Project

- [MIT license](./LICENSE)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
