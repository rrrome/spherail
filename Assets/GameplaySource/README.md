# Spherail board art

`ceramic.png` was generated for Spherail from a text description of neutral
glazed ceramic. `scripts/generate_gameplay_sprites.py` draws the gameplay
sprites from that material and its own shapes and colour palette. The generator
does not read artwork from the original scaffold.

The App build copies its 56 generated gameplay sprites into `Web/img/inkball`
and excludes the scaffold sprite sheet. Three existing ambient category marks
remain part of the App UI. `scripts/verify_gameplay_sprites.py` checks the set,
dimensions, packaging, and available source asset hashes.
