(function () {
  class MatchSync {
    constructor(app) {
      this.app = app;
      this.match = app.boot && app.boot.match ? app.boot.match : null;
      this.sequence = Number(this.match && this.match.own_snapshot && this.match.own_snapshot.sequence) || 0;
      this.timer = null;
      this.rafId = null;
      this.inFlight = false;
      this.stopped = false;
      this.lastOpponentSequence = null;
      this.opponentStatus = null;
      this.opponentSnapshot = null;
      this.opponentReceivedAt = 0;
      this.opponentAttemptStartedAt = null;
      this.lastLatencyMs = null;
      this.opponentSnapshots = [];
      this.snapshotIntervalMs = 100;
      this.snapshotJitterMs = 0;
      this.lastSnapshotReceivedAt = 0;
      this.interpolationDelayMs = 150;
      this.maxExtrapolationMs = 50;
      this.lastUnderrunTimelineAt = null;
      this.opponentLevel = null;
      this.shadowApp = null;
      this.opponentDashboard = null;
      this.playbackTimelineAt = null;
      this.ballCorrections = new Map();
      this.socket = null;
      this.nameNode = document.querySelector('[data-match-sync-name]');
      this.latencyNode = document.querySelector('[data-match-sync-latency]');
      this.emptyNode = document.querySelector('[data-opponent-empty]');
      this.connectionNode = document.querySelector('[data-opponent-connection]');
      this.waitingNode = document.querySelector('[data-opponent-waiting]');
      this.connectionTimer = null;
      this.connectionState = 'connected';
      this.forfeitCheckInFlight = false;
      this.forfeitHandled = false;
      this.boundCheckForfeit = () => this.checkOwnForfeit();
      this.canvas = document.getElementById('opponent-game');
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.pixelRatio = this.canvas ? Inkball.configureCanvas(this.canvas, this.ctx) : 1;
    }

    start() {
      if (!this.match || !this.match.room_id || !window.INKBALL_API || !window.InkballApi) return;
      if (this.nameNode && this.match.opponent) {
        this.nameNode.textContent = this.match.opponent.label || this.match.opponent.public_id || 'Opponent';
      }
      this.drawOpponent(null);
      this.rafId = window.requestAnimationFrame((now) => this.renderLoop(now));
      const interval = Number(this.match.interval_ms) || 100;
      this.snapshotIntervalMs = interval;
      if (window.InkballMatchSocket) {
        this.socket = new InkballMatchSocket(this.match.room_id);
        this.socket.on('opponent.snapshot', payload => this.updateOpponent(payload));
        this.socket.on('connection.latency', payload => this.updateLatency(payload && payload.rttMs));
        this.socket.on('opponent.connection', payload => this.updateOpponentConnection(payload));
        this.socket.on('match.forfeited', payload => this.handleOwnForfeit(payload));
        this.socket.on('match.finished', payload => {
          window.dispatchEvent(new CustomEvent('inkball:matchFinished', { detail: payload }));
        });
        this.socket.connect().then(() => this.tick()).catch(() => this.tick());
      } else {
        this.tick();
      }
      this.timer = window.setInterval(() => this.tick(), interval);
      window.addEventListener('beforeunload', () => this.stop());
      window.addEventListener('pageshow', this.boundCheckForfeit);
      window.addEventListener('online', this.boundCheckForfeit);
      document.addEventListener('visibilitychange', this.boundCheckForfeit);
    }

    stop() {
      this.stopped = true;
      if (this.timer) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
      if (this.rafId) {
        window.cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
      if (this.connectionTimer) window.clearInterval(this.connectionTimer);
      window.removeEventListener('pageshow', this.boundCheckForfeit);
      window.removeEventListener('online', this.boundCheckForfeit);
      document.removeEventListener('visibilitychange', this.boundCheckForfeit);
    }

    checkOwnForfeit() {
      if (this.forfeitHandled || this.forfeitCheckInFlight || document.hidden) return;
      if (!window.INKBALL_API || !INKBALL_API.activeMatch || !window.InkballApi) return;
      this.forfeitCheckInFlight = true;
      InkballApi.get(INKBALL_API.activeMatch)
        .then(payload => {
          if (payload && payload.forfeited && String(payload.room_id) === String(this.match.room_id)) {
            return this.handleOwnForfeit(payload);
          }
          return null;
        })
        .catch(() => null)
        .finally(() => { this.forfeitCheckInFlight = false; });
    }

    handleOwnForfeit(payload) {
      if (this.forfeitHandled) return;
      this.forfeitHandled = true;
      this.app._resultSent = true;
      this.app._allowUnload = true;
      this.app.isPaused = true;
      this.stop();
      try { localStorage.removeItem('inkballActiveMatch'); } catch (error) {}
      const label = payload && payload.match_label ? payload.match_label : '';
      const message = Inkball.t('game.youForfeited', { match: label });
      const options = {
        title: Inkball.t('game.forfeitTitle'),
        confirmLabel: Inkball.t('game.exitMatch'),
      };
      const notice = window.InkballUI && InkballUI.alert
        ? InkballUI.alert(message, options)
        : Promise.resolve(window.alert(message));
      notice.finally(() => {
        window.location.replace(payload && payload.exit_url ? payload.exit_url : '/');
      });
    }

    flush(status) {
      if (!this.match || !window.INKBALL_API || !window.InkballApi) return Promise.resolve();
      if (this.timer) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
      this.stopped = true;
      return this.send(status).catch(() => null).finally(() => {
        if (this.socket) {
          this.socket.close();
          this.socket = null;
        }
      });
    }

    tick() {
      if (this.stopped || this.inFlight || document.hidden) return;
      this.inFlight = true;
      this.send()
        .catch(() => null)
        .finally(() => {
          this.inFlight = false;
        });
    }

    send(status) {
      const url = window.INKBALL_API.matchRoomSnapshots(this.match.room_id);
      const snapshot = this.app.createMatchSnapshot(status);
      const sentAt = Date.now();
      if (this.socket && this.socket.isOpen()) {
        return this.socket.sendSnapshot({
          type: 'game.snapshot',
          sequence: ++this.sequence,
          status: snapshot.status,
          snapshot: snapshot,
        });
      }
      return window.InkballApi.post(url, {
        sequence: ++this.sequence,
        status: snapshot.status,
        snapshot: snapshot,
      }).then((payload) => {
        this.updateOpponent(payload && payload.opponent_snapshot, sentAt);
        return payload;
      });
    }

    updateOpponent(opponent, sentAt) {
      if (!opponent || !opponent.snapshot) return;
      const sequence = Number(opponent.sequence);
      if (this.lastOpponentSequence != null && Number.isFinite(sequence) && sequence <= this.lastOpponentSequence) return;
      this.lastOpponentSequence = opponent.sequence;
      this.opponentStatus = opponent.status || (opponent.snapshot && opponent.snapshot.status) || null;
      if (this.opponentStatus === 'completed' || this.opponentStatus === 'failed' || this.opponentStatus === 'forfeited') {
        this.connectionState = this.opponentStatus;
        if (this.connectionTimer) {
          window.clearInterval(this.connectionTimer);
          this.connectionTimer = null;
        }
      }
      const snapshot = opponent.snapshot;
      if (this.opponentAttemptStartedAt !== snapshot.attempt_started_at) {
        this.resetOpponentLevel();
        this.opponentAttemptStartedAt = snapshot.attempt_started_at;
      }
      this.opponentSnapshot = snapshot;
      this.opponentReceivedAt = Date.now();
      this.recordSnapshotTiming(this.opponentReceivedAt);
      this.enqueueOpponentSnapshot(snapshot, this.opponentReceivedAt);
      if (Number.isFinite(sentAt)) this.updateLatency(Date.now() - sentAt);
      window.dispatchEvent(new CustomEvent('inkball:opponentSnapshot', {
        detail: {
          roomId: this.match.room_id,
          sequence: opponent.sequence,
          status: opponent.status,
          snapshot: snapshot,
        },
      }));
    }

    updateLatency(rttMs) {
      const sample = Number(rttMs);
      if (!Number.isFinite(sample) || sample < 0) return;
      this.lastLatencyMs = this.lastLatencyMs == null
        ? Math.round(sample)
        : Math.round(this.lastLatencyMs * 0.8 + sample * 0.2);
      if (this.latencyNode) this.latencyNode.textContent = String(this.lastLatencyMs) + 'ms';
      this.updateInterpolationDelay();
    }

    updateOpponentConnection(payload) {
      if (!this.connectionNode || !this.waitingNode || !payload) return;
      if (this.connectionTimer) {
        window.clearInterval(this.connectionTimer);
        this.connectionTimer = null;
      }
      this.connectionState = payload.status || 'connected';
      if (payload.status === 'completed' || payload.status === 'failed') {
        this.opponentStatus = payload.status;
        this.waitingNode.hidden = false;
        this.connectionNode.textContent = Inkball.t(
          payload.status === 'completed' ? 'game.opponentCompleted' : 'game.opponentFailed'
        );
        return;
      }
      if (payload.status === 'connected') {
        this.waitingNode.hidden = true;
        this.connectionNode.textContent = '';
        return;
      }
      if (payload.status === 'forfeited') {
        this.opponentStatus = 'forfeited';
        this.waitingNode.hidden = false;
        this.connectionNode.textContent = Inkball.t('game.opponentForfeited');
        return;
      }
      const deadline = Date.parse(payload.reconnect_deadline || '');
      const render = () => {
        const seconds = Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 20;
        this.waitingNode.hidden = false;
        this.connectionNode.textContent = Inkball.t('game.opponentReconnecting', { seconds: seconds });
        if (seconds <= 0 && this.connectionTimer) {
          window.clearInterval(this.connectionTimer);
          this.connectionTimer = null;
        }
      };
      render();
      this.connectionTimer = window.setInterval(render, 250);
    }

    recordSnapshotTiming(receivedAt) {
      if (this.lastSnapshotReceivedAt) {
        const interval = receivedAt - this.lastSnapshotReceivedAt;
        if (interval >= 20 && interval <= 1000) {
          const previousMean = this.snapshotIntervalMs;
          this.snapshotIntervalMs += (interval - this.snapshotIntervalMs) * 0.15;
          const deviation = Math.abs(interval - previousMean);
          this.snapshotJitterMs += (deviation - this.snapshotJitterMs) * 0.2;
        }
      }
      this.lastSnapshotReceivedAt = receivedAt;
      this.updateInterpolationDelay();
    }

    updateInterpolationDelay() {
      const oneWayLatency = this.lastLatencyMs == null ? 0 : this.lastLatencyMs / 2;
      const safety = Math.max(10, this.snapshotJitterMs * 2);
      const target = Math.max(100, Math.min(
        250,
        this.snapshotIntervalMs * 1.25 + safety + Math.min(50, oneWayLatency)
      ));
      const weight = target > this.interpolationDelayMs ? 0.35 : 0.03;
      this.interpolationDelayMs += (target - this.interpolationDelayMs) * weight;
    }

    enqueueOpponentSnapshot(snapshot, receivedAt) {
      let timelineAt = Number(snapshot.updated_at_client);
      if (!Number.isFinite(timelineAt)) timelineAt = receivedAt;
      const previous = this.opponentSnapshots[this.opponentSnapshots.length - 1];
      if (previous && timelineAt <= previous.timelineAt) {
        timelineAt = previous.timelineAt + Math.max(1, receivedAt - previous.receivedAt);
      }
      this.opponentSnapshots.push({ snapshot: snapshot, receivedAt: receivedAt, timelineAt: timelineAt });
      if (this.opponentSnapshots.length > 8) this.opponentSnapshots.shift();
    }

    advanceOpponentPlayback(now) {
      const snapshots = this.opponentSnapshots;
      if (!snapshots.length) return false;
      if (snapshots.length === 1) {
        const status = snapshots[0].snapshot.status;
        if (status !== 'completed' && status !== 'failed') return false;
        this.applySnapshot(snapshots[0].snapshot);
        this.playbackTimelineAt = snapshots[0].timelineAt;
        return true;
      }

      const latest = snapshots[snapshots.length - 1];
      const desiredTime = latest.timelineAt + Math.max(0, now - latest.receivedAt) - this.interpolationDelayMs;
      const targetTime = Math.min(latest.timelineAt + this.maxExtrapolationMs, desiredTime);
      if (desiredTime > latest.timelineAt && this.lastUnderrunTimelineAt !== latest.timelineAt) {
        this.lastUnderrunTimelineAt = latest.timelineAt;
        this.snapshotJitterMs = Math.max(this.snapshotJitterMs, desiredTime - latest.timelineAt);
        this.updateInterpolationDelay();
      }
      if (this.playbackTimelineAt == null) {
        this.applySnapshot(snapshots[0].snapshot);
        this.playbackTimelineAt = snapshots[0].timelineAt;
      }
      if (targetTime <= this.playbackTimelineAt) return true;

      for (const entry of snapshots) {
        if (entry.timelineAt <= this.playbackTimelineAt || entry.timelineAt > targetTime) continue;
        this.simulateOpponentDuration(entry.timelineAt - this.playbackTimelineAt);
        this.reconcileSnapshot(entry.snapshot);
        this.playbackTimelineAt = entry.timelineAt;
      }
      if (targetTime > this.playbackTimelineAt) {
        this.simulateOpponentDuration(targetTime - this.playbackTimelineAt);
        this.playbackTimelineAt = targetTime;
      }
      return true;
    }

    simulateOpponentDuration(durationMs) {
      let remaining = Math.max(0, Number(durationMs) || 0) / 1000;
      const maxDt = Inkball.MAX_DT > 0 ? Inkball.MAX_DT : 0.05;
      while (remaining > 0) {
        const dt = Math.min(remaining, maxDt);
        this.stepOpponentFrame(dt);
        remaining -= dt;
      }
    }

    stepOpponentFrame(dt) {
      const level = this.opponentLevel;
      if (!level) return;
      dt = Inkball.stepDt(dt);
      for (const tile of level.extTiles) {
        if (!tile.removed && typeof tile.update === 'function') tile.update(dt, level);
      }
      for (const tile of level.extTiles) {
        if (tile.removed && level.tileAt[tile.gy] && level.tileAt[tile.gy][tile.gx] === tile) {
          level.tileAt[tile.gy][tile.gx] = null;
        }
      }
      for (const ball of level.ballsInGame) ball.update(level, dt);
      window.InkballBallPhysics.resolveAll(level.ballsInGame, level.holes);
      if (level.ballsToRemove.length) {
        level.ballsInGame = level.ballsInGame.filter(ball => !level.ballsToRemove.includes(ball));
        level.ballsToRemove = [];
      }

      const elapsedMs = dt * 1000;
      for (const ball of level.ballsInGame) {
        const key = String(ball.syncId);
        const correction = this.ballCorrections.get(key);
        if (!correction) continue;
        const share = Math.min(1, elapsedMs / Math.max(1, correction.remainingMs));
        ball.x += correction.x * share;
        ball.y += correction.y * share;
        correction.x *= 1 - share;
        correction.y *= 1 - share;
        correction.remainingMs -= elapsedMs;
        if (correction.remainingMs <= 0) this.ballCorrections.delete(key);
      }
    }

    reconcileSnapshot(snapshot) {
      const level = this.ensureOpponentLevel();
      if (!level || !snapshot) return;
      const existing = new Map(level.ballsInGame.map(ball => [String(ball.syncId), ball]));
      const nextBalls = [];
      const correctionMs = Math.max(80, Math.min(160, this.interpolationDelayMs * 0.75));
      for (const item of Array.isArray(snapshot.balls) ? snapshot.balls : []) {
        if (item.captured) continue;
        const id = String(item.id);
        let ball = existing.get(id);
        if (!ball) {
          ball = new Inkball.Ball(this.shadowApp, Number(item.color) || 0, Number(item.x) || 0, Number(item.y) || 0);
          ball.syncId = item.id;
        } else {
          const errorX = (Number(item.x) || 0) - ball.x;
          const errorY = (Number(item.y) || 0) - ball.y;
          if (Math.hypot(errorX, errorY) > 64) {
            ball.x = Number(item.x) || 0;
            ball.y = Number(item.y) || 0;
            this.ballCorrections.delete(id);
          } else {
            this.ballCorrections.set(id, { x: errorX, y: errorY, remainingMs: correctionMs });
          }
        }
        ball.colorIndex = Number(item.color) || 0;
        ball.vx = Number(item.vx) || 0;
        ball.vy = Number(item.vy) || 0;
        ball.size = Number(item.size) || 20;
        ball.isCaptured = false;
        nextBalls.push(ball);
        existing.delete(id);
      }
      for (const id of existing.keys()) this.ballCorrections.delete(id);
      level.ballsInGame = nextBalls;
      level.ballsToRemove = [];
      level.lines = this.snapshotLines(snapshot);
    }

    renderLoop(now) {
      const hasPlayback = this.advanceOpponentPlayback(Date.now());
      this.drawOpponent(hasPlayback ? this.opponentSnapshot : null);
      this.updateSignalOverlay(Date.now());
      this.rafId = window.requestAnimationFrame((nextNow) => this.renderLoop(nextNow));
    }

    updateSignalOverlay(now) {
      if (!this.waitingNode || !this.connectionNode) return;
      if (this.opponentStatus === 'completed') {
        this.waitingNode.hidden = false;
        this.connectionNode.textContent = Inkball.t('game.opponentCompleted');
        return;
      }
      if (this.opponentStatus === 'failed') {
        this.waitingNode.hidden = false;
        this.connectionNode.textContent = Inkball.t('game.opponentFailed');
        return;
      }
      if (this.opponentStatus === 'forfeited') {
        this.waitingNode.hidden = false;
        this.connectionNode.textContent = Inkball.t('game.opponentForfeited');
        return;
      }
      if (this.connectionState !== 'connected') return;
      const stalled = this.lastSnapshotReceivedAt > 0 && now - this.lastSnapshotReceivedAt >= 1000;
      this.waitingNode.hidden = !stalled;
      this.connectionNode.textContent = stalled ? Inkball.t('game.waitingConnection') : '';
    }

    ensureOpponentLevel() {
      if (this.opponentLevel || !this.app.currentLevel) return this.opponentLevel;
      const source = this.app.currentLevel;
      this.shadowApp = {
        config: this.app.config,
        score: 0,
        correctCaptures: 0,
        wrongCaptures: 0,
        isLevelEnded: false,
        isGameEnded: false,
        keyWallImages: this.app.keyWallImages,
        wallImages: this.app.wallImages,
        brickImages: this.app.brickImages,
        ballImages: this.app.ballImages,
        holeImages: this.app.holeImages,
        spawnerImage: this.app.spawnerImage,
        tileImage: this.app.tileImage,
        oneWayImages: this.app.oneWayImages,
        acceleratorImages: this.app.acceleratorImages,
        dashboard: {
          onBallSpawned: function () {},
          onBallsYetToSpawnChanged: function () {},
        },
        recordCapture: function () {},
      };
      this.opponentLevel = new Inkball.Level(this.shadowApp, source.levelConfig, source.layoutText || '');
      this.opponentLevel.ballsInGame = [];
      this.opponentLevel.ballsToRemove = [];
      this.opponentLevel.lines = [];
      return this.opponentLevel;
    }

    resetOpponentLevel() {
      this.opponentLevel = null;
      this.shadowApp = null;
      this.opponentDashboard = null;
      this.opponentSnapshots = [];
      this.lastSnapshotReceivedAt = 0;
      this.snapshotJitterMs = 0;
      this.lastUnderrunTimelineAt = null;
      this.playbackTimelineAt = null;
      this.ballCorrections.clear();
    }

    applySnapshot(snapshot) {
      const level = this.ensureOpponentLevel();
      if (!level || !snapshot) return;

      const nextBalls = [];
      const existing = new Map(level.ballsInGame.map((ball) => [String(ball.syncId), ball]));
      const balls = Array.isArray(snapshot.balls) ? snapshot.balls : [];
      for (const item of balls) {
        if (item.captured) continue;
        const id = String(item.id);
        let ball = existing.get(id);
        if (!ball) {
          ball = new Inkball.Ball(this.shadowApp, Number(item.color) || 0, Number(item.x) || 0, Number(item.y) || 0);
          ball.syncId = item.id;
        }
        ball.colorIndex = Number(item.color) || 0;
        ball.x = Number(item.x) || 0;
        ball.y = Number(item.y) || 0;
        ball.vx = Number(item.vx) || 0;
        ball.vy = Number(item.vy) || 0;
        ball.size = Number(item.size) || 20;
        ball.isCaptured = false;
        nextBalls.push(ball);
      }
      level.ballsInGame = nextBalls;
      level.ballsToRemove = [];
      level.lines = this.snapshotLines(snapshot);
      this.ballCorrections.clear();
    }

    snapshotLines(snapshot) {
      const lines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
      return lines.map((item) => {
        const line = new Inkball.Line();
        const points = Array.isArray(item.points) ? item.points : [];
        for (const point of points) {
          line.addPoint(Number(point.x) || 0, Number(point.y) || 0);
        }
        return line;
      });
    }

    drawOpponent(snapshot) {
      if (!this.ctx || !this.app.currentLevel) return;
      const ctx = this.ctx;
      const level = this.ensureOpponentLevel() || this.app.currentLevel;

      ctx.clearRect(0, 0, Inkball.WIDTH, Inkball.HEIGHT);
      this.drawOpponentDashboard(ctx, this.opponentSnapshot || snapshot);

      for (const element of level.elements) {
        element.draw(ctx, this.app);
      }
      for (const tile of level.extTiles) {
        if (!tile.removed) tile.draw(ctx, this.app);
      }
      for (const hole of level.holes) {
        hole.draw(ctx);
      }

      if (!snapshot) {
        if (this.emptyNode) this.emptyNode.hidden = false;
        return;
      }
      if (this.emptyNode) this.emptyNode.hidden = true;

      for (const line of level.lines) {
        line.draw(ctx);
      }
      for (const ball of level.ballsInGame) {
        ball.draw(ctx);
      }
    }

    drawOpponentDashboard(ctx, snapshot) {
      if (!this.app.currentLevel) return;
      if (!this.opponentDashboard) {
        // Presentation state is separate from both players' physics. Reuse the
        // real dashboard so queue, score and timer occupy exactly the same slots.
        this.opponentDashboard = new Inkball.Dashboard({
          score: 0, isGameEnded: false, ballImages: this.app.ballImages,
          currentLevel: {
            ballsYetToSpawn: [], levelTimer: 0, spawnTimer: 0,
            colorStringToIndex: color => this.app.currentLevel.colorStringToIndex(color),
          },
        });
      }
      const dashboard = this.opponentDashboard;
      const level = dashboard.app.currentLevel;
      const queue = snapshot && Array.isArray(snapshot.balls_yet_to_spawn)
        ? snapshot.balls_yet_to_spawn.slice(0, dashboard.maxBallsToShow) : [];
      if (queue.length !== level.ballsYetToSpawn.length || queue.some((color, i) => color !== level.ballsYetToSpawn[i])) {
        level.ballsYetToSpawn = queue;
        dashboard.onBallsYetToSpawnChanged();
      }
      dashboard.app.score = snapshot ? Number(snapshot.score) || 0 : 0;
      level.levelTimer = snapshot ? Math.max(0, Number(snapshot.time_left) || 0) : 0;
      level.spawnTimer = snapshot ? Math.max(0, Number(snapshot.spawn_timer) || 0) : 0;
      dashboard.draw(ctx, 0);
    }
  }

  window.InkballMatchSync = MatchSync;
})();
