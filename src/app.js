import {
  addRepoToList,
  createList,
  describeGitHubError,
  fetchAllStars,
  fetchExistingLists,
  findListByName,
} from "./githubApi.js";
import {
  advanceCursor,
  applyStickyFilings,
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
} from "./cellarStore.js";
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
  assignments: {},
  reviewed: {},
  grouped: null,
  existingLists: [],
  selectedCategory: "all",
  bulkCategory: DEFAULT_CATEGORIES[0].id,
  selectedRepoIds: new Set(),
  searchQuery: "",
  reviewOnly: true,
  listsAvailable: false,
  isBusy: false,
  cursorRepoId: null,
  undoStack: [],
};

const els = {
  connectForm: document.querySelector("#connectForm"),
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
  importCellar: document.querySelector("#importCellar"),
  clearCellar: document.querySelector("#clearCellar"),
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

els.connectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  analyzeStars();
});
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
    downloadJson("github-stars-organized.json", currentPortableExport());
  }
});
els.exportMarkdown.addEventListener("click", () => {
  if (state.grouped) {
    downloadText("github-stars-organized.md", exportMarkdown(state.grouped), "text/markdown");
  }
});
els.exportTaxonomy.addEventListener("click", () => downloadJson("github-stars-taxonomy.json", state.categories));
els.importTaxonomy.addEventListener("change", importTaxonomy);
els.importCellar.addEventListener("change", importCellarFile);
els.clearCellar.addEventListener("click", clearThisCellar);
els.syncLists.addEventListener("click", syncGitHubLists);
els.selectFiltered.addEventListener("click", selectVisibleRepos);
els.clearSelected.addEventListener("click", clearSelection);
els.applyBulkCategory.addEventListener("click", bulkMoveSelected);
els.selectedListName.addEventListener("input", updateActionAvailability);
els.pushSelected.addEventListener("click", pushSelectedToGitHubList);

els.reviewOnly.checked = true;
document.addEventListener("keydown", onFilingKey);
restoreCellar();

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

    if (state.repos.length === 0) {
      state.grouped = applyGrouped();
      await persistCellar();
      renderAll();
      setStatus("This GitHub account has zero starred repositories. Nothing is filtered.", "info");
      return;
    }

    state.grouped = applyGrouped();
    setProgress(84);
    await persistCellar();
    await checkListsSupport(token);
    setProgress(100);
    renderAll();
    setStatus(`Review inbox: ${inboxCount(state.grouped.results)} still unfiled of ${state.grouped.metrics.total} loaded.`, "success");
  } catch (error) {
    setStatus(describeGitHubError(error, error.rateLimit), "error");
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
  setStatus(`Added category: ${category.name}. Filed rows stayed put.`, "success");
}

function moveRepo(repoId, categoryId) {
  const target = state.categories.find((category) => category.id === categoryId);
  const result = resultById(repoId);
  if (!target || !result) return;

  commitFiling(result.repo.id, () => fileResult(result, target), `Filed ${result.repo.full_name} into ${target.name}.`);
}

function bulkMoveSelected() {
  if (!state.grouped || state.selectedRepoIds.size === 0) return;

  const target = state.categories.find((category) => category.id === els.bulkCategory.value);
  if (!target) {
    setStatus("Choose a category before applying to selected repositories.", "error");
    return;
  }

  const beforeIds = visibleRepoIds();
  let filed = 0;
  let lastId = null;
  for (const result of state.grouped.results) {
    if (!state.selectedRepoIds.has(String(result.repo.id))) continue;
    lastId = String(result.repo.id);
    rememberFiling(lastId);
    fileResult(result, target);
    filed += 1;
  }

  refreshGroups();
  if (lastId) state.cursorRepoId = advanceCursor(beforeIds, lastId, visibleRepoIds());
  persistCellar();
  if (state.grouped) renderAll();
  else renderEmpty();
  setStatus(`Filed ${filed} selected repositories into ${target.name}.`, "success");
}

function fileResult(result, target) {
  const repoId = String(result.repo.id);
  result.primaryCategory = target;
  result.confidence = "manual";
  result.explanations = ["manual override"];
  result.reviewed = true;
  state.assignments = recordAssignment(state.assignments, repoId, target.id);
  state.reviewed = setReviewedFlag(state.reviewed, repoId, true);
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
  setStatus(`Pushing ${selectedResults.length} selected repositories to GitHub List "${listName}" (GraphQL, private by default).`, "info");

  try {
    const list = await ensureList(listName, `Selected subset pushed from GitHub Stars Organizer (${selectedResults.length} repositories)`);
    for (const result of selectedResults) {
      await addRepoToList(state.token, list.id, result.repo, { lists: state.existingLists });
    }
    setStatus(`GitHub List "${list.name}" now includes ${selectedResults.length} selected repositories.`, "success");
  } catch (error) {
    setStatus(`${describeGitHubError(error)}. Exports still work.`, "error");
  } finally {
    setBusy(false);
  }
}

