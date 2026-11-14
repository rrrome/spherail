#!/usr/bin/env python3
"""Check the complete App board set and guard against scaffold art returning."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops
from generate_gameplay_sprites import COLORS, accelerator_chevrons, mix


APP = Path(__file__).resolve().parents[1]
RUNTIME = APP / 'Web' / 'img' / 'inkball'
OWNED = APP / 'Assets' / 'Gameplay'
REFERENCE_HASHES = json.loads((APP / 'Assets/GameplaySource/reference-hashes.json').read_text())


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

        assert digest(runtime) not in REFERENCE_HASHES.get(name, []), f'{name} matches reference art'

    for name in ('ambient_community.png', 'ambient_diy.png', 'ambient_favorite.png'):
        assert (RUNTIME / name).exists(), f'Missing {name}'
    assert {p.name for p in RUNTIME.glob('*.png')} == set(sizes) | {
        'ambient_community.png', 'ambient_diy.png', 'ambient_favorite.png'
    }, 'Unexpected board art packaged'

    mac_names = {f'one_way_{direction}{index}.png' for direction in 'udlr' for index in range(5)}
    mac_owned = APP / 'Assets' / 'GameplayMac'
    mac_runtime = RUNTIME / 'mac'
    assert {p.name for p in mac_owned.glob('*.png')} == mac_names, 'Incomplete Mac one-way art'
    assert {p.name for p in mac_runtime.glob('*.png')} == mac_names, 'Unexpected Mac one-way art'
    for index, color in enumerate(COLORS):
        face = mix(color, (227, 231, 225), 0.62)
        ink = mix(color, (16, 54, 65), 0.49)
        contrast = [a-b for a, b in zip(face, ink)]
        norm = sum(value*value for value in contrast)
        for direction in 'udlr':
            name = f'one_way_{direction}{index}.png'
            path = mac_runtime / name
            assert digest(path) == digest(mac_owned / name), f'{name}: Mac packaging mismatch'
            with Image.open(path) as image, Image.open(RUNTIME / name) as shared:
                assert image.size == (32, 32), f'{name}: changed cell dimensions'
                image, shared = image.convert('RGB'), shared.convert('RGB')
                bounds = ImageChops.difference(image, shared).getbbox()
                assert bounds and min(bounds[:2]) >= 6 and max(bounds[2:]) <= 27, f'{name}: frame or rails changed'
                for x, y in ((11, 9), (21, 9)):
                    point = {'u': (x, y), 'd': (32-x, 32-y), 'l': (y, 32-x), 'r': (32-y, x)}[direction]
                    assert max(abs(a-b) for a, b in zip(image.getpixel(point), ink)) < 20, f'{name}: front bar missing'
                # Include antialiased edges when measuring the visible ink's
                # centre of mass, rather than counting only fully dark pixels.
                weights = []
                for y in range(7, 26):
                    for x in range(7, 26):
                        amount = sum((a-b)*c for a, b, c in zip(face, image.getpixel((x, y)), contrast)) / norm
                        weights.append((x, y, max(0, min(1, amount))))
                mass = sum(weight for x, y, weight in weights)
                assert mass > 80, f'{name}: arrow missing'
                for axis in (0, 1):
                    centre = sum(point[axis]*point[2] for point in weights) / mass
                    assert abs(centre-15.5) < 0.6, f'{name}: off-centre mark ({centre})'
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
    print(f'Verified {len(sizes)} shared gameplay sprites, {len(mac_names)} Mac one-way sprites and 3 App UI ambient marks.')


if __name__ == '__main__':
    verify()
