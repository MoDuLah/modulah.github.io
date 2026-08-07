#!/usr/bin/env python3
from pathlib import Path

path = Path('code.html')
html = path.read_text(encoding='utf-8')


def replace_once(search: str, replacement: str, label: str) -> None:
    global html
    count = html.count(search)
    if count != 1:
        raise RuntimeError(f'Expected exactly one {label}; found {count}.')
    html = html.replace(search, replacement, 1)


def replace_between(start_marker: str, end_marker: str, replacement: str, label: str) -> None:
    global html
    start = html.find(start_marker)
    end = html.find(end_marker, start + len(start_marker))
    if start < 0 or end < 0 or end <= start:
        raise RuntimeError(f'Unable to locate {label}.')
    html = html[:start] + replacement + html[end:]


boot_css = '''        [data-boot-stage],
        [data-boot-section="activity"] {
            visibility: hidden;
            opacity: 0 !important;
            transform: translateY(14px) !important;
            pointer-events: none;
        }
        [data-boot-stage].boot-stage-ready,
        [data-boot-section="activity"].boot-stage-ready {
            visibility: visible;
            opacity: 1 !important;
            transform: none !important;
            pointer-events: auto;
            transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #module-grid[aria-busy="true"] .module-card {
            pointer-events: none;
        }
        .terminal-report-line {
            color: #bac9cc;
        }
'''
replace_once(
    '        @media (prefers-reduced-motion: reduce) {',
    boot_css + '        @media (prefers-reduced-motion: reduce) {',
    'reduced-motion rule',
)

replace_once(
    '    </style>\n<link href="https://fonts.googleapis.com/css2?family=VT323&amp;display=swap" rel="stylesheet" class="">',
    '''    </style>
<noscript><style>[data-boot-stage],[data-boot-section="activity"]{visibility:visible!important;opacity:1!important;transform:none!important;pointer-events:auto!important}</style></noscript>
<link href="https://fonts.googleapis.com/css2?family=VT323&amp;display=swap" rel="stylesheet" class="">''',
    'style closing tag',
)

replace_once(
    '<header class="fixed top-0 w-full z-50',
    '<header data-boot-stage="interface" class="fixed top-0 w-full z-50',
    'header boot stage',
)
replace_once(
    '<!-- Title & CLI -->\n<div class="flex-1 flex flex-col gap-3">\n<div>\n<h1',
    '<!-- Title & CLI -->\n<div class="flex-1 flex flex-col gap-3">\n<div data-boot-stage="interface">\n<h1',
    'hero title boot stage',
)
replace_once(
    '<!-- Hero Actions -->\n<div class="flex flex-wrap gap-4">',
    '<!-- Hero Actions -->\n<div data-boot-stage="interface" class="flex flex-wrap gap-4">',
    'hero actions boot stage',
)
replace_once(
    '<!-- Diagnostics Sidebar -->\n<div class="w-full lg:w-80 grid grid-cols-2 lg:grid-cols-1 gap-unit">',
    '<!-- Diagnostics Sidebar -->\n<div data-boot-stage="diagnostics" class="w-full lg:w-80 grid grid-cols-2 lg:grid-cols-1 gap-unit">',
    'diagnostics boot stage',
)
replace_once(
    '<aside class="xl:col-span-3 flex flex-col gap-4 fade-slide-up h-full overflow-visible xl:overflow-hidden"',
    '<aside data-boot-section="activity" class="xl:col-span-3 flex flex-col gap-4 fade-slide-up h-full overflow-visible xl:overflow-hidden"',
    'activity boot stage',
)
replace_once(
    '<div class="xl:col-span-9 fade-slide-up flex flex-col h-full overflow-visible xl:overflow-hidden min-h-0" id="module-container"',
    '<div data-boot-stage="registry" class="xl:col-span-9 fade-slide-up flex flex-col h-full overflow-visible xl:overflow-hidden min-h-0" id="module-container"',
    'registry boot stage',
)
replace_once(
    '<div class="script-details glass-panel p-6 rounded-lg w-full" id="script-details-container">',
    '<div class="script-details glass-panel p-6 rounded-lg w-full" id="script-details-container" tabindex="-1">',
    'detail focus target',
)
replace_once(
    '<footer class="w-full py-4',
    '<footer data-boot-stage="footer" class="w-full py-4',
    'footer boot stage',
)

