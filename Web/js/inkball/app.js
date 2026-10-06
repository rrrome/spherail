window.Inkball = window.Inkball || {};

function chooseLevelSource(boot) {
  const inline = !!(
    boot && boot.inlineConfig && boot.level &&
    typeof boot.level.layout_content === 'string'
  );
  return {
    config: inline ? boot.inlineConfig : null,
    layout: inline ? boot.level.layout_content : null,
    fetchConfig: !inline,
    fetchLayout: !inline,
  };
}

function requiredTileSprites(layoutText, levelConfig) {
  const directions = ['U', 'D', 'L', 'R'];
  const everyColor = new Set([0, 1, 2, 3, 4]);
  if (!layoutText) {
    return {
      bricks: true, oneWay: new Set(directions), accelerators: new Set(directions),
      balls: everyColor, holes: everyColor,
    };
  }
  const oneWay = new Set();
  const accelerators = new Set();
  const balls = new Set(everyColor);
  const holes = new Set([0]);
  const colorNames = ['grey', 'orange', 'blue', 'green', 'yellow'];
  const queuedBalls = levelConfig && Array.isArray(levelConfig.balls) ? levelConfig.balls : [];
  queuedBalls.forEach((name) => {
    balls.add(Math.max(0, colorNames.indexOf(String(name).toLowerCase())));
  });
  const pairMode = Inkball.isPairLayout(layoutText);
  let bricks = false;
  layoutText.replace(/\r\n?/g, '\n').split('\n').forEach((row) => {
    for (let col = 0; col < 18; col++) {
      const index = pairMode ? col * 2 : col;
      const cell = row.charAt(index);
      const attr = row.charAt(index + 1);
      const packed = Inkball.unpackColorCell && Inkball.unpackColorCell(cell);
      const color = attr >= '0' && attr <= '4' ? Number(attr) : 0;
      if (cell === 'B') balls.add(color);
      if (cell === 'H') holes.add(color);
      if (cell === 'K' || (packed && packed.token === 'K')) bricks = true;
      if (directions.includes(cell)) oneWay.add(cell);
      if (cell && 'udlr'.includes(cell)) accelerators.add(cell.toUpperCase());
      if (cell === 'A' && attr && 'udlrUDLR'.includes(attr)) accelerators.add(attr.toUpperCase());
    }
  });
  return { bricks: bricks, oneWay: oneWay, accelerators: accelerators, balls: balls, holes: holes };
}

function completionTarget(boot, endpoints) {
  if (boot && boot.communityRun) {
    return endpoints && typeof endpoints.communityRunCompleteUrl === 'function'
      ? endpoints.communityRunCompleteUrl(boot.communityRun)
      : '';
  }
  if (boot && boot.match && boot.match.community) return '';
  if (boot && boot.fromEditor) return '';
  return boot && boot.authenticated && endpoints ? endpoints.sessions || '' : '';
}

function attemptPayload(app, cleared, duration) {
  return {
    map: app.boot.map,
    difficulty: app.boot.difficulty,
    status: cleared ? 'completed' : 'failed',
    score: app.score,
    duration_seconds: duration,
    correct_captures: app.correctCaptures || 0,
    wrong_captures: app.wrongCaptures || 0,
    lines_drawn: app.linesDrawn || 0,
  };
}

window.InkballCommunityGame = {
  chooseLevelSource: chooseLevelSource,
  completionTarget: completionTarget,
  attemptPayload: attemptPayload,
};

