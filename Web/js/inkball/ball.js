window.Inkball = window.Inkball || {};

Inkball.Ball = class Ball {
  constructor(app, colorIndex, x, y) {
    this.app = app;
    this.colorIndex = colorIndex;
    this.x = x;
    this.y = y;
    this.size = 20;
    this.collisionRadius = 9;
    this.isCaptured = false;
    this._inHolePull = false;
    this._speedBeforeHole = 0;
    this._accelBoostRemaining = 0;
    const speed = Inkball.BALL_AXIS_SPEED;
    this.vx = Math.random() < 0.5 ? speed : -speed;
    this.vy = Math.random() < 0.5 ? speed : -speed;
  }

  cruiseSpeed() {
    return Math.hypot(Inkball.BALL_AXIS_SPEED, Inkball.BALL_AXIS_SPEED);
  }

  setSpeedMagnitude(speed) {
    const mag = Math.hypot(this.vx, this.vy);
    if (mag < 1e-6) {
      this.vx = Inkball.BALL_AXIS_SPEED;
      this.vy = Inkball.BALL_AXIS_SPEED;
      return;
    }
    this.vx = (this.vx / mag) * speed;
    this.vy = (this.vy / mag) * speed;
  }

  tickAccelBoost(dt) {
    dt = Inkball.stepDt(dt);
    if (this._accelBoostRemaining <= 0) return;
    this._accelBoostRemaining -= dt;
    if (this._accelBoostRemaining > 0 || this._inHolePull) return;
    this._accelBoostRemaining = 0;
    this.setSpeedMagnitude(this.cruiseSpeed());
  }

  update(level, dt) {
    if (this.isCaptured) return;
    dt = Inkball.stepDt(dt);

    this.tickAccelBoost(dt);
    this.checkCollisionsWithWalls(level, dt);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.checkCollisionWithLines(level.lines, dt);
    level.applyOverlaps(this, dt);

    if (this.x <= 0 || this.x >= Inkball.WIDTH - this.size) {
      this.vx = -this.vx;
    }
    if (this.y <= Inkball.TOPBAR_HEIGHT || this.y >= Inkball.HEIGHT - this.size) {
      this.vy = -this.vy;
    }
    this.checkAttractionToHoles(level, dt);
  }

  setSizeKeepCenter(size) {
    const cx = this.x + this.size / 2;
    const cy = this.y + this.size / 2;
    this.size = size;
    this.x = cx - size / 2;
    this.y = cy - size / 2;
  }

  checkCollisionsWithWalls(level, dt) {
    dt = Inkball.stepDt(dt);
    const radius = this.collisionRadius;
    const centerX = this.x + this.size / 2;
    const centerY = this.y + this.size / 2;
    const nextCenterX = centerX + this.vx * dt;
    const nextCenterY = centerY + this.vy * dt;
    const gridX = Math.floor(centerX / Inkball.CELLSIZE);
    const gridY = Math.floor((centerY - Inkball.TOP_OFFSET) / Inkball.CELLSIZE);
    const hitTiles = new Set();

    if (!this._inGrid(level, gridX, gridY)) return;

    const westX = gridX * Inkball.CELLSIZE;
    const eastX = (gridX + 1) * Inkball.CELLSIZE;
    const northY = gridY * Inkball.CELLSIZE + Inkball.TOP_OFFSET;
    const southY = (gridY + 1) * Inkball.CELLSIZE + Inkball.TOP_OFFSET;

    const e = this._tileBlocks(level, gridX + 1, gridY);
    const w = this._tileBlocks(level, gridX - 1, gridY);
    const s = this._tileBlocks(level, gridX, gridY + 1);
    const n = this._tileBlocks(level, gridX, gridY - 1);
    const se = this._tileBlocks(level, gridX + 1, gridY + 1);
    const sw = this._tileBlocks(level, gridX - 1, gridY + 1);
    const ne = this._tileBlocks(level, gridX + 1, gridY - 1);
    const nw = this._tileBlocks(level, gridX - 1, gridY - 1);

    if (this.vx > 0 && e && nextCenterX + radius >= eastX) {
      this.vx = -this.vx;
      this._hitTileOnce(level, gridX + 1, gridY, hitTiles);
    } else if (this.vx < 0 && w && nextCenterX - radius <= westX) {
      this.vx = -this.vx;
      this._hitTileOnce(level, gridX - 1, gridY, hitTiles);
    }

    if (this.vy > 0 && s && nextCenterY + radius >= southY) {
      this.vy = -this.vy;
      this._hitTileOnce(level, gridX, gridY + 1, hitTiles);
    } else if (this.vy < 0 && n && nextCenterY - radius <= northY) {
      this.vy = -this.vy;
      this._hitTileOnce(level, gridX, gridY - 1, hitTiles);
    }

    if (!w && !n && nw) {
      this._checkCornerCollision(level, nextCenterX, nextCenterY, westX, northY, gridX - 1, gridY - 1, this.vx <= 0 && this.vy <= 0, hitTiles);
    }
    if (!e && !s && se) {
      this._checkCornerCollision(level, nextCenterX, nextCenterY, eastX, southY, gridX + 1, gridY + 1, this.vx >= 0 && this.vy >= 0, hitTiles);
    }
    if (!e && !n && ne) {
      this._checkCornerCollision(level, nextCenterX, nextCenterY, eastX, northY, gridX + 1, gridY - 1, this.vx >= 0 && this.vy <= 0, hitTiles);
    }
    if (!w && !s && sw) {
      this._checkCornerCollision(level, nextCenterX, nextCenterY, westX, southY, gridX - 1, gridY + 1, this.vx <= 0 && this.vy >= 0, hitTiles);
    }
  }

  _inGrid(level, gx, gy) {
    return gx >= 0 && gx < level.cols && gy >= 0 && gy < level.rows;
  }

  _tileBlocks(level, gx, gy) {
    return this._inGrid(level, gx, gy) && level.blocksMovement(this, gx, gy);
  }

  _hitTileOnce(level, gx, gy, hitTiles) {
    if (!this._inGrid(level, gx, gy)) return;
    const key = `${gx},${gy}`;
    if (hitTiles.has(key)) return;
    hitTiles.add(key);
    level.hitTile(this, gx, gy);
  }

  _checkCornerCollision(level, nextCenterX, nextCenterY, cornerX, cornerY, tileX, tileY, directReflect, hitTiles) {
    const radius = this.collisionRadius;
    const dx = nextCenterX - cornerX;
    const dy = nextCenterY - cornerY;
    if (dx * dx + dy * dy > radius * radius) return;
    this.reflectCorner(directReflect);
    this._hitTileOnce(level, tileX, tileY, hitTiles);
  }

  reflectCorner(direct) {
    if (direct) {
      const newVx = -this.vy;
      const newVy = -this.vx;
      this.vx = newVx;
      this.vy = newVy;
      return;
    }
    const tempVx = Math.abs(this.vx);
    const tempVy = Math.abs(this.vy);
    this.vx = Math.sign(this.vx || 1) * tempVy;
    this.vy = Math.sign(this.vy || 1) * tempVx;
  }

  checkCollisionWithLines(lines, dt) {
    dt = Inkball.stepDt(dt);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const points = line.getPoints();
      for (let j = 0; j < points.length - 1; j++) {
        const p1 = points[j];
        const p2 = points[j + 1];
        if (this.collidesWithLineSegment(p1, p2, dt)) {
          this.reflectVelocity(p1, p2);
          lines.splice(i, 1);
          return;
        }
      }
    }
  }

  collidesWithLineSegment(p1, p2, dt) {
    // A long, sparsely sampled stroke must not create a wide elliptical hit
    // area. Test the actual distance from the ball to the drawn segment.
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;
    const centerX = this.x + this.size / 2;
    const centerY = this.y + this.size / 2;
    const t = lengthSquared
      ? Math.max(0, Math.min(1, ((centerX - p1.x) * dx + (centerY - p1.y) * dy) / lengthSquared))
      : 0;
    const deltaX = centerX - (p1.x + t * dx);
    const deltaY = centerY - (p1.y + t * dy);
    const reach = this.size / 2 + Inkball.LINE_THICKNESS / 2;
    return deltaX * deltaX + deltaY * deltaY <= reach * reach;
  }

  reflectVelocity(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    let n1 = { x: -dy, y: dx };
    let n2 = { x: dy, y: -dx };
    const mag1 = Math.hypot(n1.x, n1.y) || 1;
    const mag2 = Math.hypot(n2.x, n2.y) || 1;
    n1 = { x: n1.x / mag1, y: n1.y / mag1 };
    n2 = { x: n2.x / mag2, y: n2.y / mag2 };

    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const ballCenter = { x: this.x + this.size / 2, y: this.y + this.size / 2 };
    const np1 = { x: mid.x + n1.x, y: mid.y + n1.y };
    const np2 = { x: mid.x + n2.x, y: mid.y + n2.y };
    const distToNormal1 = Math.hypot(np1.x - ballCenter.x, np1.y - ballCenter.y);
    const distToNormal2 = Math.hypot(np2.x - ballCenter.x, np2.y - ballCenter.y);
    const n = distToNormal1 < distToNormal2 ? n1 : n2;

    const v = { x: this.vx, y: this.vy };
    const dot = v.x * n.x + v.y * n.y;
    this.vx = v.x - 2 * dot * n.x;
    this.vy = v.y - 2 * dot * n.y;
  }

  checkAttractionToHoles(level, dt) {
    dt = Inkball.stepDt(dt);
    const ticks = dt * Inkball.DESIGN_HZ;
    let nearestHole = null;
    let minDistance = Infinity;
    const ballCenter = { x: this.x + this.size / 2, y: this.y + this.size / 2 };

    for (const hole of level.holes) {
      if (hole.disabled) continue;
      const holeCenter = hole.getCenter();
      const distance = Math.hypot(ballCenter.x - holeCenter.x, ballCenter.y - holeCenter.y);
      if (distance <= 32 && distance < minDistance) {
        minDistance = distance;
        nearestHole = hole;
      }
    }

    if (nearestHole) {
      if (!this._inHolePull) {
        this._inHolePull = true;
        this._speedBeforeHole = Math.max(Math.hypot(this.vx, this.vy), this.cruiseSpeed());
      }
      const damp = Math.pow(Inkball.HOLE_DAMP_PER_TICK, ticks);
      this.vx *= damp;
      this.vy *= damp;
      const holeCenter = nearestHole.getCenter();
      const pull = Inkball.HOLE_PULL_PER_TICK * Inkball.DESIGN_HZ * ticks;
      this.vx += (holeCenter.x - ballCenter.x) * pull;
      this.vy += (holeCenter.y - ballCenter.y) * pull;
      this.setSizeKeepCenter(20 * (minDistance / 32));

      if (minDistance <= 5) {
        this.isCaptured = true;
        this.handleBallCaptured(level, nearestHole);
      }
    } else {
      if (this._inHolePull) {
        this._inHolePull = false;
        this.setSizeKeepCenter(20);
        this._restoreSpeedAfterHole();
      } else {
        this.setSizeKeepCenter(20);
      }
    }
  }

  releaseFromDisabledHole(hole) {
    if (this.isCaptured) return;
    const center = hole.getCenter();
    const bx = this.x + this.size / 2;
    const by = this.y + this.size / 2;
    const dx = bx - center.x;
    const dy = by - center.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 32) return;
    if (!this._inHolePull && this.size >= 20) return;

    this._inHolePull = false;
    this.setSizeKeepCenter(20);
    const cruise = this.cruiseSpeed();
    const speed = this._accelBoostRemaining > 0
      ? Math.max(this._speedBeforeHole || 0, cruise)
      : cruise;
    let nx = dx;
    let ny = dy;
    let mag = dist;
    if (mag < 1e-6) {
      nx = -this.vx;
      ny = -this.vy;
      mag = Math.hypot(nx, ny);
    }
    if (mag < 1e-6) {
      nx = 1;
      ny = 0;
      mag = 1;
    }
    this.vx = (nx / mag) * speed;
    this.vy = (ny / mag) * speed;
  }

  _restoreSpeedAfterHole() {
    const cruise = this.cruiseSpeed();
    const speed = this._accelBoostRemaining > 0
      ? Math.max(this._speedBeforeHole || 0, cruise)
      : cruise;
    this.setSpeedMagnitude(speed);
  }

  handleBallCaptured(level, hole) {
    const holeColorIndex = hole.getColorIndex();
    const ballColorIndex = this.colorIndex;
    let success = false;

    if (holeColorIndex === 0 || ballColorIndex === 0) {
      success = true;
    } else if (holeColorIndex === ballColorIndex) {
      success = true;
    }

    const colorName = this.colorIndexToColorName(ballColorIndex);
    const app = (level && level.app) || this.app;
    if (success) {
      if (app && typeof app.recordCapture === 'function') {
        app.recordCapture(true);
      } else if (app) {
        app.correctCaptures = (app.correctCaptures || 0) + 1;
      }
      const table = app && app.config && app.config.score_increase_from_hole_capture;
      const baseScore = table ? table[colorName] : 0;
      app.score += Math.round((baseScore || 0) * level.scoreIncreaseModifier);
    } else {
      if (app && typeof app.recordCapture === 'function') {
        app.recordCapture(false);
      } else if (app) {
        app.wrongCaptures = (app.wrongCaptures || 0) + 1;
      }
      const table = app && app.config && app.config.score_decrease_from_wrong_hole;
      const baseScore = table ? table[colorName] : 0;
      app.score -= Math.round((baseScore || 0) * level.scoreDecreaseModifier);
      level.ballsYetToSpawn.push(colorName);
      if (app && app.dashboard) app.dashboard.onBallsYetToSpawnChanged();
    }

    level.ballsToRemove.push(this);
  }

  colorIndexToColorName(index) {
    switch (index) {
      case 0: return 'grey';
      case 1: return 'orange';
      case 2: return 'blue';
      case 3: return 'green';
      case 4: return 'yellow';
      default: return 'grey';
    }
  }

  draw(ctx) {
    if (this.isCaptured) return;
    const img = this.app.ballImages[this.colorIndex];
    if (img && typeof Inkball.drawBallImage === 'function') {
      Inkball.drawBallImage(ctx, img, this.x, this.y, this.size);
    } else if (img) {
      ctx.drawImage(img, this.x, this.y, this.size, this.size);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};
