# Inkball — the ink arcade

Open `index.html` for the local asset gallery. All UI artwork is original,
self-contained SVG with no fonts, embedded bitmaps or external dependencies.
Each image in this directory is below **10,000 bytes** (10 KB).

The game uses a deep teal console, cream cartridge labels, orange primary keys,
and mint status lights. Labels remain live HTML for English/Chinese translation
and accessibility. Surfaces are drawn with CSS, keeping downloads small.

| Asset | Role |
| --- | --- |
| `arcade-mark.svg` | Game identity and fallback scene shutter |
| `console-texture.svg` | Subtle console grid |
| `arcade-medal.svg` | Result ticket emblem |
| `ink-path.svg` | Entry illustration and player identity panel |
| `community.svg`, `friends.svg` | Workshop and social controls |
| `back.svg`, `search.svg`, `undo.svg`, `redo.svg` | Shared utility icons |
| `fullscreen.svg` | Fullscreen entry button (hidden on results and while fullscreen) |
| `pause-panel.svg`, `pause-title.svg` | Reusable panel and title plate |
| `pause-home.svg`, `pause-restart.svg`, `pause-resume.svg` | Reusable teal, cream and orange key surfaces |

`community.png` is retained for compatibility; the current header uses the SVG.
Board materials in `Web/img/inkball/` use their own palette and generator.

## Implementation

- `Web/desktop.css`, `desktop-web.css` and `desktop.js` define the desktop layout,
  navigation, map editor and view transitions.
- `Web/js/map-home.js`, `map-home-preview.js` and `map-home-ambient.js` implement
  the carousel, previews and ambient animation.
- `Web/js/inkball/` contains the game engine, Canvas HUD and match rendering.
- `Web/desktop-i18n.js` and `Web/i18n/` provide English/Chinese interface text.

The files in `Web/` are maintained directly in this repository. Resource
preparation regenerates board sprites, editor tiles, map data and translation
bundles while preserving the engine and UI source files.

## Verification

Run from the project root:

```sh
node scripts/verify_expansion.mjs
swift test
.venv/bin/python scripts/verify_gameplay_sprites.py
```
