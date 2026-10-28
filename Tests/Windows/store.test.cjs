const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { LocalStore, validateMap } = require('../../Windows/store.cjs');
const root = path.join(__dirname, '../..');
const world = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, 'Web/official-data.js'), 'utf8'), world);
const official = JSON.parse(JSON.stringify(world.window.INKBALL_OFFICIAL.maps));
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'Web/official-achievements.json')));
function createStore(t) { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spherail-store-')); t.after(() => { assert.equal(path.dirname(directory), os.tmpdir()); fs.rmSync(directory, { recursive: true, force: true }); }); return new LocalStore(directory, catalogue); }
const { sample } = require('./fixtures.cjs');
test('Windows version matches the Mac version', () => {
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
  assert.equal(version, fs.readFileSync(path.join(root, 'AppInfo.plist'), 'utf8').match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)[1]);
});
test('profile survives restart, language/transparency edits and legacy avatar migration', t => {
  const store = createStore(t), first = store.profile();
  assert.match(first.name, /^player\d{6}$/); assert.equal(first.detailTransparency, 20);
  store.updateLanguage('en'); store.updateProfile({ name: 'Alice', detailTransparency: 70 });
  const reloaded = new LocalStore(store.directory).profile();
  assert.equal(reloaded.id, first.id); assert.equal(reloaded.name, 'Alice'); assert.equal(reloaded.language, 'en'); assert.equal(reloaded.detailTransparency, 70);
  store.write('profile', { ...reloaded, avatar: 'genshin-001', avatarData: '' }); assert.equal(store.profile().avatar, 'default');
  assert.throws(() => store.updateLanguage('invalid')); assert.throws(() => store.updateProfile({ name: 'Alice', avatarData: 'data:image/jpeg;base64,AAAA' }));
});
test('map sharing preserves IDs, deduplicates imports and renames content conflicts', t => {
  const store = createStore(t), map = store.saveMap(sample()), code = store.exportMap({ id: map.id });
  assert.equal(store.importMap(code).id, map.id); assert.equal(store.maps().length, 1);
  const variant = sample(); variant.difficulties.easy.time = 120;
  const saved = store.saveMap(variant), differentCode = store.exportMap({ id: saved.id }); store.deleteMap(saved.id);
  const imported = store.importMap(differentCode); assert.equal(imported.name, 'Test Map (2)');
  assert.equal(store.importMap(differentCode).id, imported.id);
  store.deleteMap(map.id); assert.throws(() => store.map(map.id), /not found/);
});
test('all 30 official difficulties validate and official map sharing remains compatible', t => {
  const store = createStore(t);
  for (const map of official) {
    assert.doesNotThrow(() => validateMap(map, true), map.id);
    const imported = store.importMap(store.exportMap({ map })); assert.equal(imported.official, false);
    assert.deepEqual(Object.keys(imported.difficulties), Object.keys(map.difficulties));
  }
});
test('difficulty codes preserve Unicode timed walls and normalize CRLF and outer walls', t => {
  const store = createStore(t), level = official.at(-1).difficulties.master;
  const code = store.exportDifficulty(level, '测试玩家');
  const imported = store.importDifficulty(code);
  assert.ok(imported.author_history.includes('测试玩家')); assert.equal(imported.layout_content.split('\n').length, 18);
  assert.deepEqual(imported.balls, level.balls); assert.equal(imported.time, level.time);
  assert.throws(() => store.importDifficulty('INKBALL-MAP/1\n{}'));
});
test('validation rejects malformed layouts, unsupported colours and overlapping holes', () => {
  const map = sample(); map.difficulties.easy.balls = ['pink']; assert.throws(() => validateMap(map), /ball queue/);
  const overlap = sample(); const rows = overlap.difficulties.easy.layout_content.split('\n');
  rows[5] = rows[5].slice(0, 12) + 'B0' + rows[5].slice(14); overlap.difficulties.easy.layout_content = rows.join('\n');
  assert.throws(() => validateMap(overlap), /overlap/);
  const noSpawn = sample(); noSpawn.difficulties.easy.layout_content = noSpawn.difficulties.easy.layout_content.replace('S ', '  ');
  assert.throws(() => validateMap(noSpawn), /spawn point/);
});
test('records aggregate independent bests and achievements persist without duplicate awards', t => {
  const store = createStore(t), map = official[0], definitions = catalogue[map.id].easy;
  const first = store.recordResult({ mapID: map.id, difficulty: 'easy', score: 10000, cleared: true, duration: 1, correct: 10, wrong: 0, lines: 0 });
  assert.equal(first.clears, 1); assert.equal(first.bestAccuracy, 100); assert.equal(first.newRecord, true);
  assert.ok(first.newlyUnlocked.length > 0); assert.ok(definitions.some(item => store.achievements()[item.code]));
  const second = store.recordResult({ mapID: map.id, difficulty: 'easy', score: 50, cleared: false, duration: 20, correct: 1, wrong: 3 });
  assert.equal(second.bestScore, 10000); assert.equal(second.bestTime, 1); assert.equal(second.lastAccuracy, 25); assert.equal(second.clears, 1);
  assert.deepEqual(second.newlyUnlocked, []); assert.equal(new LocalStore(store.directory).records()[`${map.id}|easy`].bestScore, 10000);
});
test('damaged user data is reported and is never silently overwritten', t => {
  const store = createStore(t), file = path.join(store.directory, 'profile.json'); fs.writeFileSync(file, '{broken');
  assert.throws(() => store.profile(), /damaged/); assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});
