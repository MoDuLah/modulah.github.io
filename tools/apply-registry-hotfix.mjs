#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';

const path = 'code.html';
let html = readFileSync(path, 'utf8');

function replaceOnce(search, replacement, label) {
  const index = html.indexOf(search);
  if (index === -1) {
    throw new Error(`Unable to locate ${label}.`);
  }
  if (html.indexOf(search, index + search.length) !== -1) {
    throw new Error(`Expected one ${label}, found more than one.`);
  }
  html = `${html.slice(0, index)}${replacement}${html.slice(index + search.length)}`;
}

function replaceBetween(startMarker, endMarker, replacement, label) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Unable to locate ${label}.`);
  }
  html = `${html.slice(0, start)}${replacement}${html.slice(end)}`;
}

replaceOnce(
  '<style>\n        .glass-panel {',
  `<style>
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
        .glass-panel {`,
  'style entry point'
);

replaceOnce(
  '<body class="bg-transparent text-on-surface font-body-md min-h-screen relative overflow-x-hidden flex flex-col selection:bg-[#98f05f] selection:text-background">',
  '<body class="bg-background text-on-surface font-body-md min-h-screen relative overflow-x-hidden flex flex-col selection:bg-[#98f05f] selection:text-background">',
  'body class'
);

replaceOnce(
  '<div class="absolute inset-0 w-full h-full z-[-1]" style="display:block;">\n<canvas id="shader-canvas-ANIMATION_67" style="display:block;width:100%;height:100%" width="1280" height="1024"></canvas>',
  '<div class="shader-background z-[-1]" style="display:block;background:#111416;">\n<canvas id="shader-canvas-ANIMATION_67" style="display:block;width:100%;height:100%;background:#111416" width="1280" height="1024"></canvas>',
  'shader wrapper'
);

replaceOnce(
  "  const canvas = document.getElementById('shader-canvas-ANIMATION_67');\n\n  function syncSize() {",
  `  const canvas = document.getElementById('shader-canvas-ANIMATION_67');
  let gl = null;

  function clearDarkFrame() {
    if (!gl) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0667, 0.0784, 0.0863, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function syncSize() {`,
  'shader setup'
);

replaceOnce(
  `    if (canvas.width !== drawingWidth || canvas.height !== drawingHeight) {
      canvas.width = drawingWidth;
      canvas.height = drawingHeight;
    }
  }`,
  `    if (canvas.width !== drawingWidth || canvas.height !== drawingHeight) {
      canvas.width = drawingWidth;
      canvas.height = drawingHeight;
      clearDarkFrame();
      return true;
    }
    return false;
  }`,
  'shader resize block'
);

replaceOnce(
  "  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');",
  "  gl = canvas.getContext('webgl', { alpha: false }) || canvas.getContext('experimental-webgl', { alpha: false });",
  'WebGL context creation'
);

replaceOnce(
  `  gl.useProgram(prog);
  const buf = gl.createBuffer();`,
  `  gl.useProgram(prog);
  clearDarkFrame();
  const buf = gl.createBuffer();`,
  'initial dark WebGL clear'
);

replaceOnce(
  `    gl.viewport(0, 0, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, t * 0.001);`,
  `    clearDarkFrame();
    if (uTime) gl.uniform1f(uTime, t * 0.001);`,
  'render frame clear'
);

replaceOnce(
  `        let moduleRenderTimer = null;
        let unloadTimer = null;
        const sortLabels = {`,
  `        let moduleRenderTimer = null;
        let unloadTimer = null;
        let terminalSequenceToken = 0;
        const pendingTerminalSteps = new Map();
        const sortLabels = {`,
  'registry state declarations'
);

replaceOnce(
  `        function cancelScheduledModuleRender() {
            moduleRenderToken += 1;
            if (moduleRenderTimer !== null) {
                clearTimeout(moduleRenderTimer);
                moduleRenderTimer = null;
            }
        }`,
  `        function cancelScheduledModuleRender() {
            moduleRenderToken += 1;
            cancelTerminalSequence();
            if (moduleRenderTimer !== null) {
                clearTimeout(moduleRenderTimer);
                moduleRenderTimer = null;
            }
        }`,
  'module render cancellation'
);

replaceOnce(
  `        function resetTerminal(terminal) {
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
        }`,
  `        function resetTerminal(terminal) {
            const cursorLine = createTerminalCursor();
            terminal.replaceChildren(cursorLine);
            return cursorLine;
        }`,
  'terminal reset function'
);

replaceOnce(
  `        function appendTerminalLine(terminal, line) {
            const cursorLine = terminal.querySelector('#cli-cursor-line');
            if (cursorLine) {
                terminal.insertBefore(line, cursorLine);
            } else {
                terminal.append(line);
            }
            terminal.scrollTop = terminal.scrollHeight;
        }

        function createModuleCard`,
  `        function appendTerminalLine(terminal, line) {
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
            const activeSteps = [...pendingTerminalSteps.entries()];
            activeSteps.forEach(([line, finish]) => {
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
            line.style.animationDuration = reducedMotion ? '0.01ms' : \\`${duration}ms\\`;
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
                    \\`INITIALIZING MODULE: ${script.title.toUpperCase()}...\\`,
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
                \\`MODULES LOADED (${filteredScripts.length})...\\`,
                'opacity-100 typing-line',
                240
            );
        }

        function createModuleCard`,
  'terminal sequence helpers'
);

replaceBetween(
  '        function renderModules() {',
  '        function createDetailAction(action) {',
  `        function renderModules() {
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

`,
  'module renderer'
);

if (!html.includes('background-color: #111416;')) {
  throw new Error('Dark document fallback was not applied.');
}
if (!html.includes('runRegistryTerminalSequence')) {
  throw new Error('Sequential registry controller was not applied.');
}
if (html.includes('`${animationDelay}ms`')) {
  throw new Error('Legacy delayed terminal insertion remains.');
}

writeFileSync(path, html);
console.log('Applied focused white-frame and registry-console hotfix.');
