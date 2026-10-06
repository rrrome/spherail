#!/usr/bin/env python3
"""Render the app icon with the same transparent inset at every macOS size."""
from pathlib import Path
import shutil
import subprocess

from PIL import Image


root = Path(__file__).resolve().parents[1]
iconset = root / "build" / "Spherail.iconset"
iconset.mkdir(parents=True, exist_ok=True)
renderer = shutil.which("rsvg-convert")
if renderer is None:
    raise SystemExit("rsvg-convert is required to rebuild Assets/Spherail.icns")

master = iconset / "icon_512x512@2x.png"
subprocess.run([
    renderer, "--width", "1024", "--height", "1024",
    str(root / "Assets" / "AppIcon.svg"), "--output", str(master),
], check=True)

with Image.open(master) as image:
    source = image.convert("RGBA")
    bounds = source.getchannel("A").getbbox()
    if bounds is None or not all(85 <= margin <= 107 for margin in
                                 (bounds[0], bounds[1], 1024 - bounds[2], 1024 - bounds[3])):
        raise SystemExit(f"Unexpected icon inset: {bounds}")
    for base in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            size = base * scale
            if size == 1024:
                continue
            suffix = "@2x" if scale == 2 else ""
            source.resize((size, size), Image.Resampling.LANCZOS).save(
                iconset / f"icon_{base}x{base}{suffix}.png"
            )

subprocess.run([
    "iconutil", "--convert", "icns", "--output",
    str(root / "Assets" / "Spherail.icns"), str(iconset),
], check=True)
