import { _electron } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = path.join(root, 'test-results', process.env.SPHERAIL_EXE ? 'windows-packaged' : 'windows-source'); fs.mkdirSync(output, { recursive: true });
const profiles = [0, 1].map(() => fs.mkdtempSync(path.join(os.tmpdir(), 'spherail-match-ui-'))), instances = [];
const wait = async (page, expression) => { const deadline = Date.now() + 30000; while (Date.now() < deadline) { if (await page.evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error(`Timed out: ${expression}`); };
const errors = [];
try {
  for (const directory of profiles) {
    const args = [`--spherail-test-data=${directory}`, '--spherail-hidden'];
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const desktop = await _electron.launch({ executablePath: process.env.SPHERAIL_EXE || require('electron'), args: process.env.SPHERAIL_EXE ? args : [root, ...args], env, timeout: 60000 });
    instances.push(desktop); const page = await desktop.firstWindow(); page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await wait(page, "document.querySelector('#header-name').textContent.startsWith('player')");
  }
  const [host, guest] = await Promise.all(instances.map(desktop => desktop.firstWindow()));
  const guestProfile = await guest.evaluate(() => InkBallNative.call('profile'));
  await wait(host, `InkBallNative.call('matchState').then(state => state.peers.some(peer => peer.playerID === ${JSON.stringify(guestProfile.id)}))`);
  await host.locator('#official-map-list .map-card[data-map-index="0"]').first().evaluate(element => element.click());
  await wait(host, "!document.querySelector('#detail-view').hidden");
  await host.locator('#detail-duel').evaluate(element => element.click());
  await host.evaluate(id => {
    const state = InkBallNative.call('matchState');
    return state.then(state => InkBallNative.call('matchInvite', { id: `wifi:${id}`, map: INKBALL_OFFICIAL.maps[0], difficulty: 'easy' }));
  }, guestProfile.id);
  await wait(guest, "document.querySelector('#match-invite-dialog').open");
  await guest.locator('#match-accept').evaluate(element => element.click());
  await Promise.all([host, guest].map(page => wait(page, "!document.querySelector('#play-view').hidden && window.inkballApp?.currentLevel && window.inkballApp?.matchSync?.opponentSnapshot")));
  await host.screenshot({ path: path.join(output, '05-lan-match.png') });
  console.log('PASS: two Electron applications discover via real mDNS, invite, accept, count down and render opponent snapshots');
  await host.evaluate(() => window.inkballApp._finishAttempt(true));
  await guest.evaluate(() => window.inkballApp._finishAttempt(true));
  await Promise.all([host, guest].map(page => wait(page, "!document.querySelector('#result-view').hidden")));
  const values = await Promise.all([host, guest].map(page => page.evaluate(() => InkBallNative.call('matchState'))));
  assert.equal(values[0].phase, 'finished'); assert.equal(values[1].phase, 'finished');
  await host.screenshot({ path: path.join(output, '06-lan-result.png') });
  assert.deepEqual(errors, []);
  console.log('PASS: both real game windows complete and display match results without renderer errors');
} finally {
  for (const desktop of instances) await desktop.close().catch(() => {});
  for (const directory of profiles) { assert.equal(path.dirname(directory), os.tmpdir()); fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
}