replace_once(
    '''        let unloadTimer = null;
        let terminalSequenceToken = 0;
        const pendingTerminalSteps = new Map();''',
    '''        let unloadTimer = null;
        let unloadSequenceActive = false;
        let activeModuleId = null;
        let pageBootComplete = false;
        let terminalSequenceToken = 0;
        const pendingTerminalSteps = new Map();''',
    'application state declarations',
)

replace_once(
    '''        const sortLabels = {
            newest: 'NEW-OLD',
            oldest: 'OLD-NEW',
            az: 'A-Z',
            za: 'Z-A'
        };''',
    '''        const sortLabels = {
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
        };''',
    'boot stage selector map',
)

replace_once(
    '''        function cancelScheduledUnload() {
            if (unloadTimer !== null) {
                clearTimeout(unloadTimer);
                unloadTimer = null;
            }
        }''',
    '''        function cancelScheduledUnload() {
            if (unloadTimer !== null) {
                clearTimeout(unloadTimer);
                unloadTimer = null;
            }
            unloadSequenceActive = false;
        }''',
    'unload cancellation',
)

replace_once(
    '''            currentSort = sort;
            closeSortMenu();
            updateRegistrySummary();
            renderModules();''',
    '''            currentSort = sort;
            closeSortMenu();
            updateRegistrySummary();
            renderModules(`SORTING REGISTRY [${sortLabels[sort]}]...`);''',
    'sort refresh call',
)

replace_once(
    '''        function filterByTier(tier) {
            cancelScheduledUnload();
            currentView = 'registry';
            currentFilter = tier;

            document.getElementById('module-grid').classList.remove('hidden');
            document.getElementById('script-details-container').classList.remove('active');

            closeMobileMenu();
            updateRegistrySummary();
            renderModules();
        }''',
    '''        function filterByTier(tier) {
            cancelScheduledUnload();
            currentView = 'registry';
            activeModuleId = null;
            currentFilter = tier;

            document.getElementById('module-grid').classList.remove('hidden');
            document.getElementById('script-details-container').classList.remove('active');

            closeMobileMenu();
            updateRegistrySummary();
            renderModules(`APPLYING REGISTRY FILTER [${tier}]...`);
        }''',
    'tier filter function',
)

replace_once(
    '''        function createTerminalLine(message, className, animationDelay = '') {
            const line = document.createElement('div');
            line.className = className;
            line.style.animationDuration = '0.2s';
            if (animationDelay) line.style.animationDelay = animationDelay;
            line.append(document.createTextNode(`> ${message} `));

            const status = document.createElement('span');
            status.className = 'text-[#98f05f]';
            status.textContent = '[OK]';
            line.append(status);
            return line;
        }''',
    '''        function createTerminalLine(
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
        }''',
    'terminal line factory',
)

replace_once(
    '''        function appendTerminalLine(terminal, line) {
            const cursorLine = terminal.querySelector('#cli-cursor-line');
            if (cursorLine) {
                terminal.insertBefore(line, cursorLine);
            } else {
                terminal.append(line);
            }
            terminal.scrollTop = terminal.scrollHeight;
        }

        function cancelTerminalSequence() {''',
    '''        function appendTerminalLine(terminal, line) {
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

        function cancelTerminalSequence() {''',
    'boot stage helpers',
)

replace_once(
    '''        function playTerminalLine(terminal, message, className, duration = 200) {
            const sequenceToken = terminalSequenceToken;
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const line = createTerminalLine(message, className);
            line.classList.add('terminal-pending');
            line.style.animationDelay = '0ms';
            line.style.animationDuration = reducedMotion ? '0.01ms' : `${duration}ms`;
            appendTerminalLine(terminal, line);''',
    '''        function playTerminalLine(
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
            appendTerminalLine(terminal, line);''',
    'terminal line player signature',
)

