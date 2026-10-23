#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

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
if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo 'Install the icon renderer with: brew install librsvg' >&2
  exit 1
fi
echo 'Build environment ready. Run: bash scripts/build.sh'
