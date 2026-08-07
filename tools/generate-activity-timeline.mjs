#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const htmlPath = process.argv[2] || 'code.html';
const repositoryUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
  : 'https://github.com/MoDuLah/modulah.github.io';
const automatedTimelineCommit = 'chore: refresh system activity timeline';
const activityStart = '<!-- Activity Feed (Left Column) -->';
const activityEnd = '<!-- Project Modules (Right Area) -->';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readCommits() {
  const raw = execFileSync(
    'git',
    ['log', '--date-order', '--pretty=format:%H%x1f%cI%x1f%s%x1e'],
    { encoding: 'utf8' }
  );

  return raw
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, committedAt, ...subjectParts] = record.split('\x1f');
      return {
        sha,
        committedAt,
        subject: subjectParts.join('\x1f').trim() || 'Untitled commit'
      };
    })
    .filter((commit) => commit.subject !== automatedTimelineCommit);
}

const categoryDefinitions = {
  origin: {
    label: 'ORIGIN',
    dotClass: 'border-[#ff00ff] shadow-[0_0_8px_rgba(255,0,255,0.55)]',
    labelClass: 'text-[#ff00ff]'
  },
  release: {
    label: 'RELEASE',
    dotClass: 'border-secondary-fixed shadow-[0_0_8px_rgba(121,255,91,0.45)]',
    labelClass: 'text-secondary-fixed'
  },
  security: {
    label: 'SECURITY',
    dotClass: 'border-tertiary-fixed-dim shadow-[0_0_8px_rgba(255,186,56,0.45)]',
    labelClass: 'text-tertiary-fixed-dim'
  },
  fix: {
    label: 'FIX',
    dotClass: 'border-[#00daf3] shadow-[0_0_8px_rgba(0,218,243,0.4)]',
    labelClass: 'text-[#00daf3]'
  },
  infrastructure: {
    label: 'INFRA',
    dotClass: 'border-[#9cf0ff] shadow-[0_0_8px_rgba(156,240,255,0.35)]',
    labelClass: 'text-[#9cf0ff]'
  },
  merge: {
    label: 'MERGE',
    dotClass: 'border-[#ff00ff] shadow-[0_0_8px_rgba(255,0,255,0.4)]',
    labelClass: 'text-[#ff00ff]'
  },
  asset: {
    label: 'ASSET',
    dotClass: 'border-outline shadow-[0_0_8px_rgba(132,147,150,0.3)]',
    labelClass: 'text-outline'
  },
  update: {
    label: 'UPDATE',
    dotClass: 'border-[#98f05f] shadow-[0_0_8px_rgba(152,240,95,0.35)]',
    labelClass: 'text-[#98f05f]'
  }
};

function classifyCommit(subject, isOrigin) {
  if (isOrigin) return categoryDefinitions.origin;
  if (/^merge\b/i.test(subject)) return categoryDefinitions.merge;
  if (/(security|vulnerab|codeql|trivy|gitleaks|dependabot|dependenc|audit)/i.test(subject)) {
    return categoryDefinitions.security;
  }
  if (/(release|publish|launch|add jobcentre|add tornfolio|website page|update hub releases)/i.test(subject)) {
    return categoryDefinitions.release;
  }
  if (/(^|[\s:])(fix|hotfix|repair|restore|revert|correct|bound|handle|prevent|resolve)(\b|:)/i.test(subject)) {
    return categoryDefinitions.fix;
  }
  if (/(workflow|github actions|\bci\b|lint|deploy|pages|publisher|changelog|test|build)/i.test(subject)) {
    return categoryDefinitions.infrastructure;
  }
  if (/(image|logo|banner|screenshot|\.png\b|asset)/i.test(subject)) {
    return categoryDefinitions.asset;
  }
  return categoryDefinitions.update;
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
});
const dayHeadingFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
});
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC'
});

function formatDate(date, formatter) {
  return formatter.format(new Date(date)).replaceAll(',', '').toUpperCase();
}

