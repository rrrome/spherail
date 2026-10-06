#!/usr/bin/env python3
"""Copy the authored web engine and compile official maps for the offline app."""
import json
import shutil
import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
SOURCE = APP.parent / 'ELEC3609Code'
WEB = APP / 'Web'
sys.path.insert(0, str(SOURCE))

# This build-time import uses the existing map derivation rules. Django is not
# included in, started by, or required to run the delivered Mac application.
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
import django
django.setup()
from inkball.layouts import filter_layout, to_pair_layout  # noqa: E402


def copy(src, dst):
    target = WEB / dst
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE / src, target)


for name in ('constants', 'tiles', 'line', 'hole', 'ball', 'moving_tile',
             'dashboard', 'level', 'app', 'match-sync'):
    copy(f'static/js/inkball/{name}.js', f'js/inkball/{name}.js')
# The shared engine keeps its original symbol names and map protocol, while
# the Mac-only canvas header uses this app's public name.
dashboard = WEB / 'js/inkball/dashboard.js'
source = dashboard.read_text(encoding='utf-8')
needle = "ctx.fillText('INKBALL', Inkball.WIDTH / 2, 25);"
assert source.count(needle) == 1
dashboard.write_text(source.replace(needle, "ctx.fillText('SPHERAIL', Inkball.WIDTH / 2, 25);"), encoding='utf-8')
# A colour wall can recolour any queued ball. The offline app must have every
# ball sprite ready before play, even if that colour is absent from the queue.
engine = WEB / 'js/inkball/app.js'
source = engine.read_text(encoding='utf-8')
needle = 'const balls = new Set([0]);'
assert source.count(needle) == 1
engine.write_text(source.replace(needle, 'const balls = new Set(everyColor);'), encoding='utf-8')
# Desktop uses elapsed wall time for its level limit. A hidden or occluded
# WKWebView can stop requestAnimationFrame, so frame delta cannot own the clock.
level_engine = WEB / 'js/inkball/level.js'
source = level_engine.read_text(encoding='utf-8')
needle = '    if (this.levelTimer > 0) {\n      this.levelTimer -= dt;'
assert source.count(needle) == 1
level_engine.write_text(source.replace(needle,
    '    if (this.levelTimer > 0 && !this.app._usesWallClockTimer) {\n      this.levelTimer -= dt;'), encoding='utf-8')
# Keep a departing opponent visible as forfeited while the local board runs on.
match_sync = WEB / 'js/inkball/match-sync.js'
source = match_sync.read_text(encoding='utf-8')
needle = "      if (payload.status === 'forfeited') {\n        this.waitingNode.hidden = false;"
assert source.count(needle) == 1
match_sync.write_text(source.replace(needle,
    "      if (payload.status === 'forfeited') {\n        this.opponentStatus = 'forfeited';\n        this.waitingNode.hidden = false;"), encoding='utf-8')
copy('static/js/ball-collision.js', 'js/ball-collision.js')
copy('static/js/community-editor-state.js', 'js/community-editor-state.js')
copy('static/js/community-editor-history.js', 'js/community-editor-history.js')
# map-preview.js is app-owned and reuses the engine to show every board element.
for name in ('map-home-preview', 'map-home-ambient', 'map-home'):
    copy(f'static/js/{name}.js', f'js/{name}.js')
# Detached or temporarily hidden WebKit views can suspend animation frames.
# The board pixels are already ready at this point, so let the preview reveal
# finish on a timer if the two-frame callback does not run.
preview = WEB / 'js/map-home-preview.js'
source = preview.read_text(encoding='utf-8')
paint_wait = '''  function afterPaint(callback) {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(callback);
    });
  }'''
assert source.count(paint_wait) == 1
source = source.replace(paint_wait, '''  function afterPaint(callback) {
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      callback();
    }
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(finish);
    });
    window.setTimeout(finish, 250);
  }''')
preview.write_text(source, encoding='utf-8')
# The app keeps the carousel inside one document. Update its counter when a
# destination is chosen, including when WebKit throttles frames offscreen.
carousel = WEB / 'js/map-home.js'
source = carousel.read_text(encoding='utf-8')
needle = 'currentIndex = wrap(mapIndexOf(card), count);'
assert source.count(needle) == 1
carousel.write_text(source.replace(needle, needle + '\n      const position = root.querySelector("[data-carousel-position]");\n      if (position) position.textContent = String(currentIndex + 1).padStart(2, "0");'), encoding='utf-8')
source = carousel.read_text(encoding='utf-8')
key_guard = 'if (introSpinning) return;\n      if (event.target && event.target.closest'
assert source.count(key_guard) == 1
carousel.write_text(source.replace(key_guard, 'if (introSpinning || root.hidden) return;\n      if (event.target && event.target.closest'), encoding='utf-8')
source = carousel.read_text(encoding='utf-8')
resize_handler = '''    window.addEventListener("resize", function () {
      measure();
      goToSlot(count < 2 ? currentIndex : count + currentIndex, true);
    });'''
