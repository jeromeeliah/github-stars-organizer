const GITHUB_API_ROOT = "https://api.github.com";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const GITHUB_API_VERSION = "2022-11-28";
const LIST_NAME_MAX = 32;
const LIST_DESCRIPTION_MAX = 300;

const VIEWER_LISTS_QUERY = `
  query ViewerLists($after: String) {
    viewer {
      lists(first: 20, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          name
          description
          isPrivate
          items(first: 100) {
            pageInfo { hasNextPage endCursor }
            nodes { ... on Repository { id databaseId nameWithOwner } }
          }
        }
      }
    }
  }
`;

const LIST_ITEMS_QUERY = `
  query UserListItems($id: ID!, $after: String) {
    node(id: $id) {
      ... on UserList {
        items(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { ... on Repository { id databaseId nameWithOwner } }
        }
      }
    }
  }
`;

const REPOSITORY_ID_QUERY = `
  query RepositoryId($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) { id }
  }
`;

const CREATE_LIST_MUTATION = `
  mutation CreateUserList($name: String!, $description: String, $isPrivate: Boolean) {
    createUserList(input: { name: $name, description: $description, isPrivate: $isPrivate }) {
      list { id name description isPrivate }
    }
  }
`;

const UPDATE_LISTS_FOR_ITEM_MUTATION = `
  mutation UpdateUserListsForItem($itemId: ID!, $listIds: [ID!]!) {
    updateUserListsForItem(input: { itemId: $itemId, listIds: $listIds }) {
      lists { id name }
    }
  }
`;

export function buildGitHubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

export async function fetchAllStars(token, options = {}) {
  const fetcher = options.fetcher || globalThis.fetch;
  if (!fetcher) {
    throw new Error("No fetch implementation is available.");
  }

  const repos = [];
  let url = `${GITHUB_API_ROOT}/user/starred?per_page=100`;

  while (url) {
    const response = await fetcher(url, {
      headers: buildGitHubHeaders(token),
    });

    if (!response.ok) {
      throw await createGitHubError(response);
    }

    const page = await response.json();
    repos.push(...page);

    options.onProgress?.({
      count: repos.length,
      rateLimit: getRateLimit(response),
    });

    url = getNextPageUrl(getHeader(response.headers, "link"));
  }

  return repos;
}

export async function fetchExistingLists(token, options = {}) {
  const lists = [];
  let after = null;

  do {
    const data = await graphqlRequest(token, VIEWER_LISTS_QUERY, { after }, options);
    const connection = data.viewer?.lists;
    for (const node of connection?.nodes || []) {
      lists.push(await hydrateViewerList(token, node, options));
    }
    after = connection?.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);

  return lists;
}

export async function createList(token, payload = {}, options = {}) {
  const name = clip(payload.name, LIST_NAME_MAX);
  if (!name) {
    throw Object.assign(new Error("Name the GitHub List before creating it."), { status: 400 });
  }

  const data = await graphqlRequest(token, CREATE_LIST_MUTATION, {
    name,
    description: clip(payload.description, LIST_DESCRIPTION_MAX) || null,
    isPrivate: payload.isPrivate !== false,
  }, options);

  const list = data.createUserList?.list;
  if (!list?.id) {
    throw Object.assign(new Error("GitHub did not return the new list."), { status: 502 });
  }

  return { ...serializeList(list), itemIds: [] };
}

export async function addRepoToList(token, listId, repo, options = {}) {
  const itemId = await resolveRepoGraphQLId(token, repo, options);
  const lists = options.lists || await fetchExistingLists(token, options);
  const current = lists
    .filter((list) => (list.itemIds || []).includes(itemId))
    .map((list) => list.id);

  if (current.includes(listId)) {
    return { id: listId, itemId, already: true };
  }

  const listIds = [...current, listId];
  await graphqlRequest(token, UPDATE_LISTS_FOR_ITEM_MUTATION, { itemId, listIds }, options);

  const target = lists.find((list) => list.id === listId);
  if (target) {
    target.itemIds = [...new Set([...(target.itemIds || []), itemId])];
  }

  return { id: listId, itemId, listIds };
}

export async function resolveRepoGraphQLId(token, repo, options = {}) {
  if (typeof repo === "string" && repo.startsWith("R_")) return repo;
  if (repo?.node_id && String(repo.node_id).startsWith("R_")) return String(repo.node_id);

  const owner = repo?.owner?.login || String(repo?.full_name || repo?.nameWithOwner || "").split("/")[0];
  const name = repo?.name || String(repo?.full_name || repo?.nameWithOwner || "").split("/")[1];
  if (!owner || !name) {
    throw Object.assign(new Error("Cannot resolve a GitHub GraphQL id without owner/name or node_id."), { status: 400 });
  }

  const data = await graphqlRequest(token, REPOSITORY_ID_QUERY, { owner, name }, options);
  if (!data.repository?.id) {
    throw Object.assign(new Error(`GitHub has no GraphQL id for ${owner}/${name}.`), { status: 404 });
  }
  return data.repository.id;
}

