const GITHUB_API_ROOT = "https://api.github.com";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const GITHUB_API_VERSION = "2022-11-28";
const LIST_NAME_MAX = 32;
const LIST_DESCRIPTION_MAX = 300;
export const GITHUB_LIST_LIMIT = 32;

const LIST_PUSH_ALIASES = {
  "ai-ml": ["local ai", "llm", "huggingface"],
  "ai-agents": ["agentic ai", "agentic", "ai workflow", "mcp servers", "n8n", "agent"],
  "developer-tools": ["tools & plugins", "tools", "plugins", "devtools"],
  "web-apps": ["vibecoding", "web", "frontend"],
  "data-analytics": ["datasets", "scrapers", "analytics"],
  "infra-devops": ["home automation", "devops", "infra"],
  "security-privacy": ["darkhat", "security", "privacy"],
  "databases-storage": ["jurisdictional", "database", "storage"],
  "languages-frameworks": ["rust", "language", "framework"],
  "learning-reference": ["learning", "inspiration", "tutorial", "course"],
  "design-creative": ["design system", "comfyui", "code art", "3d", "vector", "gsap", "design"],
  "business-finance": ["technical analysis", "tax", "trading", "finance"],
  "science-research": ["bio", "health", "science"],
  "productivity": ["productivity", "shortcuts"],
  "read-later": ["lookn into", "tbc", "ideas", "later"],
};

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

const UPDATE_LIST_MUTATION = `
  mutation UpdateUserList($listId: ID!, $name: String, $description: String) {
    updateUserList(input: { listId: $listId, name: $name, description: $description }) {
      list { id name description isPrivate }
    }
  }
`;

const DELETE_LIST_MUTATION = `
  mutation DeleteUserList($listId: ID!) {
    deleteUserList(input: { listId: $listId }) {
      clientMutationId
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

export function starringRepoPath(repo) {
  const owner = String(repo?.owner?.login || String(repo?.full_name || repo?.nameWithOwner || "").split("/")[0] || "").trim();
  const name = String(repo?.name || String(repo?.full_name || repo?.nameWithOwner || "").split("/")[1] || "").trim();
  if (!owner || !name) {
    throw Object.assign(new Error("Cannot star or unstar without owner/name."), { status: 400 });
  }
  return { owner, name };
}

async function requestStarred(token, method, repo, options = {}) {
  const fetcher = options.fetcher || globalThis.fetch;
  if (!fetcher) {
    throw new Error("No fetch implementation is available.");
  }

  const { owner, name } = starringRepoPath(repo);
  const isPut = method === "PUT";
  const response = await fetcher(
    `${GITHUB_API_ROOT}/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    {
      method,
      headers: {
        ...buildGitHubHeaders(token),
        ...(isPut ? { "Content-Length": "0" } : {}),
      },
      ...(isPut ? { body: "" } : {}),
    },
  );
  return { owner, name, response };
}

async function throwStarringError(response) {
  const error = await createGitHubError(response);
  error.operation = "starring";
  throw error;
}

export async function unstarRepo(token, repo, options = {}) {
  const { owner, name, response } = await requestStarred(token, "DELETE", repo, options);
  if (response.status === 204 || response.status === 404) {
    return { owner, name, already: response.status === 404 };
  }
  await throwStarringError(response);
}

