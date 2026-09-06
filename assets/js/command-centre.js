import { scripts, scriptReleases, moduleFaqs, moduleScreenshots } from './catalogue.js?v=20260825.10';

const scriptUpdateManifestUrl = 'assets/data/script-updates.json';
let automaticScriptReleases = [];

        function isAllowedMetadataUrl(value, prefix) {
            return typeof value === 'string'
                && value.length <= 300
                && value.startsWith(prefix);
        }

        function sanitiseMarketplace(value) {
            if (!value || typeof value !== 'object') return null;
            const author = value.author;
            const license = value.license;
            if (!author || typeof author.name !== 'string' || author.name.length > 80) return null;
            if (!isAllowedMetadataUrl(author.url, 'https://greasyfork.org/')) return null;
            if (!Number.isSafeInteger(value.dailyInstalls) || value.dailyInstalls < 0) return null;
            if (!Number.isSafeInteger(value.totalInstalls) || value.totalInstalls < 0) return null;
            if (typeof value.version !== 'string' || !/^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/.test(value.version)) return null;
            if (typeof value.createdDisplay !== 'string' || value.createdDisplay.length > 40) return null;
            if (typeof value.updatedDisplay !== 'string' || value.updatedDisplay.length > 40) return null;
            if (typeof value.size !== 'string' || value.size.length > 24) return null;
            if (!license || typeof license.name !== 'string' || license.name.length > 80) return null;
            if (license.url && !isAllowedMetadataUrl(license.url, 'https://spdx.org/licenses/')) return null;
            if (!Array.isArray(value.appliesTo) || value.appliesTo.length > 20) return null;

            const appliesTo = value.appliesTo.map((site) => {
                if (!site || typeof site.name !== 'string' || !/^[a-z0-9.-]{1,253}$/.test(site.name)) return null;
                if (!isAllowedMetadataUrl(site.url, 'https://greasyfork.org/en/scripts/by-site/')) return null;
                return { name: site.name, url: site.url };
            });
            if (appliesTo.some((site) => !site)) return null;

            return {
                author: { name: author.name, url: author.url },
                dailyInstalls: value.dailyInstalls,
                totalInstalls: value.totalInstalls,
                version: value.version,
                created: value.createdDisplay,
                updated: value.updatedDisplay,
                size: value.size,
                license: { name: license.name, url: license.url || '' },
                appliesTo
            };
        }

        function isSafeTimelineHref(value) {
            if (typeof value !== 'string' || value.length > 300) return false;
            if (value.startsWith('https://greasyfork.org/') || value.startsWith('https://pp-api.sokin.xyz/')) return true;
            return /^[A-Za-z0-9][A-Za-z0-9_./-]{0,199}$/.test(value)
                && !value.split('/').includes('..');
        }

        function sanitiseTimelineEvent(value) {
            if (!value || typeof value !== 'object') return null;
            if (typeof value.scriptId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value.scriptId)) return null;
            if (typeof value.title !== 'string' || !value.title.length || value.title.length > 140) return null;
            if (typeof value.version !== 'string' || !/^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/.test(value.version)) return null;
            if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null;
            if (Number.isNaN(Date.parse(`${value.date}T00:00:00Z`))) return null;
            if (!['RELEASE', 'HOTFIX'].includes(value.type)) return null;
            if (typeof value.summary !== 'string' || !value.summary.length || value.summary.length > 360) return null;
            if (!isSafeTimelineHref(value.href)) return null;
            return {
                scriptId: value.scriptId,
                title: value.title,
                version: value.version,
                date: value.date,
                type: value.type,
                summary: value.summary,
                href: value.href
            };
        }

        function isSafeScriptUpdate(update) {
            return update
                && typeof update.id === 'string'
                && typeof update.displayVersion === 'string'
                && /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,64}$/.test(update.displayVersion)
                && typeof update.updated === 'string'
                && update.updated.length <= 64;
        }

        async function loadScriptUpdates() {
            const status = document.getElementById('script-update-status');
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            try {
                const requestUrl = new URL(scriptUpdateManifestUrl, window.location.href);
                requestUrl.searchParams.set('fresh', Date.now().toString());
                const response = await fetch(requestUrl, {
                    cache: 'no-store',
                    credentials: 'same-origin',
                    signal: controller.signal
                });
                if (!response.ok) return false;

                const payload = await response.json();
                if (payload?.schemaVersion !== 1 || !Array.isArray(payload.scripts)) return false;

                const updates = new Map(
                    payload.scripts
                        .filter(isSafeScriptUpdate)
                        .map((update) => [update.id, update])
                );
                automaticScriptReleases = Array.isArray(payload.timeline)
                    ? payload.timeline.map(sanitiseTimelineEvent).filter(Boolean)
                    : [];

                scripts.forEach((script) => {
                    const update = updates.get(script.id);
                    if (!update) return;
                    const marketplace = sanitiseMarketplace(update.marketplace);
                    if (marketplace) script.marketplace = marketplace;

                    if (update.updateVersion === false) return;
                    script.version = update.displayVersion;
                    script.updated = update.updated;

                    if (typeof update.actionLabel === 'string' && update.actionLabel.length <= 80) {
                        const installAction = script.actions?.find((action) => /^Install\b/.test(action.label));
                        if (installAction) installAction.label = update.actionLabel;
                    }
                });

                if (status && typeof payload.checkedAt === 'string') {
                    const checked = new Date(payload.checkedAt);
                    if (!Number.isNaN(checked.getTime())) {
                        const formatted = new Intl.DateTimeFormat([], {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }).format(checked);
                        status.textContent = `Authoritative versions and release timeline checked at 00:00 and 12:00 UK time. Last check: ${formatted}.`;
                    }
                }
                return true;
            } catch {
                if (status) {
                    status.textContent = 'Live update data could not be loaded; showing the built-in catalogue until the next visit.';
                }
                return false;
            } finally {
                clearTimeout(timeout);
            }
        }

        let currentFilter = 'ALL';
        let currentSort = 'newest';
        let currentView = 'registry';
        let moduleRenderToken = 0;
        let moduleRenderTimer = null;
        let unloadTimer = null;
        let unloadSequenceActive = false;
        let activeModuleId = null;
        let pageBootComplete = false;
        let terminalSequenceToken = 0;
        let activeScreenshots = [];
        let activeScreenshotIndex = 0;
        const pendingTerminalSteps = new Map();
        const sortLabels = {
            newest: 'NEW-OLD',
            oldest: 'OLD-NEW',
            az: 'A-Z',
            za: 'Z-A'
        };
        const bootStageSelectors = {
            interface: '[data-boot-stage="interface"]',
            diagnostics: '[data-boot-stage="diagnostics"]',
            activity: '[data-boot-stage="activity"], [data-boot-section="activity"]',
            registry: '[data-boot-stage="registry"]',
            footer: '[data-boot-stage="footer"]'
        };

        function cancelScheduledModuleRender() {
            moduleRenderToken += 1;
            cancelTerminalSequence();
            if (moduleRenderTimer !== null) {
                clearTimeout(moduleRenderTimer);
                moduleRenderTimer = null;
            }
        }

        function cancelScheduledUnload() {
            if (unloadTimer !== null) {
                clearTimeout(unloadTimer);
                unloadTimer = null;
            }
            unloadSequenceActive = false;
        }

        function getFilteredScripts() {
            return currentFilter === 'ALL'
                ? scripts
                : scripts.filter((script) => script.tier.toUpperCase() === currentFilter);
        }

        function getUpdatedTimestamp(script) {
            const timestamp = Date.parse(script.updated);
            return Number.isNaN(timestamp) ? null : timestamp;
        }

        function sortModules(modules) {
            return [...modules].sort((left, right) => {
                if (currentSort === 'az' || currentSort === 'za') {
                    const direction = currentSort === 'az' ? 1 : -1;
                    return left.title.localeCompare(right.title) * direction;
                }

                const leftTimestamp = getUpdatedTimestamp(left);
                const rightTimestamp = getUpdatedTimestamp(right);
                if (leftTimestamp === null && rightTimestamp === null) {
                    return scripts.indexOf(left) - scripts.indexOf(right);
                }
                if (leftTimestamp === null) return 1;
                if (rightTimestamp === null) return -1;

                return currentSort === 'newest'
                    ? rightTimestamp - leftTimestamp
                    : leftTimestamp - rightTimestamp;
            });
        }

        function getVisibleModules() {
            return sortModules(getFilteredScripts());
        }

        function updateRegistrySummary() {
            const filteredCount = getFilteredScripts().length;
            const totalCount = scripts.length;
            const filterSuffix = currentFilter === 'ALL' ? '' : ` [${currentFilter}]`;

            document.getElementById('module-header-title').innerText =
                `Module Interface Array${filterSuffix}`;
            document.getElementById('module-filter-text').innerText =
                `FILTER: [${currentFilter}] · ${filteredCount} / ${totalCount}`;
            document.getElementById('module-sort-label').textContent = sortLabels[currentSort];
            document.getElementById('registry-summary').textContent =
                `${filteredCount} OF ${totalCount} MODULES AVAILABLE`;
            document.getElementById('registry-module-count').textContent = totalCount;
            document.getElementById('registry-supporter-count').textContent = scripts.filter(
                (script) => script.tier === 'supporter'
            ).length;
            document.getElementById('registry-web-tools-count').textContent = scripts.filter(
                (script) => script.tier === 'web tools'
            ).length;
            document.getElementById('registry-filtered-count').textContent = filteredCount;
        }

        function setModuleSort(sort) {
            if (!pageBootComplete || currentView !== 'registry') return;
            if (!Object.hasOwn(sortLabels, sort)) return;

            currentSort = sort;
            closeSortMenu();
            updateRegistrySummary();
            renderModules(`SORTING REGISTRY [${sortLabels[sort]}]...`);
        }

        function closeSortMenu() {
            const button = document.getElementById('module-sort-button');
            const menu = document.getElementById('module-sort-menu');
            menu.classList.add('hidden');
            button.setAttribute('aria-expanded', 'false');
        }

        function toggleSortMenu() {
            const button = document.getElementById('module-sort-button');
            const menu = document.getElementById('module-sort-menu');
            const willOpen = menu.classList.contains('hidden');
            menu.classList.toggle('hidden', !willOpen);
            button.setAttribute('aria-expanded', String(willOpen));
        }

        function closeMobileMenu() {
            const button = document.getElementById('mobile-menu-toggle');
            const menu = document.getElementById('mobile-nav');
            if (!button || !menu) return;

            menu.classList.add('hidden');
            button.setAttribute('aria-expanded', 'false');
        }

        function toggleMobileMenu() {
            const button = document.getElementById('mobile-menu-toggle');
            const menu = document.getElementById('mobile-nav');
            const willOpen = menu.classList.contains('hidden');
            menu.classList.toggle('hidden', !willOpen);
            button.setAttribute('aria-expanded', String(willOpen));
        }

        function toggleClock() {
            const button = document.getElementById('clock-toggle');
            const panel = document.getElementById('clock-panel');
            const willOpen = panel.classList.contains('hidden');
            panel.classList.toggle('hidden', !willOpen);
            button.setAttribute('aria-expanded', String(willOpen));
        }

        function filterByTier(tier) {
            if (!pageBootComplete) return;
            cancelScheduledUnload();
            currentView = 'registry';
            activeModuleId = null;
            currentFilter = tier;

            document.getElementById('module-grid').classList.remove('hidden');
            document.getElementById('script-details-container').classList.remove('active');

            closeMobileMenu();
            updateRegistrySummary();
            renderModules(`APPLYING REGISTRY FILTER [${tier}]...`);
        }

        // Keep this for backwards compatibility with any remaining static links
        function filterByStatus(status) {
            filterByTier(status);
        }

        function createTerminalLine(
            message,
            className,
            animationDelay = '',
            statusText = 'OK',
            statusClass = 'text-[#98f05f]'
        ) {
            const line = document.createElement('div');
            line.className = className;
            line.style.animationDuration = '0.2s';
            if (animationDelay) line.style.animationDelay = animationDelay;
            line.append(document.createTextNode(`> ${message}${statusText ? ' ' : ''}`));

            if (statusText) {
                const status = document.createElement('span');
                status.className = statusClass;
                status.textContent = `[${statusText}]`;
                line.append(status);
            }
            return line;
        }

        function createTerminalCursor() {
            const cursorLine = document.createElement('div');
            cursorLine.className = 'typing-line';
            cursorLine.id = 'cli-cursor-line';
            cursorLine.append(document.createTextNode('> _'));

            const cursor = document.createElement('span');
            cursor.className = 'blink-cursor inline-block w-2 h-3 bg-[#98f05f] translate-y-0.5 ml-1';
            cursorLine.append(cursor);
            return cursorLine;
        }

        function resetTerminal(terminal) {
            const cursorLine = createTerminalCursor();
            terminal.replaceChildren(cursorLine);
            return cursorLine;
        }

        function appendTerminalLine(terminal, line) {
            const cursorLine = terminal.querySelector('#cli-cursor-line');
            if (cursorLine) {
                terminal.insertBefore(line, cursorLine);
            } else {
                terminal.append(line);
            }
            terminal.scrollTop = terminal.scrollHeight;
        }

        function getBootStageElements(stage) {
            const selector = bootStageSelectors[stage];
            return selector ? [...document.querySelectorAll(selector)] : [];
        }

        function initializeBootStages() {
            Object.keys(bootStageSelectors).forEach((stage) => {
                getBootStageElements(stage).forEach((element) => {
                    element.classList.remove('boot-stage-ready');
                    element.setAttribute('aria-hidden', 'true');
                });
            });
            document.body.setAttribute('aria-busy', 'true');
        }

        function revealBootStage(stage) {
            getBootStageElements(stage).forEach((element) => {
                element.classList.add('boot-stage-ready');
                element.setAttribute('aria-hidden', 'false');
            });
        }

        function revealAllBootStages() {
            Object.keys(bootStageSelectors).forEach(revealBootStage);
            document.body.removeAttribute('aria-busy');
        }

        function cancelTerminalSequence() {
            terminalSequenceToken += 1;
            [...pendingTerminalSteps.entries()].forEach(([line, finish]) => {
                line.style.animation = 'none';
                line.style.opacity = '1';
                line.style.width = '100%';
                finish();
            });
        }

        function playTerminalLine(
            terminal,
            message,
            className,
            duration = 200,
            statusText = 'OK',
            statusClass = 'text-[#98f05f]'
        ) {
            const sequenceToken = terminalSequenceToken;
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const line = createTerminalLine(message, className, '', statusText, statusClass);
            line.classList.add('terminal-pending');
            line.style.animationDelay = '0ms';
            line.style.animationDuration = reducedMotion ? '0.01ms' : `${duration}ms`;
            appendTerminalLine(terminal, line);

            return new Promise((resolve) => {
                let settled = false;
                let fallbackTimer = null;

                const finish = () => {
                    if (settled) return;
                    settled = true;
                    if (fallbackTimer !== null) clearTimeout(fallbackTimer);
                    line.removeEventListener('animationend', onAnimationEnd);
                    line.classList.remove('terminal-pending');
                    pendingTerminalSteps.delete(line);
                    resolve(sequenceToken === terminalSequenceToken);
                };

                const onAnimationEnd = (event) => {
                    if (event.animationName === 'typing') finish();
                };

                line.addEventListener('animationend', onAnimationEnd);
                fallbackTimer = setTimeout(finish, reducedMotion ? 30 : duration + 120);
                pendingTerminalSteps.set(line, finish);
            });
        }

        async function announceAndRenderModules(
            terminal,
            grid,
            filteredScripts,
            renderToken,
            sequenceToken
        ) {
            for (const [index, script] of filteredScripts.entries()) {
                const completed = await playTerminalLine(
                    terminal,
                    `INITIALIZING MODULE: ${script.title.toUpperCase()}...`,
                    'opacity-100 typing-line text-outline-variant',
                    180
                );
                if (!completed || sequenceToken !== terminalSequenceToken) return false;
                if (renderToken !== moduleRenderToken || currentView !== 'registry') return false;

                const { card } = createModuleCard(script, index);
                card.style.animationDelay = '0ms';
                grid.append(card);
            }

            const loaded = await playTerminalLine(
                terminal,
                `MODULES LOADED (${filteredScripts.length})...`,
                'opacity-100 typing-line',
                240
            );
            return Boolean(
                loaded &&
                sequenceToken === terminalSequenceToken &&
                renderToken === moduleRenderToken &&
                currentView === 'registry'
            );
        }

        async function runRegistryTerminalSequence(
            terminal,
            grid,
            filteredScripts,
            renderToken,
            introMessage = 'REFRESHING MODULE REGISTRY...',
            resetOutput = true
        ) {
            cancelTerminalSequence();
            const sequenceToken = terminalSequenceToken;
            if (resetOutput) resetTerminal(terminal);

            const introduced = await playTerminalLine(
                terminal,
                introMessage,
                'opacity-100 typing-line text-outline-variant',
                240
            );
            if (!introduced || sequenceToken !== terminalSequenceToken) return false;
            if (renderToken !== moduleRenderToken || currentView !== 'registry') return false;

            return announceAndRenderModules(
                terminal,
                grid,
                filteredScripts,
                renderToken,
                sequenceToken
            );
        }

        async function runPageBootSequence() {
            cancelScheduledModuleRender();
            const renderToken = moduleRenderToken;
            const terminal = document.getElementById('cli-output');
            const grid = document.getElementById('module-grid');
            const filteredScripts = getVisibleModules();

            currentView = 'registry';
            activeModuleId = null;
            pageBootComplete = false;
            grid.replaceChildren();
            resetTerminal(terminal);
            document.getElementById('registry-summary').textContent = 'SYSTEM BOOTING';

            cancelTerminalSequence();
            const sequenceToken = terminalSequenceToken;
            const startupSteps = [
                ['INITIALISING MODUL SYSTEMS...', null, 300],
                ['MOUNTING VISUAL KERNEL / SHADER LAYER...', null, 260],
                ['LOADING COMMAND INTERFACE...', 'interface', 260],
                ['STARTING REGISTRY DIAGNOSTICS...', 'diagnostics', 240],
                ['CONNECTING SCRIPT RELEASE TIMELINE...', 'activity', 240],
                ['CONNECTING TO MODULE REGISTRY...', 'registry', 260]
            ];

            for (const [message, stage, duration] of startupSteps) {
                const completed = await playTerminalLine(
                    terminal,
                    message,
                    'opacity-100 typing-line text-outline-variant',
                    duration
                );
                if (!completed || sequenceToken !== terminalSequenceToken) return false;
                if (renderToken !== moduleRenderToken || currentView !== 'registry') return false;
                if (stage) revealBootStage(stage);
            }

            const registryReady = await announceAndRenderModules(
                terminal,
                grid,
                filteredScripts,
                renderToken,
                sequenceToken
            );
            if (!registryReady) return false;

            const footerReady = await playTerminalLine(
                terminal,
                'MOUNTING SYSTEM FOOTER...',
                'opacity-100 typing-line text-outline-variant',
                220
            );
            if (!footerReady || sequenceToken !== terminalSequenceToken) return false;
            revealBootStage('footer');

            const ready = await playTerminalLine(
                terminal,
                'COMMAND CENTRE READY...',
                'opacity-100 typing-line text-secondary-fixed',
                260
            );
            if (!ready || sequenceToken !== terminalSequenceToken) return false;

            pageBootComplete = true;
            document.body.removeAttribute('aria-busy');
            updateRegistrySummary();
            return true;
        }

        function handleBootFailure(error) {
            console.error('Command Centre boot sequence failed.', error);
            cancelTerminalSequence();
            revealAllBootStages();
            currentView = 'registry';
            activeModuleId = null;
            pageBootComplete = true;

            const grid = document.getElementById('module-grid');
            if (!grid.querySelector('.module-card')) {
                grid.replaceChildren();
                getVisibleModules().forEach((script, index) => {
                    const { card } = createModuleCard(script, index);
                    card.style.animationDelay = '0ms';
                    grid.append(card);
                });
            }
            updateRegistrySummary();
        }

        function renderScriptUpdateTimeline() {
            const timeline = document.getElementById('script-updates-timeline');
            const count = document.getElementById('script-release-count');
            if (!timeline || !count) return;

            const releaseKey = (release) =>
                `${release.scriptId || release.title.toLocaleLowerCase()}\u0000${release.version.toLocaleLowerCase()}`;
            const releases = [...scriptReleases, ...automaticScriptReleases]
                .filter((release, index, all) => all.findIndex((candidate) =>
                    releaseKey(candidate) === releaseKey(release)
                ) === index)
                .sort((left, right) => right.date.localeCompare(left.date));

            timeline.replaceChildren();
            count.textContent = `${releases.length} RELEASES`;

            releases.forEach((release, index) => {
                const item = document.createElement('li');
                item.className = "relative flex gap-3 pb-5 before:absolute before:left-[5px] before:top-5 before:bottom-0 before:w-px before:bg-white/10 last:pb-0 last:before:hidden feed-item";
                item.style.animationDelay = `${Math.min(index * 70, 630)}ms`;

                const dot = document.createElement('span');
                dot.setAttribute('aria-hidden', 'true');
                dot.className = release.type === 'HOTFIX'
                    ? 'relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full border border-tertiary-fixed-dim bg-background shadow-[0_0_8px_rgba(255,186,56,0.45)]'
                    : 'relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full border border-secondary-fixed bg-background shadow-[0_0_8px_rgba(121,255,91,0.45)]';

                const content = document.createElement('div');
                content.className = 'min-w-0 flex-1';
                const titleRow = document.createElement('div');
                titleRow.className = 'flex flex-wrap items-start gap-x-2 gap-y-1';
                const type = document.createElement('span');
                type.className = release.type === 'HOTFIX'
                    ? 'shrink-0 font-label-caps text-[9px] uppercase tracking-widest text-tertiary-fixed-dim'
                    : 'shrink-0 font-label-caps text-[9px] uppercase tracking-widest text-secondary-fixed';
                type.textContent = release.type;
                const link = document.createElement('a');
                link.className = 'min-w-0 break-words text-on-surface hover:text-[#98f05f] transition-colors';
                link.href = release.href;
                link.textContent = release.title;
                if (/^https?:\/\//i.test(release.href)) {
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                }
                const version = document.createElement('span');
                version.className = 'text-[#98f05f]';
                version.textContent = release.version;
                titleRow.append(type, link, version);

                const metadata = document.createElement('div');
                metadata.className = 'mt-1 text-[10px] text-outline-variant uppercase';
                const date = document.createElement('time');
                date.dateTime = release.date;
                date.textContent = new Intl.DateTimeFormat('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC'
                }).format(new Date(`${release.date}T00:00:00Z`));
                metadata.append(date);

                const summary = document.createElement('p');
                summary.className = 'mt-2 text-outline-variant leading-relaxed';
                summary.textContent = release.summary;
                content.append(titleRow, metadata, summary);
                item.append(dot, content);
                timeline.append(item);
            });
        }

        function renderModuleFaq(data) {
            const container = document.getElementById('detail-faq');
            const count = document.getElementById('detail-faq-count');
            const entries = moduleFaqs[data.id] || [
                {
                    question: `Where can I get help with ${data.title}?`,
                    answer: 'Open the project page for current documentation or join the MoDuL Hub Discord for support.'
                }
            ];
            container.replaceChildren();
            count.textContent = `${entries.length} ${entries.length === 1 ? 'ENTRY' : 'ENTRIES'}`;

            entries.forEach((entry) => {
                const details = document.createElement('details');
                details.className = 'bg-surface-container-lowest/50 border border-white/10 rounded group';
                const summary = document.createElement('summary');
                summary.className = 'cursor-pointer list-none p-4 flex items-start justify-between gap-3 text-on-surface hover:text-[#98f05f] transition-colors';
                const question = document.createElement('span');
                question.className = 'font-body-md text-sm';
                question.textContent = entry.question;
                const icon = document.createElement('span');
                icon.setAttribute('aria-hidden', 'true');
                icon.className = 'material-symbols-outlined text-[18px] shrink-0 group-open:rotate-180 transition-transform';
                icon.textContent = 'expand_more';
                summary.append(question, icon);
                const answer = document.createElement('p');
                answer.className = 'mx-4 mb-4 pt-3 border-t border-white/5 text-on-surface-variant text-code-sm leading-relaxed';
                answer.textContent = entry.answer;
                details.append(summary, answer);
                container.append(details);
            });
        }

        function showScreenshot(index) {
            if (!activeScreenshots.length) return;
            activeScreenshotIndex = (index + activeScreenshots.length) % activeScreenshots.length;
            const screenshot = activeScreenshots[activeScreenshotIndex];
            const image = document.getElementById('screenshot-dialog-image');
            image.src = screenshot.src;
            image.alt = screenshot.alt;
            document.getElementById('screenshot-dialog-title').textContent = screenshot.moduleTitle;
            document.getElementById('screenshot-dialog-position').textContent = `SCREENSHOT ${activeScreenshotIndex + 1} / ${activeScreenshots.length}`;
            const hasMultiple = activeScreenshots.length > 1;
            document.getElementById('screenshot-previous').disabled = !hasMultiple;
            document.getElementById('screenshot-next').disabled = !hasMultiple;
        }

        function openScreenshot(index) {
            showScreenshot(index);
            document.getElementById('screenshot-dialog').showModal();
        }

        function renderModuleScreenshots(data) {
            const container = document.getElementById('detail-screenshots');
            const count = document.getElementById('detail-screenshot-count');
            const screenshots = (moduleScreenshots[data.id] || []).map((screenshot) => ({
                ...screenshot,
                moduleTitle: data.title
            }));
            activeScreenshots = screenshots;
            activeScreenshotIndex = 0;
            container.replaceChildren();
            count.textContent = screenshots.length
                ? `${screenshots.length} ${screenshots.length === 1 ? 'IMAGE' : 'IMAGES'}`
                : 'UPLINK PENDING';

            if (!screenshots.length) {
                const empty = document.createElement('div');
                empty.className = 'sm:col-span-2 xl:col-span-3 border border-dashed border-outline-variant rounded p-6 text-center text-code-sm text-outline-variant';
                empty.textContent = 'No current screenshots have been published for this module yet.';
                container.append(empty);
                return;
            }

            screenshots.forEach((screenshot, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'screenshot-thumb rounded group';
                button.setAttribute('aria-label', `Open ${screenshot.alt}`);
                button.addEventListener('click', () => openScreenshot(index));
                const image = document.createElement('img');
                image.src = screenshot.src;
                image.alt = screenshot.alt;
                image.loading = 'lazy';
                image.decoding = 'async';
                button.append(image);
                container.append(button);
            });
        }

        function createModuleCard(script, index) {
            const animationDelay = index * 60;
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `glass-panel module-card text-left p-5 rounded-lg flex flex-col group h-full fade-slide-up ${script.badge === 'dev' ? 'border-dashed' : ''}`;
            card.dataset.moduleId = script.id;
            card.style.animationDelay = `${animationDelay}ms`;
            card.setAttribute('aria-label', `Open ${script.title} details`);
            card.addEventListener('click', () => activateScript(script.id));

            const topRow = document.createElement('div');
            topRow.className = 'module-card-reveal flex justify-between items-start mb-4';
            const iconFrame = document.createElement('div');
            iconFrame.className = 'w-10 h-10 rounded border border-white/10 bg-surface-container-lowest/50 flex items-center justify-center group-hover:border-[#98f05f]/50 transition-colors';
            const safeLogo = typeof script.logo === 'string'
                && /^assets\/images\/[a-z0-9/_-]+\.(?:gif|jpe?g|png|webp)$/i.test(script.logo);
            if (safeLogo) {
                const logo = document.createElement('img');
                logo.className = 'module-card-logo';
                logo.src = script.logo;
                logo.alt = '';
                logo.loading = 'lazy';
                logo.decoding = 'async';
                iconFrame.append(logo);
            } else {
                const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                icon.setAttribute('aria-hidden', 'true');
                icon.setAttribute('class', 'w-6 h-6 text-[#98f05f]');
                icon.setAttribute('fill', 'none');
                icon.setAttribute('focusable', 'false');
                icon.setAttribute('stroke', 'currentColor');
                icon.setAttribute('stroke-width', '1.5');
                icon.setAttribute('viewBox', '0 0 24 24');
                icon.innerHTML = script.iconPath;
                iconFrame.append(icon);
            }

            const badge = document.createElement('span');
            badge.className = `status-chip ${script.badge} font-label-caps text-label-caps px-2 py-0.5`;
            badge.textContent = script.badgeText;
            topRow.append(iconFrame, badge);

            const content = document.createElement('div');
            content.className = 'module-card-reveal flex-1';
            const title = document.createElement('h3');
            title.className = 'font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-1 group-hover:text-[#98f05f] transition-colors';
            title.textContent = script.title;
            const description = document.createElement('p');
            description.className = 'font-code-sm text-code-sm text-outline-variant';
            description.textContent = script.desc;
            content.append(title, description);
            if (script.marketplace) {
                const marketplace = document.createElement('p');
                marketplace.className = 'font-code-sm text-[10px] text-[#98f05f]/70 mt-3 uppercase tracking-wider';
                marketplace.textContent = `GF · ${script.marketplace.author.name} · ${script.marketplace.dailyInstalls.toLocaleString()} daily · ${script.marketplace.totalInstalls.toLocaleString()} total`;
                content.append(marketplace);
            }

            const footer = document.createElement('div');
            footer.className = 'module-card-reveal mt-4 pt-4 border-t border-white/5 font-code-sm text-code-sm text-[#98f05f]/80 flex justify-between';
            const version = document.createElement('span');
            version.textContent = `${script.versionPrefix}: ${script.version}`;
            const arrow = document.createElement('span');
            arrow.setAttribute('aria-hidden', 'true');
            arrow.className = 'material-symbols-outlined text-[16px] opacity-0 group-hover:opacity-100 transition-opacity';
            arrow.textContent = script.badge === 'dev' ? 'build' : 'arrow_forward';
            footer.append(version, arrow);
            const progress = document.createElement('span');
            progress.className = 'module-card-progress';
            progress.setAttribute('aria-hidden', 'true');
            card.append(topRow, content, footer, progress);
            return { card, animationDelay };
        }

        function renderModules(introMessage = 'REFRESHING MODULE REGISTRY...') {
            if (!pageBootComplete) return;

            cancelScheduledModuleRender();
            const renderToken = moduleRenderToken;
            const grid = document.getElementById('module-grid');
            const terminal = document.getElementById('cli-output');
            const oldCards = grid.querySelectorAll('.module-card');

            oldCards.forEach((card) => {
                card.classList.remove('fade-slide-up');
                card.classList.add('fade-slide-down');
            });

            const commitRender = () => {
                moduleRenderTimer = null;
                if (renderToken !== moduleRenderToken || currentView !== 'registry') return;

                const filteredScripts = getVisibleModules();
                grid.replaceChildren();
                document.getElementById('registry-summary').textContent = 'REGISTRY RECONFIGURING';
                void runRegistryTerminalSequence(
                    terminal,
                    grid,
                    filteredScripts,
                    renderToken,
                    introMessage,
                    true
                ).then((completed) => {
                    if (completed) updateRegistrySummary();
                });
            };

            if (oldCards.length > 0) {
                moduleRenderTimer = setTimeout(commitRender, 300);
            } else {
                commitRender();
            }
        }

        function createDetailAction(action) {
            const isExternal = /^https?:\/\//i.test(action.href);
            const link = document.createElement('a');
            link.href = action.href;
            link.className = action.primary
                ? 'cyber-button-primary shimmer-btn font-label-caps text-label-caps uppercase px-6 py-3 rounded-DEFAULT flex items-center justify-center gap-2 flicker-hover'
                : 'cyber-button-secondary font-label-caps text-label-caps uppercase px-6 py-3 rounded-DEFAULT flex items-center justify-center gap-2';

            if (isExternal) {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            }

            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined text-[20px]';
            icon.textContent = action.icon || 'open_in_new';
            link.append(icon, document.createTextNode(` ${action.label}`));
            return link;
        }

        function renderModuleFacts(data) {
            const facts = [
                { label: 'Project type', value: data.projectType },
                { label: 'Access', value: data.tier.toUpperCase() },
                { label: 'Release state', value: data.releaseState },
                { label: 'Updated', value: data.updated },
                { label: 'Category', value: data.category }
            ];
            if (data.marketplace) {
                facts.push(
                    { label: 'Author', value: data.marketplace.author.name, href: data.marketplace.author.url },
                    { label: 'Daily installs', value: data.marketplace.dailyInstalls.toLocaleString() },
                    { label: 'Total installs', value: data.marketplace.totalInstalls.toLocaleString() },
                    { label: 'GreasyFork version', value: data.marketplace.version },
                    { label: 'Created', value: data.marketplace.created },
                    { label: 'GreasyFork updated', value: data.marketplace.updated },
                    { label: 'Size', value: data.marketplace.size },
                    { label: 'License', value: data.marketplace.license.name, href: data.marketplace.license.url },
                    { label: 'Applies to', links: data.marketplace.appliesTo }
                );
            }
            const container = document.getElementById('detail-facts');
            container.replaceChildren();

            facts.forEach((fact) => {
                const item = document.createElement('div');
                item.className = 'bg-surface-container-lowest/50 border border-white/5 p-3 rounded';

                const term = document.createElement('dt');
                term.className = 'text-outline-variant uppercase text-[10px] tracking-wider mb-1';
                term.textContent = fact.label;

                const description = document.createElement('dd');
                description.className = 'text-on-surface';
                if (fact.links) {
                    fact.links.forEach((linkData, index) => {
                        const link = document.createElement('a');
                        link.href = linkData.url;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.className = 'text-[#98f05f] hover:underline';
                        link.textContent = linkData.name;
                        if (index) description.append(document.createTextNode(', '));
                        description.append(link);
                    });
                } else if (fact.href) {
                    const link = document.createElement('a');
                    link.href = fact.href;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.className = 'text-[#98f05f] hover:underline';
                    link.textContent = fact.value;
                    description.append(link);
                } else {
                    description.textContent = fact.value;
                }

                item.append(term, description);
                container.append(item);
            });
        }

        function getVisibleModuleActions(data) {
            return (data.actions || []).filter(
                (action) => action.label.trim().toLowerCase() !== 'open project'
            );
        }

        function renderModuleActions(data) {
            const container = document.getElementById('detail-actions');
            container.replaceChildren();
            getVisibleModuleActions(data).forEach((action) => {
                container.append(createDetailAction(action));
            });

            (data.disabledActions || []).forEach(label => {
                const disabled = document.createElement('button');
                disabled.type = 'button';
                disabled.disabled = true;
                disabled.className = 'font-label-caps text-label-caps uppercase px-6 py-3 rounded-DEFAULT border border-outline-variant text-outline-variant opacity-60 cursor-not-allowed flex items-center justify-center gap-2';
                disabled.textContent = label;
                container.append(disabled);
            });
        }

        function populateModuleDetail(data) {
            document.getElementById('detail-title').textContent = data.title;
            document.getElementById('detail-desc').textContent = data.desc;
            document.getElementById('detail-version').textContent =
                `${data.versionPrefix}: ${data.version}`;

            const badge = document.getElementById('detail-badge');
            badge.className = `status-chip ${data.badge} font-label-caps text-label-caps px-3 py-1`;
            badge.textContent = data.badgeText;

            renderModuleActions(data);
            renderModuleFacts(data);

            const features = document.getElementById('detail-features');
            features.replaceChildren();
            data.features.forEach((feature) => {
                const item = document.createElement('li');
                item.textContent = feature;
                features.append(item);
            });

            renderModuleFaq(data);
            renderModuleScreenshots(data);

            const note = document.getElementById('detail-note');
            const noteText = document.getElementById('detail-note-text');
            if (data.note) {
                noteText.textContent = data.note;
                note.classList.remove('hidden');
            } else {
                noteText.textContent = '';
                note.classList.add('hidden');
            }
        }

        function formatConsoleValue(value, maximumLength = 52) {
            const normalized = String(value || 'NOT PUBLISHED')
                .replace(/\s+/g, ' ')
                .trim()
                .toUpperCase();
            if (normalized.length <= maximumLength) return normalized;
            return `${normalized.slice(0, maximumLength - 3)}...`;
        }

        function getModuleDiagnosticSteps(data) {
            const availableActions = getVisibleModuleActions(data).length;
            const disabledActions = Array.isArray(data.disabledActions)
                ? data.disabledActions.length
                : 0;
            const steps = [
                {
                    message: `MODULE REQUEST [${data.id.toUpperCase()}]...`,
                    className: 'opacity-100 typing-line text-secondary-fixed',
                    duration: 240,
                    statusText: 'ACCEPTED',
                    statusClass: 'text-secondary-fixed'
                },
                {
                    message: 'RESOLVING REGISTRY RECORD...',
                    className: 'opacity-100 typing-line text-outline-variant',
                    duration: 220
                },
                { message: `TITLE: ${formatConsoleValue(data.title)}` },
                { message: `TYPE: ${formatConsoleValue(data.projectType)}` },
                { message: `ACCESS: ${formatConsoleValue(data.tier)}` },
                { message: `RELEASE: ${formatConsoleValue(data.releaseState)}` },
                { message: `VERSION: ${formatConsoleValue(data.version)}` },
                { message: `UPDATED: ${formatConsoleValue(data.updated)}` },
                { message: `CATEGORY: ${formatConsoleValue(data.category)}` }
            ];

            data.features.slice(0, 3).forEach((feature, index) => {
                steps.push({
                    message: `CAPABILITY ${String(index + 1).padStart(2, '0')}: ${formatConsoleValue(feature, 46)}`
                });
            });

            steps.push({
                message: `ENDPOINTS: ${availableActions} AVAILABLE / ${disabledActions} DISABLED`
            });
            return steps;
        }

        function releaseModuleSelection(grid) {
            grid.removeAttribute('aria-busy');
            grid.querySelectorAll('.module-card').forEach((card) => {
                card.disabled = false;
                card.classList.remove('active', 'loading', 'loading-peer');
            });
        }

        async function unmountModuleDetail(grid, details, selectedCard) {
            const applyRegistryState = () => {
                details.classList.remove('active');
                grid.classList.remove('hidden');
                currentView = 'registry';
                updateRegistrySummary();
            };

            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!selectedCard || reducedMotion) {
                details.dataset.transitionMode = 'crossfade-contract';
                applyRegistryState();
                grid.classList.add('registry-return-fallback');
                grid.addEventListener(
                    'animationend',
                    () => grid.classList.remove('registry-return-fallback'),
                    { once: true }
                );
                return;
            }

            if (typeof document.startViewTransition !== 'function') {
                const sourceRect = details.getBoundingClientRect();
                const transitionDetail = details.cloneNode(true);
                transitionDetail.removeAttribute('id');
                transitionDetail.querySelectorAll('[id]').forEach((element) => {
                    element.removeAttribute('id');
                });
                transitionDetail.classList.add('module-detail-transition-clone');
                transitionDetail.setAttribute('aria-hidden', 'true');
                transitionDetail.removeAttribute('tabindex');
                transitionDetail.style.setProperty('--module-source-top', `${sourceRect.top}px`);
                transitionDetail.style.setProperty('--module-source-left', `${sourceRect.left}px`);
                transitionDetail.style.setProperty('--module-source-width', `${sourceRect.width}px`);
                transitionDetail.style.setProperty('--module-source-height', `${sourceRect.height}px`);
                document.body.append(transitionDetail);

                details.dataset.transitionMode = 'fallback-contract';
                applyRegistryState();
                const targetRect = selectedCard.getBoundingClientRect();
                transitionDetail.style.setProperty('--module-target-top', `${targetRect.top}px`);
                transitionDetail.style.setProperty('--module-target-left', `${targetRect.left}px`);
                transitionDetail.style.setProperty('--module-target-width', `${targetRect.width}px`);
                transitionDetail.style.setProperty('--module-target-height', `${targetRect.height}px`);
                void transitionDetail.offsetWidth;
                transitionDetail.classList.add('contracting');
                await new Promise((resolve) => {
                    let fallbackTimer = null;
                    const finish = () => {
                        if (fallbackTimer !== null) clearTimeout(fallbackTimer);
                        transitionDetail.removeEventListener('animationend', finish);
                        resolve();
                    };
                    transitionDetail.addEventListener('animationend', finish);
                    fallbackTimer = setTimeout(finish, 750);
                });
                transitionDetail.remove();
                return;
            }

            details.style.viewTransitionName = 'module-detail';
            details.dataset.transitionMode = 'native-contract';
            document.documentElement.classList.add('module-transition-reverse');
            try {
                const transition = document.startViewTransition(() => {
                    applyRegistryState();
                    selectedCard.style.viewTransitionName = 'module-detail';
                });
                await transition.finished;
            } catch {
                if (currentView !== 'registry') applyRegistryState();
            } finally {
                details.style.removeProperty('view-transition-name');
                selectedCard.style.removeProperty('view-transition-name');
                document.documentElement.classList.remove('module-transition-reverse');
            }
        }

        async function unloadActiveModule() {
            if (unloadSequenceActive || currentView !== 'detail') return;

            unloadSequenceActive = true;
            cancelScheduledModuleRender();
            const sequenceToken = terminalSequenceToken;
            const renderToken = moduleRenderToken;
            const terminal = document.getElementById('cli-output');
            const grid = document.getElementById('module-grid');
            const details = document.getElementById('script-details-container');
            const activeData = scripts.find((script) => script.id === activeModuleId);
            currentView = 'unloading-detail';

            try {
                const cleanupSteps = [
                    [`UNMOUNT REQUEST [${(activeModuleId || 'UNKNOWN').toUpperCase()}]...`, 'ACCEPTED'],
                    ['FLUSHING MODULE SESSION...', 'OK'],
                    ['UNMOUNTING DETAIL INTERFACE...', 'OK']
                ];

                for (const [message, statusText] of cleanupSteps) {
                    const completed = await playTerminalLine(
                        terminal,
                        message,
                        'opacity-100 typing-line text-error',
                        220,
                        statusText,
                        statusText === 'ACCEPTED' ? 'text-secondary-fixed' : 'text-[#98f05f]'
                    );
                    if (!completed || sequenceToken !== terminalSequenceToken) return;
                    if (renderToken !== moduleRenderToken || currentView !== 'unloading-detail') return;
                }

                const selectedCard = grid.querySelector(`[data-module-id="${activeModuleId}"]`);
                await unmountModuleDetail(grid, details, selectedCard);
                releaseModuleSelection(grid);
                activeModuleId = null;
                if (selectedCard) selectedCard.focus({ preventScroll: true });

                const remount = await playTerminalLine(
                    terminal,
                    `RESTORING MODULE REGISTRY${activeData ? ` AFTER ${activeData.title.toUpperCase()}` : ''}...`,
                    'opacity-100 typing-line text-outline-variant',
                    240
                );
                if (!remount || sequenceToken !== terminalSequenceToken) return;
                if (renderToken !== moduleRenderToken || currentView !== 'registry') return;

                await playTerminalLine(
                    terminal,
                    'REGISTRY READY...',
                    'opacity-100 typing-line text-secondary-fixed',
                    220
                );
            } finally {
                unloadSequenceActive = false;
            }
        }

        async function mountModuleDetail(grid, details, selectedCard, data) {
            const applyDetailState = () => {
                grid.classList.add('hidden');
                details.classList.add('active');
                document.getElementById('module-header-title').innerText =
                    `System Status: ${data.title.toUpperCase()}`;
                document.getElementById('module-filter-text').innerText = 'BACK TO OVERVIEW [X]';
                currentView = 'detail';
            };

            const addFallbackCrossfade = () => {
                details.classList.add('module-detail-fallback');
                details.addEventListener(
                    'animationend',
                    (event) => {
                        if (event.animationName === 'module-detail-fallback') {
                            details.classList.remove('module-detail-fallback');
                        }
                    },
                    { once: true }
                );
            };

            if (!selectedCard || typeof document.startViewTransition !== 'function') {
                const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                if (reducedMotion || !selectedCard) {
                    details.dataset.transitionMode = 'crossfade';
                    applyDetailState();
                    addFallbackCrossfade();
                    return;
                }

                const sourceRect = selectedCard.getBoundingClientRect();
                details.dataset.transitionMode = 'fallback-expand';
                const transitionCard = selectedCard.cloneNode(true);
                transitionCard.classList.add('module-card-transition-clone');
                transitionCard.removeAttribute('data-module-id');
                transitionCard.disabled = true;
                transitionCard.style.setProperty('--module-source-top', `${sourceRect.top}px`);
                transitionCard.style.setProperty('--module-source-left', `${sourceRect.left}px`);
                transitionCard.style.setProperty('--module-source-width', `${sourceRect.width}px`);
                transitionCard.style.setProperty('--module-source-height', `${sourceRect.height}px`);
                document.body.append(transitionCard);

                applyDetailState();
                addFallbackCrossfade();
                const targetRect = details.getBoundingClientRect();
                const targetHeight = Math.max(
                    sourceRect.height,
                    Math.min(targetRect.height, window.innerHeight * 0.9)
                );
                transitionCard.style.setProperty('--module-target-top', `${targetRect.top}px`);
                transitionCard.style.setProperty('--module-target-left', `${targetRect.left}px`);
                transitionCard.style.setProperty('--module-target-width', `${targetRect.width}px`);
                transitionCard.style.setProperty('--module-target-height', `${targetHeight}px`);
                void transitionCard.offsetWidth;
                transitionCard.classList.add('expanding');
                await new Promise((resolve) => {
                    let fallbackTimer = null;
                    const finish = () => {
                        if (fallbackTimer !== null) clearTimeout(fallbackTimer);
                        transitionCard.removeEventListener('animationend', finish);
                        resolve();
                    };
                    transitionCard.addEventListener('animationend', finish);
                    fallbackTimer = setTimeout(finish, 750);
                });
                transitionCard.remove();
                return;
            }

            selectedCard.style.viewTransitionName = 'module-detail';
            details.dataset.transitionMode = 'native-expand';
            try {
                const transition = document.startViewTransition(() => {
                    grid.classList.add('hidden');
                    details.style.viewTransitionName = 'module-detail';
                    details.classList.add('active');
                    document.getElementById('module-header-title').innerText =
                        `System Status: ${data.title.toUpperCase()}`;
                    document.getElementById('module-filter-text').innerText = 'BACK TO OVERVIEW [X]';
                    currentView = 'detail';
                });
                await transition.finished;
            } catch {
                if (currentView !== 'detail') applyDetailState();
            } finally {
                selectedCard.style.removeProperty('view-transition-name');
                details.style.removeProperty('view-transition-name');
            }
        }

        async function activateScript(scriptKey) {
            if (!pageBootComplete || currentView !== 'registry') return;

            const data = scripts.find((script) => script.id === scriptKey);
            if (!data) return;

            cancelScheduledUnload();
            cancelScheduledModuleRender();
            const sequenceToken = terminalSequenceToken;
            const renderToken = moduleRenderToken;
            const terminal = document.getElementById('cli-output');
            const grid = document.getElementById('module-grid');
            const details = document.getElementById('script-details-container');
            const selectedCard = grid.querySelector(`[data-module-id="${scriptKey}"]`);

            currentView = 'loading-detail';
            activeModuleId = data.id;
            grid.setAttribute('aria-busy', 'true');
            grid.querySelectorAll('.module-card').forEach((card) => {
                card.classList.remove('fade-slide-up');
                card.style.animationDelay = '';
                card.disabled = true;
                card.classList.toggle('loading-peer', card !== selectedCard);
            });
            if (selectedCard) {
                selectedCard.classList.add('active', 'loading');
            }

            const steps = getModuleDiagnosticSteps(data);
            for (const step of steps) {
                const completed = await playTerminalLine(
                    terminal,
                    step.message,
                    step.className || 'opacity-100 typing-line terminal-report-line',
                    step.duration || 150,
                    Object.hasOwn(step, 'statusText') ? step.statusText : '',
                    step.statusClass || 'text-[#98f05f]'
                );
                if (!completed || sequenceToken !== terminalSequenceToken) {
                    grid.removeAttribute('aria-busy');
                    return;
                }
                if (renderToken !== moduleRenderToken || currentView !== 'loading-detail') {
                    grid.removeAttribute('aria-busy');
                    return;
                }
            }

            populateModuleDetail(data);
            const mounted = await playTerminalLine(
                terminal,
                'MOUNTING DETAIL INTERFACE...',
                'opacity-100 typing-line text-secondary-fixed',
                260
            );
            if (!mounted || sequenceToken !== terminalSequenceToken) {
                grid.removeAttribute('aria-busy');
                return;
            }
            if (renderToken !== moduleRenderToken || currentView !== 'loading-detail') {
                grid.removeAttribute('aria-busy');
                return;
            }

            await mountModuleDetail(grid, details, selectedCard, data);
            grid.removeAttribute('aria-busy');
            details.focus({ preventScroll: true });
        }

        function resetView() {
            if (!pageBootComplete) return;
            if (currentView === 'detail') {
                void unloadActiveModule();
                return;
            }

            cancelScheduledUnload();
            cancelScheduledModuleRender();
            currentView = 'registry';
            activeModuleId = null;
            currentFilter = 'ALL';
            document.getElementById('module-grid').classList.remove('hidden');
            document.getElementById('script-details-container').classList.remove('active');
            updateRegistrySummary();
            renderModules('RESTORING REGISTRY OVERVIEW...');
        }

        document.addEventListener('DOMContentLoaded', async () => {
            initializeBootStages();
            await loadScriptUpdates();
            renderScriptUpdateTimeline();
            document.querySelectorAll('[data-tier]').forEach((control) => {
                control.addEventListener('click', () => filterByTier(control.dataset.tier));
            });
            document.getElementById('brand-home').addEventListener('click', resetView);
            document.getElementById('return-to-registry').addEventListener('click', unloadActiveModule);
            document.getElementById('clock-toggle').addEventListener('click', toggleClock);
            document.getElementById('mobile-menu-toggle').addEventListener('click', toggleMobileMenu);
            document.getElementById('module-sort-button').addEventListener('click', toggleSortMenu);
            document.querySelectorAll('[data-sort]').forEach((control) => {
                control.addEventListener('click', () => setModuleSort(control.dataset.sort));
            });
            document.querySelectorAll('[data-dialog]').forEach((control) => {
                control.addEventListener('click', () => {
                    document.getElementById(control.dataset.dialog).showModal();
                });
            });
            document.querySelectorAll('[data-close-dialog]').forEach((control) => {
                control.addEventListener('click', () => control.closest('dialog').close());
            });
            document.getElementById('screenshot-previous').addEventListener('click', () => {
                showScreenshot(activeScreenshotIndex - 1);
            });
            document.getElementById('screenshot-next').addEventListener('click', () => {
                showScreenshot(activeScreenshotIndex + 1);
            });
            document.querySelectorAll('dialog').forEach((dialog) => {
                dialog.addEventListener('click', (event) => {
                    if (event.target === dialog) dialog.close();
                });
            });
            document.addEventListener('click', (event) => {
                const target = event.target;
                if (!(target instanceof Element)) return;
                if (!target.closest('#module-sort-group')) closeSortMenu();
                if (!target.closest('#clock-toggle') && !target.closest('#clock-panel')) {
                    document.getElementById('clock-panel').classList.add('hidden');
                    document.getElementById('clock-toggle').setAttribute('aria-expanded', 'false');
                }
                if (!target.closest('#mobile-menu-toggle') && !target.closest('#mobile-nav')) closeMobileMenu();
            });
            document.addEventListener('keydown', (event) => {
                const screenshotDialog = document.getElementById('screenshot-dialog');
                if (screenshotDialog.open && event.key === 'ArrowLeft') {
                    showScreenshot(activeScreenshotIndex - 1);
                    return;
                }
                if (screenshotDialog.open && event.key === 'ArrowRight') {
                    showScreenshot(activeScreenshotIndex + 1);
                    return;
                }
                if (event.key !== 'Escape') return;
                closeSortMenu();
                closeMobileMenu();
                document.getElementById('clock-panel').classList.add('hidden');
                document.getElementById('clock-toggle').setAttribute('aria-expanded', 'false');
            });

            const updateClock = () => {
                const now = new Date();
                const clock = document.getElementById('header-digital-clock');
                clock.dateTime = now.toISOString();
                clock.textContent = new Intl.DateTimeFormat([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }).format(now);
            };
            updateClock();
            setInterval(updateClock, 1000);
            updateRegistrySummary();
            void runPageBootSequence().catch(handleBootFailure);

            const terminal = document.getElementById('cli-output');
            if (!terminal || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

            setInterval(() => {
                if (Math.random() > 0.9) {
                    terminal.style.opacity = '0.8';
                    setTimeout(() => {
                        terminal.style.opacity = '1';
                    }, 50);
                }
            }, 2000);
        });
