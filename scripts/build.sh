#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
PYTHON="${INKBALL_BUILD_PYTHON:-.venv/bin/python}"
if ! command -v "$PYTHON" >/dev/null 2>&1; then
  echo 'Build environment missing. Run: bash scripts/setup.sh' >&2
  exit 1
fi
"$PYTHON" -c 'import PIL' || {
  echo 'Install build dependencies with: bash scripts/setup.sh' >&2
  exit 1
}
for tool in swift rsvg-convert iconutil codesign hdiutil; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing build tool: $tool (see README.md)." >&2
    exit 1
  fi
done
"$PYTHON" scripts/prepare_assets.py
"$PYTHON" scripts/verify_gameplay_sprites.py
"$PYTHON" scripts/build_icon.py
swift build -c release
APP="build/Spherail.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp .build/release/InkBallMac "$APP/Contents/MacOS/Spherail"
cp Assets/Spherail.icns "$APP/Contents/Resources/Spherail.icns"
cp -R Assets/zh-Hans.lproj "$APP/Contents/Resources/"
cp -R Web "$APP/Contents/Resources/Web"
cp LICENSE README.md README.en.md "$APP/Contents/Resources/"
cp AppInfo.plist "$APP/Contents/Info.plist"
codesign --force --deep --sign - "$APP"
mkdir -p build/dmg-root
rm -rf build/dmg-root/*
cp -R "$APP" build/dmg-root/
ln -s /Applications build/dmg-root/Applications
hdiutil create -volname Spherail -srcfolder build/dmg-root -ov -format UDZO build/Spherail-macOS.dmg
hdiutil verify build/Spherail-macOS.dmg
