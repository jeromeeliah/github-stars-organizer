/**
 * Same-origin cellar cache + portable JSON helpers.
 * Never stores or accepts a GitHub token.
 */

const DB_NAME = "github-stars-cellar";
const DB_VERSION = 1;
const STORE_NAME = "cellar";
const CELLAR_KEY = "current";

const TOKENISH_KEYS = new Set([
  "token",
  "accessToken",
  "access_token",
  "githubToken",
  "github_token",
  "pat",
  "authorization",
  "Authorization",
]);

export function buildCellarSnapshot(input = {}) {
  rejectTokenishKeys(input, "cellar");

  const {
    categories = [],
    assignments = {},
    reviewed = {},
    repos = [],
    savedAt = new Date().toISOString(),
  } = input;

  return assertSafeCellarPayload({
    version: 1,
    savedAt,
    categories: categories.map(serializeCategory),
    assignments: { ...assignments },
    reviewed: { ...reviewed },
    repos: repos.map(serializeStarSnapshot),
  });
}

export function isInboxRow(result) {
  if (!result) return false;
  if (result.reviewed) return false;
  if (result.confidence === "manual") return false;
  if (result.primaryCategory?.manual || result.primaryCategory?.id === "read-later") return false;
  return true;
}

export function inboxCount(results = []) {
  return results.filter(isInboxRow).length;
}

export function assertSafeCellarPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Cellar payload must be an object.");
  }

  rejectTokenishKeys(payload, "cellar");

  return {
    version: Number(payload.version) || 1,
    savedAt: String(payload.savedAt || new Date().toISOString()),
    categories: Array.isArray(payload.categories) ? payload.categories.map(serializeCategory) : [],
    assignments: normalizeAssignments(payload.assignments),
    reviewed: normalizeReviewed(payload.reviewed),
    repos: Array.isArray(payload.repos) ? payload.repos.map(serializeStarSnapshot) : [],
  };
}

export function parsePortableExport(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Portable export must be a JSON object.");
  }

  rejectTokenishKeys(data, "export");

  const taxonomy = Array.isArray(data.taxonomy) ? data.taxonomy : [];
  const categoryBuckets = Array.isArray(data.categories) ? data.categories : [];
  if (taxonomy.length === 0 && categoryBuckets.length === 0) {
    throw new Error("Portable export needs taxonomy or categorized repositories.");
  }

  const categories = taxonomy.length > 0
    ? taxonomy.map(serializeCategory)
    : categoryBuckets.map((bucket) => serializeCategory({
      id: bucket.id,
      name: bucket.name,
      description: bucket.description,
    }));

  const assignments = {};
  const repos = [];
  const seenRepos = new Set();

  for (const bucket of categoryBuckets) {
    const categoryId = String(bucket?.id || "");
    for (const item of bucket?.repositories || []) {
      const repo = hydrateSerializedRepo(item);
      const repoId = String(repo.id);
      if (!seenRepos.has(repoId)) {
        repos.push(repo);
        seenRepos.add(repoId);
      }
      const assignedCategory = String(item.category || categoryId);
      if (assignedCategory) {
        assignments[repoId] = { categoryId: assignedCategory };
      }
    }
  }

  const reviewed = normalizeReviewed(data.reviewed);
  if (Array.isArray(data.reviewedIds)) {
    for (const id of data.reviewedIds) {
      reviewed[String(id)] = true;
    }
  }

  return {
    categories,
    assignments: normalizeAssignments({ ...assignments, ...(data.assignments || {}) }),
    reviewed,
    repos,
  };
}

export function applyStickyFilings(grouped, { assignments = {}, reviewed = {}, categories = [] } = {}) {
  if (!grouped?.results) return grouped;

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  for (const result of grouped.results) {
    const repoId = String(result.repo.id);
    const filing = assignments[repoId];
    if (filing?.categoryId && categoryById.has(filing.categoryId)) {
      result.primaryCategory = categoryById.get(filing.categoryId);
      result.confidence = "manual";
      result.explanations = ["manual override"];
      result.score = result.score || 0;
    }
    result.reviewed = Boolean(reviewed[repoId]);
  }

  return rebuildGrouped(grouped, categories);
}

