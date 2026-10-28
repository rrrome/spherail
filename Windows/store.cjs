'use strict';
// Persistence and map-sharing contracts mirror the macOS LocalStore.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomInt } = require('node:crypto');
const colors = ['grey', 'orange', 'blue', 'green', 'yellow'];
const difficulties = ['easy', 'hard', 'master'];
const tiles = new Set('XHSBUDLRudlrCYVGKTA1234abcefhijkmnopqstvwxy');
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const requireValid = (condition, message) => { if (!condition) throw new Error(message); };
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const length = value => [...value].length;
const stableJSON = value => JSON.stringify(value, (_, item) => isObject(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

function validateLevel(raw, { shared = false, officialBorder = false } = {}) {
  requireValid(isObject(raw), 'Invalid difficulty data.');
  const layout = raw.layout_content ?? raw.layout;
  requireValid(typeof layout === 'string', 'Missing layout.');
  const rows = layout.replaceAll('\r\n', '\n').split('\n').map(row => [...row]);
  requireValid(rows.length === 18 && rows.every(row => row.length === 36), 'A map must have 18 rows of 18 two-character cells.');
  const balls = raw.balls ?? [], time = raw.time, interval = raw.spawn_interval ?? 0;
  requireValid(Array.isArray(balls) && balls.length <= 200 && balls.every(ball => colors.includes(ball)), 'Invalid ball queue.');
  requireValid(integer(time, 1, 3600) && integer(interval, 0, 600), 'Invalid time or spawn interval.');
  requireValid(shared || time >= balls.length * interval, 'Total time must be at least serve count times the interval.');
  const placed = [], holes = new Set(), walls = new Set(), occupied = new Set();
  let interior = false, spawner = false;
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
    let token = rows[y][x * 2];
    const attribute = rows[y][x * 2 + 1], border = x === 0 || x === 17 || y === 0 || y === 17;
    requireValid(token === ' ' || tiles.has(token), 'Unknown map tile.');
    if (shared && border) { rows[y][x * 2] = token = 'X'; rows[y][x * 2 + 1] = ' '; }
    requireValid(!border || token === 'X' || (officialBorder && /^[1-4]$/.test(token)), 'The outside border must be walls.');
    if (!border && token !== ' ') interior = true;
    if (token === 'S') spawner = true;
    if (token === 'B' || token === 'H') {
      requireValid(/^[0-4]$/.test(attribute), 'Balls and holes need a valid colour.');
      if (token === 'B') placed.push(colors[Number(attribute)]);
      else holes.add(Number(attribute));
    }
    if (/^[1-4]$/.test(token)) walls.add(Number(token));
    if (!shared && token !== ' ') {
      for (const [dx, dy] of token === 'H' ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]]) {
        const cell = (y + dy) * 18 + x + dx;
        requireValid(x + dx < 18 && y + dy < 18 && !occupied.has(cell), 'Map tiles overlap.');
        occupied.add(cell);
      }
    }
  }
  if (!shared && (interior || balls.length)) {
    requireValid(balls.length + placed.length > 0, 'At least one ball is required.');
    requireValid(!balls.length || spawner, 'A ball queue requires at least one spawn point.');
    requireValid(holes.size > 0, 'At least one hole is required.');
    for (const ball of [...balls, ...placed]) {
      const color = colors.indexOf(ball);
      requireValid(color === 0 || holes.has(0) || holes.has(color) || walls.has(color), `${ball} balls need a matching hole, grey hole, or matching colour wall.`);
    }
  }
  const history = raw.author_history ?? [];
  requireValid(Array.isArray(history) && history.length <= 50 && history.every(author => typeof author === 'string' && author.trim() && length(author) <= 100), 'Invalid author history.');
  const level = { ...raw, layout_content: rows.map(row => row.join('')).join('\n'), balls, time, spawn_interval: interval };
  if (shared) return { layout_content: level.layout_content, layout: 'custom.txt', balls, time, spawn_interval: interval, author_history: history };
  return { level, authored: interior || balls.length > 0 };
}

