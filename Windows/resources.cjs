'use strict';
const fs = require('node:fs');
const path = require('node:path');
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
function resolveResource(root, rawURL) {
  const url = new URL(rawURL);
  if (url.protocol !== 'spherail:' || url.hostname !== 'app' || url.username || url.password || url.port) throw new Error('Invalid resource origin.');
  const requested = decodeURIComponent(url.pathname);
  if (requested.includes('\\') || requested.includes('\0')) throw new Error('Invalid resource path.');
  const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Resource is outside the app.');
  const realRoot = fs.realpathSync(root), realFile = fs.realpathSync(file);
  const realRelative = path.relative(realRoot, realFile);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error('Resource is outside the app.');
  return { file, mime: mimeTypes[path.extname(file).toLowerCase()] ?? 'application/octet-stream' };
}
module.exports = { resolveResource };
