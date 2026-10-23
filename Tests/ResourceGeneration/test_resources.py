"""Exercise resource generation from an isolated checkout with only Pillow."""
import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]


def resource_hashes(root):
    return {
        str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
        for folder in ('Web', 'Assets')
        for path in (root / folder).rglob('*')
        if path.is_file()
    }


class StandaloneResourcesTests(unittest.TestCase):
    def test_isolated_regeneration_preserves_resources_and_is_repeatable(self):
        with tempfile.TemporaryDirectory(prefix='spherail-resources-') as directory:
            checkout = Path(directory) / 'Spherail'
            checkout.mkdir()
            for folder in ('Web', 'Assets', 'scripts'):
                shutil.copytree(ROOT / folder, checkout / folder,
                                ignore=shutil.ignore_patterns('__pycache__'))
            expected = resource_hashes(checkout)

            def run(script):
                subprocess.run([sys.executable, str(checkout / 'scripts' / script)],
                               cwd=checkout, check=True)

            run('prepare_assets.py')
            run('verify_gameplay_sprites.py')
            run('build_icon.py')
            self.assertEqual(expected, resource_hashes(checkout),
                             'Regeneration changed the shipped maps, translations or art')
            run('prepare_assets.py')
            self.assertEqual(expected, resource_hashes(checkout),
                             'Resource generation must be repeatable')


if __name__ == '__main__':
    unittest.main()