export function getNextPageUrl(linkHeader) {
  if (!linkHeader) return null;

  for (const part of String(linkHeader).split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match?.[2] === "next") return match[1];
  }

  return null;
}

export function getRateLimit(response) {
  return {
    limit: numberHeader(response.headers, "x-ratelimit-limit"),
    remaining: numberHeader(response.headers, "x-ratelimit-remaining"),
    reset: numberHeader(response.headers, "x-ratelimit-reset"),
  };
}

async function graphqlRequest(token, query, variables = {}, options = {}) {
  const fetcher = options.fetcher || globalThis.fetch;
  if (!fetcher) {
    throw new Error("No fetch implementation is available.");
  }

  const response = await fetcher(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      ...buildGitHubHeaders(token),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const rateLimit = getRateLimit(response);
  if (!response.ok) {
    throw await createGitHubError(response, "GitHub GraphQL request failed");
  }

  const payload = await response.json();
  const firstError = payload.errors?.[0];
  if (firstError) {
    const error = new Error(firstError.message || "GitHub GraphQL error");
    error.status = firstError.type === "INSUFFICIENT_SCOPES" ? 403 : 400;
    error.graphqlType = firstError.type || "";
    error.rateLimit = rateLimit;
    throw error;
  }

  return payload.data || {};
}

async function hydrateViewerList(token, node, options) {
  const list = serializeList(node);
  const itemIds = repositoryIds(node.items?.nodes);
  let after = node.items?.pageInfo?.hasNextPage ? node.items.pageInfo.endCursor : null;

  while (after) {
    const data = await graphqlRequest(token, LIST_ITEMS_QUERY, { id: list.id, after }, options);
    const connection = data.node?.items;
    itemIds.push(...repositoryIds(connection?.nodes));
    after = connection?.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null;
  }

  list.itemIds = [...new Set(itemIds)];
  return list;
}

function serializeList(list) {
  return {
    id: list.id,
    name: list.name || "",
    description: list.description || "",
    isPrivate: Boolean(list.isPrivate),
    itemIds: [...(list.itemIds || [])],
  };
}

function repositoryIds(nodes = []) {
  return (nodes || []).map((node) => node?.id).filter(Boolean);
}

function clip(value, max) {
  const text = String(value || "").trim();
  return text.length <= max ? text : text.slice(0, max);
}

export function describeGitHubError(error, rateLimit = {}) {
  const status = error?.status || Number(String(error?.message || "").match(/\b(401|403|429)\b/)?.[1]);
  const reset = formatRateLimitReset(rateLimit.reset ?? error?.rateLimit?.reset);
  const graphqlType = error?.graphqlType || "";
  const message = String(error?.message || "");

  if (graphqlType === "INSUFFICIENT_SCOPES" || /insufficient_scopes|user scope/i.test(message)) {
    return "GitHub Lists write needs a classic PAT with the user scope. Fine-grained Starring: Read can fetch stars, not create lists. Exports still work.";
  }
  if (status === 401) {
    return "GitHub rejected the token (401). Check that it is a current PAT and that Starring: Read is enabled.";
  }
  if (status === 403) {
    return reset
      ? `GitHub forbade this request (403). If this is a rate limit, it resets ${reset}.`
      : "GitHub forbade this request (403). Confirm token permissions, or wait if you hit a secondary rate limit.";
  }
  if (status === 429) {
    return reset
      ? `GitHub rate-limited this request (429). Try again ${reset}.`
      : "GitHub rate-limited this request (429). Wait and retry.";
  }
  return error?.message || "GitHub request failed.";
}

export function findListByName(lists, name) {
  const wanted = String(name || "").trim().toLowerCase();
  if (!wanted) return null;
  return (lists || []).find((list) => String(list?.name || "").trim().toLowerCase() === wanted) || null;
}

function formatRateLimitReset(reset) {
  if (!reset) return "";
  const date = new Date(Number(reset) * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return `at ${date.toLocaleTimeString()}`;
}

async function createGitHubError(response, fallbackMessage = "GitHub API error") {
  const data = await response.json().catch(() => ({}));
  const message = data.message || response.statusText || fallbackMessage;
  const error = new Error(`${fallbackMessage} ${response.status}: ${message}`);
  error.status = response.status;
  error.rateLimit = getRateLimit(response);
  return error;
}

function numberHeader(headers, name) {
  const value = getHeader(headers, name);
  return value === null ? null : Number(value);
}

function getHeader(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  return headers.get?.(name) || headers[name] || headers[name.toLowerCase()] || null;
}
