import test from "node:test";
import assert from "node:assert/strict";

import {
  addRepoToList,
  buildGitHubHeaders,
  createList,
  deleteList,
  describeGitHubError,
  fetchAllStars,
  fetchExistingLists,
  findListByName,
  findListForCategory,
  GITHUB_LIST_LIMIT,
  getNextPageUrl,
  getRateLimit,
  planShelfReplacement,
  setRepoLists,
  updateList,
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
  assert.equal(findListByName([{ id: 1, name: "🚀 Productivity" }], "Productivity"), null);
});

test("maps desk shelves onto existing GitHub Lists when the account is at the 32-list cap", () => {
  const lists = [
    { id: "a", name: "💻 🤖 Agentic Spec Driven Dev" },
    { id: "b", name: "Agentic AI" },
    { id: "c", name: "🚀 Productivity" },
    { id: "d", name: "💡 useful productivity" },
    { id: "e", name: "MCP Servers" },
    { id: "f", name: "🧬🦠 bio & health" },
    { id: "g", name: "🎨 design system" },
    { id: "h", name: "🎨 🖌️ code art" },
  ];
  assert.equal(findListForCategory(lists, { id: "productivity", name: "Productivity" }).id, "c");
  assert.equal(findListForCategory(lists, { id: "ai-agents", name: "AI Agents & Automation" }).id, "b");
  assert.equal(findListForCategory(lists, { id: "science-research", name: "Science & Research" }).id, "f");
  assert.equal(findListForCategory(lists, { id: "design-creative", name: "Design & Creative" }).id, "g");
  assert.equal(findListForCategory(lists, { id: "web-apps", name: "Web & App Development" }), null);
});

test("at the 32-list cap, shelf replacement renames onto desk names and deletes leftovers", () => {
  const lists = Array.from({ length: GITHUB_LIST_LIMIT }, (_, index) => ({
    id: `UL_${index}`,
    name: index === 0 ? "🚀 Productivity" : index === 5 ? "🦄 vibecoding" : `Shelf ${index}`,
    itemIds: [],
  }));
  const categories = [
    { id: "productivity", name: "Productivity", isDefault: false },
    { id: "web-apps", name: "Web & App Development", isDefault: false },
    { id: "uncategorized", name: "Uncategorized", isDefault: true },
  ];
  const plan = planShelfReplacement(lists, categories);
  assert.equal(plan.atCap, true);
  assert.equal(plan.create.length, 0);
  assert.equal(plan.rename.length, 2);
  assert.equal(plan.remove.length, 30);
  assert.equal(plan.rename[0].name, "Productivity");
  assert.equal(plan.rename[0].list.id, "UL_0");
  assert.equal(plan.rename[0].action, "rename");
  assert.equal(plan.rename[1].name, "Web & App Development");
  assert.equal(plan.rename[1].list.id, "UL_5");
  assert.ok(plan.remove.every((list) => list.id !== "UL_0" && list.id !== "UL_5"));
});

test("near the 32-list cap, shelf replacement rewrites unused lists instead of creating a 33rd", () => {
  const lists = Array.from({ length: GITHUB_LIST_LIMIT - 1 }, (_, index) => ({
    id: `UL_${index}`,
    name: `Shelf ${index}`,
    itemIds: [],
  }));
  const categories = [
    { id: "web-apps", name: "Web & App Development" },
    { id: "data-analytics", name: "Data & Analytics" },
  ];
  const plan = planShelfReplacement(lists, categories);
  assert.equal(plan.create.length, 1);
  assert.equal(plan.rename.length, 1);
  assert.equal(lists.length + plan.create.length, GITHUB_LIST_LIMIT);
  assert.ok(plan.remove.length > 0);
});

test("under the 32-list cap, shelf replacement creates missing names and deletes unused leftovers", () => {
  const lists = [
    { id: "UL_keep", name: "Productivity", itemIds: [] },
    { id: "UL_extra", name: "SriLanka", itemIds: [] },
  ];
  const categories = [
    { id: "productivity", name: "Productivity" },
    { id: "web-apps", name: "Web & App Development" },
    { id: "uncategorized", name: "Uncategorized", isDefault: true },
  ];
  const plan = planShelfReplacement(lists, categories);
  assert.equal(plan.atCap, false);
  assert.equal(plan.rename.length, 1);
  assert.equal(plan.rename[0].action, "keep");
  assert.equal(plan.create.length, 1);
  assert.equal(plan.create[0].name, "Web & App Development");
  assert.equal(plan.remove.length, 1);
  assert.equal(plan.remove[0].id, "UL_extra");
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

test("updates and deletes GitHub Lists over GraphQL", async () => {
  const calls = [];
  const fetcher = graphqlFetcher(async (body) => {
    calls.push(body.query.includes("DeleteUserList") ? "delete" : "update");
    if (body.query.includes("DeleteUserList")) {
      assert.equal(body.variables.listId, "UL_old");
      return { data: { deleteUserList: { clientMutationId: null } } };
    }
    assert.equal(body.variables.name, "AI & ML");
    return { data: { updateUserList: { list: { id: "UL_1", name: "AI & ML", description: "Models", isPrivate: false } } } };
  });

  const updated = await updateList("ghp_abcdefghijklmnopqrstuvwxyz1234567890", { id: "UL_1", name: "AI & ML", description: "Models" }, { fetcher });
  assert.equal(updated.name, "AI & ML");
  const deleted = await deleteList("ghp_abcdefghijklmnopqrstuvwxyz1234567890", "UL_old", { fetcher });
  assert.equal(deleted.id, "UL_old");
  assert.deepEqual(calls, ["update", "delete"]);
});

test("replaces a repository's list membership instead of merging", async () => {
  const lists = [
    { id: "UL_keep", name: "Keep", itemIds: ["R_repo"] },
    { id: "UL_ai", name: "AI & ML", itemIds: [] },
  ];
  let sent;
  const fetcher = graphqlFetcher(async (body) => {
    sent = body.variables;
    return { data: { updateUserListsForItem: { lists: [{ id: "UL_ai" }] } } };
  });

  const result = await setRepoLists(
    "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
    "R_repo",
    ["UL_ai"],
    { fetcher, lists },
  );

  assert.deepEqual(sent.listIds, ["UL_ai"]);
  assert.equal(result.already, undefined);
  assert.deepEqual(lists[0].itemIds, []);
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
