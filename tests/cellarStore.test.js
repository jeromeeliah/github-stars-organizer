import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceCursor,
  applyStickyFilings,
  assertSafeCellarPayload,
  buildCellarSnapshot,
  captureFiling,
  clearCellar,
  inboxCount,
  isInboxRow,
  loadCellar,
  parsePortableExport,
  pushUndo,
  recordAssignment,
  resolveFilingKey,
  restoreFiling,
  saveCellar,
  setReviewedFlag,
  stepCursor,
} from "../src/cellarStore.js";
import {
  categorizeRepos,
  createCategory,
  DEFAULT_CATEGORIES,
  exportPortableJson,
} from "../src/organizer.js";

const repo = (overrides = {}) => ({
  id: 1,
  name: "sample",
  full_name: "owner/sample",
  description: "",
  html_url: "https://github.com/owner/sample",
  language: "JavaScript",
  topics: [],
  stargazers_count: 42,
  forks_count: 3,
  archived: false,
  pushed_at: "2026-01-01T00:00:00Z",
  license: { spdx_id: "MIT" },
  owner: { login: "owner" },
  ...overrides,
});

function memoryStorage(seed = new Map()) {
  const map = new Map(seed);
  return {
    async get(key) {
      return map.has(key) ? structuredClone(map.get(key)) : null;
    },
    async set(key, value) {
      map.set(key, structuredClone(value));
    },
    async delete(key) {
      map.delete(key);
    },
    map,
  };
}

test("buildCellarSnapshot never accepts a token field", () => {
  assert.throws(
    () => buildCellarSnapshot({ token: "ghp_abcdefghijklmnopqrstuvwxyz1234567890" }),
    /token/i,
  );
});

test("assertSafeCellarPayload rejects nested token keys", () => {
  assert.throws(
    () => assertSafeCellarPayload({
      version: 1,
      categories: [],
      assignments: {},
      reviewed: {},
      repos: [{ id: 1, access_token: "secret" }],
    }),
    /token|access_token/i,
  );
});

test("parsePortableExport rebuilds taxonomy, repos, and assignments", () => {
  const grouped = categorizeRepos([
    repo({ id: 11, full_name: "owner/tool", name: "tool", topics: ["cli"] }),
    repo({ id: 12, full_name: "owner/notes", name: "notes", topics: ["notes"] }),
  ]);
  grouped.results[1].primaryCategory = DEFAULT_CATEGORIES.find((item) => item.id === "read-later");
  grouped.results[1].confidence = "manual";
  const exported = exportPortableJson(grouped, {
    assignments: { 12: { categoryId: "read-later" } },
    reviewed: { 11: true },
  });

  const parsed = parsePortableExport(exported);
  assert.equal(parsed.repos.length, 2);
  assert.equal(parsed.assignments["12"].categoryId, "read-later");
  assert.equal(parsed.reviewed["11"], true);
  assert.equal(parsed.categories.some((category) => category.id === "developer-tools"), true);
});

test("applyStickyFilings restores manual moves after categorizeRepos", () => {
  const categories = DEFAULT_CATEGORIES.map((category) => ({ ...category }));
  const readLater = categories.find((category) => category.id === "read-later");
  const grouped = categorizeRepos([
    repo({ id: 21, full_name: "owner/mystery", name: "mystery", language: null }),
  ], categories);

  assert.equal(grouped.results[0].primaryCategory.isDefault, true);

  const sticky = applyStickyFilings(grouped, {
    assignments: { 21: { categoryId: "read-later" } },
    reviewed: { 21: true },
    categories,
  });

  assert.equal(sticky.results[0].primaryCategory.id, readLater.id);
  assert.equal(sticky.results[0].confidence, "manual");
  assert.equal(sticky.results[0].reviewed, true);
});

test("inbox excludes manual, Read Later, and reviewed rows", () => {
  const categories = DEFAULT_CATEGORIES.map((category) => ({ ...category }));
  const grouped = categorizeRepos([
    repo({ id: 31, full_name: "owner/mystery", name: "mystery", language: null }),
    repo({ id: 32, full_name: "owner/notes", name: "notes", topics: ["notes"] }),
  ], categories);

  grouped.results[1].confidence = "manual";
  grouped.results[1].reviewed = true;
  const sticky = applyStickyFilings(grouped, {
    assignments: { 31: { categoryId: "read-later" } },
    reviewed: { 32: true },
    categories,
  });

  assert.equal(isInboxRow(sticky.results[0]), false);
  assert.equal(isInboxRow(sticky.results[1]), false);
  assert.equal(inboxCount(sticky.results), 0);
});

