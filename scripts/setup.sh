#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)"
python --version
npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/smart-campus-npm-cache
npm run vendor
if [[ ! -x .venv/bin/python ]]; then python -m venv .venv; fi
.venv/bin/python -m pip install --disable-pip-version-check --cache-dir /tmp/smart-campus-pip-cache -r requirements-dev.txt
test -x "${CHROMIUM_PATH:-/usr/bin/chromium}"
npm run check
npm test
.venv/bin/python tests/browser.py
.venv/bin/python tests/browser_stage2.py
