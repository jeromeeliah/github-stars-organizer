const GITHUB_API_ROOT = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";

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
  return experimentalListRequest(token, "/user/lists", {
    fetcher: options.fetcher,
  });
}

export async function createList(token, payload, options = {}) {
  return experimentalListRequest(token, "/user/lists", {
    fetcher: options.fetcher,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addRepoToList(token, listId, repositoryId, options = {}) {
  return experimentalListRequest(token, `/user/lists/${listId}/items`, {
    fetcher: options.fetcher,
    method: "POST",
    body: JSON.stringify({ repository_id: repositoryId }),
  });
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

async function experimentalListRequest(token, path, options = {}) {
  const fetcher = options.fetcher || globalThis.fetch;
  if (!fetcher) {
    throw new Error("No fetch implementation is available.");
  }

  const response = await fetcher(`${GITHUB_API_ROOT}${path}`, {
    method: options.method || "GET",
    headers: {
      ...buildGitHubHeaders(token),
      "Content-Type": "application/json",
    },
    body: options.body,
  });

  if (!response.ok) {
    throw await createGitHubError(response, "GitHub Lists API is unavailable or rejected this request");
  }

  return response.status === 204 ? null : response.json();
}

async function createGitHubError(response, fallbackMessage = "GitHub API error") {
  const data = await response.json().catch(() => ({}));
  const message = data.message || response.statusText || fallbackMessage;
  return new Error(`${fallbackMessage} ${response.status}: ${message}`);
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