Inkball.App = class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pixelRatio = Inkball.configureCanvas(canvas, this.ctx);
    this.frameCount = 0;
    this.currentLine = null;
    this.drawTool = 'draw';

    this.config = null;
    this.boot = null;
    this.currentLevel = null;
    this.layoutCache = {};

    this.wallImages = [];
    this.brickImages = [];
    this.ballImages = [];
    this.holeImages = [];
    this.spawnerImage = null;
    this.tileImage = null;
    this.oneWayImages = {};
    this.acceleratorImages = {};

    this.score = 0;
    this.correctCaptures = 0;
    this.wrongCaptures = 0;
    this.linesDrawn = 0;
    this.startedAt = 0;
    this._resultSent = false;
    this.isPaused = false;
    this.isLevelEnded = false;
    this.isGameEnded = false;
    this.levelCompleteFrames = 0;

    this.dashboard = null;
    this.matchSync = null;
    this.movingTile1 = null;
    this.movingTile2 = null;
    this.movingTilesActive = false;
    this.movingTileTimer = 0;

    this._boundLoop = this._loop.bind(this);
    this._rafId = null;
    this._lastFrameTime = 0;
    this._allowUnload = false;
    this._completionFailed = false;
  }

  async init() {
    const bootNode = document.getElementById('inkball-play');
    if (!bootNode) throw new Error('Missing play configuration');
    this.boot = JSON.parse(bootNode.textContent);
    if (!this.boot.level || !this.boot.level.layout) {
      throw new Error('Play configuration is missing a level.');
    }

    this.levelSource = chooseLevelSource(this.boot);
    await this._loadImages(this.levelSource.layout, this.boot.level);
    if (this.levelSource.fetchConfig) {
      let configUrl = window.INKBALL_API.config;
      if (this.boot.map && this.boot.difficulty && configUrl.indexOf('map=') === -1) {
        configUrl += (configUrl.indexOf('?') === -1 ? '?' : '&');
        configUrl += 'map=' + encodeURIComponent(this.boot.map);
        configUrl += '&difficulty=' + encodeURIComponent(this.boot.difficulty);
      }
      const configRes = await fetch(configUrl, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!configRes.ok) throw new Error('Failed to load config');
      this.config = await configRes.json();
    } else {
      this.config = this.levelSource.config;
    }
    if (!this.config.levels || !this.config.levels.length) {
      this.config.levels = [this.boot.level];
    }

    this.dashboard = new Inkball.Dashboard(this);
    this._bindPauseMenu();
    this._syncPauseUi();
    await this.startAttempt();
    if (this.boot.match && this.boot.match.own_snapshot) {
      this.restoreMatchSnapshot(this.boot.match.own_snapshot);
    }
    this._bindInput();
    this._bindLeaveGuard();
    this._lastFrameTime = performance.now();
    this._rafId = requestAnimationFrame(this._boundLoop);
    if (this.boot.match && window.InkballMatchSync) {
      this.matchSync = new window.InkballMatchSync(this);
      this.matchSync.start();
    }
  }

  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load ' + src));
      img.src = src;
    });
  }

  async _loadImages(layoutText, levelConfig) {
    const sprites = window.INKBALL_SPRITES;
    const directions = ['U', 'D', 'L', 'R'];
    const needed = requiredTileSprites(layoutText, levelConfig);
    const [
      wallImages,
      brickImages,
      ballImages,
      holeImages,
      spawnerImage,
      tileImage,
      oneWayImages,
      acceleratorImages,
    ] = await Promise.all([
      Promise.all(sprites.walls.map((url) => this._loadImage(url))),
      Promise.all(
        (sprites.bricks || []).map((frames) =>
          needed.bricks ? Promise.all(frames.map((url) => this._loadImage(url))) : []
        )
      ),
      Promise.all(sprites.balls.map((url, index) =>
        needed.balls.has(index) ? this._loadImage(url) : null)),
      Promise.all(sprites.holes.map((url, index) =>
        needed.holes.has(index) ? this._loadImage(url) : null)),
      this._loadImage(sprites.entrypoint),
      this._loadImage(sprites.tile),
      Promise.all(
        directions.map((dir) =>
          needed.oneWay.has(dir)
            ? Promise.all(sprites.one_way[dir].map((url) => this._loadImage(url))) : []
        )
      ),
      Promise.all(
        directions.map((dir) =>
          needed.accelerators.has(dir) ? this._loadImage(sprites.accelerators[dir]) : null
        )
      ),
    ]);
    this.keyWallImages = await Promise.all(sprites.key_walls.map((url) => this._loadImage(url)));
    this.wallImages = wallImages;
    this.brickImages = brickImages;
    this.ballImages = ballImages;
    this.holeImages = holeImages;
    this.spawnerImage = spawnerImage;
    this.tileImage = tileImage;
    directions.forEach((dir, index) => {
      this.oneWayImages[dir] = oneWayImages[index];
      this.acceleratorImages[dir] = acceleratorImages[index];
    });
  }

  async _fetchLayout(filename) {
    if (this.levelSource && !this.levelSource.fetchLayout) return this.levelSource.layout;
    if (this.layoutCache[filename]) return this.layoutCache[filename];
    const cachedLayout = window.InkballOfficialResources &&
      typeof window.InkballOfficialResources.layoutFor === "function" &&
      window.InkballOfficialResources.layoutFor(filename);
    if (cachedLayout) {
      this.layoutCache[filename] = cachedLayout;
      return cachedLayout;
    }
    const res = await fetch(window.INKBALL_API.levelUrl(filename), {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) throw new Error('Failed to load level ' + filename);
    const data = await res.json();
    const text = typeof data.content === 'string' ? data.content : '';
    this.layoutCache[filename] = text;
    return text;
  }

  async startAttempt() {
    const levelConfig = this.boot.level;
    const layoutText = await this._fetchLayout(levelConfig.layout);
    this.currentLevel = new Inkball.Level(this, levelConfig, layoutText);
    this.score = 0;
    this.correctCaptures = 0;
    this.wrongCaptures = 0;
    this.linesDrawn = 0;
    this.startedAt = Date.now();
    this._resultSent = false;
    this._completionFailed = false;
    this.isLevelEnded = false;
    this.isPaused = false;
    this.isGameEnded = false;
    this.levelCompleteFrames = 0;
    this.movingTilesActive = false;
    this.currentLine = null;
    this.dashboard.reset();
    this._syncPauseUi();
  }

  recordCapture(success) {
    if (success) {
      this.correctCaptures += 1;
    } else {
      this.wrongCaptures += 1;
    }
  }

  commitCurrentLine() {
    const line = this.currentLine;
    this.currentLine = null;
    if (!line || !this.currentLevel || line.getPoints().length <= 1) return false;
    this.currentLevel.lines.push(line);
    this.linesDrawn += 1;
    return true;
  }

  async restartLevel() {
    await this.startAttempt();
  }

  createMatchSnapshot(status) {
    const level = this.currentLevel;
    const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
    const linePayload = (level && level.lines ? level.lines : []).map((line, index) => ({
      id: index,
      points: line.getPoints().map((point) => ({
        x: round(point.x),
        y: round(point.y),
      })),
    }));
    const balls = (level && level.ballsInGame ? level.ballsInGame : []).map((ball, index) => ({
      id: ball.syncId || index + 1,
      color: ball.colorIndex,
      x: round(ball.x),
      y: round(ball.y),
      vx: round(ball.vx),
      vy: round(ball.vy),
      size: round(ball.size),
      captured: !!ball.isCaptured,
      in_hole_pull: !!ball._inHolePull,
      speed_before_hole: round(ball._speedBeforeHole),
      accel_boost_remaining: round(ball._accelBoostRemaining),
    }));
    const timeLeft = level && level.levelTimer > 0
      ? Math.ceil(level.levelTimer)
      : 0;
    const duration = Math.max(0, Math.round((Date.now() - (this.startedAt || Date.now())) / 1000));

    return {
      status: status || (this.isPaused ? 'paused' : 'playing'),
      attempt_started_at: this.startedAt,
      frame: this.frameCount,
      score: this.score,
      time_left: timeLeft,
      balls_yet_to_spawn: level && Array.isArray(level.ballsYetToSpawn) ? level.ballsYetToSpawn.slice() : [],
      balls_spawned_count: level ? level.ballsSpawnedCount : 0,
      next_ball_sync_id: level ? level.nextBallSyncId : 1,
      spawn_timer: level ? Math.max(0, round(level.spawnTimer)) : 0,
      duration_seconds: duration,
      correct_captures: this.correctCaptures || 0,
      wrong_captures: this.wrongCaptures || 0,
      balls: balls,
      lines: linePayload,
      holes: level ? level.holes.map((hole) => ({ disabled: !!hole.disabled })) : [],
      tiles: level ? level.extTiles.map((tile) => ({
        gx: tile.gx,
        gy: tile.gy,
        removed: !!tile.removed,
        active: tile.active,
        enabled: tile.enabled,
        open: tile.open,
        timer: tile.timer,
        remaining: tile.remaining,
      })) : [],
      updated_at_client: Date.now(),
    };
  }

  restoreMatchSnapshot(record) {
    const snapshot = record && record.snapshot;
    const level = this.currentLevel;
    if (!snapshot || !level) return false;
    const elapsed = Math.max(0, Number(record.elapsed_since_save) || 0);
    this.score = Number(snapshot.score) || 0;
    this.correctCaptures = Number(snapshot.correct_captures) || 0;
    this.wrongCaptures = Number(snapshot.wrong_captures) || 0;
    this.linesDrawn = Array.isArray(snapshot.lines) ? snapshot.lines.length : 0;
    this.startedAt = Date.now() - (Math.max(0, Number(snapshot.duration_seconds) || 0) + elapsed) * 1000;
    this.frameCount = Math.max(0, Number(snapshot.frame) || 0);

    level.levelTimer = snapshot.time_left > 0
      ? Math.max(0, Number(snapshot.time_left) - elapsed)
      : Number(snapshot.time_left) || 0;
    level.spawnTimer = Math.max(0, Number(snapshot.spawn_timer) - elapsed);
    level.ballsYetToSpawn = Array.isArray(snapshot.balls_yet_to_spawn)
      ? snapshot.balls_yet_to_spawn.slice()
      : [];
    level.ballsSpawnedCount = Math.max(0, Number(snapshot.balls_spawned_count) || 0);
    level.nextBallSyncId = Math.max(1, Number(snapshot.next_ball_sync_id) || 1);

    level.lines = (Array.isArray(snapshot.lines) ? snapshot.lines : []).map((row) => {
      const line = new Inkball.Line();
      (row.points || []).forEach((point) => line.addPoint(Number(point.x) || 0, Number(point.y) || 0));
      return line;
    }).filter((line) => line.getPoints().length > 1);

    level.ballsInGame = (Array.isArray(snapshot.balls) ? snapshot.balls : []).map((row) => {
      const ball = new Inkball.Ball(this, Number(row.color) || 0, Number(row.x) || 0, Number(row.y) || 0);
      ball.syncId = Math.max(1, Number(row.id) || 1);
      ball.vx = Number(row.vx) || 0;
      ball.vy = Number(row.vy) || 0;
      ball.size = Number(row.size) || 20;
      ball.isCaptured = Boolean(row.captured);
      ball._inHolePull = Boolean(row.in_hole_pull);
      ball._speedBeforeHole = Number(row.speed_before_hole) || 0;
      ball._accelBoostRemaining = Math.max(0, Number(row.accel_boost_remaining) || 0);
      return ball;
    });
    level.ballsToRemove = [];

    (snapshot.holes || []).forEach((row, index) => {
      if (level.holes[index]) level.holes[index].disabled = Boolean(row.disabled);
    });
    (snapshot.tiles || []).forEach((row) => {
      const tile = level.extTiles.find((item) => item.gx === row.gx && item.gy === row.gy);
      if (!tile) return;
      ['active', 'enabled', 'open', 'timer', 'remaining'].forEach((key) => {
        if (row[key] !== undefined && row[key] !== null) tile[key] = row[key];
      });
      if (row.removed) {
        tile.removed = true;
        if (level.tileAt[tile.gy]) level.tileAt[tile.gy][tile.gx] = null;
      }
    });

    this.isPaused = false;
    this.isGameEnded = false;
    this.isLevelEnded = level.levelTimer === 0 && level.time > 0;
    level.timeUp = this.isLevelEnded;
    this.dashboard.reset();
    this._syncPauseUi();
    return true;
  }

  isWithinDrawArea(x, y) {
    return (
      x >= Inkball.DRAW_AREA_X_MIN &&
      x <= Inkball.DRAW_AREA_X_MAX &&
      y >= Inkball.DRAW_AREA_Y_MIN &&
      y <= Inkball.DRAW_AREA_Y_MAX
    );
  }

  _canvasPos(evt) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = Inkball.WIDTH / rect.width;
    const scaleY = Inkball.HEIGHT / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  }

  _bindInput() {
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('dragstart', (e) => e.preventDefault());

    let activePointerId = null;
    let activePointerType = null;
    let gesture = null;
    let ancestorWindows = [];
    const toolBar = typeof document !== 'undefined' && document.querySelector
      ? document.querySelector('[data-game-tools]')
      : null;
    const toolButtons = toolBar
      ? Array.prototype.slice.call(toolBar.querySelectorAll('[data-game-tool]'))
      : [];

    const localEventFromAncestor = (event) => {
      try {
        const chain = [];
        let child = window;
        while (child !== event.currentTarget && child.parent !== child) {
          chain.push(child);
          child = child.parent;
        }
        if (child !== event.currentTarget) return null;
        let x = event.clientX;
        let y = event.clientY;
        for (let i = chain.length - 1; i >= 0; i--) {
          const frame = chain[i].frameElement;
          if (!frame) return null;
          const rect = frame.getBoundingClientRect();
          if (!rect.width || !rect.height) return null;
          x = (x - rect.left) * (chain[i].innerWidth / rect.width);
          y = (y - rect.top) * (chain[i].innerHeight / rect.height);
        }
        return { pointerId: activePointerId, clientX: x, clientY: y };
      } catch (_) { return null; }
    };

    const finishFromAncestor = (event) => {
      if (activePointerType === 'mouse' &&
          ((event.type === 'mouseup' && event.buttons === 0) ||
            event.pointerId === activePointerId)) {
        finishDrawing(localEventFromAncestor(event));
      }
    };

    const detachAncestors = () => {
      for (const ancestor of ancestorWindows) {
        ancestor.removeEventListener('pointerup', finishFromAncestor);
        ancestor.removeEventListener('mouseup', finishFromAncestor);
      }
      ancestorWindows = [];
    };

    const attachAncestors = () => {
      let ancestor = window;
      try {
        while (ancestor.parent && ancestor.parent !== ancestor) {
          ancestor = ancestor.parent;
          ancestor.addEventListener('pointerup', finishFromAncestor);
          ancestor.addEventListener('mouseup', finishFromAncestor);
          ancestorWindows.push(ancestor);
        }
      } catch (_) { /* The containing frame may be cross-origin. */ }
    };

    const cancelDrawing = () => {
      activePointerId = null;
      activePointerType = null;
      gesture = null;
      this.currentLine = null;
      detachAncestors();
    };

    const setDrawTool = (tool) => {
      this.drawTool = tool === 'erase' ? 'erase' : 'draw';
      if (this.drawTool === 'erase') cancelDrawing();
      if (this.canvas.classList) this.canvas.classList.toggle('is-erasing', this.drawTool === 'erase');
      toolButtons.forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.gameTool === this.drawTool ? 'true' : 'false');
      });
    };

    const eraseWholeLine = (x, y) => {
      if (this.isLevelEnded || this.isPaused || !this.currentLevel) return;
      this.currentLevel.removeLineAtPosition(x, y);
    };

    toolButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        setDrawTool(button.dataset.gameTool);
      });
    });

    const appendDrawPoint = (event) => {
      if (!this.currentLine) return;
      const pos = this._canvasPos(event);
      const points = this.currentLine.getPoints();
      const last = points[points.length - 1];
      if (!last) return;
      let x = pos.x;
      let y = pos.y;
      if (!this.isWithinDrawArea(x, y)) {
        // Chrome can send the next event only after the pointer has left the
        // canvas. Retain the portion of that movement inside the board.
        let fraction = 1;
        if (x < Inkball.DRAW_AREA_X_MIN) fraction = Math.min(fraction, (Inkball.DRAW_AREA_X_MIN - last.x) / (x - last.x));
        if (x > Inkball.DRAW_AREA_X_MAX) fraction = Math.min(fraction, (Inkball.DRAW_AREA_X_MAX - last.x) / (x - last.x));
        if (y < Inkball.DRAW_AREA_Y_MIN) fraction = Math.min(fraction, (Inkball.DRAW_AREA_Y_MIN - last.y) / (y - last.y));
        if (y > Inkball.DRAW_AREA_Y_MAX) fraction = Math.min(fraction, (Inkball.DRAW_AREA_Y_MAX - last.y) / (y - last.y));
        x = last.x + (x - last.x) * fraction;
        y = last.y + (y - last.y) * fraction;
      }
      if (this.isWithinDrawArea(x, y) && (last.x !== x || last.y !== y)) {
        this.currentLine.addPoint(x, y);
      }
    };

    const capturePointer = (event) => {
      if (!this.canvas.setPointerCapture) return;
      try { this.canvas.setPointerCapture(event.pointerId); }
      catch (_) { /* Window listeners still complete the gesture. */ }
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || activePointerId !== null) return;
      const pos = this._canvasPos(e);
      if (e.button === 0) {
        if (e.ctrlKey || e.metaKey || this.drawTool === 'erase') {
          if (this.isLevelEnded || this.isPaused) return;
          if (this.drawTool === 'erase' && !e.ctrlKey && !e.metaKey && !this.isWithinDrawArea(pos.x, pos.y)) return;
          e.preventDefault();
          activePointerId = e.pointerId;
          activePointerType = e.pointerType;
          gesture = 'erase';
          eraseWholeLine(pos.x, pos.y);
          if (activePointerType === 'mouse') attachAncestors();
          capturePointer(e);
          return;
        }
        if (!this.isLevelEnded && !this.isPaused) {
          if (this.isWithinDrawArea(pos.x, pos.y)) {
            e.preventDefault();
            activePointerId = e.pointerId;
            activePointerType = e.pointerType;
            gesture = 'draw';
            this.currentLine = new Inkball.Line();
            this.currentLine.addPoint(pos.x, pos.y);
            if (activePointerType === 'mouse') attachAncestors();
            capturePointer(e);
          } else {
            this.currentLine = null;
          }
        }
      } else if (e.button === 2) {
        eraseWholeLine(pos.x, pos.y);
      }
    });

    const handlePointerMove = (e) => {
      if (e.pointerId !== activePointerId || this.isLevelEnded || this.isPaused) return;
      if (gesture === 'erase') {
        if (e.cancelable) e.preventDefault();
        const samples = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() || [] : [];
        for (const sample of samples) {
          const pos = this._canvasPos(sample);
          eraseWholeLine(pos.x, pos.y);
        }
        const pos = this._canvasPos(e);
        eraseWholeLine(pos.x, pos.y);
        return;
      }
      if (this.currentLine) {
        if (e.cancelable) e.preventDefault();
        const samples = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() || [] : [];
        for (const sample of samples) appendDrawPoint(sample);
        appendDrawPoint(e);
      }
    };
    window.addEventListener('pointermove', handlePointerMove);

    const finishDrawing = (e) => {
      if (activePointerId === null || (e && e.pointerId !== activePointerId)) return;
      const erasing = gesture === 'erase';
      if (e && e.cancelable) e.preventDefault();
      if (e && !erasing && !this.isLevelEnded && !this.isPaused) appendDrawPoint(e);
      activePointerId = null;
      activePointerType = null;
      gesture = null;
      detachAncestors();
      if (erasing) {
        this.currentLine = null;
        return;
      }
      if (!this.isLevelEnded && !this.isPaused) {
        this.commitCurrentLine();
      }
      else this.currentLine = null;
    };
    this.canvas.addEventListener('pointerup', finishDrawing);
    window.addEventListener('pointerup', finishDrawing);

    const handlePointerCancel = (e) => {
      if (e.pointerId !== activePointerId) return;
      if (activePointerType === 'mouse') finishDrawing(e);
      else cancelDrawing();
    };
    this.canvas.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('pointercancel', handlePointerCancel);
    this.canvas.addEventListener('lostpointercapture', (e) => {
      if (e.pointerId === activePointerId && activePointerType !== 'mouse') cancelDrawing();
    });
    window.addEventListener('blur', () => {
      if (activePointerType === 'mouse') finishDrawing();
      else cancelDrawing();
    });
    window.addEventListener('pagehide', cancelDrawing);

    window.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('button, a, input, select, textarea, .ui-dialog')) return;
      if (this._isMatchPlay()) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.isPaused) {
          this.resume();
        } else {
          this.pause();
        }
      } else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this._handleRestart();
      }
    });
  }

  _isMatchPlay() {
    return !!(this.boot && this.boot.match);
  }

  _bindPauseMenu() {
    this.pauseOpenBtn = document.querySelector('[data-pause-open]');
    this.pauseOverlay = document.querySelector('[data-pause-overlay]');
    this.pauseHome = document.querySelector('[data-pause-home]');
    this.pauseRestart = document.querySelector('[data-pause-restart]');
    this.pauseResume = document.querySelector('[data-pause-resume]');
    if (this._isMatchPlay()) return;

    if (this.pauseOverlay) {
      this.pauseOverlay.addEventListener('cancel', (event) => {
        event.preventDefault();
        this.resume();
      });
    }
    if (this.pauseOpenBtn) {
      this.pauseOpenBtn.addEventListener('click', () => this.pause());
    }
    if (this.pauseHome) {
      this.pauseHome.addEventListener('click', (e) => {
        e.preventDefault();
        this._allowUnload = true;
        const href = this.pauseHome.getAttribute('href') || '/';
        if (this.boot && (this.boot.fromEditor || this.boot.communityRun)) {
          if (this.boot.communityRun) this._saveCommunityHandoff();
          else this._saveEditorHandoff();
          document.documentElement.classList.add('is-play-to-editor');
          window.setTimeout(function () {
            if (window.InkballScene) window.InkballScene.navigate(href);
            else window.location.href = href;
          }, window.InkballMapTransition ? InkballMapTransition.DURATION_MS : 420);
          return;
        }
        if (window.InkballScene) {
          if (this.pauseOverlay && this.pauseOverlay.open) this.pauseOverlay.close();
          window.InkballScene.navigate(href);
        } else window.location.href = href;
      });
    }
    if (this.pauseRestart) {
      this.pauseRestart.addEventListener('click', () => this._handleRestart());
    }
    if (this.pauseResume) {
      this.pauseResume.addEventListener('click', () => this.resume());
    }
  }

  _syncPauseUi() {
    const ended = this.isLevelEnded || this.isGameEnded;
    const lock = this._isMatchPlay();
    if (this.pauseOpenBtn) {
      this.pauseOpenBtn.hidden = ended || lock;
    }
    if (this.pauseOverlay) {
      const visible = !lock && !ended && this.isPaused;
      this.pauseOverlay.hidden = !visible;
      if (visible && !this.pauseOverlay.open) {
        if (window.InkballUI && typeof window.InkballUI.present === 'function') {
          window.InkballUI.present(this.pauseOverlay);
        } else this.pauseOverlay.showModal();
        if (this.pauseResume) this.pauseResume.focus();
      } else if (!visible && this.pauseOverlay.open) {
        this.pauseOverlay.close();
      }
    }
  }

  pause() {
    if (this._isMatchPlay() || this.isLevelEnded || this.isGameEnded) return;
    this.isPaused = true;
    this._syncPauseUi();
  }

  resume() {
    if (this._isMatchPlay() || this.isLevelEnded || this.isGameEnded) return;
    this.isPaused = false;
    this._lastFrameTime = performance.now();
    this._syncPauseUi();
  }

  _shouldWarnOnLeave() {
    return !this._allowUnload && !this._resultSent && !!this.currentLevel;
  }

  _bindLeaveGuard() {
    // Native unload prompts cannot be styled; keyboard reload uses our dialog.
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this._shouldWarnOnLeave()) return;
        const reloadKey = e.key === 'F5' || e.code === 'F5';
        const reloadChord =
          (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'r' || e.key === 'R');
        if (!reloadKey && !reloadChord) return;
        e.preventDefault();
        e.stopPropagation();
        this._confirmReload();
      },
      true
    );
  }

  async _confirmReload() {
    if (!this._shouldWarnOnLeave()) return;
    const wasPaused = this.isPaused;
    this.pause();
    const confirmed = await window.InkballUI.confirm(Inkball.t('game.reloadConfirm'));
    if (!confirmed) {
      if (!wasPaused) this.resume();
      return;
    }
    this._allowUnload = true;
    window.location.reload();
  }

  async _handleRestart() {
    if (this._isMatchPlay()) return;
    await this.restartLevel();
  }

  _loop() {
    const now = performance.now();
    let dt = (now - this._lastFrameTime) / 1000;
    this._lastFrameTime = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    const maxDt = Inkball.MAX_DT > 0 ? Inkball.MAX_DT : 0.05;
    if (dt > maxDt) dt = maxDt;
    this.frameCount++;
    try {
      this.update(dt);
      this.draw(dt);
    } catch (err) {
      console.error(err);
    }
    this._rafId = requestAnimationFrame(this._boundLoop);
  }

  rearmLoop() {
    if (this._rafId === null) return;
    cancelAnimationFrame(this._rafId);
    this._lastFrameTime = performance.now();
    this._rafId = requestAnimationFrame(this._boundLoop);
  }

  update(dt) {
    if (this.isGameEnded || !this.currentLevel) return;
    if (this.isLevelEnded || this.isPaused) return;
    this.currentLevel.update(dt);
  }

  draw(dt) {
    const ctx = this.ctx;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, Inkball.WIDTH, Inkball.HEIGHT);

    this.dashboard.draw(ctx, dt);
    if (this.isGameEnded || !this.currentLevel) {
      return;
    }

    this.currentLevel.draw(ctx);

    if (!this.isLevelEnded) {
      if (this.currentLine) {
        this.currentLine.draw(ctx);
      }
    } else if (this.currentLevel.timeUp) {
      this._finishAttempt(false);
    } else {
      this._finishAttempt(true);
    }
  }

  _finishAttempt(cleared) {
    if (this._resultSent || this._completionFailed) return;
    this._resultSent = true;
    this._allowUnload = true;
    this.isPaused = false;
    this._syncPauseUi();
    const matchFlush = this.matchSync
      ? this.matchSync.flush(cleared ? 'completed' : 'failed')
      : Promise.resolve();
    this._saveResultHandoff();
    document.documentElement.classList.add('is-play-to-result');
    const duration = Math.max(0, Math.round((Date.now() - this.startedAt) / 1000));
    const correct = this.correctCaptures || 0;
    const wrong = this.wrongCaptures || 0;
    const total = correct + wrong;
    const accuracy = total ? Math.round((100 * correct) / total) : 0;
    const params = {
      difficulty: this.boot.difficulty,
      cleared: cleared ? '1' : '0',
      score: String(this.score),
      time: String(duration),
      accuracy: String(accuracy),
      correct: String(correct),
      wrong: String(wrong),
      best: String(this.score),
      new_record: '0',
    };

    const go = function (extra) {
      extra = extra || {};
      if (extra.best_score != null) params.best = String(extra.best_score);
      if (extra.previous_best != null && extra.previous_best !== '') {
        params.prev_best = String(extra.previous_best);
      }
      const previousBest =
        extra.previous_best == null || extra.previous_best === ''
          ? null
          : Number(extra.previous_best);
      const isNewRecord =
        !!extra.new_record && (previousBest == null || this.score > previousBest);
      params.new_record = isNewRecord ? '1' : '0';
      const query = new URLSearchParams(params).toString();
      let dest = this.boot.resultUrl + (this.boot.resultUrl.indexOf('?') === -1 ? '?' : '&') + query;
      if (this.boot.match && this.boot.match.room_id) {
        dest += '&room=' + encodeURIComponent(this.boot.match.room_id);
      }
      if (window.InkballTabSession && InkballTabSession.withTab) {
        dest = InkballTabSession.withTab(dest);
      }
      if (window.InkballScene) window.InkballScene.navigate(dest);
      else window.location.href = dest;
    }.bind(this);

    const waitFade = new Promise(function (resolve) {
      window.setTimeout(resolve, 450);
    });

    const target = completionTarget(this.boot, window.INKBALL_API);
    const resultPost = (
      target && window.InkballApi
        ? InkballApi.post(target, attemptPayload(this, cleared, duration))
        : Promise.resolve({})
    );

    Promise.all([waitFade, matchFlush, resultPost]).then(function (results) {
      if (this.boot.communityRun) {
        if (window.InkballScene) window.InkballScene.navigate(this.boot.resultUrl);
        else window.location.href = this.boot.resultUrl;
        return;
      }
      go(results[2] || {});
    }.bind(this)).catch(function (error) {
      if (!this.boot.communityRun) {
        go({});
        return;
      }
      document.documentElement.classList.remove('is-play-to-result');
      this._resultSent = false;
      this._allowUnload = false;
      this._completionFailed = true;
      const status = document.getElementById('status');
      if (status) {
        status.hidden = false;
        status.textContent = Inkball.t('community.error.complete') || 'Could not save the result. Click to retry.';
        status.onclick = function () {
          status.hidden = true;
          this._completionFailed = false;
          this._finishAttempt(cleared);
        }.bind(this);
      }
      if (window.console && typeof window.console.error === 'function') window.console.error(error);
    }.bind(this));
  }

  _saveResultHandoff() {
    const T = window.InkballMapTransition;
    if (!T || !this.canvas) return;
    const handoff = this._boardHandoff();
    if (handoff) T.saveResult(this.boot.map, handoff.image, handoff.rect);
  }

  _saveEditorHandoff() {
    const T = window.InkballMapTransition;
    if (!T || !this.canvas) return;
    const handoff = this._boardHandoff();
    if (handoff) T.saveLeave(this.boot.map, handoff.rect, T.DURATION_MS, handoff.image);
  }

  _saveCommunityHandoff() {
    const T = window.InkballMapTransition;
    if (!T || !this.canvas) return;
    const handoff = this._boardHandoff();
    if (handoff) T.saveCommunityCard(this.boot.map, handoff.rect, handoff.image);
  }

  _boardHandoff() {
    if (!this.canvas) return null;
    const box = this.canvas.getBoundingClientRect();
    const dash = box.height * (Inkball.TOP_OFFSET / Inkball.HEIGHT);
    const rect = {
      left: box.left,
      top: box.top + dash,
      width: box.width,
      height: box.height - dash,
    };
    let image = '';
    try {
      const off = document.createElement('canvas');
      off.width = Inkball.WIDTH;
      off.height = Inkball.WIDTH;
      const ctx = off.getContext('2d');
      if (ctx) {
        const sourceScaleX = this.canvas.width / Inkball.WIDTH;
        const sourceScaleY = this.canvas.height / Inkball.HEIGHT;
        ctx.drawImage(
          this.canvas,
          0,
          Inkball.TOP_OFFSET * sourceScaleY,
          Inkball.WIDTH * sourceScaleX,
          Inkball.WIDTH * sourceScaleY,
          0,
          0,
          Inkball.WIDTH,
          Inkball.WIDTH
        );
        image = off.toDataURL('image/png');
      }
    } catch (err) {
      image = '';
    }
    return { image: image, rect: rect };
  }

  initializeMovingTiles() {
    this.movingTilesActive = true;
    this.movingTileTimer = 0;
    const edgePath = this.createEdgePath();
    this.movingTile1 = new Inkball.MovingTile(this, 0, 0, edgePath);
    this.movingTile2 = new Inkball.MovingTile(this, Inkball.BOARD_WIDTH - 1, Inkball.BOARD_HEIGHT - 1, edgePath);
    this.movingTile2.pathIndex = Math.floor(edgePath.length / 2);
  }

  updateAndDrawMovingTiles(ctx, dt) {
    if (!this.movingTilesActive) {
      this.initializeMovingTiles();
    }
    this.movingTileTimer += Inkball.stepDt(dt);
    const step = Inkball.MOVING_TILE_STEP;
    while (this.movingTileTimer >= step) {
      this.movingTileTimer -= step;
      this.movingTile1.update();
      this.movingTile2.update();
    }
    this.movingTile1.draw(ctx);
    this.movingTile2.draw(ctx);
  }

  createEdgePath() {
    const path = [];
    for (let x = 0; x < Inkball.BOARD_WIDTH; x++) {
      path.push({ x, y: 0 });
    }
    for (let y = 1; y < Inkball.BOARD_HEIGHT; y++) {
      path.push({ x: Inkball.BOARD_WIDTH - 1, y });
    }
    for (let x = Inkball.BOARD_WIDTH - 2; x >= 0; x--) {
      path.push({ x, y: Inkball.BOARD_HEIGHT - 1 });
    }
    for (let y = Inkball.BOARD_HEIGHT - 2; y > 0; y--) {
      path.push({ x: 0, y });
    }
    return path;
  }
};
