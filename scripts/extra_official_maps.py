"""Compile the fifteen user-authored layouts without difficulty filtering."""
import json
import re
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / 'Assets/Levels/New_Level.md'
THEMES = [
    ('spectrum-gates', '色阶闸阵', 'Spectrum Gates', ['循色而行','连闸贯通','破壁穿关'], ['Follow the Spectrum','Through the Gates','Breakthrough']),
    ('chromatic-locks', '四色锁廊', 'Chromatic Locks', ['初解四色','锁廊畅行','双锁皆开'], ['Four Keys','Open Passage','Double Unlock']),
    ('shifting-hours', '时隙交织', 'Shifting Hours', ['静候时机','错峰穿行','时隙穿梭'], ['Wait for the Moment','Crossing in Time','Between the Hours']),
    ('oneway-labyrinth', '单行迷宫', 'One-Way Labyrinth', ['找到出口','逆路寻踪','单行领航'], ['Way Out','Trace the Route','Master Navigator']),
    ('cascade-junction', '分流急湾', 'Cascade Junction', ['顺流入湾','分流有序','急湾领航'], ['Into the Bay','Order in the Rapids','Cascade Pilot']),
]
# Time targets leave room for all spawns, delayed walls and the final approach.
SPEED_TARGETS = [(90,180,180),(55,105,105),(90,90,170),(90,105,180),(55,105,145)]
BADGES = [
    ('闸阵疾行','Swift Passage','落笔有方','Measured Strokes',60),
    ('锁廊快手','Quick Unlock','开锁有方','Key Technique',48),
    ('抢占时隙','Seize the Moment','丝毫不差','Perfect Timing',None),
    ('捷径领航','Shortcut Navigator','惜墨如金','Every Stroke Counts',48),
    ('急流快递','Rapid Delivery','分色无误','Perfect Sorting',None),
]

def read_levels(path=SOURCE):
    text = Path(path).read_text(encoding='utf-8')
    result = {}; map_number = None; difficulty = None
    pattern = re.compile(r'^#+\s*(Map[1-5]|Easy|Hard|Master)\s*$|^INKBALL-LEVEL/1\s*$', re.M)
    for match in pattern.finditer(text):
        heading = match.group(1)
        if heading and heading.startswith('Map'):
            map_number = int(heading[-1]); difficulty = None
        elif heading:
            difficulty = {'Easy':'easy','Hard':'hard','Master':'master'}[heading]
        else:
            assert map_number and difficulty, 'Map code needs a map and difficulty heading'
            payload, _ = json.JSONDecoder().raw_decode(text[match.end():].lstrip())
            assert payload['format'] == 'inkball-map' and payload['version'] == 2
            key = (map_number, difficulty)
            assert key not in result, f'Duplicate map/difficulty: {key}'
            rows = payload['layout'].split('\n')
            assert len(rows) == 18 and all(len(row) == 36 for row in rows), key
            result[key] = payload
    assert len(result) == 15, 'Expected five maps with all three difficulties'
    return result

def build_maps():
    source = read_levels(); maps = []
    for index, (slug, zh, en, titles, english_titles) in enumerate(THEMES):
        levels = {}
        badge = BADGES[index]
        for tier, difficulty in enumerate(('easy','hard','master')):
            original = source[index+1, difficulty]
            achievements = [dict(code=f'{slug}-{difficulty}-clear', name=english_titles[tier], name_zh=titles[tier], criterion='clear', display_order=1)]
            if tier >= 1:
                achievements.append(dict(code=f'{slug}-{difficulty}-swift', name=badge[1], name_zh=badge[0], criterion='max_duration_seconds', target=SPEED_TARGETS[index][tier], display_order=2))
            if tier >= 2:
                condition = dict(criterion='no_wrong_captures') if badge[4] is None else dict(criterion='max_lines_drawn', target=badge[4])
                achievements.append(dict(code=f'{slug}-{difficulty}-precision', name=badge[3], name_zh=badge[2], display_order=3, **condition))
            levels[difficulty] = dict(layout=f'{slug}_{difficulty}.txt', layout_content=original['layout'],
                time=original['total_time'], spawn_interval=original['serve_interval'], balls=original['balls'],
                author_history=original['author_history'], score_increase_from_hole_capture_modifier=1,
                score_decrease_from_wrong_hole_modifier=1, achievements=achievements)
        maps.append(dict(id=slug,name=zh,name_en=en,official=True,author=source[index+1,'easy']['author_history'][-1],difficulties=levels))
    return maps
