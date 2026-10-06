"""Bake the web editor's composite cells into reusable local PNG sprites."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


COLORS = ('#9aa0a6', '#f4a261', '#4ea1f3', '#6fcf97', '#f2c94c')


def prepare(web: Path) -> None:
    source = web / 'img' / 'inkball'
    target = web / 'img' / 'editor'
    target.mkdir(parents=True, exist_ok=True)
    floor = Image.open(source / 'tile.png').convert('RGBA')
    walls = [Image.open(source / f'wall{i}.png').convert('RGBA') for i in range(5)]
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 12)
        count_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 13)
    except OSError:
        font = ImageFont.load_default()
        count_font = font

    for index, color in enumerate(COLORS):
        gate = floor.copy()
        layer = Image.new('RGBA', gate.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        draw.rectangle((3, 3, 29, 29), fill=(*bytes.fromhex(color[1:]), 64))
        draw.rectangle((3, 3, 29, 29), outline=color, width=3)
        gate.alpha_composite(layer)
        gate.save(target / f'C{index}.png')

        key = Image.open(source / f'key_wall{index}.png').convert('RGBA')
        key.save(target / f'Y{index}.png')

        for token in ('V', 'G'):
            tile = floor.copy()
            draw = ImageDraw.Draw(tile)
            draw.ellipse((6, 6, 26, 26), fill=color)
            draw.text((16, 16), token, font=font, fill='#111111', anchor='mm')
            tile.save(target / f'{token}{index}.png')

    for seconds in range(100):
        timed = walls[0].copy()
        ImageDraw.Draw(timed).text((16, 16), str(seconds), font=count_font,
                                    fill='white', stroke_width=2,
                                    stroke_fill='#10141c', anchor='mm')
        timed.save(target / f'T{seconds:02d}.png')
