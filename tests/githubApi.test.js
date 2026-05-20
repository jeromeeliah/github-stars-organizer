import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGitHubHeaders,
  fetchAllStars,
  getNextPageUrl,
  getRateLimit,
} from "../src/githubApi.js";

test("builds least-surprise GitHub headers without persisting token data", () => {
  assert.deepEqual(buildGitHubHeaders("github_pat_example"), {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer github_pat_example",
    "X-GitHub-Api-Version": "2022-11-28",
  });
});

test("parses next pagination link", () => {
  const link = '<https://api.github.com/user/starred?page=2>; rel="next", <https://api.github.com/user/starred?page=5>; rel="last"';

  assert.equal(getNextPageUrl(link), "https://api.github.com/user/starred?page=2");
  assert.equal(getNextPageUrl(""), null);
});

test("reads rate limit response headers", () => {
  const response = {
    headers: new Map([
      ["x-ratelimit-limit", "5000"],
      ["x-ratelimit-remaining", "4999"],
      ["x-ratelimit-reset", "1770000000"],
    ]),
  };

  assert.deepEqual(getRateLimit(response), {
    limit: 5000,
    remaining: 4999,
    reset: 1770000000,
  });
});

test("fetches all stars using Link pagination and progress callbacks", async () => {
  const calls = [];
  const progress = [];
  const fetcher = async (url) => {
    calls.push(url);

    if (calls.length === 1) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["link", '<https://api.github.com/user/starred?page=2&per_page=100>; rel="next"'],
          ["x-ratelimit-remaining", "4999"],
        ]),
        json: async () => [{ id: 1 }],
      };
    }

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Map([["x-ratelimit-remaining", "4998"]]),
      json: async () => [{ id: 2 }],
    };
  };

  const repos = await fetchAllStars("ghp_abcdefghijklmnopqrstuvwxyz1234567890", {
    fetcher,
    onProgress: (event) => progress.push(event),
  });

  assert.deepEqual(repos.map((item) => item.id), [1, 2]);
  assert.equal(calls.length, 2);
  assert.equal(progress.at(-1).count, 2);
  assert.equal(progress.at(-1).rateLimit.remaining, 4998);
});

test("surfaces GitHub API error status and message", async () => {
  const fetcher = async () => ({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
    headers: new Map(),
    json: async () => ({ message: "Bad credentials" }),
  });

  await assert.rejects(
    () => fetchAllStars("ghp_abcdefghijklmnopqrstuvwxyz1234567890", { fetcher }),
    /GitHub API error 401: Bad credentials/,
  );
});
