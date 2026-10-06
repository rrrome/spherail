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
Map materials under `static/img/inkball/` must not be restyled with these tokens.

## Implementation

- `static/css/style.css`: shared layout, navigation, messages, and error pages.
  `match-room.css`, `gameplay.css`, `map-pages.css`, `result.css`, and
  `community-editor.css` own their page geometry and animation states;
  `responsive.css` contains the earlier shared and mobile overrides.
  `ui-system.css` applies the shared skin and later responsive overrides.
- `static/css/scene-transition.css` / `static/js/scene-transition.js`: ordinary
  route transitions, with a branded shutter on browsers without cross-document
  transitions. The old frame stays visible beneath the entering snapshot.
- Existing carousel, board FLIP, ambient, pause, result and editor hand-offs
  retain their timing. Scene transitions skip those hand-offs.
- The home counter observes the existing `.is-center` class. It never handles
  input, changes selection, or writes to the carousel.
- The editor reserves space for the real toolbar, difficulty row and undo dock;
  its existing FLIP animation targets the measured board rectangle.
- Only the 64px Canvas HUD is restyled. Queue motion and level drawing are intact.
- Confirmations still use awaited `InkballUI.confirm` / `InkballUI.prompt`.
  AJAX forms and cancelled editor navigation bypass the scene helper.
- `static/js/fullscreen.js` requests fullscreen only from the shared button.
  In-app hops keep that document fullscreen via a same-origin overlay until Esc.
  A cold load never auto-enters. The result template omits this control.

Cross-document transition reference:
[Chrome's MPA transition documentation](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document).

## Verification

```sh
node --test tests/js/*.test.js
.venv/bin/python manage.py check
.venv/bin/python manage.py test --noinput
```

`scene_transition.test.js` covers delayed fallback navigation, native transitions,
existing-animation opt-out, form submission, duplicate clicks, modifier keys,
reduced motion, storage denial, stale hand-offs and cancelled navigation recovery.
