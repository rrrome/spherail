const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
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

test('every one-way sprite uses the same artwork as the Mac resource handler', () => {
  for (const direction of 'udlr') for (let color = 0; color < 5; color++) {
    const name = `one_way_${direction}${color}.png`;
    const resource = resolveResource(root, `spherail://app/img/inkball/${name}?v=1`);
    assert.equal(resource.mime, 'image/png');
    assert.deepEqual(fs.readFileSync(resource.file), fs.readFileSync(path.join(root, 'img/inkball/mac', name)));
    assert.notDeepEqual(fs.readFileSync(resource.file), fs.readFileSync(path.join(root, 'img/inkball', name)));
  }
  assert.equal(resolveResource(root, 'spherail://app/img/inkball/wall1.png').file, path.join(root, 'img/inkball/wall1.png'));
});
