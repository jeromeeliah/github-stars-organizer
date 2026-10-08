import test from "node:test";
import assert from "node:assert/strict";

import {
  addRepoToList,
  buildGitHubHeaders,
  createList,
  describeGitHubError,
  fetchAllStars,
  fetchExistingLists,
  findListByName,
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

test("describes 401, 403, and 429 without dumping raw GitHub JSON", () => {
  assert.match(describeGitHubError({ status: 401, message: "Bad credentials" }), /token/i);
  assert.match(describeGitHubError({ status: 429, rateLimit: { reset: 1770000000 } }), /429/);
  assert.match(describeGitHubError({ status: 403, message: "forbidden" }), /403/);
});

test("reuses an existing GitHub List by name", () => {
  const existing = { id: 9, name: "Read Later" };
  assert.equal(findListByName([existing], "read later"), existing);
  assert.equal(findListByName([existing], "New Shelf"), null);
});

test("describes GraphQL list writes that lack the user scope", () => {
  assert.match(
    describeGitHubError({ graphqlType: "INSUFFICIENT_SCOPES", message: "Your token has not been granted the required scopes" }),
    /user scope/i,
  );
  assert.match(
    describeGitHubError({ message: "cannot have more than 32 lists" }),
    /32 Lists/i,
  );
});

function graphqlFetcher(handler) {
  return async (url, init = {}) => {
    assert.equal(url, "https://api.github.com/graphql");
    assert.equal(init.method, "POST");
    const body = JSON.parse(init.body);
    const payload = await handler(body);
    return {
      ok: true,
      status: 200,
      headers: new Map([["x-ratelimit-remaining", "4990"]]),
      json: async () => payload,
    };
  };
}

test("lists GitHub user lists over GraphQL, including extra item pages", async () => {
  const calls = [];
  const fetcher = graphqlFetcher(async (body) => {
    calls.push(body.query.includes("UserListItems") ? "items" : "viewer");
    if (body.query.includes("UserListItems")) {
      return {
        data: {
          node: {
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [{ id: "R_2", databaseId: 2, nameWithOwner: "owner/two" }],
            },
          },
        },
      };
    }
    return {
      data: {
        viewer: {
          lists: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [{
              id: "UL_1",
              name: "AI & ML",
              description: "Models",
              isPrivate: true,
              items: {
                pageInfo: { hasNextPage: true, endCursor: "c1" },
                nodes: [{ id: "R_1", databaseId: 1, nameWithOwner: "owner/one" }],
              },
            }],
          },
        },
      },
    };
  });

  const lists = await fetchExistingLists("ghp_abcdefghijklmnopqrstuvwxyz1234567890", { fetcher });
  assert.equal(calls.join(","), "viewer,items");
  assert.equal(lists[0].id, "UL_1");
  assert.deepEqual(lists[0].itemIds, ["R_1", "R_2"]);
});

test("creates a private GitHub List over GraphQL", async () => {
  const fetcher = graphqlFetcher(async (body) => {
    assert.match(body.query, /createUserList/);
    assert.equal(body.variables.isPrivate, true);
    assert.equal(body.variables.name, "AI & ML");
    return { data: { createUserList: { list: { id: "UL_new", name: "AI & ML", description: "Models", isPrivate: true } } } };
  });

  const list = await createList("ghp_abcdefghijklmnopqrstuvwxyz1234567890", { name: "AI & ML", description: "Models" }, { fetcher });
  assert.equal(list.id, "UL_new");
  assert.equal(list.isPrivate, true);
  assert.deepEqual(list.itemIds, []);
});

test("adds a repository to a list without dropping its other memberships", async () => {
  const lists = [
    { id: "UL_keep", name: "Keep", itemIds: ["R_repo"] },
    { id: "UL_ai", name: "AI & ML", itemIds: [] },
  ];
  let sent;
  const fetcher = graphqlFetcher(async (body) => {
    sent = body.variables;
    return { data: { updateUserListsForItem: { lists: [{ id: "UL_keep" }, { id: "UL_ai" }] } } };
  });

  const result = await addRepoToList(
    "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
    "UL_ai",
    { node_id: "R_repo", full_name: "owner/repo", name: "repo", owner: { login: "owner" } },
    { fetcher, lists },
  );

  assert.deepEqual(sent.listIds.sort(), ["UL_ai", "UL_keep"]);
  assert.equal(result.already, undefined);
  assert.ok(lists[1].itemIds.includes("R_repo"));
});

test("skips a GraphQL membership write when the repo is already on the list", async () => {
  let called = 0;
  const fetcher = graphqlFetcher(async () => {
    called += 1;
    return { data: {} };
  });
  const lists = [{ id: "UL_ai", name: "AI & ML", itemIds: ["R_repo"] }];
  const result = await addRepoToList(
    "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
    "UL_ai",
    "R_repo",
    { fetcher, lists },
  );
  assert.equal(result.already, true);
  assert.equal(called, 0);
});

test("surfaces GraphQL insufficient scope errors without dumping the token", async () => {
  const fetcher = graphqlFetcher(async () => ({
    errors: [{ type: "INSUFFICIENT_SCOPES", message: "Your token has not been granted the required scopes to execute this query." }],
  }));

  await assert.rejects(
    () => fetchExistingLists("ghp_abcdefghijklmnopqrstuvwxyz1234567890", { fetcher }),
    (error) => {
      assert.equal(error.graphqlType, "INSUFFICIENT_SCOPES");
      assert.equal(error.status, 403);
      assert.equal(error.message.includes("ghp_"), false);
      return true;
    },
  );
});
