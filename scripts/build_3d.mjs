// Bundle the original renderer for WKWebView file URLs, with no runtime CDN.
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
await build({
  absWorkingDir: root,
  entryPoints: ['Web/js/inkball/prototype-3d.js'],
  outfile: 'Web/js/inkball/prototype-3d.bundle.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'safari16',
  minify: true,
  legalComments: 'inline',
  sourcemap: false,
});
await mkdir(new URL('../Web/vendor/three/', import.meta.url), { recursive: true });
await copyFile(new URL('../node_modules/three/LICENSE', import.meta.url),
  new URL('../Web/vendor/three/LICENSE', import.meta.url));
