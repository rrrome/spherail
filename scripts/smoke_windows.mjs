import { _electron } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = path.join(root, 'test-results', process.env.SPHERAIL_EXE ? 'windows-packaged' : 'windows-source');
fs.mkdirSync(output, { recursive: true });
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'spherail-ui-'));
const executablePath = process.env.SPHERAIL_EXE || require('electron');
const flags = [`--spherail-test-data=${data}`, '--spherail-no-discovery', '--spherail-hidden'];
if (process.env.CI) flags.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
const args = process.env.SPHERAIL_EXE ? flags : [root, ...flags];
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const errors = [], failedRequests = [];
let desktop;
async function withDeadline(promise, label, milliseconds = 60000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function closeDesktop() {
  if (!desktop) return;
  const instance = desktop; desktop = null;
  try { await withDeadline(instance.close(), 'closing the test application', 15000); }
  catch { instance.process().kill(); }
}
try {
  desktop = await _electron.launch({ executablePath, args, env, timeout: 60000 });
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failedRequests.push(request.url()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  // Poll through the debugger protocol; waitForFunction's page-side eval is
  // intentionally blocked by the production CSP.
  const wait = async (expression, target = page) => {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await target.evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const click = selector => page.locator(selector).first().evaluate(element => element.click());
  await wait("document.querySelector('#header-name').textContent.startsWith('player')");
  assert.equal(await page.evaluate(() => window.INKBALL_OFFICIAL.maps.length), 10);
  assert.deepEqual(await page.evaluate(() => [typeof window.require, typeof window.process, document.documentElement.dataset.platform]), ['undefined', 'undefined', 'windows']);
  await wait("document.querySelectorAll('#official-map-list .is-preview-ready').length === 30");
  await page.screenshot({ path: path.join(output, '01-home.png') });
  console.log('PASS: offline bootstrap, 10 maps, 30 previews and isolated renderer');
  await click('#profile-open');
  assert.equal(await page.locator('#profile-version').textContent(), 'v0.1.4');
  await page.locator('#profile-name').fill('Windows Tester');
  await page.locator('#profile-avatar-file').setInputFiles(path.join(root, 'Assets/Windows/Spherail.png'));
  await wait("document.querySelector('#profile-avatar-preview').src.startsWith('data:image/jpeg;base64,')");
  await page.locator('#profile-language').selectOption('en');
  await wait("document.documentElement.lang === 'en'");
  await page.locator('#profile-detail-transparency').evaluate(element => { element.value = '65'; element.dispatchEvent(new Event('input')); });
  await click('#profile-save'); await wait("!document.querySelector('#profile-dialog').open");
  assert.equal(await page.evaluate(async () => (await InkBallNative.call('profile')).detailTransparency), 65);
  assert.equal(await page.evaluate(async () => (await InkBallNative.call('profile')).avatar), 'custom');
  console.log('PASS: version, English/Chinese profile and persistent preferences');
  await click('#official-map-list .map-card[data-map-index="0"]');
  await wait("!document.querySelector('#detail-view').hidden");
  await click('#detail-start');
  await wait("window.inkballApp?.currentLevel && !document.querySelector('#play-view').hidden");
  const board = await page.locator('#game').boundingBox();
  await page.mouse.move(board.x + board.width * 0.3, board.y + board.height * 0.4);
  await page.mouse.down();
  for (let i = 0; i < 10; i++) await page.mouse.move(board.x + board.width * (0.3 + i * 0.025), board.y + board.height * 0.4);
  await page.mouse.up();
  assert.ok(await page.evaluate(() => window.inkballApp.linesDrawn > 0));
  await click('[data-pause-open]'); await wait("document.querySelector('[data-pause-overlay]').open");
  assert.equal(await page.evaluate(() => window.inkballApp.isPaused), true);
  await click('[data-pause-resume]'); await wait('!window.inkballApp.isPaused');
  await page.screenshot({ path: path.join(output, '02-game-2d.png') });
  // Exercise the existing completion path after real initialization and input.
  await page.evaluate(() => window.inkballApp._finishAttempt(false));
  await wait("!document.querySelector('#result-view').hidden");
  const records = await page.evaluate(() => InkBallNative.call('bootstrap').then(data => data.records));
  assert.ok(Object.keys(records).length > 0);
  await click('#result-continue'); await wait("!document.querySelector('#maps-view').hidden");
  console.log('PASS: 2D play, pointer drawing, pause/resume, result and disk record');
  await click('#official-map-list .map-card[data-map-index="0"]');
  await wait("!document.querySelector('#detail-view').hidden");
  await click('#detail-3d-toggle');
  await wait("document.querySelector('#detail-view').classList.contains('is-3d-frame-ready')");
  const frame = page.frames().find(frame => frame.url().includes('prototype-3d.html'));
  assert.ok(frame);
  await wait('window.Inkball3D?.texturesLoaded()', frame);
  assert.equal(await frame.evaluate(() => window.Inkball3D.renderer.getContext().isContextLost()), false);
  await click('#detail-start'); await wait('window.Inkball3D.started', frame);
  const controls = await frame.evaluate(() => {
    const game = window.Inkball3D;
    game.pause(); const paused = game.paused;
    game.resume(); const resumed = !game.paused;
    // Freeze the short real-time level while a slow software GPU is captured.
    game.pause(); game.setCameraLocked(false); game.setTool('erase');
    return { paused, resumed, tool: game.drawTool, cameraLocked: game.cameraLocked };
  });
  assert.deepEqual(controls, { paused: true, resumed: true, tool: 'erase', cameraLocked: false });
  if (process.env.CI) {
    // Chromium's hidden-window compositor can stall captureScreenshot with
    // SwiftShader. Read the actual WebGL frame instead, retaining pixel checks.
    const snapshot = await frame.evaluate(() => {
      const renderer = window.Inkball3D.renderer;
      window.Inkball3D.renderFrame();
      const canvas = renderer.domElement, gl = renderer.getContext();
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const colors = new Set();
      for (let index = 0; index < pixels.length; index += 4 * 521) colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      return { image: canvas.toDataURL('image/png'), colors: colors.size, width: canvas.width, height: canvas.height,
        contextLost: gl.isContextLost(), glError: gl.getError(), started: window.Inkball3D.started, paused: window.Inkball3D.paused };
    });
    fs.writeFileSync(path.join(output, '03-game-3d.png'), Buffer.from(snapshot.image.split(',')[1], 'base64'));
    const { image: _image, ...diagnostics } = snapshot;
    console.log('3D frame diagnostics:', JSON.stringify(diagnostics));
    assert.ok(snapshot.colors > 8, 'Software WebGL must render a nonblank, multicolour game frame');
  } else await page.screenshot({ path: path.join(output, '03-game-3d.png') });
  console.log('PASS: nonblank 3D render capture');
  // Returning removes the iframe. Evaluate in the surviving main frame so a
  // detached-frame debugger response cannot leave Playwright waiting forever.
  await withDeadline(page.evaluate(() => document.querySelector('#detail-3d-frame').contentWindow.InkballScene.navigate('desktop-return')), 'returning from the 3D frame', 20000);
  await wait("!document.querySelector('#detail-view').classList.contains('is-3d-playing')");
  console.log('PASS: local 3D textures, WebGL, start, pause, camera, erase and return');
  await click('[data-route="personal"]'); await click('#personal-create');
  await wait("!document.querySelector('#editor-view').hidden");
  await page.locator('#editor-name').fill('Windows Map');
  await click('#editor-import');
  const sample = require('../Tests/Windows/fixtures.cjs').sample();
  const code = await page.evaluate(level => InkBallNative.call('exportDifficultyCode', { level, author: 'Windows Tester' }).then(data => data.code), sample.difficulties.easy);
  await page.locator('#map-code').fill(code); await click('#code-action');
  await wait("!document.querySelector('#code-dialog').open");
  await click('#editor-save');
  await wait("/saved|已保存/i.test(document.querySelector('#editor-status').textContent)");
  assert.equal(await page.evaluate(() => InkBallNative.call('maps').then(data => data.maps[0].name)), 'Windows Map');
  await click('#editor-export');
  const clipboardText = await desktop.evaluate(({ clipboard }) => clipboard.readText());
  assert.ok(clipboardText.startsWith('INKBALL-LEVEL/1\n'));
  await page.screenshot({ path: path.join(output, '04-editor.png') });
  console.log('PASS: editor import, save, export and native clipboard');
  assert.deepEqual(errors, [], `Renderer errors: ${errors.join('\n')}`);
  assert.deepEqual(failedRequests, [], `Failed offline requests: ${failedRequests.join('\n')}`);
  const profile = await page.evaluate(() => InkBallNative.call('profile'));
  await closeDesktop();
  const diskProfile = JSON.parse(fs.readFileSync(path.join(data, 'InkBall', 'profile.json'), 'utf8'));
  assert.equal(diskProfile.id, profile.id); assert.equal(diskProfile.name, 'Windows Tester');
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, version: '0.1.4', mode: process.env.SPHERAIL_EXE ? 'packaged' : 'source', errors, failedRequests }, null, 2));
  console.log(`Windows smoke test passed. Screenshots: ${output}`);
} catch (error) {
  console.error('Renderer errors:', errors); console.error('Failed requests:', failedRequests);
  if (desktop && !process.env.CI) { const windows = desktop.windows(); if (windows[0]) await windows[0].screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {}); }
  throw error;
} finally {
  await closeDesktop();
  assert.equal(path.dirname(data), os.tmpdir());
  fs.rmSync(data, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
