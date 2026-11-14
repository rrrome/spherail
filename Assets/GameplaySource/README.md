# Spherail board art

`ceramic.png` was generated for Spherail from a text description of neutral
glazed ceramic. `scripts/generate_gameplay_sprites.py` draws the gameplay
sprites from that material and its own shapes and colour palette. The generator
does not read artwork from the original scaffold.

The App build copies its 56 generated gameplay sprites into `Web/img/inkball`
and excludes the scaffold sprite sheet. Three existing ambient category marks
remain part of the App UI. `scripts/verify_gameplay_sprites.py` checks the set,
dimensions, packaging, and reference asset hashes recorded in
`reference-hashes.json`. This manifest stores hashes only; verification uses
the checked-in manifest without loading reference artwork.

Mac and Windows use 20 additional one-way sprites from `Assets/GameplayMac`,
generated from the same material and palette with a transverse bar ahead of
each arrow. They are copied to `Web/img/inkball/mac`. The native
`AppResourceHandler` and Windows resource handler resolve the existing one-way
image URLs to these variants, so previews, the editor, tile guide and 2D game
use the same art. The base sprites remain unchanged in the resource tree.
Verification checks the bars, frame preservation and the visible marks'
centres of mass across all colours and directions.
