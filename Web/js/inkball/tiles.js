window.Inkball = window.Inkball || {};

Inkball._px = function (gx, gy) {
  return {
    x: gx * Inkball.CELLSIZE,
    y: gy * Inkball.CELLSIZE + Inkball.TOP_OFFSET,
  };
};

Inkball._ballPassesColor = function (ball, requiredColor) {
  if (requiredColor == null || requiredColor < 0) return true;
  return ball.colorIndex === requiredColor;
};

/** Legacy solid wall (X / 1-4) */
Inkball.WallTile = class WallTile {
  constructor(gx, gy, wallIndex) {
    this.gx = gx;
    this.gy = gy;
    this.wallIndex = wallIndex; // 0-4
    this.removed = false;
  }

  solidFor() {
    return !this.removed;
  }

  onBallHit(ball) {
    if (this.wallIndex >= 1 && this.wallIndex <= 4) {
      ball.colorIndex = this.wallIndex;
    }
  }

  onBallOverlap() {}
  update() {}

  draw(ctx, app) {
    if (this.removed) return;
    const p = Inkball._px(this.gx, this.gy);
    const img = app.wallImages[this.wallIndex];
    if (img) ctx.drawImage(img, p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);
  }
};

/** Breakable brick — 3 hits; grey damaged by any; coloured only by matching ball */
Inkball.BrickTile = class BrickTile {
  constructor(gx, gy, colorIndex) {
    this.gx = gx;
    this.gy = gy;
    this.colorIndex = colorIndex;
    this.hits = 0;
    this.removed = false;
    this._hitCooldown = 0;
  }

  solidFor() {
    return !this.removed;
  }

  onBallHit(ball) {
    if (this.removed || this._hitCooldown > 0) return;
    // Grey brick: any ball. Coloured brick: only matching colour ball.
    const ok = this.colorIndex === 0 || ball.colorIndex === this.colorIndex;
    if (!ok) return;
    this.hits += 1;
    this._hitCooldown = Inkball.BRICK_HIT_COOLDOWN;
    if (this.hits >= Inkball.BRICK_HITS) {
      this.removed = true;
    }
  }

  onBallOverlap() {}

  update(dt) {
    dt = Inkball.stepDt(dt);
    if (this._hitCooldown > 0) {
      this._hitCooldown -= dt;
      if (this._hitCooldown < 0) this._hitCooldown = 0;
    }
  }

  draw(ctx, app) {
    if (this.removed) return;
    const p = Inkball._px(this.gx, this.gy);
    const frames = (app.brickImages && app.brickImages[this.colorIndex]) || [];
    const img = frames.length ? frames[Math.min(this.hits, frames.length - 1)] : null;
    if (img) ctx.drawImage(img, p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);
  }
};

/** One-way wall: only matching balls moving in the arrow direction pass. */
Inkball.OneWayTile = class OneWayTile {
  constructor(gx, gy, dir, colorIndex) {
    this.gx = gx;
    this.gy = gy;
    this.dir = dir; // U D L R
    this.colorIndex = colorIndex == null ? 0 : colorIndex; // Unspecified means grey, matching its sprite.
    this.removed = false;
  }

  _movingAllowed(ball) {
    if (this.dir === 'U') return ball.vy < 0;
    if (this.dir === 'D') return ball.vy > 0;
    if (this.dir === 'L') return ball.vx < 0;
    return ball.vx > 0;
  }

  solidFor(ball) {
    if (this.removed) return false;
    if (!this._movingAllowed(ball)) return true;
    return !Inkball._ballPassesColor(ball, this.colorIndex);
  }

  onBallHit() {}
  onBallOverlap() {}
  update() {}

  draw(ctx, app) {
    const p = Inkball._px(this.gx, this.gy);
    const colorIndex = this.colorIndex == null ? 0 : this.colorIndex;
    const directionImages = app.oneWayImages[this.dir];
    const img = directionImages && directionImages[colorIndex];
    if (img) ctx.drawImage(img, p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);
  }
};

/** Colour gate: matching colour (or grey ball) passes; others bounce; no recolour */
Inkball.ColourGateTile = class ColourGateTile {
  constructor(gx, gy, colorIndex) {
    this.gx = gx;
    this.gy = gy;
    this.colorIndex = colorIndex;
    this.removed = false;
  }

  solidFor(ball) {
    if (this.removed) return false;
    return !Inkball._ballPassesColor(ball, this.colorIndex);
  }

  onBallHit() {}
  onBallOverlap() {}
  update() {}

  draw(ctx, app) {
    const p = Inkball._px(this.gx, this.gy);
    if (app.tileImage) ctx.drawImage(app.tileImage, p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);
    const col = Inkball.COLOR_HEX[this.colorIndex];
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.strokeRect(p.x + 3, p.y + 3, Inkball.CELLSIZE - 6, Inkball.CELLSIZE - 6);
    ctx.fillStyle = col;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * 0.25;
    ctx.fillRect(p.x + 3, p.y + 3, Inkball.CELLSIZE - 6, Inkball.CELLSIZE - 6);
    ctx.globalAlpha = prevAlpha;
  }
};

