/**
 * Full-screen grey brick floor with a tint mask, plus bouncing balls.
 * Live on home (diagonal drift); still on detail/play; alternating rows on
 * result; CSS-composited 45° weave on the account page.
 */
(function () {
  const SIZE = 20;
  const MIN_SPEED = 1.2;
  const MAX_SPEED = 2.2;
  const TILE_DRIFT = 0.12;
  const FADE_MS = 700;
  const SPECIAL_FADE_MS = 450;
  const COMMUNITY_ENTER_MS = 1000;
  const COMMUNITY_BALL_FADE_MS = 1000;
  const COVER_MS = 800;
  const COMMUNITY_HANDOFF_MS = 1000;
  const STATE_KEY = "inkballAmbient";
  const FRAME_KEY = "inkballAmbientFrame";
  const COMMUNITY_HANDOFF_KEY = "inkballCommunityHandoff";
  const BRICK_MASK = "#3a4150";
  const BRICK_SHADE = "rgba(26, 29, 35, 0.32)";
  const FALLBACK = ["#9aa0a6", "#f4a261", "#4ea1f3", "#6fcf97", "#f2c94c"];

  function isSpecialCell(column, row) {
    return (row % 4 === 0 && column % 4 === 0)
      || (row % 4 === 2 && column % 4 === 2);
  }

  function advanceTileOffset(offset, distance, size, community) {
    const patternSize = size * (community ? 4 : 1);
    return (offset + distance) % patternSize;
  }

  function patternAxis(offset, patternSize, viewportSize) {
    const translate = ((offset % patternSize) + patternSize) % patternSize;
    return {
      translate: translate,
      start: -patternSize,
      length: viewportSize + patternSize * 2,
    };
  }

  function specialBrickFade(elapsed, duration) {
    const total = Math.max(1, Number(duration) || SPECIAL_FADE_MS);
    return Math.max(0, Math.min(1, (Number(elapsed) || 0) / total));
  }

  function normaliseOrigin(point, viewportWidth, viewportHeight) {
    const width = Math.max(1, Number(viewportWidth) || 1);
    const height = Math.max(1, Number(viewportHeight) || 1);
    const x = Math.max(0, Math.min(width, Number(point && point.x) || 0));
    const y = Math.max(0, Math.min(height, Number(point && point.y) || 0));
    return { x: x / width, y: y / height };
  }

  function specialCellReveal(distance, elapsed, duration, maximumDistance) {
    const total = Math.max(1, Number(duration) || COMMUNITY_ENTER_MS);
    const time = Number(elapsed) || 0;
    if (time <= 0) return 0;
    if (time >= total) return 1;
    const reach = Math.max(1, Number(maximumDistance) || 1);
    const delay = Math.max(0, Number(distance) || 0) / reach * total * 0.7;
    const local = Math.max(0, Math.min(1, (time - delay) / (total * 0.3)));
    return local * local * (3 - 2 * local);
  }

  const ambientApi = window.InkballAmbient || {};
  ambientApi.isSpecialCell = isSpecialCell;
  ambientApi.advanceTileOffset = advanceTileOffset;
  ambientApi.patternAxis = patternAxis;
  ambientApi.specialBrickFade = specialBrickFade;
  ambientApi.normaliseOrigin = normaliseOrigin;
  ambientApi.specialCellReveal = specialCellReveal;
  ambientApi.COMMUNITY_ENTER_MS = COMMUNITY_ENTER_MS;
  ambientApi.COMMUNITY_HANDOFF_MS = COMMUNITY_HANDOFF_MS;
  ambientApi.markCommunityHandoff = function () {
    try { sessionStorage.setItem(COMMUNITY_HANDOFF_KEY, "1"); } catch (error) {}
  };
  window.InkballAmbient = ambientApi;

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = src;
    });
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function clockNow() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function readState() {
    try {
      return JSON.parse(sessionStorage.getItem(STATE_KEY) || "null");
    } catch (err) {
      return null;
    }
  }

  function writeState(value) {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(value));
    } catch (err) {
      /* ignore */
    }
  }

  function bakeBrick(wall) {
    const size = (wall && (wall.width || wall.naturalWidth)) || 32;
    const off = document.createElement("canvas");
    off.width = size;
    off.height = size;
    const octx = off.getContext("2d");
    if (!octx) return null;
    if (wall) {
      octx.drawImage(wall, 0, 0, size, size);
      octx.globalCompositeOperation = "multiply";
      octx.fillStyle = BRICK_MASK;
      octx.fillRect(0, 0, size, size);
      octx.globalCompositeOperation = "source-over";
      octx.fillStyle = BRICK_SHADE;
      octx.fillRect(0, 0, size, size);
    } else {
      octx.fillStyle = "#2a3140";
      octx.fillRect(0, 0, size, size);
    }
    return off;
  }

  function bakeDiagPair(brick) {
    const size = (brick && brick.width) || 32;
    const floor = "#232833";

    function strip(drawY) {
      const off = document.createElement("canvas");
      off.width = size;
      off.height = size * 2;
      const ctx = off.getContext("2d");
      if (!ctx) return "";
      ctx.fillStyle = floor;
      ctx.fillRect(0, 0, size, size * 2);
      ctx.drawImage(brick, 0, drawY, size, size);
      return off.toDataURL("image/png");
    }

    return { size: size, even: strip(0), odd: strip(size) };
  }

  function startDiagWeave(root) {
    const even = root.querySelector("[data-ambient-even]");
    const odd = root.querySelector("[data-ambient-odd]");
    if (!even || !odd) return;

    const urls = window.INKBALL_SPRITES || {};
    const wallUrl = urls.walls && urls.walls[0];
    loadImage(wallUrl).then(function (wall) {
      const brick = bakeBrick(wall);
      if (!brick) return;
      const pair = bakeDiagPair(brick);
      const tile = pair.size / 2;
      const period = pair.size;
      even.style.backgroundImage = 'url("' + pair.even + '")';
      odd.style.backgroundImage = 'url("' + pair.odd + '")';
      even.style.backgroundSize = tile + "px " + period + "px";
      odd.style.backgroundSize = tile + "px " + period + "px";
      root.classList.add("is-ready");
      if (prefersReducedMotion() || !even.animate) return;
      const ms = Math.max(3000, pair.size / (TILE_DRIFT * 60) * 1000);
      const timing = { duration: ms, iterations: Infinity, easing: "linear" };
      even.animate(
        [{ transform: "translate3d(0,0,0)" }, { transform: "translate3d(" + tile + "px,0,0)" }],
        timing
      );
      odd.animate(
        [{ transform: "translate3d(0,0,0)" }, { transform: "translate3d(" + -tile + "px,0,0)" }],
        timing
      );
    });
  }

  function start(root) {
    if (!root) return;
    if (root.getAttribute("data-map-ambient") === "diag") {
      startDiagWeave(root);
      return;
    }
    const canvas = root;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mode = canvas.getAttribute("data-map-ambient");
    const still = mode === "still";
    const altRows = mode === "rows";
    const community = mode === "community";
    const burst = canvas.getAttribute("data-ambient-burst") === "1";
    let balls = [];
    let images = [];
    let brickCell = null;
    let brickPattern = null;
    let specialCells = {};
    let specialPatterns = {};
    let specialImages = {};
    let specialTab = root.getAttribute("data-community-tab") || "community";
    let previousSpecialTab = null;
    let specialFadeStartedAt = 0;
    let brickSize = 32;
    let tileOffset = 0;
    let brickBlend = altRows ? 1 : 0;
    let ballAlpha = still || community ? 0 : 1;
    let pendingCommunityOrigin = null;
    let communityOrigin = null;
    let communityEnterStartedAt = 0;
    let communityEntering = false;
    let width = 0;
    let height = 0;
    let raf = null;
    let running = false;
    let ready = false;
    let pendingResultCleared = null;
    let burstGeneration = 0;
    const reduce = prefersReducedMotion();

    ctx.fillStyle = "#232833";
    ctx.fillRect(0, 0, canvas.width || 1, canvas.height || 1);

    function snapshot(origin) {
      if (origin) pendingCommunityOrigin = normaliseOrigin(origin, width || window.innerWidth, height || window.innerHeight);
      writeState({
        mode: community ? "community" : still ? "still" : altRows ? "rows" : "live",
        tileOffset: tileOffset,
        width: width,
        height: height,
        communityOrigin: pendingCommunityOrigin,
        balls: balls.map(function (ball) {
          return {
            x: ball.x,
            y: ball.y,
            vx: ball.vx,
            vy: ball.vy,
            color: ball.color,
            imgIndex: images.indexOf(ball.img),
          };
        }),
      });
      try {
        if (!width || !height) {
          sessionStorage.removeItem(FRAME_KEY);
          return;
        }
        const off = document.createElement("canvas");
        off.width = Math.max(1, Math.floor(width));
        off.height = Math.max(1, Math.floor(height));
        const octx = off.getContext("2d");
        if (octx) {
          octx.drawImage(canvas, 0, 0, off.width, off.height);
          sessionStorage.setItem(FRAME_KEY, off.toDataURL("image/jpeg", 0.62));
        }
      } catch (err) {
        try {
          sessionStorage.removeItem(FRAME_KEY);
        } catch (ignore) {
          /* ignore */
        }
      }
    }

    if (mode === "live") ambientApi.snapshot = snapshot;

    function refreshPattern() {
      brickPattern = brickCell ? ctx.createPattern(brickCell, "repeat") : null;
      specialPatterns = {};
      Object.keys(specialCells).forEach(function (tab) {
        specialPatterns[tab] = ctx.createPattern(specialCells[tab], "repeat");
      });
    }

    function bakeSpecialCell(image) {
      if (!image) return null;
      const off = document.createElement("canvas");
      off.width = brickSize * 4;
      off.height = brickSize * 4;
      const octx = off.getContext("2d");
      if (!octx) return null;
      for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 4; column++) {
          if (isSpecialCell(column, row)) {
            octx.drawImage(image, column * brickSize, row * brickSize, brickSize, brickSize);
          }
        }
      }
      return off;
    }

    function setCommunityTab(tab, now) {
      if (!community || !specialPatterns[tab] || tab === specialTab) return;
      previousSpecialTab = reduce ? null : specialTab;
      specialTab = tab;
      specialFadeStartedAt = Number(now) || clockNow();
      if (reduce) draw(specialFadeStartedAt + SPECIAL_FADE_MS);
    }

    if (community) {
      ambientApi.setCommunityTab = setCommunityTab;
      ambientApi.communityState = function () {
        return { tab: specialTab, sprite: specialImages[specialTab] ? specialImages[specialTab].src : null };
      };
    }

    if (altRows) {
      ambientApi.restartResult = function (cleared) {
        pendingResultCleared = !!cleared;
        canvas.dataset.ambientBurst = pendingResultCleared ? "1" : "0";
        if (!ready) return;
        pause();
        burstGeneration += 1;
        if (pendingResultCleared && !reduce) spawnBurst();
        else spawn();
        ballAlpha = 1;
        draw();
        play();
      };
      ambientApi.resultState = function () {
        return {
          ready: ready,
          burst: pendingResultCleared === true && !reduce,
          count: balls.length,
          running: running,
          balls: balls.map(function (ball) {
            return { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };
          }),
        };
      };
    }

    function resize() {
      const nextW = window.innerWidth;
      const nextH = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(nextW * dpr));
      canvas.height = Math.max(1, Math.floor(nextH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = nextW;
      height = nextH;
      refreshPattern();
      balls.forEach(function (ball) {
        ball.x = Math.min(Math.max(0, ball.x), Math.max(0, width - SIZE));
        ball.y = Math.min(Math.max(0, ball.y), Math.max(0, height - SIZE));
      });
    }

    function tightTextRect(node) {
      try {
        const range = document.createRange();
        range.selectNodeContents(node);
        const box = range.getBoundingClientRect();
        if (box.width >= 8 && box.height >= 4) {
          const padX = 10;
          const padY = 6;
          return {
            left: box.left - padX,
            top: box.top - padY,
            right: box.right + padX,
            bottom: box.bottom + padY,
          };
        }
      } catch (err) {
        /* fall through */
      }
      return null;
    }

    function pushVisibleRect(rects, box) {
      if (!box || box.width < 8 || box.height < 4) return;
      if (box.right < 0 || box.left > width || box.bottom < 0 || box.top > height) return;
      rects.push({
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
      });
    }

    function obstacleRects() {
      const rects = [];
      const blocks = document.querySelectorAll(
        ".map-card, .result-card, .result-btn, .site-header"
      );
      for (let i = 0; i < blocks.length; i++) {
        pushVisibleRect(rects, blocks[i].getBoundingClientRect());
      }
      const titles = document.querySelectorAll(".map-home__title");
      for (let i = 0; i < titles.length; i++) {
        const title = titles[i];
        pushVisibleRect(rects, tightTextRect(title) || title.getBoundingClientRect());
      }
      return rects;
    }

    function overlaps(x, y, rect) {
      return x < rect.right && x + SIZE > rect.left && y < rect.bottom && y + SIZE > rect.top;
    }

    function hitsAny(x, y, rects) {
      for (let i = 0; i < rects.length; i++) {
        if (overlaps(x, y, rects[i])) return true;
      }
      return false;
    }

    function bounceOff(ball, rects) {
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        if (!overlaps(ball.x, ball.y, rect)) continue;
        const overlapL = ball.x + SIZE - rect.left;
        const overlapR = rect.right - ball.x;
        const overlapT = ball.y + SIZE - rect.top;
        const overlapB = rect.bottom - ball.y;
        const minX = Math.min(overlapL, overlapR);
        const minY = Math.min(overlapT, overlapB);
        if (minX < minY) {
          if (overlapL < overlapR) {
            ball.x = rect.left - SIZE;
            ball.vx = -Math.abs(ball.vx);
          } else {
            ball.x = rect.right;
            ball.vx = Math.abs(ball.vx);
          }
        } else if (overlapT < overlapB) {
          ball.y = rect.top - SIZE;
          ball.vy = -Math.abs(ball.vy);
        } else {
          ball.y = rect.bottom;
          ball.vy = Math.abs(ball.vy);
        }
      }
    }

    function spawn() {
      const area = Math.max(1, width * height);
      const count = Math.max(8, Math.min(16, Math.round(area / 90000)));
      const pack = images.length ? images : [null, null, null, null, null];
      const rects = obstacleRects();
      balls = [];
      for (let i = 0; i < count; i++) {
        const speed = rand(MIN_SPEED, MAX_SPEED);
        const angle = rand(0, Math.PI * 2);
        let x = rand(0, Math.max(1, width - SIZE));
        let y = rand(0, Math.max(1, height - SIZE));
        for (let tries = 0; tries < 24 && hitsAny(x, y, rects); tries++) {
          x = rand(0, Math.max(1, width - SIZE));
          y = rand(0, Math.max(1, height - SIZE));
        }
        balls.push({
          img: pack[i % pack.length],
          color: FALLBACK[i % FALLBACK.length],
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        });
      }
    }

    function makeBall(index, x, y, vx, vy) {
      const pack = images.length ? images : [null, null, null, null, null];
      return {
        img: pack[index % pack.length],
        color: FALLBACK[index % FALLBACK.length],
        x: x,
        y: y,
        vx: vx,
        vy: vy,
      };
    }

    function resultButtonTop() {
      const buttons = document.querySelectorAll(".result-btn");
      let top = height;
      let found = false;
      for (let i = 0; i < buttons.length; i++) {
        const node = buttons[i];
        if (node.hidden) continue;
        const box = node.getBoundingClientRect();
        if (box.height < 4) continue;
        if (!found || box.top < top) {
          top = box.top;
          found = true;
        }
      }
      if (found) return top;
      let rem = 16;
      try {
        rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      } catch (err) {
        /* ignore */
      }
      return height - 1.35 * rem - 64;
    }

    function burstSpawnY() {
      const y = resultButtonTop() - SIZE - rand(12, 28);
      return Math.max(8, Math.min(y, height - SIZE - 8));
    }

    function spawnBurst() {
      balls = [];
      const generation = burstGeneration;
      const area = Math.max(1, width * height);
      const total = Math.max(12, Math.min(20, Math.round(area / 70000)));
      let emitted = 0;
      const interval = 55;

      function emitPair() {
        if (generation !== burstGeneration || emitted >= total) return;
        const speedL = rand(2.8, 4.6);
        const speedR = rand(2.8, 4.6);
        const angleL = rand(-Math.PI * 0.72, -Math.PI * 0.18);
        const angleR = rand(-Math.PI * 0.82, -Math.PI * 0.28);
        const originY = burstSpawnY();
        balls.push(
          makeBall(
            emitted,
            rand(4, 18),
            originY,
            Math.cos(angleL) * speedL,
            Math.sin(angleL) * speedL
          )
        );
        emitted += 1;
        if (emitted >= total) return;
        balls.push(
          makeBall(
            emitted,
            width - SIZE - rand(4, 18),
            originY,
            Math.cos(angleR) * speedR,
            Math.sin(angleR) * speedR
          )
        );
        emitted += 1;
        if (emitted < total) window.setTimeout(emitPair, interval);
      }

      emitPair();
    }

    function restore(state) {
      if (!state) return false;
      tileOffset = Number(state.tileOffset) || 0;
      const sx = width / Math.max(1, Number(state.width) || width);
      const sy = height / Math.max(1, Number(state.height) || height);
      const saved = state.balls || [];
      balls = saved.map(function (item, i) {
        const imgIndex = item.imgIndex >= 0 ? item.imgIndex : i;
        const ball = {
          img: images[imgIndex] || images[0] || null,
          color: item.color || FALLBACK[i % FALLBACK.length],
          x: (Number(item.x) || 0) * sx,
          y: (Number(item.y) || 0) * sy,
          vx: Number(item.vx) || 0,
          vy: Number(item.vy) || 0,
        };
        if (!altRows) dampCruise(ball);
        return ball;
      });
      return balls.length > 0;
    }

    function drawRowBricks() {
      const lastRow = Math.ceil(height / brickSize) + 1;
      for (let row = -1; row <= lastRow; row++) {
        const dir = row % 2 === 0 ? 1 : -1;
        const xOff = ((dir * tileOffset) % brickSize + brickSize) % brickSize;
        ctx.save();
        ctx.translate(xOff, row * brickSize);
        ctx.fillStyle = brickPattern;
        ctx.fillRect(-brickSize, 0, width + brickSize * 2, brickSize);
        ctx.restore();
      }
    }

    function drawLiveBricks() {
      const xAxis = patternAxis(tileOffset, brickSize, width);
      const yAxis = patternAxis(tileOffset, brickSize, height);
      ctx.save();
      ctx.translate(xAxis.translate, yAxis.translate);
      ctx.fillStyle = brickPattern;
      ctx.fillRect(xAxis.start, yAxis.start, xAxis.length, yAxis.length);
      ctx.restore();
    }

    function drawSpecialBricks(pattern, alpha) {
      if (!pattern || alpha <= 0) return;
      const patternSize = brickSize * 4;
      const xAxis = patternAxis(tileOffset, patternSize, width);
      const yAxis = patternAxis(tileOffset, patternSize, height);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(xAxis.translate, yAxis.translate);
      ctx.fillStyle = pattern;
      ctx.fillRect(xAxis.start, yAxis.start, xAxis.length, yAxis.length);
      ctx.restore();
    }

    function drawEnteringSpecialBricks(image, now) {
      if (!image || !communityOrigin) return;
      const elapsed = (Number(now) || clockNow()) - communityEnterStartedAt;
      const patternSize = brickSize * 4;
      const xAxis = patternAxis(tileOffset, patternSize, width);
      const yAxis = patternAxis(tileOffset, patternSize, height);
      const startX = xAxis.translate + xAxis.start;
      const startY = yAxis.translate + yAxis.start;
      const farX = Math.max(communityOrigin.x, width - communityOrigin.x);
      const farY = Math.max(communityOrigin.y, height - communityOrigin.y);
      const maximumDistance = Math.hypot(farX, farY) + brickSize * 2;

      ctx.save();
      for (let y = startY; y < height + patternSize; y += patternSize) {
        for (let x = startX; x < width + patternSize; x += patternSize) {
          [[x, y], [x + brickSize * 2, y + brickSize * 2]].forEach(function (cell) {
            const distance = Math.hypot(
              cell[0] + brickSize / 2 - communityOrigin.x,
              cell[1] + brickSize / 2 - communityOrigin.y
            );
            const alpha = specialCellReveal(distance, elapsed, COMMUNITY_ENTER_MS, maximumDistance);
            if (alpha <= 0) return;
            ctx.globalAlpha = alpha;
            ctx.drawImage(image, cell[0], cell[1], brickSize, brickSize);
          });
        }
      }
      ctx.restore();
      if (elapsed >= COMMUNITY_ENTER_MS) communityEntering = false;
    }

    function drawCommunityBricks(now) {
      drawLiveBricks();
      if (communityEntering) {
        drawEnteringSpecialBricks(specialImages[specialTab], now);
        return;
      }
      const current = specialPatterns[specialTab];
      if (!previousSpecialTab || reduce) {
        drawSpecialBricks(current, 1);
        return;
      }
      const mix = specialBrickFade((Number(now) || clockNow()) - specialFadeStartedAt, SPECIAL_FADE_MS);
      drawSpecialBricks(specialPatterns[previousSpecialTab], 1 - mix);
      drawSpecialBricks(current, mix);
      if (mix >= 1) previousSpecialTab = null;
    }

    function drawBricks(now) {
      if (!brickPattern) {
        ctx.fillStyle = "#232833";
        ctx.fillRect(0, 0, width, height);
        return;
      }
      if (community) {
        drawCommunityBricks(now);
        return;
      }
      if (brickBlend >= 0.995) {
        drawRowBricks();
        return;
      }
      if (brickBlend <= 0.005) {
        drawLiveBricks();
        return;
      }
      drawLiveBricks();
      ctx.save();
      ctx.globalAlpha = brickBlend;
      drawRowBricks();
      ctx.restore();
    }

    function draw(now) {
      ctx.clearRect(0, 0, width, height);
      drawBricks(now);
      if (ballAlpha <= 0 || !balls.length) return;
      ctx.save();
      ctx.globalAlpha = ballAlpha;
      balls.forEach(function (ball) {
        if (ball.img) {
          if (window.Inkball && typeof window.Inkball.drawBallImage === "function") {
            window.Inkball.drawBallImage(ctx, ball.img, ball.x, ball.y, SIZE);
          } else {
            ctx.drawImage(ball.img, ball.x, ball.y, SIZE, SIZE);
          }
        } else {
          ctx.fillStyle = ball.color;
          ctx.beginPath();
          ctx.arc(ball.x + SIZE / 2, ball.y + SIZE / 2, SIZE / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();
    }

    function dampCruise(ball) {
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed < 0.01 || speed <= MAX_SPEED) return;
      const scale = MAX_SPEED / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }

    function step(now) {
      if (!community || communityEntering) {
        const rects = obstacleRects();
        balls.forEach(function (ball) {
          ball.x += ball.vx;
          ball.y += ball.vy;
        });
        window.InkballBallPhysics.resolveAll(balls);
        balls.forEach(function (ball) {
          bounceOff(ball, rects);
          if (ball.x <= 0) {
            ball.x = 0;
            ball.vx = Math.abs(ball.vx);
          } else if (ball.x + SIZE >= width) {
            ball.x = width - SIZE;
            ball.vx = -Math.abs(ball.vx);
          }
          if (ball.y <= 0) {
            ball.y = 0;
            ball.vy = Math.abs(ball.vy);
          } else if (ball.y + SIZE >= height) {
            ball.y = height - SIZE;
            ball.vy = -Math.abs(ball.vy);
          }
          if (!altRows) dampCruise(ball);
        });
      }
      if (communityEntering) {
        const elapsed = Math.max(0, (Number(now) || clockNow()) - communityEnterStartedAt);
        ballAlpha = Math.max(0, 1 - elapsed / COMMUNITY_BALL_FADE_MS);
        if (ballAlpha <= 0) balls = [];
      }
      if (!reduce) tileOffset = advanceTileOffset(tileOffset, TILE_DRIFT, brickSize, community);
      if (!altRows && brickBlend > 0) {
        brickBlend = Math.max(0, brickBlend - 1 / 50);
      }
      draw(now);
    }

    function loop(now) {
      if (!running) return;
      step(now);
      raf = window.requestAnimationFrame(loop);
    }

    function play() {
      if (still || reduce || running || document.hidden || canvas.closest(".view")?.hidden) return;
      running = true;
      raf = window.requestAnimationFrame(loop);
    }

    function pause() {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = null;
    }

    function dismissCover() {
      if (altRows) return;
      const cover = document.getElementById("ambient-handoff");
      if (!cover) {
        document.documentElement.classList.remove("is-ambient-handoff");
        document.documentElement.classList.remove("is-community-ambient-handoff");
        return;
      }
      document.documentElement.classList.add("is-ambient-ready");
      window.setTimeout(function () {
        document.documentElement.classList.remove("is-ambient-handoff");
        document.documentElement.classList.remove("is-ambient-ready");
        document.documentElement.classList.remove("is-community-ambient-handoff");
        if (cover.parentNode) cover.parentNode.removeChild(cover);
        try {
          sessionStorage.removeItem(FRAME_KEY);
          sessionStorage.removeItem(COMMUNITY_HANDOFF_KEY);
        } catch (err) {
          /* ignore */
        }
      }, document.documentElement.classList.contains("is-community-ambient-handoff")
        ? COMMUNITY_HANDOFF_MS
        : COVER_MS);
    }

    function fadeBalls() {
      if (!balls.length || ballAlpha <= 0) {
        draw();
        return;
      }
      if (reduce) {
        ballAlpha = 0;
        balls = [];
        writeState({ tileOffset: tileOffset, width: width, height: height, balls: [] });
        draw();
        return;
      }
      const origin = ballAlpha;
      const began = clockNow();
      function tick(now) {
        const t = Math.min(1, (now - began) / FADE_MS);
        ballAlpha = origin * (1 - t);
        draw();
        if (t < 1) {
          raf = window.requestAnimationFrame(tick);
          return;
        }
        ballAlpha = 0;
        balls = [];
        writeState({ tileOffset: tileOffset, width: width, height: height, balls: [] });
      }
      raf = window.requestAnimationFrame(tick);
    }

    const urls = window.INKBALL_SPRITES || {};
    const wallUrl = urls.walls && urls.walls[0];
    const ambientBrickUrls = urls.ambient_bricks || {};
    const ambientTabs = ["community", "favorites", "custom"];
    Promise.all([
      Promise.all((urls.balls || []).map(loadImage)),
      loadImage(wallUrl),
      Promise.all(ambientTabs.map(function (tab) { return loadImage(ambientBrickUrls[tab]); })),
    ]).then(function (parts) {
      images = (parts[0] || []).filter(Boolean);
      const wall = parts[1];
      brickCell = bakeBrick(wall);
      brickSize = (brickCell && brickCell.width) || 32;
      ambientTabs.forEach(function (tab, index) {
        if (parts[2][index]) specialImages[tab] = parts[2][index];
        const cell = bakeSpecialCell(parts[2][index]);
        if (cell) specialCells[tab] = cell;
      });
      resize();
      ready = true;
      if (altRows && pendingResultCleared !== null) {
        ambientApi.restartResult(pendingResultCleared);
        return;
      }
      const saved = readState();
      if (community) {
        const handoff = saved && saved.mode === "live" && saved.communityOrigin;
        const restored = handoff && restore(saved);
        if (handoff && !reduce) {
          communityOrigin = {
            x: Math.max(0, Math.min(1, Number(saved.communityOrigin.x) || 0)) * width,
            y: Math.max(0, Math.min(1, Number(saved.communityOrigin.y) || 0)) * height,
          };
          communityEnterStartedAt = clockNow();
          communityEntering = true;
          ballAlpha = restored ? 1 : 0;
        } else {
          balls = [];
          ballAlpha = 0;
        }
        draw(communityEnterStartedAt || clockNow());
        play();
        dismissCover();
      } else if (still) {
        if (canvas.closest(".view")) {
          // These App routes share one document; keep their floor static.
          balls = [];
          ballAlpha = 0;
          draw();
        } else {
          const hasBalls = restore(saved);
          ballAlpha = hasBalls ? 1 : 0;
          draw();
          fadeBalls();
          dismissCover();
        }
      } else {
        const handingOff = document.documentElement.classList.contains("is-ambient-handoff");
        const restored = handingOff && restore(saved);
        if (restored && saved && saved.mode === "rows" && !altRows) {
          brickBlend = 1;
        }
        if (!restored) {
          if (burst && !reduce) spawnBurst();
          else spawn();
        }
        ballAlpha = 1;
        draw();
        play();
        dismissCover();
      }
    });

    window.addEventListener("resize", function () {
      resize();
      draw();
    });
    document.addEventListener("visibilitychange", function () {
      if (still) return;
      if (document.hidden) pause();
      else play();
    });
    window.addEventListener("inkball:communitytabchange", function (event) {
      const tab = event && event.detail && event.detail.tab;
      setCommunityTab(tab);
    });
    if (community) {
      const homeLink = document.querySelector("a.community-back");
      if (homeLink) {
        homeLink.addEventListener("click", function () {
          snapshot();
          ambientApi.markCommunityHandoff();
        });
      }
    }
    window.addEventListener("inkball:routechange", function () {
      if (canvas.closest(".view")?.hidden) pause();
      else play();
    });
    window.addEventListener("pagehide", function () {
      if (mode === "live") snapshot();
    });
  }

  function startAll() {
    document.querySelectorAll("[data-map-ambient]").forEach(start);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startAll);
  } else {
    startAll();
  }
})();
