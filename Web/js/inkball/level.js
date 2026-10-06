window.Inkball = window.Inkball || {};

Inkball.LevelElement = class LevelElement {
  constructor(type, x, y, width = 1, height = 1) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  draw(ctx, app) {
    const px = this.x * Inkball.CELLSIZE;
    const py = this.y * Inkball.CELLSIZE + Inkball.TOP_OFFSET;
    const w = this.width * Inkball.CELLSIZE;
    const h = this.height * Inkball.CELLSIZE;
    let img = null;

    if (this.type.startsWith('wall')) {
      const index = parseInt(this.type.substring(4), 10);
      img = app.wallImages[index];
    } else if (this.type === 'spawner') {
      img = app.spawnerImage;
    } else if (this.type === 'tile') {
      img = app.tileImage;
    }

    if (img) {
      ctx.drawImage(img, px, py, w, h);
    }
  }
};

Inkball.Level = class Level {
  constructor(app, levelConfig, layoutText) {
    this.app = app;
    this.levelConfig = levelConfig;
    this.layoutText = layoutText;
    this.layoutFilename = levelConfig.layout;

    const rawTime = Number(levelConfig.time);
    this.time = Number.isFinite(rawTime) && rawTime > 0 ? rawTime : -1;
    const rawSpawn = Number(levelConfig.spawn_interval);
    this.spawnInterval = Number.isFinite(rawSpawn) && rawSpawn > 0 ? rawSpawn : 0;
    this.scoreIncreaseModifier = levelConfig.score_increase_from_hole_capture_modifier;
    this.scoreDecreaseModifier = levelConfig.score_decrease_from_wrong_hole_modifier;
    this.timedTileLifetime =
      typeof levelConfig.timed_tile_lifetime_seconds === 'number' &&
      levelConfig.timed_tile_lifetime_seconds > 0
        ? levelConfig.timed_tile_lifetime_seconds
        : Inkball.DEFAULT_TIMED_TILE_SECONDS;

    this.ballsToSpawn = [];
    this.ballsYetToSpawn = [];
    this.ballsSpawnedCount = 0;
    const balls = levelConfig.balls || [];
    for (let i = 0; i < balls.length; i++) {
      this.ballsToSpawn.push(balls[i]);
      this.ballsYetToSpawn.push(balls[i]);
    }

    this.spawnTimer = this.spawnInterval;
    this.levelTimer = this.time > 0 ? this.time : -1;
    this.timeUp = false;

    const layoutLines = layoutText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    while (layoutLines.length && layoutLines[layoutLines.length - 1] === '') {
      layoutLines.pop();
    }

    this.rows = Math.max(layoutLines.length, 18);
    this.cols = 18;
    this.pairMode = layoutLines.some(function (line) {
      return line.length > 18;
    });
    this.grid = [];
    this.cellAttr = [];

    for (let i = 0; i < this.rows; i++) {
      const line = layoutLines[i] || '';
      const row = [];
      const attrRow = [];
      for (let j = 0; j < this.cols; j++) {
        if (this.pairMode) {
          row.push(line.charAt(j * 2) || ' ');
          attrRow.push(line.charAt(j * 2 + 1) || ' ');
        } else {
          row.push(j < line.length ? line.charAt(j) : ' ');
          attrRow.push(' ');
        }
      }
      this.grid.push(row);
      this.cellAttr.push(attrRow);
    }

    while (this.grid.length < 18) {
      this.grid.push(Array(this.cols).fill(' '));
      this.rows = this.grid.length;
    }

    for (let j = 0; j < this.cols; j++) {
      if (this.grid[0][j] === ' ' || !this.grid[0][j]) this.grid[0][j] = 'X';
      if (this.grid[this.rows - 1][j] === ' ' || !this.grid[this.rows - 1][j]) {
        this.grid[this.rows - 1][j] = 'X';
      }
    }
    for (let i = 0; i < this.rows; i++) {
      if (this.grid[i][0] === ' ' || !this.grid[i][0]) this.grid[i][0] = 'X';
      if (this.grid[i][this.cols - 1] === ' ' || !this.grid[i][this.cols - 1]) {
        this.grid[i][this.cols - 1] = 'X';
      }
    }

    this.elements = [];
    this.holes = [];
    this.ballsInGame = [];
    this.ballsToRemove = [];
    this.nextBallSyncId = 1;
    this.lines = [];
    this.spawners = [];
    this.extTiles = [];
    this.tileAt = [];
    for (let i = 0; i < this.rows; i++) {
      this.tileAt.push(new Array(this.cols).fill(null));
    }

    this._parseLayout();
  }

  _placeTile(tile) {
    this.extTiles.push(tile);
    this.tileAt[tile.gy][tile.gx] = tile;
  }

  _placeColoredSpecial(token, color, j, i) {
    this.elements.push(new Inkball.LevelElement('tile', j, i));
    if (token === 'C') this._placeTile(new Inkball.ColourGateTile(j, i, color));
    else if (token === 'Y') this._placeTile(new Inkball.KeyWallTile(j, i, color));
    else if (token === 'V') this._placeTile(new Inkball.KeyActivatorTile(j, i, color));
    else if (token === 'G') this._placeTile(new Inkball.HoleGateTile(j, i, color));
    else if (token === 'K') this._placeTile(new Inkball.BrickTile(j, i, color));
  }

  _createBall(colorIndex, x, y) {
    const ball = new Inkball.Ball(this.app, colorIndex, x, y);
    ball.syncId = this.nextBallSyncId++;
    return ball;
  }

  _consume(j, i) {
    this.grid[i][j] = ' ';
  }

  _peekDigit(j, i) {
    if (j + 1 >= this.cols) return null;
    const c = this.grid[i][j + 1];
    if (c >= '0' && c <= '4') return c;
    return null;
  }

  _digitAttr(j, i) {
    if (this.pairMode) {
      const a = this.cellAttr[i] && this.cellAttr[i][j];
      if (a >= '0' && a <= '4') return a;
      return null;
    }
    return this._peekDigit(j, i);
  }

  _consumeDigitAttr(j, i) {
    if (this.pairMode) return;
    if (this._peekDigit(j, i) != null) this._consume(j + 1, i);
  }

  _colorIndexAttr(j, i, fallback) {
    const d = this._digitAttr(j, i);
    if (d == null) return fallback;
    return parseInt(d, 10);
  }

  _parseLayout() {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const cell = this.grid[i][j];
        if (cell === ' ' || cell === '\0') {
          if (!this.tileAt[i][j]) {
            this.elements.push(new Inkball.LevelElement('tile', j, i));
          }
          continue;
        }

        switch (cell) {
          case 'X': {
            this._placeTile(new Inkball.WallTile(j, i, 0));
            break;
          }
          case '1':
          case '2':
          case '3':
          case '4': {
            this._placeTile(new Inkball.WallTile(j, i, parseInt(cell, 10)));
            break;
          }
          case 'S': {
            const spawner = new Inkball.LevelElement('spawner', j, i);
            this.elements.push(spawner);
            this.spawners.push(spawner);
            break;
          }
          case 'H':
            if (j + 1 < this.cols && i + 1 < this.rows) {
              const colorChar = this.pairMode
                ? this._digitAttr(j, i) || '0'
                : this.grid[i][j + 1];
              let holeIndex = parseInt(colorChar, 10);
              if (!(holeIndex >= 0 && holeIndex <= 4)) holeIndex = 0;
              const hole = new Inkball.Hole(
                this.app,
                holeIndex,
                j * Inkball.CELLSIZE,
                i * Inkball.CELLSIZE + Inkball.TOP_OFFSET
              );
              this.holes.push(hole);
              if (!this.pairMode) {
                this._consume(j + 1, i);
                this._consume(j, i + 1);
                this._consume(j + 1, i + 1);
              }
            }
            break;
          case 'B': {
            const d = this._digitAttr(j, i);
            const ballIndex = d != null ? parseInt(d, 10) : 0;
            const ball = this._createBall(
              ballIndex,
              j * Inkball.CELLSIZE,
              i * Inkball.CELLSIZE + Inkball.TOP_OFFSET
            );
            this.ballsInGame.push(ball);
            this.elements.push(new Inkball.LevelElement('tile', j, i));
            this._consumeDigitAttr(j, i);
            break;
          }
          case 'K': {
            const color = this._colorIndexAttr(j, i, 0);
            this._consumeDigitAttr(j, i);
            this.elements.push(new Inkball.LevelElement('tile', j, i));
            this._placeTile(new Inkball.BrickTile(j, i, color));
            break;
          }
          case 'U':
          case 'D':
          case 'L':
          case 'R': {
            const d = this._digitAttr(j, i);
            let color = 0;
            if (d != null) {
              color = parseInt(d, 10);
              this._consumeDigitAttr(j, i);
            }
            this.elements.push(new Inkball.LevelElement('tile', j, i));
            this._placeTile(new Inkball.OneWayTile(j, i, cell, color));
            break;
          }
          case 'C': {
            const color = this._colorIndexAttr(j, i, 0);
            this._consumeDigitAttr(j, i);
            this.elements.push(new Inkball.LevelElement('tile', j, i));
            this._placeTile(new Inkball.ColourGateTile(j, i, color));
            break;
          }
          case 'T': {
            this.elements.push(new Inkball.LevelElement('tile', j, i));
            const seconds = this.pairMode
              ? Inkball.decodeTimedSeconds(this.cellAttr[i][j], this.timedTileLifetime)
              : this.timedTileLifetime;
            this._placeTile(new Inkball.TimedTile(j, i, seconds));
            break;
          }
          case 'A': {
            if (this.pairMode) {
              const a = (this.cellAttr[i][j] || '').toLowerCase();
              let dir = null;
              if (a === 'u') dir = 'U';
              else if (a === 'd') dir = 'D';
              else if (a === 'l') dir = 'L';
              else if (a === 'r') dir = 'R';
              this.elements.push(new Inkball.LevelElement('tile', j, i));
              if (dir) this._placeTile(new Inkball.AccelTile(j, i, dir));
              break;
            }
            if (j + 1 < this.cols) {
              const dirChar = this.grid[i][j + 1];
              let dir = null;
              if (dirChar === 'u' || dirChar === 'U') dir = 'U';
              else if (dirChar === 'd' || dirChar === 'D') dir = 'D';
              else if (dirChar === 'l' || dirChar === 'L') dir = 'L';
              else if (dirChar === 'r' || dirChar === 'R') dir = 'R';
              if (dir) {
                this._consume(j + 1, i);
                this.elements.push(new Inkball.LevelElement('tile', j, i));
                this._placeTile(new Inkball.AccelTile(j, i, dir));
                break;
              }
            }
            this.elements.push(new Inkball.LevelElement('tile', j, i));
            break;
          }
          case 'u':
          case 'd':
          case 'l':
          case 'r': {
            this.elements.push(new Inkball.LevelElement('tile', j, i));
            this._placeTile(new Inkball.AccelTile(j, i, cell.toUpperCase()));
            break;
          }
          case 'Y': {
            const group = this._colorIndexAttr(j, i, 0);
            this._consumeDigitAttr(j, i);
            this.elements.push(new Inkball.LevelElement('tile', j, i));
            this._placeTile(new Inkball.KeyWallTile(j, i, group));
            break;
          }
          case 'V': {
            const group = this._colorIndexAttr(j, i, 0);
            this._consumeDigitAttr(j, i);
            this.elements.push(new Inkball.LevelElement('tile', j, i));
            this._placeTile(new Inkball.KeyActivatorTile(j, i, group));
            break;
          }
          case 'G': {
            const group = this._colorIndexAttr(j, i, 0);
            this._consumeDigitAttr(j, i);
            this.elements.push(new Inkball.LevelElement('tile', j, i));
            this._placeTile(new Inkball.HoleGateTile(j, i, group));
            break;
          }
          default: {
            const packed = Inkball.unpackColorCell && Inkball.unpackColorCell(cell);
            if (packed) {
              this._placeColoredSpecial(packed.token, packed.color, j, i);
              break;
            }
            this.elements.push(new Inkball.LevelElement('tile', j, i));
            break;
          }
        }
      }
    }
  }

  getTile(gx, gy) {
    if (gy < 0 || gy >= this.rows || gx < 0 || gx >= this.cols) return null;
    const t = this.tileAt[gy][gx];
    if (t && t.removed) return null;
    return t;
  }

  blocksMovement(ball, gx, gy) {
    const t = this.getTile(gx, gy);
    if (!t) return false;
    return !!t.solidFor(ball);
  }

  hitTile(ball, gx, gy) {
    const t = this.getTile(gx, gy);
    if (!t) return;
    if (typeof t.onBallHit === 'function') t.onBallHit(ball, this);
  }

  applyOverlaps(ball, dt) {
    const gx = Math.floor((ball.x + ball.size / 2) / Inkball.CELLSIZE);
    const gy = Math.floor((ball.y + ball.size / 2 - Inkball.TOP_OFFSET) / Inkball.CELLSIZE);
    const t = this.getTile(gx, gy);
    if (t && typeof t.onBallOverlap === 'function') {
      t.onBallOverlap(ball, this, dt);
    }
  }

  toggleKeyWalls(group) {
    for (const t of this.extTiles) {
      if (t instanceof Inkball.KeyWallTile && !t.removed && t.group === group) {
        t.toggle();
      }
    }
  }

  toggleHoles(group) {
    for (const hole of this.holes) {
      if (group === 0 || hole.colorIndex === group) {
        hole.disabled = !hole.disabled;
        if (hole.disabled) {
          for (const ball of this.ballsInGame) {
            ball.releaseFromDisabledHole(hole);
          }
        }
      }
    }
  }

  update(dt) {
    if (this.app.isLevelEnded || this.app.isGameEnded) return;
    dt = Inkball.stepDt(dt);

    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
    } else {
      this.spawnNextBall();
      this.spawnTimer = this.spawnInterval;
    }

    if (this.levelTimer > 0 && !this.app._usesWallClockTimer) {
      this.levelTimer -= dt;
      if (this.levelTimer <= 0) {
        this.levelTimer = 0;
        this.app.isLevelEnded = true;
        this.timeUp = true;
      }
    }

    for (const t of this.extTiles) {
      if (!t.removed && typeof t.update === 'function') t.update(dt, this);
    }

    // Clear removed tiles from lookup so balls can pass
    for (const t of this.extTiles) {
      if (t.removed && this.tileAt[t.gy] && this.tileAt[t.gy][t.gx] === t) {
        this.tileAt[t.gy][t.gx] = null;
      }
    }

    for (const ball of this.ballsInGame) {
      ball.update(this, dt);
    }
    const physics = window.InkballBallPhysics;
    if (physics && typeof physics.resolveAll === 'function') {
      physics.resolveAll(this.ballsInGame, this.holes);
    }

    if (this.ballsToRemove.length) {
      this.ballsInGame = this.ballsInGame.filter((b) => !this.ballsToRemove.includes(b));
      this.ballsToRemove = [];
    }

    if (!this.timeUp && this.ballsInGame.length === 0 && this.ballsYetToSpawn.length === 0) {
      this.app.isLevelEnded = true;
      if (this.levelTimer > 0) {
        const timeBonusUnits = Math.floor(this.levelTimer / Inkball.TIME_BONUS_SECONDS);
        this.app.score += timeBonusUnits;
      }
    }
  }

  draw(ctx) {
    for (const element of this.elements) {
      element.draw(ctx, this.app);
    }
    for (const t of this.extTiles) {
      if (!t.removed) t.draw(ctx, this.app);
    }
    for (const hole of this.holes) {
      hole.draw(ctx);
    }
    for (const ball of this.ballsInGame) {
      ball.draw(ctx);
    }
    for (const line of this.lines) {
      line.draw(ctx);
    }
  }

  spawnNextBall() {
    if (this.ballsYetToSpawn.length === 0 || this.spawners.length === 0) return;
    const color = this.ballsYetToSpawn.shift();
    const ballIndex = this.colorStringToIndex(color);
    const spawner = this.spawners[Math.floor(Math.random() * this.spawners.length)];
    const spawnX = spawner.x * Inkball.CELLSIZE;
    const spawnY = spawner.y * Inkball.CELLSIZE + Inkball.TOP_OFFSET;
    this.ballsInGame.push(this._createBall(ballIndex, spawnX, spawnY));
    this.ballsSpawnedCount++;
    this.app.dashboard.onBallSpawned();
  }

  colorCharToIndex(c) {
    switch (c) {
      case '0': return 0;
      case '1': return 1;
      case '2': return 2;
      case '3': return 3;
      case '4': return 4;
      default: return 0;
    }
  }

  colorStringToIndex(color) {
    switch (String(color).toLowerCase()) {
      case 'grey': return 0;
      case 'orange': return 1;
      case 'blue': return 2;
      case 'green': return 3;
      case 'yellow': return 4;
      default: return 0;
    }
  }

  getWallGrid() {
    return this.grid;
  }

  removeLineAtPosition(x, y) {
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].containsPoint(x, y)) {
        this.lines.splice(i, 1);
        break;
      }
    }
  }
};
