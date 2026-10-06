#!/usr/bin/env python3
"""Create Spherail's original board art from an original ceramic texture.

The image generator supplied only the neutral material swatch. All silhouettes,
colours, lighting, symbols, and damaged states below are drawn by this script.
No scaffold pixel data is used.
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
TEXTURE = ROOT / 'Assets' / 'GameplaySource' / 'ceramic.png'
OUTPUT = ROOT / 'Assets' / 'Gameplay'
S = 4
COLORS = (
    (157, 177, 194),  # pearl
    (250, 121, 52),   # amber
    (43, 138, 231),   # azure
    (50, 184, 117),   # jade
    (247, 219, 30),   # gold
)


def mix(a, b, t):
    return tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))


def rgba(c, alpha=255):
    return (*c, alpha)


def box(draw, xy, **kwargs):
    draw.rectangle(tuple(round(v * S) for v in xy), **kwargs)


def roundbox(draw, xy, radius, **kwargs):
    draw.rounded_rectangle(tuple(round(v * S) for v in xy), radius=radius*S, **kwargs)


def ellipse(draw, xy, **kwargs):
    draw.ellipse(tuple(round(v*S) for v in xy), **kwargs)


def polygon(draw, points, **kwargs):
    draw.polygon([(round(x*S), round(y*S)) for x, y in points], **kwargs)


def line(draw, points, **kwargs):
    draw.line([(round(x*S), round(y*S)) for x, y in points], **kwargs)


def finish(image, size=32):
    return image.resize((size, size), Image.Resampling.LANCZOS)


def ceramic(texture):
    # One repeated cell. Keep the material faint so level objects read at 32px.
    grain = texture.resize((32*S, 32*S), Image.Resampling.LANCZOS).convert('RGB')
    base = Image.new('RGB', grain.size, (212, 219, 231))
    base = Image.blend(base, grain, 0.19).convert('RGBA')
    shine = Image.new('RGBA', base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(shine)
    box(d, (0, 0, 31, 31), outline=(137, 157, 177, 210), width=S)
    line(d, [(1, 1), (30, 1), (30, 2)], fill=(252, 252, 247, 170), width=S)
    line(d, [(1, 1), (1, 30)], fill=(252, 252, 247, 160), width=S)
    line(d, [(1, 30), (30, 30), (30, 2)], fill=(122, 145, 167, 100), width=S)
    base.alpha_composite(shine)
    return base


def wall(floor, color):
    im = floor.copy()
    d = ImageDraw.Draw(im)
    dark = mix(color, (20, 48, 62), 0.48)
    light = mix(color, (255, 249, 223), 0.52)
    roundbox(d, (1.5, 1.5, 30.5, 30.5), 3, fill=rgba(dark), outline=(38, 82, 94, 255), width=S)
    roundbox(d, (3, 3, 28.5, 28.5), 2.5, fill=rgba(mix(color, (220, 232, 238), 0.42)), outline=rgba(light), width=S)
    roundbox(d, (5, 5, 26.5, 26.5), 1.7, fill=rgba(mix(color, (239, 241, 231), 0.32)))
    line(d, [(6, 6), (25, 6)], fill=(255, 255, 246, 145), width=S)
    line(d, [(26, 7), (26, 25), (7, 26)], fill=rgba(dark, 100), width=S)
    return im


def key_wall(floor, color):
    # Keep the colour wall intact; a dark V identifies a closed switch wall.
    im = wall(floor, color)
    d = ImageDraw.Draw(im)
    line(d, [(10, 9), (16, 22), (22, 9)], fill=(23, 53, 60, 255), width=2*S, joint='curve')
    return im


def entrypoint(floor):
    im = floor.copy()
    d = ImageDraw.Draw(im)
    # An octagonal emitter, distinct from the original four-dot source image.
    polygon(d, [(12, 4), (20, 4), (28, 12), (28, 20), (20, 28),
                (12, 28), (4, 20), (4, 12)], fill=(38, 94, 105), outline=None)
    polygon(d, [(12, 6), (20, 6), (26, 12), (26, 20), (20, 26),
                (12, 26), (6, 20), (6, 12)], fill=(231, 195, 134))
    ellipse(d, (10, 10, 22, 22), fill=(20, 56, 66), outline=(255, 244, 210), width=S)
    polygon(d, [(16, 9), (20, 16), (16, 14), (12, 16)], fill=(255, 177, 112))
    return im


def hole(floor, color):
    im = Image.new('RGBA', (64*S, 64*S))
    for y in (0, 1):
        for x in (0, 1):
            im.paste(floor, (x*32*S, y*32*S))
    d = ImageDraw.Draw(im)
    dark = mix(color, (12, 43, 54), 0.6)
    light = mix(color, (255, 242, 202), 0.44)
    polygon(d, [(19, 4), (45, 4), (60, 19), (60, 45), (45, 60),
                (19, 60), (4, 45), (4, 19)], fill=rgba(dark), outline=None)
    polygon(d, [(20, 7), (44, 7), (57, 20), (57, 44), (44, 57),
                (20, 57), (7, 44), (7, 20)], fill=rgba(mix(color, (215, 225, 224), 0.53)))
    ellipse(d, (12, 12, 52, 52), fill=rgba(light), outline=rgba((249, 244, 217)), width=2*S)
    ellipse(d, (17, 17, 47, 47), fill=(19, 59, 69), outline=rgba(dark), width=3*S)
    ellipse(d, (21, 21, 43, 43), fill=(5, 19, 29), outline=(95, 130, 132), width=S)
    for x, y in ((17, 12), (47, 12), (52, 47), (12, 47)):
        ellipse(d, (x-1, y-1, x+1, y+1), fill=(35, 79, 85))
    reflection = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ellipse(ImageDraw.Draw(reflection), (24, 23, 36, 29), fill=(76, 113, 116, 105))
    im.alpha_composite(reflection)
    return im


def ball(color):
    size = 128
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    pixels = im.load()
    # Keep the neutral ball pearly; coloured balls retain their hue through
    # both the lit and shaded parts after the game shrinks them to 20px.
    neutral = color == COLORS[0]
    hi = mix(color, (255, 250, 226), 0.72 if neutral else 0.10)
    deep = mix(color, (7, 36, 56), 0.7 if neutral else 0.48)
    for y in range(size):
        for x in range(size):
            dx = (x-63.5)/57
            dy = (y-63.5)/57
            dist = math.hypot(dx, dy)
            if dist > 1.05:
                continue
            alpha = round(255*max(0, min(1, (1.05-dist)*12)))
            light = max(0, 1 - math.hypot(dx+0.34, dy+0.43)/1.4)
            shade = max(0, min(1, 0.45 + light*0.68 - dist*0.24 + dy*-0.09))
            c = mix(deep, hi, shade)
            if 0.88 < dist < 1.0:
                c = mix(c, deep, 0.7)
            pixels[x, y] = rgba(c, alpha)
    reflection = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(reflection)
    d.ellipse((34, 21, 76, 49), fill=(255, 255, 242, 50 if neutral else 30))
    d.arc((9, 9, 117, 117), 203, 314,
          fill=rgba(mix(color, (255, 248, 213), 0.55), 200), width=5)
    im.alpha_composite(reflection)
    return im


def brick(color, stage):
    # Damage stages share a newly drawn, beveled enamel block silhouette.
    im = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    shadow = mix(color, (17, 49, 60), 0.57)
    mid = mix(color, (222, 227, 217), 0.13)
    lit = mix(color, (255, 243, 210), 0.44)
    roundbox(d, (0.5, 0.5, 31.5, 31.5), 2.6, fill=rgba(shadow))
    roundbox(d, (2, 2, 29, 29), 1.8, fill=rgba(mid), outline=rgba(lit), width=S)
    roundbox(d, (5, 5, 26, 25.5), 1.1, fill=rgba(mix(mid, lit, 0.21)))
    line(d, [(5, 5), (26, 5)], fill=(255, 255, 234, 125), width=S)
    # Even the untouched brick has one dark fracture, so it cannot be mistaken
    # for a colour wall; later damage adds branches and widens the seam.
    cracks = [
        [(10, 1), (13, 7), (10, 12), (17, 17), (14, 23), (21, 31)],
        [(29, 11), (23, 14), (17, 17)],
        [(3, 23), (9, 20), (14, 23)],
    ]
    crack_highlight = Image.new('RGBA', im.size, (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(crack_highlight)
    for path in cracks[:stage + 1]:
        line(d, path, fill=rgba(mix(shadow, (8, 29, 37), 0.62)),
             width=round((1.5 if stage == 0 else 1.8 + stage * 0.2)*S), joint='curve')
        offset = [(x+0.8, y+0.6) for x, y in path]
        line(highlight_draw, offset, fill=rgba(lit, 205), width=S//2, joint='curve')
    im.alpha_composite(crack_highlight)
    if stage == 2:
        polygon(d, [(0, 0), (8, 0), (4, 4), (0, 7)], fill=(0, 0, 0, 0))
        polygon(d, [(32, 22), (32, 32), (24, 32), (29, 27)], fill=(0, 0, 0, 0))
    return im


def one_way(floor, color, direction):
    im = floor.copy()
    d = ImageDraw.Draw(im)
    rim = mix(color, (16, 54, 65), 0.49)
    roundbox(d, (2, 2, 30, 30), 4, fill=rgba(mix(color, (227, 231, 225), 0.62)),
             outline=rgba(rim), width=S)
    # Symmetric gate rails; arrow rotation is the only direction-specific art.
    box(d, (3, 3, 29, 6), fill=rgba(color))
    box(d, (3, 26, 29, 29), fill=rgba(color))
    arrow = [(16, 8), (23, 17), (19, 17), (19, 24), (13, 24), (13, 17), (9, 17)]
    theta = {'u': 0, 'r': 90, 'd': 180, 'l': 270}[direction]
    rad = math.radians(theta)
    rotated = [(16+(x-16)*math.cos(rad)-(y-16)*math.sin(rad),
                16+(x-16)*math.sin(rad)+(y-16)*math.cos(rad)) for x, y in arrow]
    polygon(d, rotated, fill=rgba(rim))
    return im


def accelerator_chevrons(direction):
    """Two equal chevrons whose combined bounds are centred at (16, 16)."""
    theta = math.radians({'u': 0, 'r': 90, 'd': 180, 'l': 270}[direction])
    paths = []
    for tip_y in (8.5, 16.5):
        arrow = [(8, tip_y+7), (16, tip_y), (24, tip_y+7)]
        paths.append([(16+(x-16)*math.cos(theta)-(y-16)*math.sin(theta),
                       16+(x-16)*math.sin(theta)+(y-16)*math.cos(theta)) for x, y in arrow])
    return paths


def accelerator(floor, direction):
    im = floor.copy()
    d = ImageDraw.Draw(im)
    roundbox(d, (3, 3, 29, 29), 3, fill=(105, 154, 164, 76),
             outline=(57, 108, 118, 190), width=S)
    for points in accelerator_chevrons(direction):
        line(d, points, fill=(28, 101, 117), width=3*S, joint='curve')
        line(d, points, fill=(241, 242, 215), width=S, joint='curve')
    return im


def generate():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    texture = Image.open(TEXTURE)
    floor = ceramic(texture)
    finish(floor).save(OUTPUT / 'tile.png')
    finish(entrypoint(floor)).save(OUTPUT / 'entrypoint.png')
    for index, color in enumerate(COLORS):
        finish(wall(floor, color)).save(OUTPUT / f'wall{index}.png')
        finish(key_wall(floor, color)).save(OUTPUT / f'key_wall{index}.png')
        finish(hole(floor, color), 64).save(OUTPUT / f'hole{index}.png')
        ball(color).save(OUTPUT / f'ball{index}.png')
        for stage in range(3):
            suffix = f'_{stage}' if stage else ''
            brick(color, stage).save(OUTPUT / f'brick{index}{suffix}.png')
        for direction in 'udlr':
            finish(one_way(floor, color, direction)).save(OUTPUT / f'one_way_{direction}{index}.png')
    for direction in 'udlr':
        finish(accelerator(floor, direction)).save(OUTPUT / f'accelerator_{direction}.png')


if __name__ == '__main__':
    generate()
