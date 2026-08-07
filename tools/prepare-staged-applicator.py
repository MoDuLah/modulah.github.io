#!/usr/bin/env python3
from pathlib import Path

path = Path('tools/apply-staged-boot.py')
source = path.read_text(encoding='utf-8')

replacements = {
    "sequence_functions + '        function createModuleCard(script, index) {'": "sequence_functions",
    "render_function + '        function createDetailAction(action) {'": "render_function",
    'module_functions + "        document.addEventListener(\'DOMContentLoaded\', () => {"': 'module_functions',
}

for search, replacement in replacements.items():
    count = source.count(search)
    if count != 1:
        raise RuntimeError(f'Expected one applicator marker {search!r}; found {count}.')
    source = source.replace(search, replacement, 1)

path.write_text(source, encoding='utf-8')
print('Prepared staged boot applicator end-marker handling.')