export function recordAssignment(assignments, repoId, categoryId) {
  const next = { ...assignments };
  next[String(repoId)] = { categoryId: String(categoryId) };
  return next;
}

export function clearAssignment(assignments, repoId) {
  const next = { ...assignments };
  delete next[String(repoId)];
  return next;
}

export function setReviewedFlag(reviewed, repoId, value = true) {
  const next = { ...reviewed };
  const key = String(repoId);
  if (value) next[key] = true;
  else delete next[key];
  return next;
}

// Keyboard filing (P0-4). Pure: the desk passes in ids and key facts, gets back decisions.

const FILING_KEYS = new Map([
  ["j", "next"],
  ["ArrowDown", "next"],
  ["k", "previous"],
  ["ArrowUp", "previous"],
  ["f", "file"],
  ["Enter", "file"],
  ["s", "skip"],
  ["r", "read-later"],
  ["d", "unstar"],
  ["u", "undo"],
  ["x", "select"],
]);

export function resolveFilingKey({ key, ctrlKey = false, metaKey = false, altKey = false, typing = false, control = false } = {}) {
  if (ctrlKey || metaKey || altKey) return null;
  if (typing) return null;
  const action = FILING_KEYS.get(key) || null;
  if (action === "file" && key === "Enter" && control) return null;
  return action;
}

export function stepCursor(visibleIds, currentId, delta) {
  if (!Array.isArray(visibleIds) || visibleIds.length === 0) return null;
  const index = visibleIds.indexOf(currentId);
  if (index === -1) return delta < 0 ? visibleIds[visibleIds.length - 1] : visibleIds[0];
  const next = Math.min(visibleIds.length - 1, Math.max(0, index + delta));
  return visibleIds[next];
}

export function advanceCursor(beforeIds, currentId, afterIds) {
  if (!Array.isArray(afterIds) || afterIds.length === 0) return null;
  const stillVisible = new Set(afterIds);
  const index = Array.isArray(beforeIds) ? beforeIds.indexOf(currentId) : -1;
  if (index !== -1) {
    for (let i = index + 1; i < beforeIds.length; i += 1) {
      if (stillVisible.has(beforeIds[i])) return beforeIds[i];
    }
    if (stillVisible.has(currentId)) return currentId;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (stillVisible.has(beforeIds[i])) return beforeIds[i];
    }
  }
  return afterIds[afterIds.length - 1];
}

export function captureFiling({ assignments = {}, reviewed = {} } = {}, repoId) {
  const key = String(repoId);
  return {
    repoId: key,
    assignment: assignments[key] ? { ...assignments[key] } : null,
    reviewed: Boolean(reviewed[key]),
  };
}

export function captureUnstar({ assignments = {}, reviewed = {}, lists = [] } = {}, repo) {
  const itemId = repo?.node_id;
  const listIds = itemId
    ? (lists || []).filter((list) => (list.itemIds || []).includes(itemId)).map((list) => list.id)
    : [];
  return {
    ...captureFiling({ assignments, reviewed }, repo?.id),
    kind: "unstar",
    repo: repo || null,
    listIds,
  };
}

export function restoreFiling({ assignments = {}, reviewed = {} } = {}, entry) {
  if (!entry?.repoId) return { assignments, reviewed };
  return {
    assignments: entry.assignment
      ? recordAssignment(assignments, entry.repoId, entry.assignment.categoryId)
      : clearAssignment(assignments, entry.repoId),
    reviewed: setReviewedFlag(reviewed, entry.repoId, entry.reviewed),
  };
}

export function pushUndo(stack = [], entry, limit = 50) {
  if (!entry) return stack;
  return [...stack, entry].slice(-limit);
}

export async function loadCellar(storage = getIndexedDbStorage()) {
  const raw = await storage.get(CELLAR_KEY);
  if (!raw) return null;
  return assertSafeCellarPayload(raw);
}

export async function saveCellar(snapshot, storage = getIndexedDbStorage()) {
  const safe = assertSafeCellarPayload(snapshot);
  await storage.set(CELLAR_KEY, safe);
  return safe;
}

