#!/usr/bin/env python3
"""Check the complete App board set and guard against scaffold art returning."""
from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image, ImageChops
from generate_gameplay_sprites import accelerator_chevrons


APP = Path(__file__).resolve().parents[1]
RUNTIME = APP / 'Web' / 'img' / 'inkball'
OWNED = APP / 'Assets' / 'Gameplay'
REFERENCE = APP.parent / 'ELEC3609Code' / 'references'


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify() -> None:
    sizes = {'tile.png': (32, 32), 'entrypoint.png': (32, 32)}
    for direction in 'udlr':
        sizes[f'accelerator_{direction}.png'] = (32, 32)
    for index in range(5):
        sizes[f'wall{index}.png'] = (32, 32)
        sizes[f'key_wall{index}.png'] = (32, 32)
        sizes[f'hole{index}.png'] = (64, 64)
        sizes[f'ball{index}.png'] = (128, 128)
        sizes[f'brick{index}.png'] = (128, 128)
        for stage in (1, 2):
            sizes[f'brick{index}_{stage}.png'] = (128, 128)
        for direction in 'udlr':
            sizes[f'one_way_{direction}{index}.png'] = (32, 32)

    assert {p.name for p in OWNED.glob('*.png')} == set(sizes), 'Incomplete owned sprite set'
    assert not (RUNTIME / 'inkball_spritesheet.png').exists(), 'Scaffold sheet still packaged'
    for name, expected in sizes.items():
        owned, runtime = OWNED / name, RUNTIME / name
        with Image.open(runtime) as image:
            image.verify()
        with Image.open(runtime) as image:
            assert image.size == expected, (name, image.size, expected)
        assert digest(owned) == digest(runtime), f'{name} is not App-owned art'

        sources = (
            REFERENCE / 'inkball_scaffold_final' / 'src' / 'main' / 'resources' / 'inkball' / name,
            REFERENCE / 'inkball-sprites-original' / name,
        )
        for source in sources:
            if source.exists():
                assert digest(runtime) != digest(source), f'{name} matches source art'

    for name in ('ambient_community.png', 'ambient_diy.png', 'ambient_favorite.png'):
        assert (RUNTIME / name).exists(), f'Missing {name}'
    assert {p.name for p in RUNTIME.glob('*.png')} == set(sizes) | {
        'ambient_community.png', 'ambient_diy.png', 'ambient_favorite.png'
    }, 'Unexpected board art packaged'
    for index in range(5):
        key = RUNTIME / f'key_wall{index}.png'
        assert digest(key) == digest(APP / 'Web' / 'img' / 'editor' / f'Y{index}.png'), 'Editor key wall differs from game'
        assert digest(key) != digest(RUNTIME / f'wall{index}.png'), 'Key wall looks like a colour wall'
        with Image.open(key) as image, Image.open(RUNTIME / f'wall{index}.png') as wall:
            image = image.convert('RGBA')
            wall = wall.convert('RGBA')
            for point in ((11, 11), (16, 21), (21, 11)):
                assert max(image.getpixel(point)[:3]) < 90, 'Dark V mark missing'
            assert image.getpixel((16, 10)) == wall.getpixel((16, 10)), 'Unexpected latch plate'
            bounds = ImageChops.difference(image.convert('RGB'), wall.convert('RGB')).getbbox()
            assert bounds and bounds[0] >= 6 and bounds[1] >= 5 and bounds[2] <= 27 and bounds[3] <= 27, 'Colour wall changed outside the V'
            assert ImageChops.difference(image.getchannel('A'), wall.getchannel('A')).getbbox() is None, 'Colour wall opacity changed'
    centres = []
    for index in range(1, 5):
        with Image.open(RUNTIME / f'ball{index}.png') as image:
            rgb = image.convert('RGB').getpixel((64, 64))
        saturation = (max(rgb) - min(rgb)) / max(rgb)
        assert saturation >= 0.42, f'ball{index} is too desaturated: {rgb}'
        centres.append(rgb)
    for first in range(len(centres)):
        for second in range(first + 1, len(centres)):
            separation = sum((a-b)**2 for a, b in zip(centres[first], centres[second]))**0.5
            assert separation >= 65, f'balls {first+1} and {second+1} are hard to distinguish'

    for index in range(5):
        with Image.open(RUNTIME / f'ball{index}.png') as image:
            assert image.convert('RGBA').getpixel((64, 30))[3] == 255, f'ball{index} has a transparent highlight'
        with Image.open(RUNTIME / f'hole{index}.png') as image:
            assert image.convert('RGBA').getpixel((32, 26))[3] == 255, f'hole{index} has a transparent centre'
        with Image.open(RUNTIME / f'brick{index}.png') as image:
            brick = image.convert('RGBA')
            seam = brick.getpixel((40, 48))
            face = brick.getpixel((60, 48))
            assert sum(face[:3]) - sum(seam[:3]) > 120, f'brick{index} has no distinct crack'

    for direction in 'udlr':
        points = [point for path in accelerator_chevrons(direction) for point in path]
        xs, ys = zip(*points)
        assert abs((min(xs) + max(xs)) / 2 - 16) < 0.01, direction
        assert abs((min(ys) + max(ys)) / 2 - 16) < 0.01, direction
    print(f'Verified {len(sizes)} original gameplay sprites and 3 App UI ambient marks.')


if __name__ == '__main__':
    verify()
