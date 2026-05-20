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
  bulkCategory: DEFAULT_CATEGORIES[0].id,
  selectedRepoIds: new Set(),
  searchQuery: "",
  reviewOnly: false,
  listsAvailable: false,
  isBusy: false,
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
  repoSearch: document.querySelector("#repoSearch"),
  reviewOnly: document.querySelector("#reviewOnly"),
  categoryName: document.querySelector("#categoryName"),
  categoryKeywords: document.querySelector("#categoryKeywords"),
  addCategory: document.querySelector("#addCategory"),
  exportJson: document.querySelector("#exportJson"),
  exportMarkdown: document.querySelector("#exportMarkdown"),
  exportTaxonomy: document.querySelector("#exportTaxonomy"),
  importTaxonomy: document.querySelector("#importTaxonomy"),
  syncLists: document.querySelector("#syncLists"),
  listsNote: document.querySelector("#listsNote"),
  selectFiltered: document.querySelector("#selectFiltered"),
  clearSelected: document.querySelector("#clearSelected"),
  selectionSummary: document.querySelector("#selectionSummary"),
  bulkCategory: document.querySelector("#bulkCategory"),
  applyBulkCategory: document.querySelector("#applyBulkCategory"),
  selectedListName: document.querySelector("#selectedListName"),
  pushSelected: document.querySelector("#pushSelected"),
};

els.analyze.addEventListener("click", analyzeStars);
els.addCategory.addEventListener("click", addManualCategory);
els.categoryFilter.addEventListener("change", () => {
  state.selectedCategory = els.categoryFilter.value;
  renderRepos();
});
els.bulkCategory.addEventListener("change", () => {
  state.bulkCategory = els.bulkCategory.value;
  updateActionAvailability();
});
els.repoSearch.addEventListener("input", () => {
  state.searchQuery = els.repoSearch.value.trim().toLowerCase();
  renderRepos();
});
els.reviewOnly.addEventListener("change", () => {
  state.reviewOnly = els.reviewOnly.checked;
  renderRepos();
});
els.exportJson.addEventListener("click", () => {
  if (state.grouped) {
    downloadJson("github-stars-organized.json", exportPortableJson(state.grouped));
  }
});
els.exportMarkdown.addEventListener("click", () => {
  if (state.grouped) {
    downloadText("github-stars-organized.md", exportMarkdown(state.grouped), "text/markdown");
  }
});
els.exportTaxonomy.addEventListener("click", () => downloadJson("github-stars-taxonomy.json", state.categories));
els.importTaxonomy.addEventListener("change", importTaxonomy);
els.syncLists.addEventListener("click", syncGitHubLists);
els.selectFiltered.addEventListener("click", selectVisibleRepos);
els.clearSelected.addEventListener("click", clearSelection);
els.applyBulkCategory.addEventListener("click", bulkMoveSelected);
els.selectedListName.addEventListener("input", updateActionAvailability);
els.pushSelected.addEventListener("click", pushSelectedToGitHubList);

renderEmpty();

