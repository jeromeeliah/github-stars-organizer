import {
  addRepoToList,
  createList,
  fetchAllStars,
  fetchExistingLists,
} from "./githubApi.js";
import {
  categorizeRepos,
  createCategory,
  DEFAULT_CATEGORIES,
  exportMarkdown,
  exportPortableJson,
  isLikelyGitHubToken,
} from "./organizer.js";

const state = {
  token: "",
  repos: [],
  categories: normalizeCategories(DEFAULT_CATEGORIES),
  grouped: null,
  existingLists: [],
  selectedCategory: "all",
  listsAvailable: false,
};

const els = {
  token: document.querySelector("#token"),
  analyze: document.querySelector("#analyze"),
  status: document.querySelector("#status"),
  progress: document.querySelector("#progress"),
  metrics: document.querySelector("#metrics"),
  categoryList: document.querySelector("#categoryList"),
  repoList: document.querySelector("#repoList"),
  categoryFilter: document.querySelector("#categoryFilter"),
  categoryName: document.querySelector("#categoryName"),
  categoryKeywords: document.querySelector("#categoryKeywords"),
  addCategory: document.querySelector("#addCategory"),
  exportJson: document.querySelector("#exportJson"),
  exportMarkdown: document.querySelector("#exportMarkdown"),
  exportTaxonomy: document.querySelector("#exportTaxonomy"),
  importTaxonomy: document.querySelector("#importTaxonomy"),
  syncLists: document.querySelector("#syncLists"),
  listsNote: document.querySelector("#listsNote"),
};

els.analyze.addEventListener("click", analyzeStars);
els.addCategory.addEventListener("click", addManualCategory);
els.categoryFilter.addEventListener("change", () => {
  state.selectedCategory = els.categoryFilter.value;
  renderRepos();
});
els.exportJson.addEventListener("click", () => {
  if (state.grouped) downloadJson("github-stars-organized.json", exportPortableJson(state.grouped));
});
els.exportMarkdown.addEventListener("click", () => {
  if (state.grouped) downloadText("github-stars-organized.md", exportMarkdown(state.grouped), "text/markdown");
});
els.exportTaxonomy.addEventListener("click", () => downloadJson("github-stars-taxonomy.json", state.categories));
els.importTaxonomy.addEventListener("change", importTaxonomy);
els.syncLists.addEventListener("click", syncGitHubLists);

renderEmpty();

