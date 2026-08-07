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


replace_once(
    '<!DOCTYPE html><html class="dark" lang="en" style="">',
    '<!DOCTYPE html><html class="dark" lang="en" style="background:#111416;">',
    'document root',
)

replace_once(
    '''        .shader-background {
            position: fixed;
            inset: 0;
            width: 100vw;''',
    '''        .shader-background {
            position: fixed;
            z-index: 0;
            inset: 0;
            width: 100vw;''',
    'shader background rule',
)

replace_once(
    '<div class="shader-background z-[-1]" style="display:block;background:#111416;">',
    '<div class="shader-background" style="display:block;background:#111416;">',
    'shader wrapper class',
)

replace_once(
    '''<div class="text-[#98f05f] flex-1 font-mono tracking-tight relative z-10 overflow-y-auto custom-scrollbar text-[11px]" data-stitch-orig-opacity="1" id="cli-output" style="opacity: 1;">
                    <div class="opacity-70 typing-line" style="animation-duration: 0.3s;">&gt; INITIALISING MODUL SYSTEMS... <span class="text-secondary-fixed-dim">[OK]</span></div>
                    <div class="opacity-70 typing-line" style="animation-duration: 0.3s;">&gt; CONNECTING TO REGISTRY... <span class="text-secondary-fixed-dim">[OK]</span></div>
                    <div class="typing-line" id="cli-cursor-line">&gt; _<span class="blink-cursor inline-block w-2 h-3 bg-[#98f05f] translate-y-0.5 ml-1"></span></div>
                </div>''',
    '''<div class="text-[#98f05f] flex-1 font-mono tracking-tight relative z-10 overflow-y-auto custom-scrollbar text-[11px]" data-stitch-orig-opacity="1" id="cli-output" style="opacity: 1;">
                    <div class="typing-line" id="cli-cursor-line">&gt; _<span class="blink-cursor inline-block w-2 h-3 bg-[#98f05f] translate-y-0.5 ml-1"></span></div>
                </div>''',
    'initial terminal contents',
)

required = [
    'style="background:#111416;"',
    'z-index: 0;',
    '<div class="shader-background"',
    'runRegistryTerminalSequence',
]
for marker in required:
    if marker not in html:
        raise RuntimeError(f'Missing expected marker after refinement: {marker}')

for forbidden in [
    'shader-background z-[-1]',
    '<div class="opacity-70 typing-line" style="animation-duration: 0.3s;">&gt; INITIALISING MODUL SYSTEMS...',
]:
    if forbidden in html:
        raise RuntimeError(f'Obsolete marker remains after refinement: {forbidden}')

path.write_text(html, encoding='utf-8')
print('Refined shader stacking, root fallback and initial terminal ownership.')