async function analyzeStars() {
  const token = els.token.value.trim();
  if (!isLikelyGitHubToken(token)) {
    setStatus("Enter a classic or fine-grained GitHub token. It is kept in memory only for GitHub API requests in this tab.", "error");
    return;
  }

  state.token = token;
  state.selectedRepoIds.clear();
  setBusy(true);
  setStatus("Fetching starred repositories from GitHub...", "info");
  setProgress(8);

  try {
    state.repos = await fetchAllStars(token, {
      onProgress: ({ count, rateLimit }) => {
        setProgress(Math.min(72, 8 + count / 10));
        const remaining = rateLimit.remaining === null ? "unknown" : rateLimit.remaining;
        setStatus(`Fetched ${count} repositories. API remaining: ${remaining}.`, "info");
      },
    });

    state.grouped = categorizeRepos(state.repos, state.categories);
    setProgress(84);
    await checkListsSupport(token);
    setProgress(100);
    renderAll();
    setStatus(`Review ready: ${state.grouped.metrics.total} repositories loaded. Filter, select a subset, then apply or export.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
}

function addManualCategory() {
  const name = els.categoryName.value.trim();
  const keywords = els.categoryKeywords.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!name) {
    setStatus("Name the category before adding it.", "error");
    return;
  }

  const category = createCategory({
    name,
    keywords,
    description: keywords.length > 0 ? `Custom rule keywords: ${keywords.join(", ")}` : "Custom manual category",
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
  const result = state.grouped?.results.find((item) => String(item.repo.id) === String(repoId));
  if (!target || !result) return;

  result.primaryCategory = target;
  result.confidence = "manual";
  result.explanations = ["manual override"];
  rebuildGroupsFromResults();
  renderAll();
}

function bulkMoveSelected() {
  if (!state.grouped || state.selectedRepoIds.size === 0) return;

  const target = state.categories.find((category) => category.id === els.bulkCategory.value);
  if (!target) {
    setStatus("Choose a category before applying to selected repositories.", "error");
    return;
  }

  for (const result of state.grouped.results) {
    if (!state.selectedRepoIds.has(String(result.repo.id))) continue;
    result.primaryCategory = target;
    result.confidence = "manual";
    result.explanations = ["manual override"];
  }

  rebuildGroupsFromResults();
  renderAll();
  setStatus(`Applied ${target.name} to ${state.selectedRepoIds.size} selected repositories.`, "success");
}

function toggleRepoSelection(repoId, checked) {
  const id = String(repoId);
  if (checked) {
    state.selectedRepoIds.add(id);
  } else {
    state.selectedRepoIds.delete(id);
  }
  updateActionAvailability();
  renderSelectionSummary();
}

function selectVisibleRepos() {
  for (const result of getVisibleResults()) {
    state.selectedRepoIds.add(String(result.repo.id));
  }
  renderRepos();
}

function clearSelection() {
  state.selectedRepoIds.clear();
  renderRepos();
}

async function pushSelectedToGitHubList() {
  if (!state.grouped || !state.token || state.selectedRepoIds.size === 0) return;

  const listName = els.selectedListName.value.trim();
  if (!listName) {
    setStatus("Name the GitHub List before pushing the selected subset.", "error");
    return;
  }

  const selectedResults = state.grouped.results.filter((result) => state.selectedRepoIds.has(String(result.repo.id)));
  setBusy(true);
  setStatus(`Pushing ${selectedResults.length} selected repositories to GitHub List "${listName}". This uses an experimental endpoint.`, "info");

  try {
    const list = await createList(state.token, {
      name: listName,
      description: `Selected subset pushed from GitHub Stars Organizer (${selectedResults.length} repositories)`,
    });

    for (const result of selectedResults) {
      await addRepoToList(state.token, list.id, result.repo.id);
    }

    setStatus(`Created GitHub List "${listName}" with ${selectedResults.length} selected repositories.`, "success");
  } catch (error) {
    setStatus(`${error.message}. If this endpoint is unavailable on your account, use Markdown/JSON export instead.`, "error");
  } finally {
    setBusy(false);
  }
}

function recategorize() {
  if (state.repos.length === 0) {
    renderCategories();
    renderFilterControls();
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

  state.grouped.categories = state.categories.map((category) => ({
    ...category,
    repositories: groups.get(category.id)?.repositories || [],
  }));

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
    els.listsNote.textContent = `Experimental Lists endpoint responded. Existing GitHub Lists found: ${state.existingLists.length}. Category sync and selected-subset push are available.`;
  } catch (error) {
    state.existingLists = [];
    state.listsAvailable = false;
    els.listsNote.textContent = "GitHub does not document a stable public Lists API. If direct push is unavailable on your account, use exports and GitHub's native Stars UI.";
  }
}

async function syncGitHubLists() {
  if (!state.grouped || !state.token) return;

  const categories = state.grouped.categories.filter((category) => category.repositories.length > 0 && !category.isDefault);
  setBusy(true);
  setStatus(`Pushing ${categories.length} non-empty categories to GitHub Lists. This uses an experimental endpoint.`, "info");

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
      setStatus(`Pushed ${created}/${categories.length} categories: ${category.name}`, "info");
    } catch (error) {
      failed++;
    }
  }

  setBusy(false);
  setStatus(`Category push finished. Created: ${created}. Failed: ${failed}.`, failed > 0 ? "error" : "success");
}

function importTaxonomy(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!Array.isArray(data)) {
        throw new Error("Taxonomy file must contain an array.");
      }
      state.categories = normalizeCategories(data);
      recategorize();
      setStatus(`Imported ${state.categories.length} categories. Read Later and Uncategorized were preserved if missing.`, "success");
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
  renderFilterControls();
  renderRepos();
}

function renderEmpty() {
  renderCategories();
  renderFilterControls();
  els.metrics.replaceChildren(
    metric("Repos", "0"),
    metric("Categorized", "0"),
    metric("Uncategorized", "0"),
    metric("Needs review", "0"),
  );
  els.repoList.replaceChildren(emptyState("Fetch your stars to review categories, apply a subset, or export clean files."));
  updateActionAvailability();
}

function renderMetrics() {
  const { total, categorized, uncategorized, lowConfidence } = state.grouped.metrics;
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
    count: counts.get(category.id) || 0,
  }));

  els.categoryList.replaceChildren(...categories.map((category) => {
    const row = document.createElement("article");
    row.className = "category-row";

    const count = document.createElement("strong");
    count.textContent = String(category.count);

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

function renderFilterControls() {
  const categoryOptions = [option("all", "All categories"), ...state.categories.map((category) => option(category.id, category.name))];
  els.categoryFilter.replaceChildren(...categoryOptions);
  els.bulkCategory.replaceChildren(...state.categories.map((category) => option(category.id, category.name)));

  const availableValues = new Set(categoryOptions.map((item) => item.value));
  if (!availableValues.has(state.selectedCategory)) {
    state.selectedCategory = "all";
  }

  els.categoryFilter.value = state.selectedCategory;
  if (!state.categories.some((category) => category.id === state.bulkCategory)) {
    state.bulkCategory = state.categories[0]?.id || "";
  }
  els.bulkCategory.value = state.bulkCategory;
  renderSelectionSummary();
  updateActionAvailability();
}

function renderRepos() {
  if (!state.grouped) {
    els.repoList.replaceChildren(emptyState("Fetch your stars to start reviewing repositories."));
    renderSelectionSummary();
    updateActionAvailability();
    return;
  }

  const results = getVisibleResults();
  if (results.length === 0) {
    els.repoList.replaceChildren(emptyState("No repositories match this filter."));
    renderSelectionSummary();
    updateActionAvailability();
    return;
  }

  els.repoList.replaceChildren(...results.map(repoRow));
  renderSelectionSummary();
  updateActionAvailability();
}

function getVisibleResults() {
  if (!state.grouped) return [];

  return state.grouped.results.filter((result) => {
    const categoryMatch = state.selectedCategory === "all" || result.primaryCategory.id === state.selectedCategory;
    const reviewMatch = !state.reviewOnly || result.confidence !== "high";
    const haystack = [
      result.repo.full_name,
      result.repo.description,
      result.repo.language,
      ...(result.repo.topics || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const searchMatch = state.searchQuery === "" || haystack.includes(state.searchQuery);
    return categoryMatch && reviewMatch && searchMatch;
  });
}

function repoRow(result) {
  const row = document.createElement("article");
  row.className = "repo-row";

  const top = document.createElement("div");
  top.className = "repo-main";

  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = state.selectedRepoIds.has(String(result.repo.id));
  toggle.setAttribute("aria-label", `Select ${result.repo.full_name}`);
  toggle.addEventListener("change", () => toggleRepoSelection(result.repo.id, toggle.checked));

  const text = document.createElement("div");
  text.className = "repo-text";

  const title = document.createElement("a");
  title.href = result.repo.html_url;
  title.target = "_blank";
  title.rel = "noopener noreferrer";
  title.className = "repo-title";
  title.textContent = result.repo.full_name;

  const meta = document.createElement("div");
  meta.className = "repo-meta";
  meta.append(
    badge(result.repo.language || "Unknown"),
    badge(`${result.repo.stargazers_count?.toLocaleString?.() || 0} stars`),
    badge(`confidence: ${result.confidence}`, result.confidence),
  );

  const snippet = document.createElement("p");
  snippet.className = "repo-snippet";
  snippet.textContent = result.repo.description || "No repository description";

  text.append(title, meta, snippet);

  const actions = document.createElement("div");
  actions.className = "repo-actions";

  const select = document.createElement("select");
  select.setAttribute("aria-label", `Move ${result.repo.full_name}`);
  select.replaceChildren(...state.categories.map((category) => option(category.id, category.name)));
  select.value = result.primaryCategory.id;
  select.addEventListener("change", () => moveRepo(result.repo.id, select.value));

  actions.append(select);
  top.append(toggle, text, actions);

  const details = document.createElement("details");
  details.className = "repo-details";
  const summary = document.createElement("summary");
  summary.textContent = result.explanations.length > 0
    ? `${result.explanations.length} matched rule${result.explanations.length > 1 ? "s" : ""}`
    : "No matched rules";

  const detailsBody = document.createElement("div");
  detailsBody.className = "repo-details-body";
  const why = document.createElement("p");
  why.textContent = result.explanations.length > 0 ? result.explanations.join(", ") : "No matching rule";
  detailsBody.append(why);

  if ((result.repo.topics || []).length > 0) {
    const topics = document.createElement("p");
    topics.textContent = `topics: ${result.repo.topics.join(", ")}`;
    detailsBody.append(topics);
  }

  details.append(summary, detailsBody);
  row.append(top, details);
  return row;
}

function badge(text, tone = "default") {
  const node = document.createElement("span");
  node.className = `badge badge-${tone}`;
  node.textContent = text;
  return node;
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

function renderSelectionSummary() {
  const visibleCount = getVisibleResults().length;
  const selectedCount = state.selectedRepoIds.size;
  els.selectionSummary.textContent = `${selectedCount} selected · ${visibleCount} visible`;
}

function setBusy(isBusy) {
  state.isBusy = isBusy;
  updateActionAvailability();
}

function updateActionAvailability() {
  const hasGrouped = Boolean(state.grouped);
  const hasSelection = state.selectedRepoIds.size > 0;
  const canPushSelected = hasGrouped && hasSelection && state.listsAvailable && els.selectedListName.value.trim() !== "";

  els.analyze.disabled = state.isBusy;
  els.addCategory.disabled = state.isBusy;
  els.exportJson.disabled = state.isBusy || !hasGrouped;
  els.exportMarkdown.disabled = state.isBusy || !hasGrouped;
  els.exportTaxonomy.disabled = state.isBusy || state.categories.length === 0;
  els.syncLists.disabled = state.isBusy || !hasGrouped || !state.listsAvailable;
  els.selectFiltered.disabled = state.isBusy || !hasGrouped;
  els.clearSelected.disabled = state.isBusy || !hasSelection;
  els.bulkCategory.disabled = state.isBusy || !hasGrouped;
  els.applyBulkCategory.disabled = state.isBusy || !hasGrouped || !hasSelection;
  els.selectedListName.disabled = state.isBusy || !hasGrouped;
  els.pushSelected.disabled = state.isBusy || !canPushSelected;
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
