const DEFAULT_CATEGORY_INPUT = [
  {
    id: "ai-ml",
    name: "AI & ML",
    description: "Models, machine learning frameworks, inference, embeddings, and AI infrastructure",
    keywords: ["ai", "ml", "llm", "gpt", "transformer", "neural", "machine", "learning", "tensorflow", "pytorch", "model", "inference", "embedding", "vector", "ggml", "whisper", "llama", "mistral", "ollama", "huggingface", "diffusion"],
    languages: ["Jupyter Notebook"],
  },
  {
    id: "ai-agents",
    name: "AI Agents & Automation",
    description: "Agentic workflows, assistants, MCP servers, and AI-powered coding tools",
    keywords: ["agent", "agents", "mcp", "claude", "copilot", "assistant", "autonomous", "agentic", "langchain", "autogen", "crew", "workflow", "automation", "openai"],
    languages: [],
  },
  {
    id: "developer-tools",
    name: "Developer Tools",
    description: "CLIs, editors, plugins, Git tooling, SDKs, and developer productivity utilities",
    keywords: ["cli", "tool", "tools", "utility", "developer", "devtool", "plugin", "extension", "editor", "ide", "git", "sdk", "terminal"],
    languages: [],
  },
  {
    id: "web-apps",
    name: "Web & App Development",
    description: "Frontend, backend, full-stack apps, APIs, and application frameworks",
    keywords: ["web", "api", "rest", "graphql", "frontend", "backend", "fullstack", "react", "vue", "next", "svelte", "database", "cms", "crm", "scraper"],
    languages: ["HTML", "CSS", "PHP"],
  },
  {
    id: "data-analytics",
    name: "Data & Analytics",
    description: "Data engineering, visualization, notebooks, BI, and analytics workflows",
    keywords: ["data", "analytics", "visualization", "dashboard", "notebook", "etl", "warehouse", "pipeline", "pandas", "spark", "bi"],
    languages: ["Jupyter Notebook", "R"],
  },
  {
    id: "infra-devops",
    name: "Infrastructure & DevOps",
    description: "Cloud, containers, deployment, observability, networking, and platform engineering",
    keywords: ["docker", "kubernetes", "k8s", "terraform", "ansible", "cloud", "deploy", "deployment", "observability", "monitoring", "serverless", "infra", "devops", "ci", "cd"],
    languages: ["HCL", "Shell"],
  },
  {
    id: "security-privacy",
    name: "Security & Privacy",
    description: "Security tools, privacy, authentication, encryption, and ethical hacking",
    keywords: ["security", "privacy", "pentest", "vulnerability", "exploit", "encryption", "auth", "identity", "password", "secret", "zero", "trust"],
    languages: [],
  },
  {
    id: "databases-storage",
    name: "Databases & Storage",
    description: "Databases, caches, search indexes, filesystems, queues, and persistence layers",
    keywords: ["database", "postgres", "mysql", "sqlite", "redis", "mongo", "elasticsearch", "search", "cache", "queue", "storage", "filesystem"],
    languages: ["SQL"],
  },
  {
    id: "languages-frameworks",
    name: "Languages & Frameworks",
    description: "Programming languages, runtimes, compilers, frameworks, and package ecosystems",
    keywords: ["language", "compiler", "runtime", "framework", "library", "package", "stdlib", "wasm", "typescript", "python", "rust", "go"],
    languages: ["Rust", "Go", "Python", "Ruby", "Java", "C", "C++", "C#"],
  },
  {
    id: "learning-reference",
    name: "Learning & Reference",
    description: "Books, courses, awesome lists, tutorials, roadmaps, and reference material",
    keywords: ["learn", "tutorial", "course", "book", "guide", "algorithm", "interview", "awesome", "curated", "roadmap", "study", "education", "primer", "handbook"],
    languages: [],
  },
  {
    id: "design-creative",
    name: "Design & Creative",
    description: "Design systems, graphics, creative coding, image generation, and visual tools",
    keywords: ["design", "creative", "graphics", "image", "generation", "generative", "figma", "canvas", "comfyui", "stable", "diffusion", "art"],
    languages: [],
  },
  {
    id: "business-finance",
    name: "Business & Finance",
    description: "Finance, accounting, trading, crypto, business operations, and market tools",
    keywords: ["finance", "trading", "quant", "stock", "crypto", "blockchain", "defi", "investment", "portfolio", "market", "financial", "banking", "fintech", "accounting"],
    languages: [],
  },
  {
    id: "science-research",
    name: "Science & Research",
    description: "Bioinformatics, health, scientific computing, simulation, and research tooling",
    keywords: ["bio", "health", "medical", "genomic", "protein", "molecular", "drug", "pharma", "clinical", "dna", "rna", "cell", "science", "simulation"],
    languages: ["R", "MATLAB", "Julia"],
  },
  {
    id: "productivity",
    name: "Productivity",
    description: "Personal systems, notes, task management, automation, and workflow helpers",
    keywords: ["productivity", "notes", "tasks", "calendar", "knowledge", "workflow", "automation", "personal", "organizer"],
    languages: [],
  },
  {
    id: "read-later",
    name: "Read Later",
    description: "Manual holding area for repositories to review later",
    keywords: [],
    languages: [],
    manual: true,
  },
  {
    id: "uncategorized",
    name: "Uncategorized",
    description: "Repositories with no confident category match",
    keywords: [],
    languages: [],
    isDefault: true,
  },
];

