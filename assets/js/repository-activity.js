(() => {
  "use strict";

  const repository = "MoDuLah/modulah.github.io";
  const fallbackBranch = "main";
  const apiBase = `https://api.github.com/repos/${repository}`;
  const cacheKey = `modulah:repository-activity:${repository}`;
  const cacheTtlMs = 5 * 60 * 1000;
  const maxPages = 50;

  const categoryDefinitions = {
    origin: {
      label: "ORIGIN",
      dotClass: "border-[#ff00ff] shadow-[0_0_8px_rgba(255,0,255,0.55)]",
      labelClass: "text-[#ff00ff]",
    },
    release: {
      label: "RELEASE",
      dotClass: "border-secondary-fixed shadow-[0_0_8px_rgba(121,255,91,0.45)]",
      labelClass: "text-secondary-fixed",
    },
    security: {
      label: "SECURITY",
      dotClass: "border-tertiary-fixed-dim shadow-[0_0_8px_rgba(255,186,56,0.45)]",
      labelClass: "text-tertiary-fixed-dim",
    },
    fix: {
      label: "FIX",
      dotClass: "border-[#00daf3] shadow-[0_0_8px_rgba(0,218,243,0.4)]",
      labelClass: "text-[#00daf3]",
    },
    infrastructure: {
      label: "INFRA",
      dotClass: "border-[#9cf0ff] shadow-[0_0_8px_rgba(156,240,255,0.35)]",
      labelClass: "text-[#9cf0ff]",
    },
    merge: {
      label: "MERGE",
      dotClass: "border-[#ff00ff] shadow-[0_0_8px_rgba(255,0,255,0.4)]",
      labelClass: "text-[#ff00ff]",
    },
    asset: {
      label: "ASSET",
      dotClass: "border-outline shadow-[0_0_8px_rgba(132,147,150,0.3)]",
      labelClass: "text-outline",
    },
    update: {
      label: "UPDATE",
      dotClass: "border-[#98f05f] shadow-[0_0_8px_rgba(152,240,95,0.35)]",
      labelClass: "text-[#98f05f]",
    },
  };

  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const dayHeadingFormatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

  function createElement(tagName, className = "", textContent = "") {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
  }

  function formatDate(value, formatter) {
    return formatter.format(new Date(value)).replaceAll(",", "").toUpperCase();
  }

  function encodeRefPath(ref) {
    return ref.split("/").map(encodeURIComponent).join("/");
  }

  function classifyCommit(subject, isOrigin) {
    if (isOrigin) return categoryDefinitions.origin;
    if (/^merge\b/i.test(subject)) return categoryDefinitions.merge;
    if (/(security|vulnerab|codeql|trivy|gitleaks|dependabot|dependenc|audit)/i.test(subject)) {
      return categoryDefinitions.security;
    }
    if (
      /(release|publish|launch|add jobcentre|add tornfolio|website page|update hub releases)/i.test(
        subject
      )
    ) {
      return categoryDefinitions.release;
    }
    if (
      /(^|[\s:])(fix|hotfix|repair|restore|revert|correct|bound|handle|prevent|resolve)(\b|:)/i.test(
        subject
      )
    ) {
      return categoryDefinitions.fix;
    }
    if (
      /(workflow|github actions|\bci\b|lint|deploy|pages|publisher|changelog|test|build)/i.test(
        subject
      )
    ) {
      return categoryDefinitions.infrastructure;
    }
    if (/(image|logo|banner|screenshot|\.png\b|asset)/i.test(subject)) {
      return categoryDefinitions.asset;
    }
    return categoryDefinitions.update;
  }

  function normalizeCommit(item) {
    const details = item && item.commit ? item.commit : {};
    const committer = details.committer || {};
    const author = details.author || {};
    const message = String(details.message || "Untitled commit").trim();

    return {
      sha: String(item.sha || ""),
      subject: message.split(/\r?\n/, 1)[0] || "Untitled commit",
      committedAt: committer.date || author.date || new Date(0).toISOString(),
      url: String(item.html_url || `https://github.com/${repository}/commit/${item.sha || ""}`),
    };
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
      const suffix = rateLimitRemaining === "0" ? " GitHub API rate limit reached." : "";
      throw new Error(`GitHub API returned ${response.status}.${suffix}`);
    }

    return response.json();
  }

  async function resolveDefaultBranch() {
    try {
      const metadata = await fetchJson(apiBase);
      return String(metadata.default_branch || fallbackBranch);
    } catch (error) {
      console.warn("Repository branch lookup failed; using main.", error);
      return fallbackBranch;
    }
  }

  async function fetchAllCommits(branch) {
    const commits = [];

    for (let page = 1; page <= maxPages; page += 1) {
      const url = `${apiBase}/commits?sha=${encodeURIComponent(branch)}&per_page=100&page=${page}`;
      const pageItems = await fetchJson(url);
      if (!Array.isArray(pageItems)) throw new Error("GitHub returned an invalid commit list.");

      commits.push(...pageItems.map(normalizeCommit));
      if (pageItems.length < 100) return commits;
    }

    throw new Error(`Repository history exceeds the ${maxPages * 100}-commit browser limit.`);
  }

  function readCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (!parsed || !Array.isArray(parsed.commits) || !parsed.commits.length) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeCache(branch, commits) {
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          savedAt: Date.now(),
          branch,
          commits,
        })
      );
    } catch {
      // A private browsing mode or storage policy may block localStorage.
    }
  }

  function createTimelineEntry(commit, index, total) {
    const category = classifyCommit(commit.subject, index === total - 1);
    const item = createElement(
      "li",
      "relative flex gap-3 pb-5 before:absolute before:left-[5px] before:top-5 before:bottom-0 before:w-px before:bg-white/10 last:pb-0 last:before:hidden"
    );
    item.dataset.category = category.label.toLowerCase();
    item.dataset.commitSha = commit.sha;

    const dot = createElement(
      "span",
      `relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full border bg-background ${category.dotClass}`
    );
    dot.setAttribute("aria-hidden", "true");

    const content = createElement("div", "min-w-0 flex-1");
    const titleRow = createElement("div", "flex flex-wrap items-start gap-x-2 gap-y-1");
    const categoryLabel = createElement(
      "span",
      `shrink-0 font-label-caps text-[9px] uppercase tracking-widest ${category.labelClass}`,
      category.label
    );
    const titleLink = createElement(
      "a",
      "min-w-0 break-words text-on-surface hover:text-[#98f05f] transition-colors",
      commit.subject
    );
    titleLink.href = commit.url;
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";
    titleRow.append(categoryLabel, titleLink);

    const metadata = createElement(
      "div",
      "mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-outline-variant"
    );
    const time = createElement(
      "time",
      "",
      `${timeFormatter.format(new Date(commit.committedAt))} UTC`
    );
    time.dateTime = commit.committedAt;
    const separator = createElement("span", "", "//");
    separator.setAttribute("aria-hidden", "true");
    const shaLink = createElement(
      "a",
      "uppercase hover:text-[#98f05f] transition-colors",
      commit.sha.slice(0, 7)
    );
    shaLink.href = commit.url;
    shaLink.target = "_blank";
    shaLink.rel = "noopener noreferrer";
    metadata.append(time, separator, shaLink);

    content.append(titleRow, metadata);
    item.append(dot, content);
    return item;
  }

  function createTimeline(commits) {
    const timeline = createElement("ol", "relative");
    timeline.id = "system-activity-timeline";
    timeline.setAttribute("aria-label", "Repository commit history");

    let activeDay = "";
    commits.forEach((commit, index) => {
      const day = new Date(commit.committedAt).toISOString().slice(0, 10);
      if (day !== activeDay) {
        activeDay = day;
        const heading = createElement(
          "li",
          "sticky top-0 z-20 -mx-1 mb-3 bg-[#0d1117]/95 px-1 py-1.5 backdrop-blur-md"
        );
        const headingTime = createElement(
          "time",
          "font-label-caps text-[9px] uppercase tracking-[0.16em] text-outline",
          formatDate(commit.committedAt, dayHeadingFormatter)
        );
        headingTime.dateTime = day;
        heading.append(headingTime);
        timeline.append(heading);
      }

      timeline.append(createTimelineEntry(commit, index, commits.length));
    });

    return timeline;
  }

  function renderFeed(feed, branch, commits, sourceLabel) {
    if (!commits.length) return;

    const latest = commits[0];
    const earliest = commits[commits.length - 1];
    const panel = createElement(
      "div",
      "glass-panel rounded-lg flex h-[34rem] min-h-0 flex-col xl:h-full"
    );
    const header = createElement(
      "div",
      "border-b border-white/10 p-4 bg-surface-container-lowest/50 rounded-t-lg shrink-0"
    );
    const titleRow = createElement("div", "flex items-center justify-between gap-3");
    const title = createElement(
      "h2",
      "font-label-caps text-label-caps text-[#98f05f] uppercase tracking-wider flex items-center gap-2"
    );
    title.id = "system-activity-title";
    const historyIcon = createElement("span", "material-symbols-outlined text-[16px]", "history");
    historyIcon.setAttribute("aria-hidden", "true");
    title.append(historyIcon, document.createTextNode(" System Activity Feed"));

    const statusGroup = createElement("div", "flex shrink-0 items-center gap-2");
    const source = createElement(
      "span",
      "font-label-caps text-[8px] uppercase tracking-wider text-outline",
      sourceLabel
    );
    const count = createElement(
      "span",
      "font-label-caps text-[9px] uppercase tracking-wider text-secondary-fixed",
      `${commits.length} COMMITS`
    );
    count.id = "activity-commit-count";
    statusGroup.append(source, count);
    titleRow.append(title, statusGroup);

    const summary = createElement(
      "div",
      "mt-2 flex flex-wrap items-center justify-between gap-2 font-code-sm text-[10px] text-outline-variant"
    );
    const range = createElement(
      "span",
      "",
      `${formatDate(earliest.committedAt, dateFormatter)} → ${formatDate(latest.committedAt, dateFormatter)}`
    );
    const fullLog = createElement(
      "a",
      "uppercase hover:text-[#98f05f] transition-colors",
      "Full Git Log"
    );
    fullLog.href = `https://github.com/${repository}/commits/${encodeRefPath(branch)}`;
    fullLog.target = "_blank";
    fullLog.rel = "noopener noreferrer";
    summary.append(range, fullLog);
    header.append(titleRow, summary);

    const scrollArea = createElement(
      "div",
      "p-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar font-code-sm text-code-sm"
    );
    scrollArea.id = "activity-timeline-scroll";
    scrollArea.append(createTimeline(commits));
    panel.append(header, scrollArea);

    feed.id = "system-activity-feed";
    feed.setAttribute("aria-labelledby", "system-activity-title");
    feed.replaceChildren(panel);
  }

  async function start() {
    const feed = document.querySelector('[data-boot-section="activity"]');
    if (!feed) return;

    const cached = readCache();
    if (cached) {
      const isFresh = Date.now() - Number(cached.savedAt || 0) < cacheTtlMs;
      renderFeed(
        feed,
        cached.branch || fallbackBranch,
        cached.commits,
        isFresh ? "CACHED" : "STALE CACHE"
      );
      if (isFresh) {
        feed.setAttribute("aria-busy", "false");
        return;
      }
    }

    feed.setAttribute("aria-busy", "true");
    try {
      const branch = await resolveDefaultBranch();
      const commits = await fetchAllCommits(branch);
      if (!commits.length) throw new Error("GitHub returned no commits.");
      writeCache(branch, commits);
      renderFeed(feed, branch, commits, "LIVE GIT");
    } catch (error) {
      console.warn(
        "Live repository activity could not be loaded; preserving the fallback feed.",
        error
      );
    } finally {
      feed.setAttribute("aria-busy", "false");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void start();
    });
  } else {
    void start();
  }
})();
