window.Inkball = window.Inkball || {};

Inkball.CELLSIZE = 32;
Inkball.TOPBAR_HEIGHT = 64;
Inkball.WIDTH = 576;
Inkball.HEIGHT = 640;
Inkball.BOARD_WIDTH = Inkball.WIDTH / Inkball.CELLSIZE;
Inkball.BOARD_HEIGHT = 18;
Inkball.TOP_OFFSET = 64;

Inkball.canvasPixelRatio = function () {
  const ratio = typeof window !== 'undefined' ? Number(window.devicePixelRatio) || 1 : 1;
  return Math.max(1, Math.min(2, ratio));
};

Inkball.configureCanvas = function (canvas, ctx) {
  if (!canvas) return 1;
  const ratio = Inkball.canvasPixelRatio();
  const width = Math.round(Inkball.WIDTH * ratio);
  const height = Math.round(Inkball.HEIGHT * ratio);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  if (ctx && typeof ctx.setTransform === 'function') {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  return ratio;
};

Inkball.DRAW_AREA_X_MIN = 32;
Inkball.DRAW_AREA_Y_MIN = 96;
Inkball.DRAW_AREA_X_MAX = 544;
Inkball.DRAW_AREA_Y_MAX = 608;

Inkball.LINE_THICKNESS = 10;

// Time-based simulation. DESIGN_HZ is only used to keep the original 30 FPS feel
// when converting per-tick coefficients, and as the default dt in unit tests.
Inkball.DESIGN_HZ = 30;
Inkball.MAX_DT = 0.05;

Inkball.BRICK_HITS = 3;
Inkball.ACCEL = 180;
Inkball.MAX_BALL_SPEED = 120;
Inkball.ACCEL_BOOST_SECONDS = 2;
Inkball.BALL_AXIS_SPEED = 60;
Inkball.DEFAULT_TIMED_TILE_SECONDS = 39;

// One pair-layout attribute character for 0–99 seconds. Space keeps the default.
Inkball.TIMED_SECONDS_CHARS = (function () {
  let s = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < 38; i++) s += String.fromCharCode(0xC0 + i);
  return s;
})();

Inkball.clampTimedSeconds = function (n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return Inkball.DEFAULT_TIMED_TILE_SECONDS;
  return Math.max(0, Math.min(99, n));
};

Inkball.encodeTimedSeconds = function (n) {
  n = Inkball.clampTimedSeconds(n);
  if (n === Inkball.DEFAULT_TIMED_TILE_SECONDS) return ' ';
  return Inkball.TIMED_SECONDS_CHARS.charAt(n);
};

Inkball.decodeTimedSeconds = function (ch, fallback) {
  if (fallback == null) fallback = Inkball.DEFAULT_TIMED_TILE_SECONDS;
  if (ch == null || ch === '' || ch === ' ') return fallback;
  const i = Inkball.TIMED_SECONDS_CHARS.indexOf(String(ch).charAt(0));
  return i >= 0 ? i : fallback;
};

Inkball.timedRemainingDisplay = function (seconds) {
  if (!(seconds > 0)) return 0;
  return Math.ceil(seconds);
};

Inkball.drawTimedSecondsLabel = function (ctx, cx, cy, seconds) {
  if (!ctx) return;
  const label = String(Inkball.timedRemainingDisplay(seconds));
  ctx.save();
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(16, 20, 28, 0.92)';
  ctx.fillStyle = '#fff';
  ctx.strokeText(label, cx, cy);
  ctx.fillText(label, cx, cy);
  ctx.restore();
};

Inkball.HOLE_DAMP_PER_TICK = 0.96;
Inkball.HOLE_PULL_PER_TICK = 0.005;
Inkball.BRICK_HIT_COOLDOWN = 8 / Inkball.DESIGN_HZ;
Inkball.GATE_COOLDOWN = 15 / Inkball.DESIGN_HZ;
Inkball.MOVING_TILE_STEP = 2 / Inkball.DESIGN_HZ;
Inkball.TIME_BONUS_SECONDS = 0.067;
Inkball.DASH_ICON_SPEED = 30;

Inkball.stepDt = function (dt) {
  if (typeof dt !== 'number' || !isFinite(dt) || dt < 0) {
    return 1 / Inkball.DESIGN_HZ;
  }
  return dt;
};

Inkball.isPairLayout = function (text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines.some(function (line) {
    return line.length > 18;
  });
};

Inkball.COLOR_HEX = ['#9aa0a6', '#f4a261', '#4ea1f3', '#6fcf97', '#f2c94c'];

// Single-cell colour packing so adjacent C/Y/V/G/K keep their colour.
// Index 0 stays the original letter; pair form (Y2, C1, …) and legacy 18-char
// two-cell tokens are both parsed.
Inkball.COLOR_CELL_CHARS = {
  C: ['C', 'a', 'b', 'c', 'e'],
  Y: ['Y', 'f', 'h', 'i', 'j'],
  V: ['V', 'k', 'm', 'n', 'o'],
  G: ['G', 'p', 'q', 's', 't'],
  K: ['K', 'v', 'w', 'x', 'y'],
};

Inkball.COLOR_CELL_LOOKUP = {};
Object.keys(Inkball.COLOR_CELL_CHARS).forEach(function (token) {
  const chars = Inkball.COLOR_CELL_CHARS[token];
  for (let color = 1; color <= 4; color++) {
    Inkball.COLOR_CELL_LOOKUP[chars[color]] = { token: token, color: color };
  }
});

Inkball.packColorCell = function (token, color) {
  const chars = Inkball.COLOR_CELL_CHARS[token];
  if (!chars) return token;
  const idx = Number(color);
  if (idx >= 1 && idx <= 4) return chars[idx];
  return chars[0];
};

Inkball.unpackColorCell = function (ch) {
  return Inkball.COLOR_CELL_LOOKUP[ch] || null;
};

Inkball.drawBallImage = function (ctx, img, x, y, size) {
  if (!ctx || !img || !(size > 0)) return;
  const radius = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
};
