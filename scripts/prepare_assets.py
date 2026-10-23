#!/usr/bin/env python3
"""Generate App resources using only sources inside this repository.

Web contains the maintained desktop engine, translations and UI artwork.
Assets contains map definitions and the material used to generate board sprites.
"""
import json
import shutil
from pathlib import Path

from extra_official_maps import build_maps
from layouts import filter_layout, to_pair_layout
from generate_gameplay_sprites import generate as generate_gameplay_sprites
from prepare_editor_tiles import prepare as prepare_editor_tiles

APP = Path(__file__).resolve().parents[1]
WEB = APP / 'Web'
LEVELS = APP / 'Assets' / 'Levels'

generate_gameplay_sprites()
sprites = WEB / 'img' / 'inkball'
sprites.mkdir(parents=True, exist_ok=True)
for art in (APP / 'Assets' / 'Gameplay').glob('*.png'):
    shutil.copy2(art, sprites / art.name)
prepare_editor_tiles(WEB)
translations = {
    language: json.loads((WEB / f'i18n/{language}.json').read_text(encoding='utf-8'))
    for language in ('en', 'zh')
}

config = json.loads((LEVELS / 'config.json').read_text(encoding='utf-8'))
extra_maps = build_maps()
maps = []
achievement_catalogue = {}
for entry in config['maps']:
    base = to_pair_layout((LEVELS / entry['layout']).read_text(encoding='utf-8'))
    levels = {}
    achievement_catalogue[entry['slug']] = {}
    for difficulty, variant in entry['difficulties'].items():
        level = dict(variant)
        achievement_catalogue[entry['slug']][difficulty] = variant.get('achievements', [])
        level['layout'] = f"{entry['slug']}_{difficulty}.txt"
        level['layout_content'] = (
            to_pair_layout((LEVELS / variant['layout']).read_text(encoding='utf-8'))
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
print(f'Prepared {len(maps)} official maps in {WEB}')