test("filing keys map j/k/f/s/r/u/x and stay quiet while typing or with modifiers", () => {
  assert.equal(resolveFilingKey({ key: "j" }), "next");
  assert.equal(resolveFilingKey({ key: "ArrowUp" }), "previous");
  assert.equal(resolveFilingKey({ key: "f" }), "file");
  assert.equal(resolveFilingKey({ key: "Enter" }), "file");
  assert.equal(resolveFilingKey({ key: "s" }), "skip");
  assert.equal(resolveFilingKey({ key: "r" }), "read-later");
  assert.equal(resolveFilingKey({ key: "u" }), "undo");
  assert.equal(resolveFilingKey({ key: "x" }), "select");
  assert.equal(resolveFilingKey({ key: "q" }), null);
  assert.equal(resolveFilingKey({ key: "j", typing: true }), null);
  assert.equal(resolveFilingKey({ key: "f", metaKey: true }), null);
  assert.equal(resolveFilingKey({ key: "Enter", control: true }), null, "Enter on a button stays a button press");
  assert.equal(resolveFilingKey({ key: "f", control: true }), "file", "letters still file when a button has focus");
});

test("cursor steps within visible rows and advances past a filed row", () => {
  const ids = ["a", "b", "c"];
  assert.equal(stepCursor(ids, null, 1), "a");
  assert.equal(stepCursor(ids, null, -1), "c");
  assert.equal(stepCursor(ids, "a", 1), "b");
  assert.equal(stepCursor(ids, "c", 1), "c");
  assert.equal(stepCursor(ids, "a", -1), "a");
  assert.equal(stepCursor([], "a", 1), null);

  assert.equal(advanceCursor(ids, "b", ["a", "c"]), "c", "filed row vanished: move to the next one");
  assert.equal(advanceCursor(ids, "c", ["a", "b"]), "b", "last row filed: fall back to the previous one");
  assert.equal(advanceCursor(ids, "b", ids), "c", "row stays visible: still move on");
  assert.equal(advanceCursor(ids, "c", ids), "c", "nothing after the last row: stay");
  assert.equal(advanceCursor(ids, "b", []), null);
  assert.equal(advanceCursor(ids, "zz", ["a"]), "a");
});

test("undo entry restores the previous filing exactly", () => {
  const start = { assignments: { 7: { categoryId: "ai-ml" } }, reviewed: { 7: true } };
  const filedEntry = captureFiling(start, 7);
  const unfiledEntry = captureFiling(start, 8);

  const after = {
    assignments: recordAssignment(recordAssignment(start.assignments, 7, "read-later"), 8, "devops"),
    reviewed: setReviewedFlag(setReviewedFlag(start.reviewed, 7, true), 8, true),
  };

  const back8 = restoreFiling(after, unfiledEntry);
  assert.equal(back8.assignments[8], undefined);
  assert.equal(back8.reviewed[8], undefined);
  assert.deepEqual(back8.assignments[7], { categoryId: "read-later" });

  const back7 = restoreFiling(back8, filedEntry);
  assert.deepEqual(back7.assignments, start.assignments);
  assert.deepEqual(back7.reviewed, start.reviewed);

  assert.deepEqual(restoreFiling(after, null), after);
});

test("undo stack caps its length and ignores empty entries", () => {
  let stack = [];
  for (let i = 0; i < 60; i += 1) stack = pushUndo(stack, { repoId: String(i), assignment: null, reviewed: false });
  assert.equal(stack.length, 50);
  assert.equal(stack[0].repoId, "10");
  assert.equal(pushUndo(stack, null), stack);
  assert.equal(pushUndo(undefined, { repoId: "1" }).length, 1);
});

test("skip is reviewed without a sticky assignment so the shelf stays", () => {
  const categories = DEFAULT_CATEGORIES.map((category) => ({ ...category }));
  const grouped = categorizeRepos([
    repo({ id: 41, full_name: "owner/mystery", name: "mystery", language: null }),
  ], categories);
  const shelf = grouped.results[0].primaryCategory.id;

  const sticky = applyStickyFilings(grouped, {
    assignments: {},
    reviewed: { 41: true },
    categories,
  });

  assert.equal(sticky.results[0].reviewed, true);
  assert.equal(sticky.results[0].primaryCategory.id, shelf);
  assert.equal(isInboxRow(sticky.results[0]), false);
});

test("memory cellar round-trips taxonomy and assignments without a token", async () => {
  const storage = memoryStorage();
  const categories = [
    ...DEFAULT_CATEGORIES,
    createCategory({ id: "climate", name: "Climate", keywords: ["climate"] }),
  ];
  const snapshot = buildCellarSnapshot({
    categories,
    assignments: recordAssignment({}, 99, "climate"),
    reviewed: setReviewedFlag({}, 99, true),
    repos: [repo({ id: 99, full_name: "owner/climate-kit", name: "climate-kit", topics: ["climate"] })],
  });

  await saveCellar(snapshot, storage);
  const loaded = await loadCellar(storage);
  assert.equal(loaded.assignments["99"].categoryId, "climate");
  assert.equal(loaded.reviewed["99"], true);
  assert.equal(loaded.repos[0].full_name, "owner/climate-kit");
  assert.equal(Object.prototype.hasOwnProperty.call(loaded, "token"), false);

  await clearCellar(storage);
  assert.equal(await loadCellar(storage), null);
});