export async function clearCellar(storage = getIndexedDbStorage()) {
  await storage.delete(CELLAR_KEY);
}

function rebuildGrouped(grouped, categories) {
  const groups = new Map();

  for (const result of grouped.results) {
    const category = result.primaryCategory;
    const group = groups.get(category.id) || { ...category, repositories: [] };
    group.repositories.push(result);
    groups.set(category.id, group);
  }

  grouped.categories = categories.map((category) => ({
    ...category,
    repositories: groups.get(category.id)?.repositories || [],
  }));

  grouped.taxonomy = categories;
  grouped.metrics = {
    total: grouped.results.length,
    categorized: grouped.results.filter((item) => !item.primaryCategory.isDefault).length,
    uncategorized: grouped.results.filter((item) => item.primaryCategory.isDefault).length,
    lowConfidence: grouped.results.filter((item) => item.confidence !== "high" && !item.reviewed).length,
  };

  return grouped;
}

function serializeCategory(category) {
  return {
    id: String(category.id || ""),
    name: String(category.name || category.id || ""),
    description: String(category.description || ""),
    keywords: [...(category.keywords || [])],
    languages: [...(category.languages || [])],
    manual: Boolean(category.manual),
    isDefault: Boolean(category.isDefault),
  };
}

function serializeStarSnapshot(repo) {
  return {
    id: repo.id,
    name: repo.name || "",
    full_name: repo.full_name || `${repo.owner?.login || ""}/${repo.name || ""}`.replace(/^\/|\/$/g, ""),
    description: repo.description || "",
    html_url: repo.html_url || repo.url || "",
    language: repo.language || "",
    topics: [...(repo.topics || [])],
    stargazers_count: repo.stargazers_count ?? repo.stars ?? 0,
    forks_count: repo.forks_count ?? repo.forks ?? 0,
    archived: Boolean(repo.archived),
    pushed_at: repo.pushed_at || repo.pushedAt || "",
    license: repo.license?.spdx_id
      ? { spdx_id: repo.license.spdx_id }
      : (repo.license ? { spdx_id: String(repo.license) } : null),
    owner: { login: repo.owner?.login || String(repo.full_name || "").split("/")[0] || "" },
    node_id: repo.node_id || "",
  };
}

export function hydrateSerializedRepo(item) {
  if (item.full_name || item.html_url) {
    return serializeStarSnapshot(item);
  }

  return serializeStarSnapshot({
    id: item.id,
    name: item.name,
    full_name: `${item.owner || ""}/${item.name || ""}`.replace(/^\/|\/$/g, ""),
    description: item.description,
    html_url: item.url,
    language: item.language,
    topics: item.topics,
    stargazers_count: item.stars,
    forks_count: item.forks,
    archived: item.archived,
    pushed_at: item.pushedAt,
    license: item.license ? { spdx_id: item.license } : null,
    owner: { login: item.owner || "" },
    node_id: item.node_id || "",
  });
}

function normalizeAssignments(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [repoId, filing] of Object.entries(value)) {
    if (!filing) continue;
    const categoryId = typeof filing === "string" ? filing : filing.categoryId;
    if (!categoryId) continue;
    out[String(repoId)] = { categoryId: String(categoryId) };
  }
  return out;
}

function normalizeReviewed(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [repoId, flagged] of Object.entries(value)) {
    if (flagged) out[String(repoId)] = true;
  }
  return out;
}

function rejectTokenishKeys(value, label, path = []) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectTokenishKeys(item, label, [...path, String(index)]));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (TOKENISH_KEYS.has(key)) {
      throw new Error(`Refusing to ${path.length ? "read" : "store"} a GitHub token in the ${label} (${[...path, key].join(".")}).`);
    }
    if (child && typeof child === "object") {
      rejectTokenishKeys(child, label, [...path, key]);
    }
  }
}

function getIndexedDbStorage() {
  return {
    async get(key) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    },
    async set(key, value) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const request = tx.objectStore(STORE_NAME).put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
    async delete(key) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const request = tx.objectStore(STORE_NAME).delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
  };
}

function openDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable in this environment."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