assert source.count(resize_handler) == 1
carousel.write_text(source.replace(resize_handler, '''    function refreshPosition() {
      if (root.hidden) return;
      if (root.dataset.returnMapSlug) {
        currentIndex = indexForSlug(root.dataset.returnMapSlug);
        delete root.dataset.returnMapSlug;
      }
      measure();
      goToSlot(count < 2 ? currentIndex : count + currentIndex, true);
    }

    window.addEventListener("resize", refreshPosition);
    window.addEventListener("inkball:routechange", refreshPosition);'''), encoding='utf-8')
ambient = WEB / 'js/map-home-ambient.js'
source = ambient.read_text(encoding='utf-8')
def replace_ambient(old, new):
    global source
    assert source.count(old) == 1, old
    source = source.replace(old, new)

replace_ambient('''  function start() {
    const root = document.querySelector("[data-map-ambient]");
    if (!root) return;''', '''  function start(root) {
    if (!root) return;''')
# Honor the app's workshop tab before the initial background paint.
replace_ambient('    let specialTab = "community";',
    '    let specialTab = root.getAttribute("data-community-tab") || "community";')
replace_ambient('''    let running = false;
    const reduce = prefersReducedMotion();''', '''    let running = false;
    let ready = false;
    let pendingResultCleared = null;
    let burstGeneration = 0;
    const reduce = prefersReducedMotion();''')
replace_ambient('''    ambientApi.snapshot = snapshot;''', '''    if (mode === "live") ambientApi.snapshot = snapshot;''')
replace_ambient('''    ambientApi.setCommunityTab = setCommunityTab;''', '''    if (community) {
      ambientApi.setCommunityTab = setCommunityTab;
      ambientApi.communityState = function () {
        return { tab: specialTab, sprite: specialImages[specialTab] ? specialImages[specialTab].src : null };
      };
    }

    if (altRows) {
      ambientApi.restartResult = function (cleared) {
        pendingResultCleared = !!cleared;
        canvas.dataset.ambientBurst = pendingResultCleared ? "1" : "0";
        if (!ready) return;
        pause();
        burstGeneration += 1;
        if (pendingResultCleared && !reduce) spawnBurst();
        else spawn();
        ballAlpha = 1;
        draw();
        play();
      };
      ambientApi.resultState = function () {
        return {
          ready: ready,
          burst: pendingResultCleared === true && !reduce,
          count: balls.length,
          running: running,
          balls: balls.map(function (ball) {
            return { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };
          }),
        };
      };
    }''')
replace_ambient('''    function spawnBurst() {
      balls = [];''', '''    function spawnBurst() {
      balls = [];
      const generation = burstGeneration;''')
replace_ambient('''      function emitPair() {
        if (emitted >= total) return;''', '''      function emitPair() {
        if (generation !== burstGeneration || emitted >= total) return;''')
replace_ambient('''    function dismissCover() {
      const cover = document.getElementById("ambient-handoff");''', '''    function dismissCover() {
      if (altRows) return;
      const cover = document.getElementById("ambient-handoff");''')
replace_ambient('''      resize();
      const saved = readState();''', '''      resize();
      ready = true;
      if (altRows && pendingResultCleared !== null) {
        ambientApi.restartResult(pendingResultCleared);
        return;
      }
      const saved = readState();''')
replace_ambient('''      } else if (still) {
        const hasBalls = restore(saved);
        ballAlpha = hasBalls ? 1 : 0;
        draw();
        fadeBalls();
        dismissCover();''', '''      } else if (still) {
        if (canvas.closest(".view")) {
          // These App routes share one document; keep their floor static.
          balls = [];
          ballAlpha = 0;
          draw();
        } else {
          const hasBalls = restore(saved);
          ballAlpha = hasBalls ? 1 : 0;
          draw();
          fadeBalls();
          dismissCover();
        }''')
replace_ambient('''      if (!still) snapshot();''', '''      if (mode === "live") snapshot();''')
replace_ambient('''  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }''', '''  function startAll() {
    document.querySelectorAll("[data-map-ambient]").forEach(start);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startAll);
  } else {
    startAll();
  }''')
