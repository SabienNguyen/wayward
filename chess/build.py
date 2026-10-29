#!/usr/bin/env python3
"""Assemble the single-file page (index.html) from src/ and curriculum/."""
import json, os, re, sys
D = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(D, p), encoding='utf-8').read()
def data(p):
    full = os.path.join(D, p)
    return json.dumps(json.load(open(full, encoding='utf-8')), ensure_ascii=False) if os.path.exists(full) else '[]'
parts = {
    'CSS': rd('src/style.css'),
    'BRAIN_SRC': rd('src/brain.js'),
    'BRAIN': re.sub(r"\nif \(typeof module !== 'undefined'\) module\.exports.*\n", "\n", rd('src/brain.js')),
    'ENGINE': re.sub(r"\nif \(typeof module !== 'undefined'\) module\.exports.*\n", "\n", rd('src/engine.js')),
    'LESSONS': data('curriculum/lessons.json'),
    'PUZZLES': data('curriculum/puzzles.json'),
    'APP': rd('src/app.js'),
}
out = rd('src/shell.html')
for k, v in parts.items():
    assert out.count(f'/*@@{k}@@*/') == 1, k
    out = out.replace(f'/*@@{k}@@*/', v.replace('</script', '<\\/script'))
dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, 'index.html')
open(dest, 'w', encoding='utf-8').write(out)
print('wrote', os.path.relpath(dest, D), f'{len(out) // 1024} KB')