function recategorize() {
  if (state.repos.length === 0) {
    persistCellar();
    renderCategories();
    renderFilterControls();
    return;
  }

  persistAndRender();
}

function applyGrouped() {
  const grouped = categorizeRepos(state.repos, state.categories);
  return applyStickyFilings(grouped, {
    assignments: state.assignments,
    reviewed: state.reviewed,
    categories: state.categories,
  });
}

function refreshGroups() {
  state.grouped = state.repos.length > 0 ? applyGrouped() : null;
}

async function checkListsSupport(token) {
  try {
    state.existingLists = await fetchExistingLists(token);
    state.listsAvailable = true;
    els.listsNote.textContent = `GraphQL Lists available. Existing lists: ${state.existingLists.length}. New lists are created private. Writes need a classic PAT with the user scope. Prefer subset push.`;
  } catch (error) {
    state.existingLists = [];
    state.listsAvailable = false;
    els.listsNote.textContent = `${describeGitHubError(error)} Fetch and exports still work without Lists write.`;
  }
}

async function ensureList(name, description) {
  const existing = findListByName(state.existingLists, name);
  if (existing) return existing;

  const list = await createList(state.token, { name, description });
  state.existingLists = [...state.existingLists, list];
  return list;
}

async function syncGitHubLists() {
  if (!state.grouped || !state.token) return;

  const categories = state.grouped.categories.filter((category) => category.repositories.length > 0 && !category.isDefault);
  setBusy(true);
  setStatus(`Last-resort: pushing ${categories.length} non-empty categories to GitHub Lists via GraphQL. Prefer subset push.`, "info");

  let created = 0;
  let reused = 0;
  let failed = 0;

  for (const category of categories) {
    try {
      const already = findListByName(state.existingLists, category.name);
      const list = await ensureList(category.name, category.description || "Organized by GitHub Stars Organizer");
      if (already) reused += 1;
      else created += 1;

      for (const result of category.repositories) {
        await addRepoToList(state.token, list.id, result.repo, { lists: state.existingLists });
      }

      setStatus(`Category push ${created + reused}/${categories.length}: ${category.name}${already ? " (reused list)" : ""}`, "info");
    } catch (error) {
      failed += 1;
    }
  }

  setBusy(false);
  setStatus(`Category push finished. Created: ${created}. Reused: ${reused}. Failed: ${failed}.`, failed > 0 ? "error" : "success");
}

function importTaxonomy(event) {
  readJsonFile(event, (data) => {
    if (!Array.isArray(data)) {
      throw new Error("Taxonomy file must contain an array.");
    }
    state.categories = normalizeCategories(data);
    recategorize();
    setStatus(`Imported ${state.categories.length} categories. Filed rows stayed put.`, "success");
  });
}

function importCellarFile(event) {
  readJsonFile(event, (data) => {
    const parsed = parsePortableExport(data);
    applyImportedCellar(parsed);
    persistAndRender(`Imported JSON: ${state.repos.length} repositories. Token was not read.`);
  });
}

function applyImportedCellar(parsed) {
  state.categories = normalizeCategories(parsed.categories.length ? parsed.categories : DEFAULT_CATEGORIES);
  state.assignments = parsed.assignments;
  state.reviewed = parsed.reviewed;
  state.repos = parsed.repos;
  state.selectedRepoIds.clear();
  state.cursorRepoId = null;
  state.undoStack = [];
  state.grouped = state.repos.length > 0 ? applyGrouped() : null;
}

async function restoreCellar() {
  try {
    const cellar = await loadCellar();
    if (!cellar) {
      renderEmpty();
      return;
    }

    applyImportedCellar(cellar);
    if (state.grouped) renderAll();
    else renderEmpty();
    setStatus(`Restored filings from this browser (${cellar.savedAt}). Token was not stored.`, "success");
  } catch (error) {
    renderEmpty();
    setStatus(error.message, "error");
  }
}

