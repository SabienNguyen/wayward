#!/usr/bin/env bash
# Rebuild, then run every check. Browser tests need Playwright with Chromium.
set -e
cd "$(dirname "$0")/.."
python3 build.py
node tests/engine.test.js
node curriculum/check.js | tail -1
node curriculum/verify_puzzles.js | tail -1
python3 build.py tests/.page.html >/dev/null
{ printf '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'; cat tests/.page.html; printf '</body></html>'; } > tests/.preview.html
node tests/e2e.js
node tests/e2e2.js