/** Timed solid tile that fades then becomes passable */
Inkball.TimedTile = class TimedTile {
  constructor(gx, gy, lifetimeSeconds) {
    this.gx = gx;
    this.gy = gy;
    this.lifetime = typeof lifetimeSeconds === 'number' && isFinite(lifetimeSeconds)
      ? Math.max(0, lifetimeSeconds)
      : Inkball.DEFAULT_TIMED_TILE_SECONDS;
    this.maxLifetime = this.lifetime > 0 ? this.lifetime : 1;
    this.removed = this.lifetime <= 0;
  }

  solidFor() {
    return !this.removed && this.lifetime > 0;
  }

  onBallHit() {}
  onBallOverlap() {}

  update(dt) {
    if (this.removed) return;
    dt = Inkball.stepDt(dt);
    if (this.lifetime > 0) {
      this.lifetime -= dt;
      if (this.lifetime <= 0) this.removed = true;
    }
  }

  draw(ctx, app) {
    if (this.removed) return;
    const p = Inkball._px(this.gx, this.gy);
    const alpha = Math.max(0.35, this.lifetime / this.maxLifetime);
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * alpha;
    const img = app.wallImages[0];
    if (img) ctx.drawImage(img, p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);
    else {
      ctx.fillStyle = Inkball.COLOR_HEX[0];
      ctx.fillRect(p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);
    }
    ctx.globalAlpha = prevAlpha;
    Inkball.drawTimedSecondsLabel(
      ctx,
      p.x + Inkball.CELLSIZE / 2,
      p.y + Inkball.CELLSIZE / 2,
      this.lifetime,
    );
  }
};

/** Acceleration pad */
Inkball.AccelTile = class AccelTile {
  constructor(gx, gy, dir) {
    this.gx = gx;
    this.gy = gy;
    this.dir = dir;
    this.removed = false;
  }

  solidFor() {
    return false;
  }

  onBallHit() {}

  onBallOverlap(ball, _level, dt) {
    dt = Inkball.stepDt(dt);
    const a = Inkball.ACCEL * dt;
    if (this.dir === 'U') ball.vy -= a;
    else if (this.dir === 'D') ball.vy += a;
    else if (this.dir === 'L') ball.vx -= a;
    else ball.vx += a;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > Inkball.MAX_BALL_SPEED) {
      ball.vx = (ball.vx / sp) * Inkball.MAX_BALL_SPEED;
      ball.vy = (ball.vy / sp) * Inkball.MAX_BALL_SPEED;
    }
    ball._accelBoostRemaining = Inkball.ACCEL_BOOST_SECONDS;
  }

  update() {}

  draw(ctx, app) {
    const p = Inkball._px(this.gx, this.gy);
    const img = app.acceleratorImages[this.dir];
    if (img) ctx.drawImage(img, p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);
  }
};

/** Key wall — toggled solid/retracted */
Inkball.KeyWallTile = class KeyWallTile {
  constructor(gx, gy, group) {
    this.gx = gx;
    this.gy = gy;
    this.group = group; // 0-4
    this.solid = true;
    this.removed = false;
  }

  solidFor() {
    return !this.removed && this.solid;
  }

  onBallHit() {}
  onBallOverlap() {}
  update() {}

  toggle() {
    this.solid = !this.solid;
  }

  draw(ctx, app) {
    const p = Inkball._px(this.gx, this.gy);
    const col = Inkball.COLOR_HEX[this.group];
    if (this.solid) {
      const img = app.keyWallImages?.[this.group] || app.keyWallImages?.[0];
      if (img) ctx.drawImage(img, p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);
    } else {
      if (app.tileImage) ctx.drawImage(app.tileImage, p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);
      ctx.strokeStyle = col;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x + 3, p.y + 3, Inkball.CELLSIZE - 6, Inkball.CELLSIZE - 6);
      ctx.setLineDash([]);
    }
  }
};

/** Key activator — toggles matching key walls */
Inkball.KeyActivatorTile = class KeyActivatorTile {
  constructor(gx, gy, group) {
    this.gx = gx;
    this.gy = gy;
    this.group = group;
    this.removed = false;
    this._cooldown = 0;
  }

  solidFor() {
    return true;
  }

  onBallHit(ball, level) {
    if (this._cooldown > 0) return;
    if (this.group !== 0 && ball.colorIndex !== 0 && ball.colorIndex !== this.group) return;
    level.toggleKeyWalls(this.group);
    this._cooldown = Inkball.GATE_COOLDOWN;
  }

  onBallOverlap() {}

  update(dt) {
    dt = Inkball.stepDt(dt);
    if (this._cooldown > 0) {
      this._cooldown -= dt;
      if (this._cooldown < 0) this._cooldown = 0;
    }
  }

  draw(ctx, app) {
    const p = Inkball._px(this.gx, this.gy);
    if (app.tileImage) ctx.drawImage(app.tileImage, p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);
    const col = Inkball.COLOR_HEX[this.group];
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(p.x + 16, p.y + 16, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('V', p.x + 16, p.y + 16);
  }
};

/** Hole gate switch — enable/disable holes */
Inkball.HoleGateTile = class HoleGateTile {
  constructor(gx, gy, group) {
    this.gx = gx;
    this.gy = gy;
    this.group = group; // 0 = all holes
    this.removed = false;
    this._cooldown = 0;
  }

  solidFor() {
    return true;
  }

  onBallHit(ball, level) {
    if (this._cooldown > 0) return;
    if (this.group !== 0 && ball.colorIndex !== 0 && ball.colorIndex !== this.group) return;
    level.toggleHoles(this.group);
    this._cooldown = Inkball.GATE_COOLDOWN;
  }

  onBallOverlap() {}

  update(dt) {
    dt = Inkball.stepDt(dt);
    if (this._cooldown > 0) {
      this._cooldown -= dt;
      if (this._cooldown < 0) this._cooldown = 0;
    }
  }

  draw(ctx, app) {
    const p = Inkball._px(this.gx, this.gy);
    if (app.tileImage) ctx.drawImage(app.tileImage, p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);
    const col = Inkball.COLOR_HEX[this.group];
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(p.x + 16, p.y + 16, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('G', p.x + 16, p.y + 16);
  }
};