async function analyzeStars() {
  const token = els.token.value.trim();
  if (!isLikelyGitHubToken(token)) {
    setStatus("Enter a classic or fine-grained GitHub token. It is used only for GitHub API requests in this browser session.", "error");
    return;
  }

  state.token = token;
  setBusy(true);
  setStatus("Fetching starred repositories from GitHub...", "info");
  setProgress(10);

  try {
    state.repos = await fetchAllStars(token, {
      onProgress: ({ count, rateLimit }) => {
        setProgress(Math.min(70, 10 + count / 8));
        const remaining = rateLimit.remaining === null ? "unknown" : rateLimit.remaining;
        setStatus(`Fetched ${count} repositories. API remaining: ${remaining}.`, "info");
      },
    });

    state.grouped = categorizeRepos(state.repos, state.categories);
    setProgress(85);
    await checkListsSupport(token);
    setProgress(100);
    renderAll();
    setStatus(`Ready for review: ${state.grouped.metrics.total} repositories grouped into ${state.grouped.categories.length} categories.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
}

function addManualCategory() {
  const name = els.categoryName.value.trim();
  const keywords = els.categoryKeywords.value.split(",").map((item) => item.trim()).filter(Boolean);
  if (!name) {
    setStatus("Name the category before adding it.", "error");
    return;
  }

  const category = createCategory({
    name,
    keywords,
    description: keywords.length > 0 ? `Custom category matching: ${keywords.join(", ")}` : "Custom manual category",
  });

  if (state.categories.some((item) => item.id === category.id)) {
    setStatus("A category with that name already exists.", "error");
    return;
  }

  state.categories = normalizeCategories([
    ...state.categories.filter((item) => !item.isDefault),
    { ...category },
    ...state.categories.filter((item) => item.isDefault),
  ]);
  els.categoryName.value = "";
  els.categoryKeywords.value = "";
  recategorize();
  setStatus(`Added category: ${category.name}.`, "success");
}

function moveRepo(repoId, categoryId) {
  const target = state.categories.find((category) => category.id === categoryId);
  const result = state.grouped.results.find((item) => String(item.repo.id) === String(repoId));
  if (!target || !result) return;

  result.primaryCategory = target;
  result.confidence = "manual";
  result.explanations = ["manual override"];
  rebuildGroupsFromResults();
  renderAll();
}

function recategorize() {
  if (state.repos.length === 0) {
    renderCategories();
    return;
  }
  state.grouped = categorizeRepos(state.repos, state.categories);
  renderAll();
}

function rebuildGroupsFromResults() {
  const groups = new Map();
  for (const result of state.grouped.results) {
    const category = result.primaryCategory;
    const group = groups.get(category.id) || { ...category, repositories: [] };
    group.repositories.push(result);
    groups.set(category.id, group);
  }

  state.grouped.categories = [...groups.values()].sort((a, b) => {
    if (a.isDefault) return 1;
    if (b.isDefault) return -1;
    return b.repositories.length - a.repositories.length;
  });
  state.grouped.metrics = {
    total: state.grouped.results.length,
    categorized: state.grouped.results.filter((item) => !item.primaryCategory.isDefault).length,
    uncategorized: state.grouped.results.filter((item) => item.primaryCategory.isDefault).length,
    lowConfidence: state.grouped.results.filter((item) => item.confidence !== "high").length,
  };
}

async function checkListsSupport(token) {
  try {
    state.existingLists = await fetchExistingLists(token);
    state.listsAvailable = true;
    els.listsNote.textContent = `Experimental Lists API responded. Existing lists detected: ${state.existingLists.length}.`;
    els.syncLists.disabled = false;
  } catch (error) {
    state.existingLists = [];
    state.listsAvailable = false;
    els.listsNote.textContent = "GitHub Lists API did not respond as a stable public API. Exports remain available.";
    els.syncLists.disabled = true;
  }
}

async function syncGitHubLists() {
  if (!state.grouped || !state.token) return;

  const categories = state.grouped.categories.filter((category) => category.repositories.length > 0 && !category.isDefault);
  setBusy(true);
  setStatus(`Creating ${categories.length} GitHub Lists. This uses an experimental GitHub endpoint.`, "info");

  let created = 0;
  let failed = 0;

  for (const category of categories) {
    try {
      const list = await createList(state.token, {
        name: category.name,
        description: category.description || "Organized by GitHub Stars Organizer",
      });

      for (const result of category.repositories) {
        await addRepoToList(state.token, list.id, result.repo.id);
      }
      created++;
      setStatus(`Created ${created}/${categories.length}: ${category.name}`, "info");
    } catch (error) {
      failed++;
    }
  }

  setBusy(false);
  setStatus(`Lists sync finished. Created: ${created}. Failed: ${failed}.`, failed ? "error" : "success");
}

function importTaxonomy(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!Array.isArray(data)) throw new Error("Taxonomy file must contain an array.");
      state.categories = normalizeCategories(data);
      recategorize();
      setStatus(`Imported ${state.categories.length} categories.`, "success");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function renderAll() {
  renderMetrics();
  renderCategories();
  renderFilter();
  renderRepos();
}

function renderEmpty() {
  renderCategories();
  els.metrics.replaceChildren(metric("Repos", "0"), metric("Categorized", "0"), metric("Needs review", "0"));
  els.repoList.replaceChildren(emptyState("Fetch your stars to review categories and exports."));
  setExportButtons(false);
}

function renderMetrics() {
  const { total, categorized, uncategorized, lowConfidence } = state.grouped.metrics;
  setExportButtons(true);
  els.metrics.replaceChildren(
    metric("Repos", total),
    metric("Categorized", categorized),
    metric("Uncategorized", uncategorized),
    metric("Needs review", lowConfidence),
  );
}

function renderCategories() {
  const counts = new Map((state.grouped?.categories || []).map((category) => [category.id, category.repositories.length]));
  const categories = state.categories.map((category) => ({
    ...category,
    repositories: Array.from({ length: counts.get(category.id) || 0 }),
  }));
  els.categoryList.replaceChildren(...categories.map((category) => {
    const row = document.createElement("article");
    row.className = "category-row";

    const count = document.createElement("strong");
    count.textContent = String(category.repositories?.length || 0);

    const body = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = category.name;
    const description = document.createElement("p");
    description.textContent = category.description || "No description";
    body.append(title, description);

    row.append(count, body);
    return row;
  }));
}

function renderFilter() {
  const options = [option("all", "All categories")];
  for (const category of state.categories) {
    options.push(option(category.id, category.name));
  }
  els.categoryFilter.replaceChildren(...options);
  const availableValues = new Set(options.map((item) => item.value));
  if (!availableValues.has(state.selectedCategory)) {
    state.selectedCategory = "all";
  }
  els.categoryFilter.value = state.selectedCategory;
}

function renderRepos() {
  if (!state.grouped) {
    els.repoList.replaceChildren(emptyState("Fetch your stars to start reviewing repositories."));
    return;
  }

  const results = state.grouped.results.filter((result) => {
    return state.selectedCategory === "all" || result.primaryCategory.id === state.selectedCategory;
  });

  if (results.length === 0) {
    els.repoList.replaceChildren(emptyState("No repositories in this category."));
    return;
  }

  els.repoList.replaceChildren(...results.map(repoRow));
}

function repoRow(result) {
  const row = document.createElement("article");
  row.className = "repo-row";

  const title = document.createElement("a");
  title.href = result.repo.html_url;
  title.target = "_blank";
  title.rel = "noopener noreferrer";
  title.textContent = result.repo.full_name;

  const meta = document.createElement("p");
  meta.textContent = [
    result.repo.language || "Unknown language",
    `${result.repo.stargazers_count?.toLocaleString?.() || 0} stars`,
    `confidence: ${result.confidence}`,
  ].join(" · ");

  const why = document.createElement("p");
  why.className = "why";
  why.textContent = result.explanations.length > 0 ? result.explanations.join(", ") : "No matching rule";

  const select = document.createElement("select");
  select.setAttribute("aria-label", `Move ${result.repo.full_name}`);
  select.replaceChildren(...state.categories.map((category) => option(category.id, category.name)));
  select.value = result.primaryCategory.id;
  select.addEventListener("change", () => moveRepo(result.repo.id, select.value));

  const body = document.createElement("div");
  body.append(title, meta, why);
  row.append(body, select);
  return row;
}

function metric(label, value) {
  const node = document.createElement("div");
  node.className = "metric";
  const strong = document.createElement("strong");
  strong.textContent = String(value);
  const span = document.createElement("span");
  span.textContent = label;
  node.append(strong, span);
  return node;
}

function option(value, label) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  return node;
}

function emptyState(message) {
  const node = document.createElement("p");
  node.className = "empty";
  node.textContent = message;
  return node;
}

function setBusy(isBusy) {
  els.analyze.disabled = isBusy;
  els.addCategory.disabled = isBusy;
  els.syncLists.disabled = isBusy || !state.listsAvailable;
}

function normalizeCategories(inputCategories) {
  const normalized = [];
  const seen = new Set();

  for (const rawCategory of inputCategories) {
    const category = { ...createCategory(rawCategory) };
    if (seen.has(category.id)) continue;
    normalized.push(category);
    seen.add(category.id);
  }

  for (const fallback of DEFAULT_CATEGORIES.filter((category) => category.manual || category.isDefault)) {
    if (seen.has(fallback.id)) continue;
    normalized.push({ ...fallback });
    seen.add(fallback.id);
  }

  return normalized;
}

function setExportButtons(enabled) {
  els.exportJson.disabled = !enabled;
  els.exportMarkdown.disabled = !enabled;
}

function setStatus(message, type) {
  els.status.textContent = message;
  els.status.dataset.type = type;
}

function setProgress(value) {
  els.progress.value = value;
}

function downloadJson(filename, value) {
  downloadText(filename, JSON.stringify(value, null, 2), "application/json");
}

function downloadText(filename, text, type) {
  if (!text) return;
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
