#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo 'Install Node.js 24+ (including npm) before setting up the build.' >&2
  exit 1
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) { console.error("Node.js 24+ is required"); process.exit(1); }'

# Prefer the tested Python version, then accept any installed Python 3.10+.
BUILD_PYTHON="${PYTHON:-}"
if [ -z "$BUILD_PYTHON" ]; then
  for candidate in python3.12 python3 python3.14 python3.13 python3.11 python3.10; do
    if command -v "$candidate" >/dev/null 2>&1 && \
       "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then
      BUILD_PYTHON="$candidate"
      break
    fi
  done
fi
if [ -z "$BUILD_PYTHON" ]; then
  echo 'Install Python 3.10+ first, or set PYTHON to its executable.' >&2
  exit 1
fi
"$BUILD_PYTHON" -c 'import sys; sys.exit("Python 3.10+ is required" if sys.version_info < (3, 10) else 0)'
"$BUILD_PYTHON" -m venv .venv
.venv/bin/python -m pip install -r requirements-build.txt
npm ci
npm run build:3d
if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo 'Install the icon renderer with: brew install librsvg' >&2
  exit 1
fi
echo 'Build environment ready. Run: bash scripts/build.sh'
