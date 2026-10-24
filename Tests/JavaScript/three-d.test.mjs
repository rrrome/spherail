import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');

test('WKWebView frame clock falls back, fires once and cancels parked frames', () => {
  let index = 0;
  const frames = new Map(), timers = new Map();
  const fake = {
    requestAnimationFrame: callback => { frames.set(++index, callback); return index; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: callback => { timers.set(++index, callback); return index; },
    clearTimeout: id => timers.delete(id), performance: { now: () => 123 },
  };
  const world = { window: {}, Map };
  vm.createContext(world);
  vm.runInContext(read('Web/js/frame-clock.js'), world);
  const clock = world.window.InkballFrameClock.create(fake);
  const calls = [];
  clock.requestAnimationFrame(now => calls.push(now));
  const staleFrame = [...frames.values()][0];
  [...timers.values()][0]();
  staleFrame(456);
  assert.deepEqual(calls, [123]);
  assert.equal(frames.size + timers.size, 0);
  const cancelled = clock.requestAnimationFrame(() => assert.fail('Cancelled frame ran'));
  clock.cancelAnimationFrame(cancelled);
  assert.equal(frames.size + timers.size, 0);
});

test('reference geometry, materials, camera parameters and preview loop are unchanged', () => {
  const source = read('Web/js/inkball/prototype-3d.js');
  const rendering = source.slice(0, source.indexOf('async function main()'))
    .replace(/loadRuntimeTexture\('[^']+'/g, "loadRuntimeTexture('<asset>'");
  const reference = JSON.parse(read('Tests/Fixtures/3d-reference.json'));
  assert.equal(createHash('sha256').update(rendering).digest('hex'), reference.rendering_source_sha256);
  assert.equal(JSON.parse(read('package.json')).devDependencies.three, reference.three_version);
  for (const [asset, digest] of Object.entries(reference.runtime_assets)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL(asset, root))).digest('hex'), digest, asset);
  }
  for (const match of source.matchAll(/loadRuntimeTexture\('([^']+)'/g)) {
    assert.ok(fs.existsSync(new URL('Web/' + match[1], root)), match[1]);
    assert.ok(!match[1].startsWith('/'), 'Textures must resolve inside the app');
  }
  assert.ok(!source.includes('await fetch('), 'Previews must use local map payloads');
});

function previewHarness() {
  const handlers = new Map(), messages = [], timers = new Map();
  const classes = new Set();
  const win = {
    location: { origin: 'null' }, document: null,
    matchMedia: () => ({ matches: false }),
    addEventListener: (type, callback) => handlers.set(type, callback),
    removeEventListener: (type, callback) => { if (handlers.get(type) === callback) handlers.delete(type); },
    setTimeout: callback => { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: callback => callback(),
  };
  const contentWindow = { postMessage: (message, origin) => { assert.equal(origin, '*'); messages.push(message); } };
  let src = '';
  const frame = { contentWindow, getAttribute: () => src, setAttribute: (_, value) => { src = value; } };
  const layer = { hidden: true, offsetWidth: 800 };
  const element = { classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) } };
  const world = { window: win, Set, Map };
  vm.createContext(world);
  vm.runInContext(read('Web/js/map-render-preview.js'), world);
  let ready = 0;
  const preview = win.InkballRenderPreview.create({
    root: element, layer, frame, hero: { style: {}, getBoundingClientRect: () => ({ left: 100, top: 80, width: 576, height: 576 }) },
    map: 'test', session: 'run-2', window: win,
    getBoot: difficulty => ({ selected: { map: 'test', difficulty, layout: difficulty, config: { time: 100 } } }),
    onReady: () => { ready++; },
  });
  const send = data => handlers.get('message')?.({ source: contentWindow, origin: 'null', data: { map: 'test', session: 'run-2', ...data } });
  return { preview, messages, send, frame, layer, classes, handlers, get ready() { return ready; } };
}

test('offline preview boots locally, coalesces difficulty changes and rejects stale sessions', () => {
  const h = previewHarness();
  h.preview.update('prototype-3d.html?mode=background', 'easy');
  assert.ok(h.frame.getAttribute('src').startsWith('prototype-3d.html?'));
  h.preview.setMode('3d');
  h.send({ type: 'inkball:3d-ready', difficulty: 'easy', request: 0, session: 'old-session' });
  assert.equal(h.ready, 0);
  h.send({ type: 'inkball:3d-ready', difficulty: 'easy', request: 0 });
  assert.ok(h.classes.has('is-3d-render'));
  h.preview.update('prototype-3d.html?difficulty=hard', 'hard');
  h.preview.update('prototype-3d.html?difficulty=master', 'master');
  const updates = h.messages.filter(message => message.type === 'inkball:3d-preview-update');
  assert.equal(updates.length, 2);
  assert.equal(updates[1].selected.layout, 'master');
  h.send({ type: 'inkball:3d-ready', difficulty: 'hard', request: updates[0].request });
  assert.equal(h.ready, 1, 'An obsolete difficulty must not satisfy the latest request');
  h.send({ type: 'inkball:3d-ready', difficulty: 'master', request: updates[1].request });
  assert.equal(h.ready, 2);
  h.preview.destroy();
  assert.equal(h.handlers.size, 0);
  assert.equal(h.layer.hidden, true);
});
