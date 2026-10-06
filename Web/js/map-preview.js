/** Static board previews reuse the game's parser and tile renderers.
 * Queued balls are never spawned; all elements present at level start are shown.
 */
(function () {
  const SIZE = 576;
  let sprites = null;
  let loadPromise = null;

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function emptySprites() {
    return { wallImages: [], holeImages: [], ballImages: [], brickImages: [],
      keyWallImages: [], oneWayImages: {}, acceleratorImages: {} };
  }

  function loadSprites() {
    if (loadPromise) return loadPromise;
    const urls = window.INKBALL_SPRITES || {};
    const list = function (paths) { return Promise.all((paths || []).map(loadImage)); };
    const directions = function (paths, loader) {
      return Promise.all(Object.entries(paths || {}).map(async function ([dir, path]) {
        return [dir, await loader(path)];
      })).then(Object.fromEntries);
    };
    loadPromise = Promise.all([
      loadImage(urls.tile), loadImage(urls.entrypoint), list(urls.walls),
      list(urls.holes), list(urls.balls), list(urls.key_walls),
      Promise.all((urls.bricks || []).map(list)),
      directions(urls.one_way, list), directions(urls.accelerators, loadImage),
    ]).then(function (parts) {
      sprites = { tileImage: parts[0], spawnerImage: parts[1], wallImages: parts[2],
        holeImages: parts[3], ballImages: parts[4], keyWallImages: parts[5],
        brickImages: parts[6], oneWayImages: parts[7], acceleratorImages: parts[8] };
      return sprites;
    });
    return loadPromise;
  }

  function contextFor(canvas) {
    if (canvas.width !== SIZE) canvas.width = SIZE;
    if (canvas.height !== SIZE) canvas.height = SIZE;
    return canvas.getContext('2d');
  }

  function drawFloor(ctx) {
    ctx.fillStyle = '#1a1d23';
    ctx.fillRect(0, 0, SIZE, SIZE);
    if (!sprites?.tileImage) return;
    for (let y = 0; y < SIZE; y += Inkball.CELLSIZE) {
      for (let x = 0; x < SIZE; x += Inkball.CELLSIZE) {
        ctx.drawImage(sprites.tileImage, x, y, Inkball.CELLSIZE, Inkball.CELLSIZE);
      }
    }
  }

  function sceneFor(source) {
    const config = typeof source === 'string' ? { layout_content: source } : (source || {});
    const level = new Inkball.Level(sprites || emptySprites(), config, config.layout_content || '');
    const scene = [];
    function add(kind, item, draw) {
      // Compare visible properties, excluding ball velocities and the spawn queue.
      const properties = ['type', 'x', 'y', 'gx', 'gy', 'width', 'height', 'size',
        'wallIndex', 'colorIndex', 'group', 'dir', 'lifetime'];
      const key = JSON.stringify([kind, item.constructor.name,
        ...properties.map(function (property) { return item[property] ?? null; })]);
      scene.push({ key: key, draw: draw });
    }
    level.elements.forEach(function (element) {
      if (element.type !== 'tile') add('element', element, function (ctx) { element.draw(ctx, level.app); });
    });
    level.extTiles.forEach(function (tile) {
      if (!tile.removed) add('tile', tile, function (ctx) { tile.draw(ctx, level.app); });
    });
    level.holes.forEach(function (hole) { add('hole', hole, function (ctx) { hole.draw(ctx); }); });
    level.ballsInGame.forEach(function (ball) { add('ball', ball, function (ctx) { ball.draw(ctx); }); });
    return scene;
  }

  function drawScene(ctx, scene) {
    ctx.save();
    ctx.translate(0, -Inkball.TOP_OFFSET);
    scene.forEach(function (item) { item.draw(ctx); });
    ctx.restore();
  }

  function drawElements(ctx, source) {
    drawScene(ctx, sceneFor(source));
  }

  function paintScene(canvas, scene) {
    const ctx = contextFor(canvas);
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawScene(ctx, scene);
  }

  function drawDifferenceLayersSync(floor, stable, outgoing, incoming, before, after) {
    const oldScene = sceneFor(before), newScene = sceneFor(after);
    const oldKeys = new Set(oldScene.map(function (item) { return item.key; }));
    const newKeys = new Set(newScene.map(function (item) { return item.key; }));
    const shared = newScene.filter(function (item) { return oldKeys.has(item.key); });
    const removed = oldScene.filter(function (item) { return !newKeys.has(item.key); });
    const added = newScene.filter(function (item) { return !oldKeys.has(item.key); });
    drawFloor(contextFor(floor));
    paintScene(stable, shared);
    paintScene(outgoing, removed);
    paintScene(incoming, added);
    return removed.length > 0 || added.length > 0;
  }

  function drawPreview(canvas, source) {
    if (!canvas) return;
    const ctx = contextFor(canvas);
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawFloor(ctx);
    drawElements(ctx, source);
  }

  function drawLayersSync(floor, elements, source) {
    if (!floor || !elements) return;
    drawFloor(contextFor(floor));
    const ctx = contextFor(elements);
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawElements(ctx, source);
  }

  window.InkballMapPreview = {
    draw: function (canvas, source) {
      return loadSprites().then(function () { drawPreview(canvas, source); });
    },
    drawSync: drawPreview,
    drawLayersSync: drawLayersSync,
    drawDifferenceLayersSync: drawDifferenceLayersSync,
    ready: loadSprites,
  };
})();
