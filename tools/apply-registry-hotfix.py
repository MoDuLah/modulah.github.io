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


replace_once(
    '<style>\n        .glass-panel {',
    '''<style>
        html,
        body {
            min-height: 100%;
            background-color: #111416;
        }
        .shader-background {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100vh;
            background: #111416;
            overflow: hidden;
            pointer-events: none;
        }
        .shader-background canvas {
            display: block;
            width: 100%;
            height: 100%;
            background: #111416;
        }
        .glass-panel {''',
    'style entry point',
)

replace_once(
    '<body class="bg-transparent text-on-surface font-body-md min-h-screen relative overflow-x-hidden flex flex-col selection:bg-[#98f05f] selection:text-background">',
    '<body class="bg-background text-on-surface font-body-md min-h-screen relative overflow-x-hidden flex flex-col selection:bg-[#98f05f] selection:text-background">',
    'body class',
)

replace_once(
    '<div class="absolute inset-0 w-full h-full z-[-1]" style="display:block;">\n<canvas id="shader-canvas-ANIMATION_67" style="display:block;width:100%;height:100%" width="1280" height="1024"></canvas>',
    '<div class="shader-background z-[-1]" style="display:block;background:#111416;">\n<canvas id="shader-canvas-ANIMATION_67" style="display:block;width:100%;height:100%;background:#111416" width="1280" height="1024"></canvas>',
    'shader wrapper',
)

replace_once(
    "  const canvas = document.getElementById('shader-canvas-ANIMATION_67');\n\n  function syncSize() {",
    '''  const canvas = document.getElementById('shader-canvas-ANIMATION_67');
  let gl = null;

  function clearDarkFrame() {
    if (!gl) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0667, 0.0784, 0.0863, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function syncSize() {''',
    'shader setup',
)

replace_once(
    '''    if (canvas.width !== drawingWidth || canvas.height !== drawingHeight) {
      canvas.width = drawingWidth;
      canvas.height = drawingHeight;
    }
  }''',
    '''    if (canvas.width !== drawingWidth || canvas.height !== drawingHeight) {
      canvas.width = drawingWidth;
      canvas.height = drawingHeight;
      clearDarkFrame();
      return true;
    }
    return false;
  }''',
    'shader resize block',
)

replace_once(
    "  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');",
    "  gl = canvas.getContext('webgl', { alpha: false }) || canvas.getContext('experimental-webgl', { alpha: false });",
    'WebGL context creation',
)

replace_once(
    '''  gl.useProgram(prog);
  const buf = gl.createBuffer();''',
    '''  gl.useProgram(prog);
  clearDarkFrame();
  const buf = gl.createBuffer();''',
    'initial WebGL clear',
)

replace_once(
    '''    gl.viewport(0, 0, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, t * 0.001);''',
    '''    clearDarkFrame();
    if (uTime) gl.uniform1f(uTime, t * 0.001);''',
    'render clear',
)

replace_once(
    '''        let moduleRenderTimer = null;
        let unloadTimer = null;
        const sortLabels = {''',
    '''        let moduleRenderTimer = null;
        let unloadTimer = null;
        let terminalSequenceToken = 0;
        const pendingTerminalSteps = new Map();
        const sortLabels = {''',
    'registry state declarations',
)

replace_once(
    '''        function cancelScheduledModuleRender() {
            moduleRenderToken += 1;
            if (moduleRenderTimer !== null) {
                clearTimeout(moduleRenderTimer);
                moduleRenderTimer = null;
            }
        }''',
    '''        function cancelScheduledModuleRender() {
            moduleRenderToken += 1;
            cancelTerminalSequence();
            if (moduleRenderTimer !== null) {
                clearTimeout(moduleRenderTimer);
                moduleRenderTimer = null;
            }
        }''',
    'module render cancellation',
)

replace_once(
    '''        function resetTerminal(terminal) {
            const initialisingLine = createTerminalLine(
                'INITIALISING MODUL SYSTEMS...',
                'opacity-70 typing-line'
            );
            initialisingLine.style.animationDuration = '0.3s';
            const connectingLine = createTerminalLine(
                'CONNECTING TO REGISTRY...',
                'opacity-70 typing-line'
            );
            connectingLine.style.animationDuration = '0.3s';
            const cursorLine = createTerminalCursor();
            terminal.replaceChildren(initialisingLine, connectingLine, cursorLine);
            return cursorLine;
        }''',
    '''        function resetTerminal(terminal) {
            const cursorLine = createTerminalCursor();
            terminal.replaceChildren(cursorLine);
            return cursorLine;
        }''',
    'terminal reset function',
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

        function createModuleCard''',
    '''        function appendTerminalLine(terminal, line) {
            const cursorLine = terminal.querySelector('#cli-cursor-line');
            if (cursorLine) {
                terminal.insertBefore(line, cursorLine);
            } else {
                terminal.append(line);
            }
            terminal.scrollTop = terminal.scrollHeight;
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

        function playTerminalLine(terminal, message, className, duration = 200) {
            const sequenceToken = terminalSequenceToken;
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const line = createTerminalLine(message, className);
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

        async function runRegistryTerminalSequence(terminal, grid, filteredScripts, renderToken) {
            cancelTerminalSequence();
            const sequenceToken = terminalSequenceToken;
            resetTerminal(terminal);

            const bootSteps = [
                ['INITIALISING MODUL SYSTEMS...', 'opacity-70 typing-line', 300],
                ['CONNECTING TO REGISTRY...', 'opacity-70 typing-line', 300]
            ];

            for (const [message, className, duration] of bootSteps) {
                const completed = await playTerminalLine(terminal, message, className, duration);
                if (!completed || sequenceToken !== terminalSequenceToken) return;
                if (renderToken !== moduleRenderToken || currentView !== 'registry') return;
            }

            for (const [index, script] of filteredScripts.entries()) {
                const completed = await playTerminalLine(
                    terminal,
                    `INITIALIZING MODULE: ${script.title.toUpperCase()}...`,
                    'opacity-100 typing-line text-outline-variant',
                    180
                );
                if (!completed || sequenceToken !== terminalSequenceToken) return;
                if (renderToken !== moduleRenderToken || currentView !== 'registry') return;

                const { card } = createModuleCard(script, index);
                card.style.animationDelay = '0ms';
                grid.append(card);
            }

            await playTerminalLine(
                terminal,
                `MODULES LOADED (${filteredScripts.length})...`,
                'opacity-100 typing-line',
                240
            );
        }

        function createModuleCard''',
    'terminal sequence helpers',
)

replace_between(
    '        function renderModules() {',
    '        function createDetailAction(action) {',
    '''        function renderModules() {
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
                void runRegistryTerminalSequence(terminal, grid, filteredScripts, renderToken);
            };

            if (oldCards.length > 0) {
                moduleRenderTimer = setTimeout(commitRender, 300);
            } else {
                commitRender();
            }
        }

''',
    'module renderer',
)

required = [
    'background-color: #111416;',
    'shader-background',
    "canvas.getContext('webgl', { alpha: false })",
    'runRegistryTerminalSequence',
    'cancelTerminalSequence',
]
for marker in required:
    if marker not in html:
        raise RuntimeError(f'Missing expected marker after patch: {marker}')

legacy = [
    '`${animationDelay}ms`',
    '`${filteredScripts.length * 60 + 100}ms`',
]
for marker in legacy:
    if marker in html:
        raise RuntimeError(f'Legacy delayed terminal marker remains: {marker}')

path.write_text(html, encoding='utf-8')
print('Applied dark-frame and sequential registry-console fixes to code.html.')