sequence_functions = '''        async function announceAndRenderModules(
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
                ['CONNECTING ACTIVITY STREAM...', 'activity', 240],
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

'''
replace_between(
    '        async function runRegistryTerminalSequence(',
    '        function createModuleCard(script, index) {',
    sequence_functions + '        function createModuleCard(script, index) {',
    'registry sequence controller',
)

render_function = '''        function renderModules(introMessage = 'REFRESHING MODULE REGISTRY...') {
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

'''
replace_between(
    '        function renderModules(',
    '        function createDetailAction(action) {',
    render_function + '        function createDetailAction(action) {',
    'module renderer',
)

module_functions = '''        function populateModuleDetail(data) {
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
            const availableActions = Array.isArray(data.actions) ? data.actions.length : 0;
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

                details.classList.remove('active');
                grid.classList.remove('hidden');
                currentView = 'registry';
                currentFilter = 'ALL';
                activeModuleId = null;
                updateRegistrySummary();
                grid.replaceChildren();

                const remount = await playTerminalLine(
                    terminal,
                    `REMOUNTING MODULE REGISTRY${activeData ? ` AFTER ${activeData.title.toUpperCase()}` : ''}...`,
                    'opacity-100 typing-line text-outline-variant',
                    240
                );
                if (!remount || sequenceToken !== terminalSequenceToken) return;
                if (renderToken !== moduleRenderToken || currentView !== 'registry') return;

                const rendered = await announceAndRenderModules(
                    terminal,
                    grid,
                    getVisibleModules(),
                    renderToken,
                    sequenceToken
                );
                if (!rendered) return;

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
                card.disabled = true;
            });
            if (selectedCard) selectedCard.classList.add('active');

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

            grid.classList.add('hidden');
            details.classList.add('active');
            document.getElementById('module-header-title').innerText =
                `System Status: ${data.title.toUpperCase()}`;
            document.getElementById('module-filter-text').innerText = 'BACK TO OVERVIEW [X]';
            currentView = 'detail';
            grid.removeAttribute('aria-busy');
            details.focus({ preventScroll: true });
        }

        function resetView() {
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

'''
replace_between(
    '        function unloadActiveModule() {',
    "        document.addEventListener('DOMContentLoaded', () => {",
    module_functions + "        document.addEventListener('DOMContentLoaded', () => {",
    'module detail lifecycle',
)

replace_once(
    "        document.addEventListener('DOMContentLoaded', () => {\n            document.querySelectorAll('[data-tier]')",
    "        document.addEventListener('DOMContentLoaded', () => {\n            initializeBootStages();\n            document.querySelectorAll('[data-tier]')",
    'boot stage initialization',
)
replace_once(
    '''            updateClock();
            setInterval(updateClock, 1000);
            updateRegistrySummary();
            renderModules();''',
    '''            updateClock();
            setInterval(updateClock, 1000);
            updateRegistrySummary();
            void runPageBootSequence().catch(handleBootFailure);''',
    'initial page boot call',
)

required_markers = [
    'data-boot-stage="interface"',
    'data-boot-stage="diagnostics"',
    'data-boot-section="activity"',
    'data-boot-stage="registry"',
    'data-boot-stage="footer"',
    'runPageBootSequence',
    'getModuleDiagnosticSteps',
    'MOUNTING DETAIL INTERFACE',
    'REMOUNTING MODULE REGISTRY',
    'COMMAND CENTRE READY',
]
for marker in required_markers:
    if marker not in html:
        raise RuntimeError(f'Missing staged boot marker: {marker}')

for forbidden in [
    'unloadTimer = setTimeout',
    'newLine.textContent = \' > UNLOADING MODULE',
    'renderModules();\n\n            const terminal',
]:
    if forbidden in html:
        raise RuntimeError(f'Obsolete lifecycle marker remains: {forbidden}')

path.write_text(html, encoding='utf-8')
print('Applied staged page boot and module diagnostic controller to code.html.')