async function clearThisCellar() {
  const confirmed = globalThis.confirm("Clear saved filings in this browser? The GitHub token was never stored.");
  if (!confirmed) return;

  await clearCellar();
  state.repos = [];
  state.assignments = {};
  state.reviewed = {};
  state.grouped = null;
  state.selectedRepoIds.clear();
  state.cursorRepoId = null;
  state.undoStack = [];
  state.categories = normalizeCategories(DEFAULT_CATEGORIES);
  renderEmpty();
  setStatus("Cleared saved filings. The GitHub token was never stored.", "success");
}

function persistAndRender(message) {
  refreshGroups();
  persistCellar();
  if (state.grouped) renderAll();
  else renderEmpty();
  if (message) setStatus(message, "success");
}

async function persistCellar() {
  try {
    await saveCellar(buildCellarSnapshot({
      categories: state.categories,
      assignments: state.assignments,
      reviewed: state.reviewed,
      repos: state.repos,
    }));
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function currentPortableExport() {
  return exportPortableJson(state.grouped, {
    assignments: state.assignments,
    reviewed: state.reviewed,
  });
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
    metric("Inbox", "0"),
  );
  const message = state.repos.length === 0
    ? "Nothing filed yet. Import github-stars-organized.json or analyze stars. The token stays in the tab."
    : "Fetch your stars to review categories, apply a subset, or export clean files.";
  els.repoList.replaceChildren(emptyState(message));
  updateActionAvailability();
}

function renderMetrics() {
  const { total, categorized, uncategorized } = state.grouped.metrics;
  const inbox = inboxCount(state.grouped.results);
  const inboxMetric = metric("Inbox", inbox);
  inboxMetric.tabIndex = 0;
  inboxMetric.setAttribute("role", "button");
  inboxMetric.title = "Show the review inbox";
  inboxMetric.addEventListener("click", showInbox);
  inboxMetric.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showInbox();
    }
  });

  els.metrics.replaceChildren(
    metric("Repos", total),
    metric("Categorized", categorized),
    metric("Uncategorized", uncategorized),
    inboxMetric,
  );
}

function showInbox() {
  state.reviewOnly = true;
  state.selectedCategory = "all";
  els.reviewOnly.checked = true;
  renderFilterControls();
  renderRepos();
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
  els.reviewOnly.checked = state.reviewOnly;
  renderSelectionSummary();
  updateActionAvailability();
}

function renderRepos() {
  if (!state.grouped) {
    state.cursorRepoId = null;
    els.repoList.replaceChildren(emptyState(emptyListMessage()));
    renderSelectionSummary();
    updateActionAvailability();
    return;
  }

  const results = getVisibleResults();
  syncCursor(results.map((result) => String(result.repo.id)));
  if (results.length === 0) {
    els.repoList.replaceChildren(emptyState(emptyListMessage()));
    renderSelectionSummary();
    updateActionAvailability();
    return;
  }

  els.repoList.replaceChildren(...results.map(repoRow));
  els.repoList.querySelector(".repo-row.is-cursor")?.scrollIntoView({ block: "nearest" });
  renderSelectionSummary();
  updateActionAvailability();
}

function emptyListMessage() {
  if (!state.grouped && state.repos.length === 0) {
    return "Nothing filed yet. Import github-stars-organized.json or analyze stars.";
  }
  if (state.grouped && state.grouped.results.length === 0) {
    return "This GitHub account has zero starred repositories.";
  }
  if (state.reviewOnly && state.grouped && inboxCount(state.grouped.results) === 0) {
    return "Inbox is clear. Filed, Read Later, and reviewed rows are hidden.";
  }
  return "No repositories match this filter. Clear search or turn off Inbox only.";
}

