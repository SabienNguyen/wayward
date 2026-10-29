#!/usr/bin/env python3
"""Assemble the single-file page (index.html) from src/, ml/ and curriculum/."""
import json, os, re, sys
D = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(D, p), encoding='utf-8').read()
strip_exports = lambda js: re.sub(r"\nif \(typeof module !== 'undefined'\) module\.exports.*\n", "\n", js)

weights = json.loads(rd('ml/weights.json'))
lessons = json.loads(rd('curriculum/lessons.json'))
puzzles = json.loads(rd('curriculum/puzzles.json'))
parts = {
    'CSS': rd('src/base.css'),
    'EXTRA': rd('src/extra.css'),
    'ENGINE': strip_exports(rd('src/engine.js')),
    'ML': strip_exports(rd('ml/ml.js')),
    'WEIGHTS': json.dumps({'checkpoints': weights}),
    'LESSONS': json.dumps(lessons, ensure_ascii=False),
    'PUZZLES': json.dumps(puzzles, ensure_ascii=False),
    'APP': rd('src/app.js'),
}
out = rd('src/shell.html')
for k, v in parts.items():
    assert out.count(f'/*@@{k}@@*/') == 1, k
    out = out.replace(f'/*@@{k}@@*/', v.replace('</script', '<\\/script'))
dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, 'index.html')
open(dest, 'w', encoding='utf-8').write(out)
print('wrote', os.path.relpath(dest, D), f'{len(out) // 1024} KB')