function renderCommit(commit, index, total) {
  const isOrigin = index === total - 1;
  const category = classifyCommit(commit.subject, isOrigin);
  const commitUrl = `${repositoryUrl}/commit/${commit.sha}`;
  const safeSubject = escapeHtml(commit.subject);
  const safeSha = escapeHtml(commit.sha.slice(0, 7));
  const safeDate = escapeHtml(commit.committedAt);
  const displayTime = escapeHtml(`${timeFormatter.format(new Date(commit.committedAt))} UTC`);

  return `<li class="relative flex gap-3 pb-5 before:absolute before:left-[5px] before:top-5 before:bottom-0 before:w-px before:bg-white/10 last:pb-0 last:before:hidden" data-category="${category.label.toLowerCase()}" data-commit-sha="${escapeHtml(commit.sha)}">
<span aria-hidden="true" class="relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full border bg-background ${category.dotClass}"></span>
<div class="min-w-0 flex-1">
<div class="flex flex-wrap items-start gap-x-2 gap-y-1">
<span class="shrink-0 font-label-caps text-[9px] uppercase tracking-widest ${category.labelClass}">${category.label}</span>
<a class="min-w-0 break-words text-on-surface hover:text-[#98f05f] transition-colors" href="${commitUrl}" rel="noopener noreferrer" target="_blank">${safeSubject}</a>
</div>
<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-outline-variant">
<time datetime="${safeDate}">${displayTime}</time>
<span aria-hidden="true">//</span>
<a class="uppercase hover:text-[#98f05f] transition-colors" href="${commitUrl}" rel="noopener noreferrer" target="_blank">${safeSha}</a>
</div>
</div>
</li>`;
}

function renderTimeline(commits) {
  const groups = [];
  const groupMap = new Map();

  commits.forEach((commit, index) => {
    const dayKey = new Date(commit.committedAt).toISOString().slice(0, 10);
    let group = groupMap.get(dayKey);
    if (!group) {
      group = { dayKey, date: commit.committedAt, entries: [] };
      groupMap.set(dayKey, group);
      groups.push(group);
    }
    group.entries.push({ commit, index });
  });

  return groups
    .map((group) => {
      const entries = group.entries
        .map(({ commit, index }) => renderCommit(commit, index, commits.length))
        .join('\n');
      const heading = escapeHtml(formatDate(group.date, dayHeadingFormatter));
      return `<li class="sticky top-0 z-20 -mx-1 mb-3 bg-[#0d1117]/95 px-1 py-1.5 backdrop-blur-md">
<time class="font-label-caps text-[9px] uppercase tracking-[0.16em] text-outline" datetime="${group.dayKey}">${heading}</time>
</li>
${entries}`;
    })
    .join('\n');
}

function renderActivityAside(commits) {
  const latest = commits[0];
  const earliest = commits.at(-1);
  const timeline = renderTimeline(commits);
  const historyRange = `${formatDate(earliest.committedAt, dateFormatter)} → ${formatDate(latest.committedAt, dateFormatter)}`;
  const commitsUrl = `${repositoryUrl}/commits/main`;

  return `${activityStart}
<aside aria-labelledby="system-activity-title" class="xl:col-span-3 flex flex-col gap-4 fade-slide-up h-full min-h-0 overflow-visible xl:overflow-hidden" data-boot-section="activity" id="system-activity-feed" style="animation-delay: 0.5s;">
<div class="glass-panel rounded-lg flex h-[34rem] min-h-0 flex-col xl:h-full">
<div class="border-b border-white/10 p-4 bg-surface-container-lowest/50 rounded-t-lg shrink-0">
<div class="flex items-center justify-between gap-3">
<h2 class="font-label-caps text-label-caps text-[#98f05f] uppercase tracking-wider flex items-center gap-2" id="system-activity-title">
<span aria-hidden="true" class="material-symbols-outlined text-[16px]">history</span>
System Activity Feed
</h2>
<span class="shrink-0 font-label-caps text-[9px] uppercase tracking-wider text-secondary-fixed" id="activity-commit-count">${commits.length} COMMITS</span>
</div>
<div class="mt-2 flex flex-wrap items-center justify-between gap-2 font-code-sm text-[10px] text-outline-variant">
<span>${escapeHtml(historyRange)}</span>
<a class="uppercase hover:text-[#98f05f] transition-colors" href="${commitsUrl}" rel="noopener noreferrer" target="_blank">Full Git Log</a>
</div>
</div>
<div class="p-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar font-code-sm text-code-sm" id="activity-timeline-scroll">
<!-- ACTIVITY_TIMELINE_START -->
<ol aria-label="Repository commit history" class="relative" id="system-activity-timeline">
${timeline}
</ol>
<!-- ACTIVITY_TIMELINE_END -->
</div>
</div>
</aside>`;
}

const commits = readCommits();
if (commits.length === 0) {
  throw new Error('No repository commits were found.');
}

const html = readFileSync(htmlPath, 'utf8');
const startIndex = html.indexOf(activityStart);
const endIndex = html.indexOf(activityEnd);
if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
  throw new Error('Could not locate the System Activity Feed region in code.html.');
}

const nextHtml = `${html.slice(0, startIndex)}${renderActivityAside(commits)}\n${html.slice(endIndex)}`;
if (nextHtml !== html) {
  writeFileSync(htmlPath, nextHtml);
  console.log(`Updated ${htmlPath} with ${commits.length} repository commits.`);
} else {
  console.log(`${htmlPath} already contains the current repository timeline.`);
}
