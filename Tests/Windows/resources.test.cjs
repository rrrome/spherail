const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveResource } = require('../../Windows/resources.cjs');
const root = path.join(__dirname, '../../Web');
test('local resource origin serves HTML, JavaScript and WebGL images', () => {
  assert.equal(resolveResource(root, 'spherail://app/index.html').mime, 'text/html; charset=utf-8');
  assert.equal(resolveResource(root, 'spherail://app/js/desktop-3d.js').mime, 'text/javascript; charset=utf-8');
  assert.match(resolveResource(root, 'spherail://app/img/ui/avatar-default.svg').mime, /svg/);
});
test('local resource handler rejects other origins and encoded Windows path escapes', () => {
  for (const url of ['https://app/index.html', 'spherail://other/index.html', 'spherail://user@app/index.html',
    'spherail://app/%2e%2e%5cpackage.json', 'spherail://app/%2e%2e%2fpackage.json', 'spherail://app/%00']) {
    assert.throws(() => resolveResource(root, url), url);
  }
});
