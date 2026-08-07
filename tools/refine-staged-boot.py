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
    '''        function setModuleSort(sort) {
            if (!Object.hasOwn(sortLabels, sort)) return;''',
    '''        function setModuleSort(sort) {
            if (!pageBootComplete || currentView !== 'registry') return;
            if (!Object.hasOwn(sortLabels, sort)) return;''',
    'sort readiness guard',
)

replace_once(
    '''        function filterByTier(tier) {
            cancelScheduledUnload();''',
    '''        function filterByTier(tier) {
            if (!pageBootComplete) return;
            cancelScheduledUnload();''',
    'filter readiness guard',
)

replace_once(
    '''        function resetView() {
            if (currentView === 'detail') {''',
    '''        function resetView() {
            if (!pageBootComplete) return;
            if (currentView === 'detail') {''',
    'overview readiness guard',
)

replace_once(
    '''<div class="text-[#98f05f] flex-1 font-mono tracking-tight relative z-10 overflow-y-auto custom-scrollbar text-[11px]" data-stitch-orig-opacity="1" id="cli-output" style="opacity: 1;">''',
    '''<div aria-live="polite" aria-relevant="additions" class="text-[#98f05f] flex-1 font-mono tracking-tight relative z-10 overflow-y-auto custom-scrollbar text-[11px]" data-stitch-orig-opacity="1" id="cli-output" role="log" style="opacity: 1;">''',
    'terminal accessibility attributes',
)

for function_name in [
    'createModuleCard',
    'createDetailAction',
    'populateModuleDetail',
    'runPageBootSequence',
    'activateScript',
    'unloadActiveModule',
]:
    occurrences = html.count(f'function {function_name}')
    if occurrences != 1:
        raise RuntimeError(f'Expected one {function_name} declaration; found {occurrences}.')

required = [
    'if (!pageBootComplete || currentView !== \'registry\') return;',
    'if (!pageBootComplete) return;',
    'role="log"',
    'aria-relevant="additions"',
]
for marker in required:
    if marker not in html:
        raise RuntimeError(f'Missing staged boot refinement: {marker}')

path.write_text(html, encoding='utf-8')
print('Applied staged boot readiness guards and terminal accessibility attributes.')