export async function starRepo(token, repo, options = {}) {
  const { owner, name, response } = await requestStarred(token, "PUT", repo, options);
  if (response.status === 204 || response.status === 304) {
    return { owner, name };
  }
  await throwStarringError(response);
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

export async function updateList(token, payload = {}, options = {}) {
  const listId = payload.id || payload.listId;
  if (!listId) {
    throw Object.assign(new Error("updateUserList needs a list id."), { status: 400 });
  }

  const variables = { listId };
  if (payload.name !== undefined) variables.name = clip(payload.name, LIST_NAME_MAX);
  if (payload.description !== undefined) variables.description = clip(payload.description, LIST_DESCRIPTION_MAX) || null;

  const data = await graphqlRequest(token, UPDATE_LIST_MUTATION, variables, options);
  const list = data.updateUserList?.list;
  if (!list?.id) {
    throw Object.assign(new Error("GitHub did not return the updated list."), { status: 502 });
  }
  return serializeList(list);
}

export async function deleteList(token, listId, options = {}) {
  const id = typeof listId === "string" ? listId : listId?.id;
  if (!id) {
    throw Object.assign(new Error("deleteUserList needs a list id."), { status: 400 });
  }
  await graphqlRequest(token, DELETE_LIST_MUTATION, { listId: id }, options);
  return { id };
}

export async function setRepoLists(token, repo, listIds, options = {}) {
  const itemId = await resolveRepoGraphQLId(token, repo, options);
  const wanted = [...new Set((listIds || []).filter(Boolean))];
  const lists = options.lists || await fetchExistingLists(token, options);
  const current = lists
    .filter((list) => (list.itemIds || []).includes(itemId))
    .map((list) => list.id);
  const same = current.length === wanted.length && wanted.every((id) => current.includes(id));
  if (same) {
    return { itemId, listIds: wanted, already: true };
  }

  await graphqlRequest(token, UPDATE_LISTS_FOR_ITEM_MUTATION, { itemId, listIds: wanted }, options);

  for (const list of lists) {
    const ids = new Set(list.itemIds || []);
    if (wanted.includes(list.id)) ids.add(itemId);
    else ids.delete(itemId);
    list.itemIds = [...ids];
  }

  return { itemId, listIds: wanted };
}

export async function addRepoToList(token, listId, repo, options = {}) {
  if (options.replace) {
    const result = await setRepoLists(token, repo, [listId], options);
    return { id: listId, ...result };
  }

  const itemId = await resolveRepoGraphQLId(token, repo, options);
  const lists = options.lists || await fetchExistingLists(token, options);
  const current = lists
    .filter((list) => (list.itemIds || []).includes(itemId))
    .map((list) => list.id);

  if (current.includes(listId)) {
    return { id: listId, itemId, already: true };
  }

  const result = await setRepoLists(token, repo, [...current, listId], { ...options, lists });
  return { id: listId, ...result };
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

function listItemCount(list) {
  return (list?.itemIds || []).length;
}

function isRetryableWriteError(error) {
  if (error?.graphqlType === "INSUFFICIENT_SCOPES") return false;
  const status = error?.status;
  if (status === 429 || status === 502 || status === 503) return true;
  if (status === 403) return true;
  return /something went wrong while executing your query/i.test(String(error?.message || ""));
}

async function maybeDelay(options = {}) {
  const ms = Number(options.delayMs || 0);
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withWriteRetry(fn, options = {}) {
  const attempts = Number(options.retries || 5);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableWriteError(error) || attempt === attempts) throw error;
      const wait = Math.min(8000, 400 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}

export function describeGitHubError(error, rateLimit = {}) {
  const status = error?.status || Number(String(error?.message || "").match(/\b(401|403|429)\b/)?.[1]);
  const reset = formatRateLimitReset(rateLimit.reset ?? error?.rateLimit?.reset);
  const graphqlType = error?.graphqlType || "";
  const message = String(error?.message || "");

  if (graphqlType === "INSUFFICIENT_SCOPES" || /insufficient_scopes|user scope/i.test(message)) {
    return "GitHub Lists write needs a classic PAT with the user scope. Fine-grained Starring: Read can fetch stars, not create lists. Exports still work.";
  }
  if (/more than 32 lists/i.test(message)) {
    return "GitHub allows at most 32 Lists. Replace GitHub Lists with these shelves to rename existing lists and delete leftovers, or push a subset onto a list that already exists by name. Exports still work.";
  }
  if (status === 401) {
    return "GitHub rejected the token (401). Check that it is a current PAT and that Starring: Read is enabled.";
  }
  const remaining = rateLimit.remaining ?? error?.rateLimit?.remaining;
  if (error?.operation === "starring" && status === 403 && remaining !== 0) {
    return "Unstar needs Starring: write on a fine-grained token, or public_repo on a classic PAT (repo if you star private repositories). Fetch still works with Starring: Read.";
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

export function findListForCategory(lists, category = {}, options = {}) {
  const minScore = options.minScore ?? 55;
  const exact = findListByName(lists, category.name);
  if (exact) return exact;

  let best = null;
  let bestScore = 0;
  for (const list of lists || []) {
    const score = scoreListForCategory(list, category);
    if (score > bestScore) {
      best = list;
      bestScore = score;
    } else if (score === bestScore && score > 0 && best) {
      if (foldListName(list.name).length > foldListName(best.name).length) best = list;
    }
  }
  if (!best || bestScore < minScore) return null;
  return best;
}

export function resolveListForCategory(lists, category = {}, options = {}) {
  return findListForCategory(lists, category, options);
}

function claimList(assigned, rename, list, category, name, description) {
  assigned.add(list.id);
  rename.push({
    list,
    category,
    name,
    description,
    action: String(list.name || "").trim() === name ? "keep" : "rename",
  });
}

function sortUnusedLists(lists) {
  return lists.slice().sort((a, b) => listItemCount(a) - listItemCount(b) || String(a.id).localeCompare(String(b.id)));
}

export function planShelfReplacement(lists, categories = []) {
  const existing = [...(lists || [])];
  const shelves = (categories || []).filter((category) => !category.isDefault);
  const atCap = existing.length >= GITHUB_LIST_LIMIT;
  const assigned = new Set();
  const rename = [];
  const create = [];
  const unused = () => existing.filter((list) => !assigned.has(list.id));

  for (const category of shelves) {
    const name = clip(category.name, LIST_NAME_MAX);
    const description = clip(category.description, LIST_DESCRIPTION_MAX);
    const pool = unused();
    const exact = findListByName(pool, name);
    if (exact) {
      claimList(assigned, rename, exact, category, name, description);
      continue;
    }

    const closest = findListForCategory(pool, category, { minScore: atCap ? 40 : 55 });
    if (closest) {
      claimList(assigned, rename, closest, category, name, description);
      continue;
    }

    create.push({ category, name, description });
  }

  const room = Math.max(0, GITHUB_LIST_LIMIT - existing.length);
  while (create.length > room) {
    const leftover = sortUnusedLists(unused())[0];
    if (!leftover) break;
    const step = create.shift();
    claimList(assigned, rename, leftover, step.category, step.name, step.description);
  }

  if (existing.length + create.length > GITHUB_LIST_LIMIT) {
    throw Object.assign(new Error(`cannot have more than ${GITHUB_LIST_LIMIT} lists`), { status: 400 });
  }

  return {
    rename,
    create,
    remove: unused(),
    atCap,
    shelves: shelves.length,
  };
}

export async function replaceDeskShelves(token, input = {}, options = {}) {
  const lists = [...(input.lists || [])];
  const plan = planShelfReplacement(lists, input.categories || []);
  const byCategoryId = new Map();

  for (const step of plan.rename) {
    const current = lists.find((list) => list.id === step.list.id);
    if (!current) continue;
    if (step.action === "rename" || current.name !== step.name) {
      const updated = await updateList(token, {
        id: current.id,
        name: step.name,
        description: step.description,
      }, options);
      current.name = updated.name;
      current.description = updated.description;
    }
    byCategoryId.set(step.category.id, current);
    await maybeDelay(options);
    options.onProgress?.({ phase: "rename", name: step.name });
  }

  for (const step of plan.create) {
    if (lists.length >= GITHUB_LIST_LIMIT) {
      throw Object.assign(new Error(`cannot have more than ${GITHUB_LIST_LIMIT} lists`), { status: 400 });
    }
    const created = await createList(token, { name: step.name, description: step.description }, options);
    lists.push(created);
    byCategoryId.set(step.category.id, created);
    await maybeDelay(options);
    options.onProgress?.({ phase: "create", name: step.name });
  }

  let filed = 0;
  let skipped = 0;
  let failed = 0;

  for (const result of input.results || []) {
    const category = result.primaryCategory;
    const target = category && !category.isDefault ? byCategoryId.get(category.id) : null;
    const listIds = target ? [target.id] : [];
    try {
      const outcome = await withWriteRetry(
        () => setRepoLists(token, result.repo, listIds, { ...options, lists }),
        options,
      );
      if (outcome?.already) skipped += 1;
      else filed += 1;
    } catch (error) {
      failed += 1;
      options.onError?.(error, result);
    }
    await maybeDelay(options);
    options.onProgress?.({ phase: "file", filed, skipped, failed });
  }

  const removed = [];
  if (failed === 0) {
    for (const extra of plan.remove) {
      await withWriteRetry(() => deleteList(token, extra.id, options), options);
      const index = lists.findIndex((list) => list.id === extra.id);
      if (index >= 0) lists.splice(index, 1);
      removed.push(extra);
      await maybeDelay(options);
      options.onProgress?.({ phase: "delete", name: extra.name });
    }
  } else {
    options.onProgress?.({ phase: "delete-skipped", failed, leftovers: plan.remove.length });
  }

  return { plan, lists, byCategoryId, filed, skipped, failed, removed };
}

export function foldListName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreListForCategory(list, category) {
  const listFold = foldListName(list?.name);
  const categoryFold = foldListName(category?.name);
  if (!listFold) return 0;
  if (categoryFold && listFold === categoryFold) return 90;
  if (categoryFold && listFold.startsWith(categoryFold)) return 78;
  if (categoryFold && listFold.includes(categoryFold)) return 70;

  let aliasScore = 0;
  const aliases = LIST_PUSH_ALIASES[category?.id] || [];
  aliases.forEach((alias, index) => {
    const folded = foldListName(alias);
    if (!folded) return;
    const primacy = Math.max(0, 16 - index);
    if (listFold === folded) {
      aliasScore = Math.max(aliasScore, (folded.length >= 5 ? 92 : 70) + primacy);
    } else if (folded.length >= 4 && listFold.startsWith(folded)) {
      aliasScore = Math.max(aliasScore, 80 + Math.floor(primacy / 2));
    } else if (listFold.includes(folded)) {
      aliasScore = Math.max(aliasScore, 55 + Math.min(folded.length, 15));
    }
  });
  return aliasScore;
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