function getVisibleResults() {
  if (!state.grouped) return [];

  return state.grouped.results.filter((result) => {
    const categoryMatch = state.selectedCategory === "all" || result.primaryCategory.id === state.selectedCategory;
    const reviewMatch = !state.reviewOnly || isInboxRow(result);
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
  const repoId = String(result.repo.id);
  const row = document.createElement("article");
  row.className = "repo-row";
  row.dataset.repoId = repoId;
  if (state.cursorRepoId === repoId) {
    row.classList.add("is-cursor");
    row.setAttribute("aria-current", "true");
  }
  row.addEventListener("pointerdown", () => setCursor(repoId, { quiet: true }));

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
  const inbox = state.grouped ? inboxCount(state.grouped.results) : 0;
  els.selectionSummary.textContent = `${selectedCount} selected · ${visibleCount} visible · ${inbox} in inbox`;
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
  els.importCellar.disabled = state.isBusy;
  els.clearCellar.disabled = state.isBusy;
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

function readJsonFile(event, onData) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      onData(JSON.parse(String(reader.result)));
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
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

function onFilingKey(event) {
  const action = resolveFilingKey({
    key: event.key,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    typing: isTypingTarget(event.target),
    control: Boolean(event.target?.closest?.("button, a, summary, [role='button']")),
  });
  if (!action) return;
  event.preventDefault();
  handleFilingAction(action);
}

function handleFilingAction(action) {
  if (state.isBusy || !state.grouped) return;
  if (action === "next") moveCursor(1);
  else if (action === "previous") moveCursor(-1);
  else if (action === "file") fileCurrentSuggestion();
  else if (action === "skip") skipCurrent();
  else if (action === "read-later") readLaterCurrent();
  else if (action === "undo") undoLastFiling();
  else if (action === "select") toggleCursorSelection();
}

function moveCursor(delta) {
  const ids = visibleRepoIds();
  if (ids.length === 0) return;
  setCursor(stepCursor(ids, state.cursorRepoId, delta));
}

function setCursor(repoId, { quiet = false } = {}) {
  const id = repoId ? String(repoId) : null;
  if (state.cursorRepoId === id) return;
  state.cursorRepoId = id;
  if (quiet && els.repoList) {
    for (const node of els.repoList.querySelectorAll(".repo-row")) {
      const on = node.dataset.repoId === id;
      node.classList.toggle("is-cursor", on);
      if (on) node.setAttribute("aria-current", "true");
      else node.removeAttribute("aria-current");
    }
    return;
  }
  renderRepos();
}

function fileCurrentSuggestion() {
  const result = currentResult();
  if (!result) return;
  const target = result.primaryCategory;
  commitFiling(result.repo.id, () => fileResult(result, target), `Filed ${result.repo.full_name} into ${target.name}.`);
}

function skipCurrent() {
  const result = currentResult();
  if (!result) return;
  commitFiling(result.repo.id, () => {
    result.reviewed = true;
    state.reviewed = setReviewedFlag(state.reviewed, result.repo.id, true);
  }, `Skipped ${result.repo.full_name}. Still on its shelf.`);
}

function readLaterCurrent() {
  const result = currentResult();
  const target = state.categories.find((category) => category.id === "read-later");
  if (!result || !target) return;
  commitFiling(result.repo.id, () => fileResult(result, target), `Filed ${result.repo.full_name} into Read Later.`);
}

function undoLastFiling() {
  const entry = state.undoStack.at(-1);
  if (!entry) {
    setStatus("Nothing to undo in this tab.", "info");
    return;
  }

  state.undoStack = state.undoStack.slice(0, -1);
  const restored = restoreFiling({ assignments: state.assignments, reviewed: state.reviewed }, entry);
  state.assignments = restored.assignments;
  state.reviewed = restored.reviewed;
  state.cursorRepoId = entry.repoId;
  const result = resultById(entry.repoId);
  const name = result?.repo.full_name || `repository ${entry.repoId}`;
  persistAndRender(`Undid last filing for ${name}.`);
}

function toggleCursorSelection() {
  const result = currentResult();
  if (!result) return;
  const id = String(result.repo.id);
  toggleRepoSelection(id, !state.selectedRepoIds.has(id));
  renderRepos();
}

function commitFiling(repoId, mutate, message) {
  const beforeIds = visibleRepoIds();
  const id = String(repoId);
  rememberFiling(id);
  mutate();
  refreshGroups();
  state.cursorRepoId = advanceCursor(beforeIds, id, visibleRepoIds());
  persistCellar();
  if (state.grouped) renderAll();
  else renderEmpty();
  if (message) setStatus(message, "success");
}

function rememberFiling(repoId) {
  state.undoStack = pushUndo(state.undoStack, captureFiling({
    assignments: state.assignments,
    reviewed: state.reviewed,
  }, repoId));
}

function currentResult() {
  const ids = visibleRepoIds();
  if (ids.length === 0) return null;
  syncCursor(ids);
  return resultById(state.cursorRepoId);
}

function resultById(repoId) {
  const id = String(repoId);
  return state.grouped?.results.find((item) => String(item.repo.id) === id) || null;
}

function visibleRepoIds() {
  return getVisibleResults().map((result) => String(result.repo.id));
}

function syncCursor(visibleIds) {
  if (!visibleIds.length) {
    state.cursorRepoId = null;
    return;
  }
  if (!visibleIds.includes(state.cursorRepoId)) {
    state.cursorRepoId = visibleIds[0];
  }
}

function isTypingTarget(target) {
  if (!target || target === document.body) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target.type || "text").toLowerCase();
  return !["checkbox", "radio", "button", "submit", "reset", "file"].includes(type);
}