play_guard = 'if (still || reduce || running || document.hidden) return;'
assert source.count(play_guard) == 1
source = source.replace(play_guard, 'if (still || reduce || running || document.hidden || canvas.closest(".view")?.hidden) return;')
route_anchor = 'window.addEventListener("pagehide", function () {'
assert source.count(route_anchor) == 1
source = source.replace(route_anchor, 'window.addEventListener("inkball:routechange", function () {\n      if (canvas.closest(".view")?.hidden) pause();\n      else play();\n    });\n    ' + route_anchor)
ambient.write_text(source, encoding='utf-8')
# Runtime board sprites are original App art. Generate every gameplay variant
# from the App's own ceramic material before editor composites are baked.
from generate_gameplay_sprites import generate as generate_gameplay_sprites  # noqa: E402
generate_gameplay_sprites()
sprites = WEB / 'img' / 'inkball'
sprites.mkdir(parents=True, exist_ok=True)
for stale in sprites.glob('*.png'):
    stale.unlink()
for art in (APP / 'Assets' / 'Gameplay').glob('*.png'):
    shutil.copy2(art, sprites / art.name)
# Ambient category marks were made for the Web UI, rather than scaffold art.
for name in ('ambient_community.png', 'ambient_diy.png', 'ambient_favorite.png'):
    shutil.copy2(SOURCE / 'static' / 'img' / 'inkball' / name, sprites / name)
shutil.copytree(SOURCE / 'static/img/ui', WEB / 'img/ui', dirs_exist_ok=True)
copy('static/img/icons/trophy.svg', 'img/icons/trophy.svg')
from prepare_editor_tiles import prepare as prepare_editor_tiles  # noqa: E402
prepare_editor_tiles(WEB)
for language in ('en', 'zh'):
    copy(f'static/i18n/{language}.json', f'i18n/{language}.json')
translations = {
    language: json.loads((WEB / f'i18n/{language}.json').read_text(encoding='utf-8'))
    for language in ('en', 'zh')
}
(WEB / 'i18n-data.js').write_text(
    'window.INKBALL_I18N=' + json.dumps(translations, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8'
)

config = json.loads((SOURCE / 'game_data/config.json').read_text(encoding='utf-8'))
from extra_official_maps import build_maps
extra_maps = build_maps()
extra_slugs = {entry['id'] for entry in extra_maps}
maps = []
achievement_catalogue = {}
for entry in config['maps']:
    # These layouts also ship in Web now; keep the App's authored source once.
    if entry['slug'] in extra_slugs:
        continue
    base = to_pair_layout((SOURCE / 'game_data' / entry['layout']).read_text(encoding='utf-8'))
    levels = {}
    achievement_catalogue[entry['slug']] = {}
    for difficulty, variant in entry['difficulties'].items():
        level = dict(variant)
        achievement_catalogue[entry['slug']][difficulty] = variant.get('achievements', [])
        level['layout'] = f"{entry['slug']}_{difficulty}.txt"
        level['layout_content'] = (
            to_pair_layout((SOURCE / 'game_data' / variant['layout']).read_text(encoding='utf-8'))
            if variant.get('layout') else filter_layout(base, difficulty, variant.get('max_preplaced'))
        )
        levels[difficulty] = level
    maps.append({
        'id': entry['slug'], 'name': entry['name'], 'official': True,
        'author': 'Spherail', 'difficulties': levels,
    })
maps.extend(extra_maps)
for entry in extra_maps:
    achievement_catalogue[entry['id']] = {key: level['achievements'] for key, level in entry['difficulties'].items()}
    for language in ('en', 'zh'):
        translations[language]['map.name.' + entry['id']] = entry['name_en'] if language == 'en' else entry['name']
for language, catalogue in translations.items():
    (WEB / f'i18n/{language}.json').write_text(json.dumps(catalogue, ensure_ascii=False), encoding='utf-8')
(WEB / 'i18n-data.js').write_text('window.INKBALL_I18N=' + json.dumps(translations, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
bundle = {
    'version': 1, 'maps': maps,
    'score_increase_from_hole_capture': config['score_increase_from_hole_capture'],
    'score_decrease_from_wrong_hole': config['score_decrease_from_wrong_hole'],
}
(WEB / 'official-data.js').write_text(
    'window.INKBALL_OFFICIAL=' + json.dumps(bundle, ensure_ascii=False, indent=2) + ';\n',
    encoding='utf-8',
)
(WEB / 'official-achievements.json').write_text(
    json.dumps(achievement_catalogue, ensure_ascii=False, indent=2) + '\n',
    encoding='utf-8',
)
from prepare_key_walls import prepare as prepare_key_walls
prepare_key_walls(WEB)
print(f'Prepared {len(maps)} official maps in {WEB}')
