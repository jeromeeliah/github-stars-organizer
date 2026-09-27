import test from "node:test";
import assert from "node:assert/strict";

import {
  categorizeRepo,
  categorizeRepos,
  createCategory,
  DEFAULT_CATEGORIES,
  exportMarkdown,
  exportPortableJson,
  isLikelyGitHubToken,
  tokenizeRepo,
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

test("accepts classic and fine-grained GitHub token formats without storing them", () => {
  assert.equal(isLikelyGitHubToken("ghp_abcdefghijklmnopqrstuvwxyz1234567890"), true);
  assert.equal(isLikelyGitHubToken("github_pat_11AAAAAAA0abcdefghijklmnopqrstuvwxyz"), true);
  assert.equal(isLikelyGitHubToken("not-a-token"), false);
  assert.equal(isLikelyGitHubToken("ghp_short"), false);
  assert.equal(isLikelyGitHubToken("github_pat_short"), false);
});

test("tokenizes repository metadata without substring false positives", () => {
  const tokens = tokenizeRepo(repo({
    name: "artifact-store",
    description: "A macrame bibliography manager",
    topics: ["dev-tools", "static-analysis"],
  }));

  assert.equal(tokens.has("art"), false);
  assert.equal(tokens.has("mac"), false);
  assert.equal(tokens.has("dev"), true);
  assert.equal(tokens.has("tools"), true);
  assert.equal(tokens.has("static"), true);
});

test("categorizes with explanations and multiple candidates", () => {
  const result = categorizeRepo(repo({
    name: "langchain-agent-toolkit",
    description: "Agent workflow automation for OpenAI apps",
    topics: ["ai-agents", "workflow"],
  }));

  assert.equal(result.primaryCategory.id, "ai-agents");
  assert.equal(result.candidates.length >= 2, true);
  assert.equal(result.explanations.some((item) => item.includes("agent")), true);
  assert.equal(result.confidence, "high");
});

test("supports custom categories without mutating defaults", () => {
  const categories = [
    ...DEFAULT_CATEGORIES,
    createCategory({
      id: "climate",
      name: "Climate Tech",
      description: "Climate, energy, and sustainability projects",
      keywords: ["climate", "energy", "sustainability"],
    }),
  ];

  const result = categorizeRepo(repo({
    name: "open-energy-dashboard",
    description: "Sustainability analytics for energy systems",
  }), categories);

  assert.equal(DEFAULT_CATEGORIES.some((category) => category.id === "climate"), false);
  assert.equal(result.primaryCategory.id, "climate");
});

test("groups categorized repositories and preserves low-confidence uncategorized results", () => {
  const grouped = categorizeRepos([
    repo({ id: 1, full_name: "owner/llama-ui", name: "llama-ui", topics: ["llm"] }),
    repo({ id: 2, full_name: "owner/unknown", name: "unknown", language: null }),
  ]);

  assert.equal(grouped.categories.some((category) => category.id === "ai-ml"), true);
  assert.equal(grouped.categories.some((category) => category.id === "uncategorized"), true);
  assert.equal(grouped.metrics.total, 2);
  assert.equal(grouped.metrics.uncategorized, 1);
});

test("exports a minimized portable JSON schema", () => {
  const grouped = categorizeRepos([
    repo({ id: 7, full_name: "owner/tool", name: "tool", topics: ["cli"] }),
  ]);

  const exported = exportPortableJson(grouped);
  const item = exported.categories[0].repositories[0];

  assert.deepEqual(Object.keys(item).sort(), [
    "archived",
    "category",
    "description",
    "forks",
    "id",
    "language",
    "license",
    "name",
    "owner",
    "pushedAt",
    "stars",
    "topics",
    "url",
  ].sort());
  assert.equal(typeof item.owner, "string");
  assert.equal(item.owner, "owner");
  assert.equal(item.name, "tool");
  assert.deepEqual(item.topics, ["cli"]);
});

test("exports independent arrays and freezes default category arrays", () => {
  const grouped = categorizeRepos([
    repo({ id: 8, full_name: "owner/tool", name: "tool", topics: ["cli"] }),
  ]);
  const exported = exportPortableJson(grouped);

  assert.equal(Object.isFrozen(DEFAULT_CATEGORIES[0].keywords), true);
  exported.taxonomy[0].keywords.push("mutated");
  exported.categories[0].repositories[0].topics.push("mutated");

  assert.equal(grouped.taxonomy[0].keywords.includes("mutated"), false);
  assert.equal(grouped.results[0].repo.topics.includes("mutated"), false);
});

test("exports readable Markdown grouped by category", () => {
  const grouped = categorizeRepos([
    repo({ id: 9, full_name: "owner/security-kit", name: "security-kit", topics: ["security"] }),
  ]);

  assert.ok(grouped.results[0].explanations.length > 0);

  const markdown = exportMarkdown(grouped);

  assert.match(markdown, /# GitHub Stars Organized/);
  assert.match(markdown, /Security & Privacy/);
  assert.match(markdown, /owner\/security-kit/);
  assert.match(markdown, /1 repository\./);
  assert.match(markdown, /42 stars · JavaScript/);
  assert.doesNotMatch(markdown, /Matched:/);
});