export const DEFAULT_CATEGORIES = Object.freeze(DEFAULT_CATEGORY_INPUT.map(createCategory));

export function createCategory(input) {
  const id = String(input.id || slugify(input.name)).trim();
  const name = String(input.name || id).trim();
  const keywords = Array.from(new Set((input.keywords || []).flatMap((keyword) => [...tokenizeText(keyword)])));

  return Object.freeze({
    id,
    name,
    description: String(input.description || "").trim(),
    keywords: Object.freeze(keywords),
    languages: Object.freeze(Array.from(new Set(input.languages || []))),
    manual: Boolean(input.manual),
    isDefault: Boolean(input.isDefault),
  });
}

export function isLikelyGitHubToken(value) {
  const token = String(value || "").trim();
  return /^(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}$/.test(token)
    || /^github_pat_[A-Za-z0-9_]{20,}$/.test(token);
}

export function tokenizeRepo(repo) {
  return tokenizeText([
    repo?.name,
    repo?.full_name,
    repo?.description,
    ...(repo?.topics || []),
  ].filter(Boolean).join(" "));
}

export function tokenizeText(value) {
  const words = String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return new Set(words);
}

export function categorizeRepo(repo, categories = DEFAULT_CATEGORIES) {
  const tokens = tokenizeRepo(repo);
  const usableCategories = categories.map((category) => createCategory(category));
  const defaultCategory = usableCategories.find((category) => category.isDefault)
    || createCategory({ id: "uncategorized", name: "Uncategorized", isDefault: true });

  const candidates = usableCategories
    .filter((category) => !category.manual && !category.isDefault)
    .map((category) => scoreCategory(repo, tokens, category))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.category.name.localeCompare(b.category.name));

  const best = candidates[0];
  const primaryCategory = best ? best.category : defaultCategory;
  const explanations = best ? best.matches.map((match) => `${match.type}: ${match.value}`) : [];

  return {
    repo,
    primaryCategory,
    candidates: candidates.slice(0, 3).map((candidate) => ({
      category: candidate.category,
      score: candidate.score,
      matches: candidate.matches,
    })),
    score: best?.score || 0,
    confidence: scoreToConfidence(best?.score || 0),
    explanations,
  };
}