function validateMap(raw, officialBorder = false) {
  requireValid(isObject(raw) && typeof raw.name === 'string', 'Invalid map.');
  const name = raw.name.trim();
  requireValid(length(name) >= 1 && length(name) <= 20, 'Map name must contain 1–20 characters.');
  requireValid(isObject(raw.difficulties) && Object.keys(raw.difficulties).length > 0, 'At least one difficulty is required.');
  const cleaned = {}; let authored = false;
  for (const [difficulty, input] of Object.entries(raw.difficulties)) {
    requireValid(difficulties.includes(difficulty), 'Unknown difficulty.');
    const result = validateLevel(input, { officialBorder });
    authored ||= result.authored;
    cleaned[difficulty] = { ...result.level, layout: `custom_${difficulty}.txt` };
  }
  requireValid(authored, 'At least one ball and one hole are required.');
  return { name, author: [...String(raw.author ?? '')].slice(0, 100).join(''), difficulties: cleaned, official: false };
}

class LocalStore {
  constructor(directory, achievements = {}, validateAvatar = () => false) {
    this.directory = directory; this.catalogue = achievements; this.validateAvatar = validateAvatar;
    fs.mkdirSync(directory, { recursive: true });
  }
  read(name, fallback) {
    const file = path.join(this.directory, `${name}.json`);
    if (!fs.existsSync(file)) return structuredClone(fallback);
    try { const data = JSON.parse(fs.readFileSync(file, 'utf8')); requireValid(isObject(data), 'Invalid data.'); return data; }
    catch { throw new Error(`Stored data is damaged: ${name}.json`); }
  }
  write(name, value) {
    const file = path.join(this.directory, `${name}.json`), temporary = `${file}.${randomUUID()}.tmp`;
    try { fs.writeFileSync(temporary, stableJSON(value), { flag: 'wx' }); fs.renameSync(temporary, file); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    return value;
  }
  profile() {
    let value = this.read('profile', null);
    if (!value) value = { id: randomUUID().toUpperCase(), name: `player${randomInt(100000, 1000000)}`, avatar: 'default', avatarData: '', language: 'zh', detailTransparency: 20 };
    if (value.avatar !== 'custom' || !value.avatarData) { value.avatar = 'default'; value.avatarData = ''; }
    value.detailTransparency ??= 20;
    return this.write('profile', value);
  }
  updateLanguage(language) {
    requireValid(['en', 'zh'].includes(language), 'Unsupported language.');
    return this.write('profile', { ...this.profile(), language });
  }
  updateProfile({ name, avatarData = '', detailTransparency }) {
    requireValid(typeof name === 'string' && name.trim() && length(name.trim()) <= 50, 'Player name must contain 1–50 characters.');
    requireValid(detailTransparency === undefined || integer(detailTransparency, 0, 100), 'Difficulty screen transparency must be between 0 and 100.');
    requireValid(typeof avatarData === 'string' && (!avatarData || this.validateAvatar(avatarData)), 'Avatar must be a cropped 96 × 96 JPEG under 16 KB.');
    return this.write('profile', { ...this.profile(), name: name.trim(), avatar: avatarData ? 'custom' : 'default', avatarData,
      ...(detailTransparency === undefined ? {} : { detailTransparency }) });
  }
  maps() { const data = this.read('maps', { version: 1, maps: [] }); requireValid(Array.isArray(data.maps), 'Stored maps are damaged.'); return data.maps; }
  map(id) { const value = this.maps().find(map => map.id === id); requireValid(value, 'Map not found.'); return value; }
  saveMap(raw, officialBorder = false) {
    const value = validateMap(raw, officialBorder), maps = this.maps();
    value.id = typeof raw.id === 'string' && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(raw.id) ? raw.id.toUpperCase() : randomUUID().toUpperCase();
    value.updatedAt = new Date().toISOString();
    const index = maps.findIndex(map => map.id === value.id);
    if (index < 0) maps.push(value); else maps[index] = value;
    this.write('maps', { version: 1, maps }); return value;
  }
  deleteMap(id) { const maps = this.maps(); this.map(id); this.write('maps', { version: 1, maps: maps.filter(map => map.id !== id) }); return { ok: true }; }
  exportMap({ id, map }) {
    const value = structuredClone(map ?? this.map(id));
    if (map) { requireValid(map.official === true, 'Expected an official map.'); validateMap(map, true); }
    delete value.id; delete value.updatedAt;
    return 'INKBALL-MAP/1\n' + JSON.stringify({ format: 'INKBALL-MAP', version: 1, map: value }, null, 2);
  }
  importMap(code) {
    requireValid(typeof code === 'string' && Buffer.byteLength(code) <= 200000 && code.startsWith('INKBALL-MAP/1\n'), 'Invalid or oversized map code.');
    const data = JSON.parse(code.slice('INKBALL-MAP/1\n'.length));
    requireValid(data.format === 'INKBALL-MAP' && data.version === 1, 'Invalid map code.');
    const officialBorder = data.map?.official === true, value = validateMap(data.map, officialBorder), maps = this.maps();
    const originalName = value.name;
    const variantName = n => [...originalName].slice(0, 20 - ` (${n})`.length).join('') + ` (${n})`;
    const variants = new Set(Array.from({ length: maps.length + 1 }, (_, i) => variantName(i + 2)));
    for (const map of maps) {
      const comparable = structuredClone(map); delete comparable.id; delete comparable.updatedAt;
      if (variants.has(comparable.name)) comparable.name = originalName;
      if (stableJSON(comparable) === stableJSON(value)) return map;
    }
    for (let n = 2; maps.some(map => map.name === value.name); n++) value.name = variantName(n);
    return this.saveMap(value, officialBorder);
  }
  exportDifficulty(level, author = '') {
    const value = validateLevel(level, { shared: true }), history = [...value.author_history];
    const name = [...author.trim()].slice(0, 100).join('');
    if (name && history.at(-1) !== name) history.push(name);
    if (!history.length) history.push('Spherail');
    requireValid(history.length <= 50, 'Author history is too long.');
    return 'INKBALL-LEVEL/1\n' + JSON.stringify({ format: 'inkball-map', version: 2, layout: value.layout_content, balls: value.balls,
      serve_interval: value.spawn_interval, total_time: value.time, author_history: history }, null, 2);
  }
  importDifficulty(code) {
    requireValid(typeof code === 'string' && Buffer.byteLength(code) <= 100000 && code.startsWith('INKBALL-LEVEL/1\n'), 'Invalid difficulty code.');
    const data = JSON.parse(code.slice('INKBALL-LEVEL/1\n'.length));
    requireValid(data.format === 'inkball-map' && data.version === 2, 'Invalid difficulty code.');
    return validateLevel({ layout_content: data.layout, balls: data.balls, spawn_interval: data.serve_interval,
      time: data.total_time, author_history: data.author_history }, { shared: true });
  }
  records() { return this.read('records', { records: {} }).records ?? {}; }
  achievements() { return Object.fromEntries(Object.keys(this.read('records', { achievements: {} }).achievements ?? {}).map(key => [key, true])); }
  recordResult({ mapID, difficulty, score, cleared, duration, correct = 0, wrong = 0, lines = 0 }) {
    requireValid(typeof mapID === 'string' && mapID.length <= 200 && difficulties.includes(difficulty), 'Invalid result map.');
    requireValid([score, duration, correct, wrong, lines].every(value => integer(value, 0, Number.MAX_SAFE_INTEGER)) && typeof cleared === 'boolean', 'Invalid game result.');
    const data = this.read('records', { version: 1, records: {}, achievements: {} });
    data.records ??= {}; data.achievements ??= {};
    const key = `${mapID}|${difficulty}`, previous = data.records[key] ?? {}, oldBest = previous.bestScore ?? 0;
    const accuracy = correct + wrong ? Math.round(correct / (correct + wrong) * 100) : 0;
    const value = { ...previous, bestScore: Math.max(score, oldBest), bestTime: Math.min(previous.bestTime ?? previous.lastDuration ?? duration, duration),
      bestAccuracy: Math.max(previous.bestAccuracy ?? accuracy, accuracy), clears: (previous.clears ?? (previous.lastCleared ? 1 : 0)) + (cleared ? 1 : 0),
      lastScore: score, lastCleared: cleared, lastDuration: duration, lastAccuracy: accuracy };
    if ('lastScore' in previous && !('clears' in previous)) value.clearsApproximate = true;
    data.records[key] = value;
    const newlyUnlocked = [];
    if (cleared) for (const item of [...(this.catalogue[mapID]?.[difficulty] ?? [])].sort((a, b) => a.display_order - b.display_order)) {
      const earned = { clear: true, score_at_least: score >= item.target, no_wrong_captures: wrong === 0,
        max_duration_seconds: duration <= item.target, max_lines_drawn: lines <= item.target }[item.criterion];
      if (earned && !data.achievements[item.code]) { data.achievements[item.code] = new Date().toISOString(); newlyUnlocked.push(item.code); }
    }
    this.write('records', data);
    return { ...value, newRecord: score > oldBest, newlyUnlocked };
  }
}
module.exports = { LocalStore, validateMap, validateLevel, stableJSON, requireValid };
