"""Reuse the shipped Mac artwork for Windows; no external SVG renderer needed."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
destination = root / 'Assets' / 'Windows'
destination.mkdir(parents=True, exist_ok=True)
with Image.open(root / 'Assets' / 'Spherail.icns') as source:
    image = source.convert('RGBA')
    image.save(destination / 'Spherail.ico', sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
    image.resize((256, 256), Image.Resampling.LANCZOS).save(destination / 'Spherail.png')
print('Prepared Windows ICO and PNG from the existing Spherail app icon.')