export function categorizeRepos(repos, categories = DEFAULT_CATEGORIES) {
  const results = repos.map((repo) => categorizeRepo(repo, categories));
  const categoryMap = new Map();

  for (const result of results) {
    const existing = categoryMap.get(result.primaryCategory.id) || {
      ...result.primaryCategory,
      repositories: [],
    };
    existing.repositories.push(result);
    categoryMap.set(result.primaryCategory.id, existing);
  }

  const categoryOrder = new Map(categories.map((category, index) => [category.id, index]));
  const groupedCategories = Array.from(categoryMap.values()).sort((a, b) => {
    if (a.isDefault) return 1;
    if (b.isDefault) return -1;
    if (a.manual) return 1;
    if (b.manual) return -1;
    return (categoryOrder.get(a.id) ?? 999) - (categoryOrder.get(b.id) ?? 999);
  });

  const uncategorized = results.filter((result) => result.primaryCategory.isDefault).length;
  const lowConfidence = results.filter((result) => result.confidence !== "high").length;

  return {
    generatedAt: new Date().toISOString(),
    categories: groupedCategories,
    results,
    taxonomy: categories.map((category) => createCategory(category)),
    metrics: {
      total: repos.length,
      categorized: repos.length - uncategorized,
      uncategorized,
      lowConfidence,
    },
  };
}

export function exportPortableJson(grouped, options = {}) {
  const reviewed = {};
  for (const result of grouped.results || []) {
    if (result.reviewed) reviewed[String(result.repo.id)] = true;
  }

  return {
    generatedAt: grouped.generatedAt,
    metrics: grouped.metrics,
    taxonomy: grouped.taxonomy.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      keywords: [...category.keywords],
      languages: [...category.languages],
      manual: category.manual,
      isDefault: category.isDefault,
    })),
    categories: grouped.categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      repositories: category.repositories.map((result) => serializeRepo(result.repo, category.id)),
    })),
    assignments: { ...(options.assignments || {}) },
    reviewed: { ...reviewed, ...(options.reviewed || {}) },
  };
}

export function exportMarkdown(grouped) {
  const lines = [
    "# GitHub Stars Organized",
    "",
    `Generated: ${grouped.generatedAt}`,
    `${plural(grouped.metrics.total, "repository", "repositories")}. ${grouped.metrics.categorized} filed, ${grouped.metrics.uncategorized} still uncategorized.`,
    "",
  ];

  for (const category of grouped.categories) {
    lines.push(`## ${category.name} · ${category.repositories.length}`, "");
    if (category.description) lines.push(category.description, "");

    for (const result of [...category.repositories].sort((a, b) => (b.repo.stargazers_count || 0) - (a.repo.stargazers_count || 0))) {
      lines.push(markdownRepoLine(result));
      if (result.repo.description) lines.push(`  ${truncate(result.repo.description, 140)}`);
    }

    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function plural(count, singular, pluralWord) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function markdownRepoLine(result) {
  const repo = result.repo;
  const facts = [`${(repo.stargazers_count || 0).toLocaleString()} stars`];
  if (repo.language) facts.push(repo.language);
  if (repo.archived) facts.push("archived");
  return `- [${repo.full_name}](${repo.html_url}) · ${facts.join(" · ")}`;
}

export function serializeRepo(repo, categoryId) {
  return {
    id: repo.id,
    owner: repo.owner?.login || repo.full_name?.split("/")?.[0] || "",
    name: repo.name || repo.full_name?.split("/")?.[1] || "",
    description: repo.description || "",
    url: repo.html_url,
    language: repo.language || "",
    topics: [...(repo.topics || [])],
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    archived: Boolean(repo.archived),
    pushedAt: repo.pushed_at || "",
    license: repo.license?.spdx_id || "",
    category: categoryId,
  };
}

function scoreCategory(repo, tokens, category) {
  const matches = [];
  let score = 0;

  for (const keyword of category.keywords) {
    if (tokens.has(keyword)) {
      matches.push({ type: "keyword", value: keyword });
      score += 2;
    }
  }

  if (repo.language && category.languages.includes(repo.language)) {
    matches.push({ type: "language", value: repo.language });
    score += 3;
  }

  for (const topic of repo.topics || []) {
    const topicTokens = tokenizeText(topic);
    for (const keyword of category.keywords) {
      if (topicTokens.has(keyword)) {
        score += 1;
      }
    }
  }

  return { category, score, matches };
}

function scoreToConfidence(score) {
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  if (score > 0) return "low";
  return "none";
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function truncate(value, length) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}
