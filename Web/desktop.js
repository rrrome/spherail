(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const all = (selector) => Array.from(document.querySelectorAll(selector));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const labels = { easy: '萌新', hard: '进阶', master: '大师' };
  const colors = ['grey', 'orange', 'blue', 'green', 'yellow'];
  const colorFill = ['#cdd5e7', '#f5a065', '#5d9cf5', '#7ccc8b', '#f2d475'];
  const official = window.INKBALL_OFFICIAL.maps;
  let profile = null;
  let customMaps = [];
  let records = {};
  let achievements = {};
  let match = {};
  let matchEntry = null;
  let peers = new Map();
  let draft = null;
  let savedDraft = null;
  let activeDifficulty = 'easy';
  let history = InkballEditorHistory.create(80);
  let selectedAvatarData = '';
  let cropImage = null;
  let cropObjectURL = null;
  let cropZoom = 1;
  let cropOffset = { x: 0, y: 0 };
  let cropDrag = null;
  let currentPlay = null;
  let game = null;
  let matchOutcome = null;
  let matchLocalResult = null;
  let matchErrorMessage = '';
  let countdownTicker = null;
  let codeMode = 'import';
  let editorStroke = null;
  let editorMode = 'place';
  let editorHover = null;
  let editorHistories = {};
  let timedEditCell = null;
  let detailMap = null;
  let detailDifficulty = 'easy';
  let detailAnimation = null;
  let detailReturnFly = null;
  let detailPreviewTimer = null;
  let detailPreviewRequest = 0;
  let detailPreviewLevel = null;
  let detailElementAnimations = [];
  let pendingDeleteMap = null;
  let resultAnimation = null;
  let resultRevealTimer = null;
  const editorImages = new Map();
  let selectedSpec = null;
  let detail3D = null;

  const pending = new Map();
  const eventListeners = new Map();
  let requestID = 0;
  window.InkBallNative = {
    call(action, payload = {}) {
      const id = ++requestID;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        window.webkit.messageHandlers.inkball.postMessage({ id, action, payload });
      });
    },
    receive(message) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error));
      else entry.resolve(message.result);
    },
    on(event, callback) {
      const list = eventListeners.get(event) || [];
      list.push(callback);
      eventListeners.set(event, list);
      return () => eventListeners.set(event, (eventListeners.get(event) || []).filter((fn) => fn !== callback));
    },
    emit(message) {
      for (const callback of eventListeners.get(message.event) || []) callback(message.data || {});
    },
  };
  const native = window.InkBallNative;

  // The existing canvas engine and opponent renderer use these small global contracts.
  window.Inkball = window.Inkball || {};
  Inkball.t = (key, params = {}) => {
    let value = window.INKBALL_I18N?.[window.InkballDesktopI18n?.language || 'zh']?.[key] || key;
    for (const [name, replacement] of Object.entries(params)) value = value.replaceAll('{' + name + '}', replacement);
    return value;
  };
  Inkball.drawBallImage = (ctx, img, x, y, size) => {
    if (!ctx || !img || !(size > 0)) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
  };
  const spriteBase = 'img/inkball/';
  const indices = [0, 1, 2, 3, 4];
  window.INKBALL_SPRITES = {
    tile: spriteBase + 'tile.png', entrypoint: spriteBase + 'entrypoint.png',
    walls: indices.map((i) => spriteBase + `wall${i}.png`),
    bricks: indices.map((i) => [0, 1, 2].map((frame) => spriteBase + `brick${i}${frame ? '_' + frame : ''}.png`)),
    balls: indices.map((i) => spriteBase + `ball${i}.png`),
    holes: indices.map((i) => spriteBase + `hole${i}.png`),
    one_way: Object.fromEntries(['U', 'D', 'L', 'R'].map((dir) => [dir, indices.map((i) => spriteBase + `one_way_${dir.toLowerCase()}${i}.png`)])),
    accelerators: Object.fromEntries(['U', 'D', 'L', 'R'].map((dir) => [dir, spriteBase + `accelerator_${dir.toLowerCase()}.png`])),
    ambient_bricks: { community: spriteBase + 'ambient_community.png', favorites: spriteBase + 'ambient_favorite.png', custom: spriteBase + 'ambient_diy.png' },
  };
  window.INKBALL_SPRITES.key_walls = Array.from({ length: 5 }, (_, color) => spriteBase + `key_wall${color}.png`);
  window.INKBALL_API = { matchRoomSnapshots: () => '' };
  window.InkballApi = {};
  window.InkballUI = { confirm: async (message) => window.confirm(message) };
  window.InkballMatchSocket = class {
    constructor() { this.handlers = new Map(); this.unsubscribe = []; this.open = false; }
    on(event, callback) { this.handlers.set(event, callback); }
    connect() {
      this.open = true;
      this.unsubscribe.push(native.on('opponentSnapshot', (packet) => this.handlers.get('opponent.snapshot')?.(packet)));
      this.unsubscribe.push(native.on('matchDisconnected', (packet) => this.handlers.get('opponent.connection')?.({ status: 'reconnecting', ...packet })));
      this.unsubscribe.push(native.on('matchReconnected', () => this.handlers.get('opponent.connection')?.({ status: 'connected' })));
      this.unsubscribe.push(native.on('opponentLeft', (event) => this.handlers.get('opponent.connection')?.({
        status: event?.finished ? (event.cleared ? 'completed' : 'failed') : 'forfeited',
      })));
      return Promise.resolve();
    }
    isOpen() { return this.open; }
    sendSnapshot(snapshot) { return native.call('matchSend', { snapshot }); }
    close() { this.open = false; this.unsubscribe.forEach((fn) => fn()); }
  };
  const matchStart = window.InkballMatchSync.prototype.start;
  window.InkballMatchSync.prototype.start = function (...args) {
    const original = EventTarget.prototype.addEventListener;
    const listeners = this.app._desktopListeners || [];
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      listeners.push([this, type, listener, options]);
      return original.call(this, type, listener, options);
    };
    try { return matchStart.apply(this, args); }
    finally { EventTarget.prototype.addEventListener = original; }
  };

  function stopGame() {
    const pauseOverlay = $('[data-pause-overlay]');
    if (pauseOverlay?.open) pauseOverlay.close();
    if (pauseOverlay) pauseOverlay.hidden = true;
    if (!game) return;
    game._allowUnload = true;
    if (game._desktopClockTimer) window.clearInterval(game._desktopClockTimer);
    if (game._rafId != null) cancelAnimationFrame(game._rafId);
    game._rafId = null;
    game.matchSync?.stop();
    for (const [target, type, listener, options] of game._desktopListeners || []) {
      target.removeEventListener(type, listener, options);
    }
    game = null;
    window.inkballApp = null;
  }

  function attachWallClock(instance) {
    instance._usesWallClockTimer = true;
    instance._desktopClockAt = Date.now();
    instance._desktopClockLevel = null;
    instance.advanceWallClock = function (now = Date.now()) {
      const level = this.currentLevel;
      if (!level || level !== this._desktopClockLevel) {
        this._desktopClockLevel = level;
        this._desktopClockAt = now;
        return;
      }
      const elapsed = Math.max(0, (now - this._desktopClockAt) / 1000);
      this._desktopClockAt = now;
      if (this.isPaused || this.isLevelEnded || this.isGameEnded || !(level.levelTimer > 0)) return;
      level.levelTimer = Math.max(0, level.levelTimer - elapsed);
      if (level.levelTimer === 0) {
        level.timeUp = true;
        this.isLevelEnded = true;
        this._finishAttempt(false);
      }
    };
    const originalUpdate = instance.update;
    instance.update = function (dt) { this.advanceWallClock(); return originalUpdate.call(this, dt); };
    const originalResume = instance.resume;
    instance.resume = function (...args) {
      this._desktopClockAt = Date.now();
      return originalResume.apply(this, args);
    };
  }

  function startWallClock(instance) {
    const tick = () => instance.advanceWallClock();
    instance._desktopClockTimer = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    instance._desktopListeners.push([document, 'visibilitychange', tick]);
    instance._desktopListeners.push([window, 'focus', tick]);
  }

  async function initializeGame(instance) {
    const listeners = [];
    // Capture only the engine's synchronous binding methods. A new game can
    // then remove their anonymous callbacks without replacing a global API
    // across an asynchronous image load.
    for (const name of ['_bindPauseMenu', '_bindInput', '_bindLeaveGuard']) {
      const originalMethod = instance[name];
      instance[name] = function (...args) {
        const original = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (type, listener, options) {
          listeners.push([this, type, listener, options]);
          return original.call(this, type, listener, options);
        };
        try { return originalMethod.apply(this, args); }
        finally { EventTarget.prototype.addEventListener = original; }
      };
    }
    instance._desktopListeners = listeners;
    await instance.init();
  }

  function bindMatchMenu(instance) {
    const button = $('[data-pause-open]');
    const overlay = $('[data-pause-overlay]');
    const home = $('[data-pause-home]');
    const resume = $('[data-pause-resume]');
    button.hidden = false;
    $('[data-pause-restart]').hidden = true;
    $('#pause-dialog-title').textContent = '对战进行中';
    $('#pause-home-label').textContent = '退出对战';
    const listen = (target, type, callback) => {
      target.addEventListener(type, callback);
      instance._desktopListeners.push([target, type, callback]);
    };
    listen(button, 'click', () => { overlay.hidden = false; overlay.showModal(); });
    listen(resume, 'click', () => overlay.close());
    listen(overlay, 'cancel', (event) => { event.preventDefault(); overlay.close(); });
    listen(home, 'click', (event) => {
      event.preventDefault();
      overlay.close();
      $('#match-exit-dialog').showModal();
    });
  }

  let libraryAnimations = [];
  let libraryAnimationTimer = 0;
  let navHighlightTimer = 0;
  function animateLibraryRoute(route, previous) {
    clearTimeout(libraryAnimationTimer);
    libraryAnimations.forEach((animation) => animation.cancel());
    libraryAnimations = [];
    if (!['maps', 'personal'].includes(route) || !['maps', 'personal'].includes(previous) || route === previous) return;
    const view = $('#' + route + '-view');
    view.classList.remove('is-view-entering');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const direction = route === 'personal' ? 1 : -1;
    const selector = route === 'maps' ? '.map-home__stage,.map-home__footer' : '.workshop-count,.workshop-grid';
    libraryAnimations = [...view.querySelectorAll(selector)].map((node, index) => node.animate([
      { opacity: 0, transform: `translateX(${direction * 40}px) scale(.98)` },
      { opacity: 1, transform: 'translateX(0) scale(1)' },
    ], { duration: 360, delay: index * 35, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
    // WKWebView may suspend its animation timeline during Space/fullscreen changes.
    // Always release temporary transforms so navigation cannot remain half faded.
    libraryAnimationTimer = window.setTimeout(() => {
      libraryAnimations.forEach((animation) => animation.cancel());
      libraryAnimations = [];
    }, 520);
  }
  function show(route) {
    const previous = all('.view').find((section) => !section.hidden)?.id.replace('-view', '');
    if (route !== 'detail') detail3D?.dispose();
    if (route !== 'editor') closeEditorGuide();
    if (route !== 'play') closePlayGuide();
    if (route !== 'play' && $('#play-view').hidden === false) stopGame();
    if (route !== 'detail' && detailAnimation) finishDetailAnimation();
    if (route !== 'maps' && detailReturnFly) clearDetailReturnFly();
    all('.view').forEach((section) => {
      const visible = section.id === route + '-view';
      if (visible && section.hidden) {
        section.classList.remove('is-view-entering');
        void section.offsetWidth;
        section.classList.add('is-view-entering');
      }
      section.hidden = !visible;
    });
    all('[data-route]').forEach((button) => button.classList.toggle('active', button.dataset.route === route || (route === 'editor' && button.dataset.route === 'personal') || (route === 'detail' && button.dataset.route === (detailMap?.official ? 'maps' : 'personal'))));
    if (previous !== route) document.body.scrollTop = 0;
    updateNavHighlight();
    window.dispatchEvent(new Event('inkball:routechange'));
    if (route === 'personal') renderMaps();
    if (route === 'detail') { renderDetail(); positionDetailHero(); }
    if (route === 'editor') renderEditor();
    if (route === 'match') renderMatch();
    animateLibraryRoute(route, previous);
  }

  function updateNavHighlight(animate = true) {
    const nav = $('.app-header nav'), active = nav.querySelector('button.active');
    const highlight = nav.querySelector('.app-nav-highlight');
    if (!active || !nav.getBoundingClientRect().width) return;
    window.clearTimeout(navHighlightTimer);
    nav.classList.toggle('is-highlight-ready', animate && highlight.dataset.positioned === 'true');
    Object.assign(highlight.style, { width: `${active.offsetWidth}px`, height: `${active.offsetHeight}px`,
      transform: `translate(${active.offsetLeft}px,${active.offsetTop}px)` });
    highlight.dataset.positioned = 'true';
    // Settle the destination even when WebKit suspends its animation timeline.
    navHighlightTimer = window.setTimeout(() => nav.classList.remove('is-highlight-ready'), 360);
  }

  function mapByID(id) { return [...official, ...customMaps].find((row) => row.id === id); }
  function difficultyOptions(map) { return Object.keys(labels).filter((d) => map.difficulties?.[d]); }
  function defaultPreviewLevel(map) { return map.difficulties[difficultyOptions(map)[0]]; }
  function textNode(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function actionButton(label, callback, className) {
    const button = textNode('button', label, className);
    button.type = 'button'; button.addEventListener('click', callback);
    return button;
  }
  function displayName(map) {
    return map.official ? Inkball.t(`map.name.${map.id}`) : map.name;
  }
  function buildOfficialCarousel() {
    const track = $('#official-map-list');
    track.replaceChildren();
    $('#maps-view').dataset.mapCount = String(official.length);
    $('[data-carousel-total]').textContent = '/ ' + String(official.length).padStart(2, '0');
    $('#inkball-maps').textContent = JSON.stringify(official.map((map) => ({ slug: map.id, layout: defaultPreviewLevel(map) })));
    official.forEach((map, index) => {
      const card = document.createElement('a');
      card.className = 'map-card'; card.href = '#detail';
      card.dataset.mapSlug = map.id; card.dataset.mapIndex = String(index);
      const plate = textNode('span', '', 'map-card__plate');
      plate.append(textNode('span', `SPHERAIL / ${String(index + 1).padStart(2, '0')}`), textNode('span', '', 'map-card__contacts'));
      const surface = textNode('span', '', 'map-card__preview-frame map-preview-surface');
      const canvas = document.createElement('canvas'); canvas.className = 'map-card__preview';
      canvas.width = 576; canvas.height = 576; surface.append(canvas);
      const caption = textNode('span', '', 'map-card__caption');
      const enter = textNode('span', '', 'map-card__enter');
      const icon = document.createElement('img'); icon.src = 'img/ui/open-map.svg'; icon.alt = '';
      enter.append(icon); caption.append(textNode('span', displayName(map), 'map-card__name'), enter);
      card.append(plate, surface, caption); track.append(card);
    });
  }
  function renderMaps() {
    const target = $('#personal-map-list'); target.replaceChildren();
    $('#personal-count').textContent = String(customMaps.length);
    const create = document.createElement('button');
    create.type = 'button'; create.id = 'personal-create';
    create.className = 'workshop-card workshop-card--create';
    const createContent = textNode('span', '', 'workshop-card__create-content');
    createContent.append(textNode('span', '+', 'workshop-card__plus'), textNode('span', '新建地图', 'workshop-card__create-label'));
    const titleSpacer = textNode('span', '', 'workshop-card__title');
    const previewSpacer = textNode('span', '', 'workshop-card__preview');
    const actionSpacer = textNode('span', '', 'workshop-card__actions');
    for (const spacer of [titleSpacer, previewSpacer, actionSpacer]) spacer.setAttribute('aria-hidden', 'true');
    create.append(titleSpacer, previewSpacer, actionSpacer, createContent);
    create.addEventListener('click', () => { openEditor(); show('editor'); });
    target.append(create);
    const query = $('#personal-query').value.trim().toLocaleLowerCase();
    const direction = $('#personal-sort').value === 'oldest' ? 1 : -1;
    const maps = customMaps.map((map, index) => ({ map, index }))
      .filter(({ map }) => map.name.toLocaleLowerCase().includes(query))
      .sort((a, b) => {
        const difference = ((Date.parse(a.map.updatedAt) || 0) - (Date.parse(b.map.updatedAt) || 0)) * direction;
        return difference || a.index - b.index;
      });
    $('#personal-empty').hidden = maps.length !== 0 || !query;
    for (const { map } of maps) {
      const card = textNode('article', '', 'workshop-card');
      card.dataset.mapID = map.id;
      const title = textNode('h3', map.name, 'workshop-card__title');
      title.setAttribute('translate', 'no');
      card.append(title);
      const surface = document.createElement('button');
      surface.type = 'button'; surface.className = 'workshop-card__preview';
      surface.setAttribute('aria-label', `游玩 ${map.name}`);
      const preview = document.createElement('canvas');
      preview.width = 576; preview.height = 576; surface.append(preview);
      surface.addEventListener('click', () => openMapDetail(map, card));
      card.append(surface);
      const buttons = textNode('div', '', 'workshop-card__actions');
      const edit = actionButton('', () => { openEditor(map); show('editor'); }, 'workshop-card__edit');
      edit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5Z"/></svg><span>编辑地图</span>';
      buttons.append(edit);
      const remove = actionButton('', () => {
        pendingDeleteMap = map;
        $('#delete-map-name').textContent = map.name;
        $('#delete-map-dialog').showModal();
      }, 'workshop-card__delete');
      remove.setAttribute('aria-label', '删除地图'); remove.title = '删除地图';
      remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
      buttons.append(remove);
      card.append(buttons); target.append(card);
      const level = map.difficulties[difficultyOptions(map)[0]];
      if (window.InkballMapPreview && level) InkballMapPreview.draw(preview, level)
        .then(() => surface.classList.add('is-preview-ready'));
    }
  }
  function achievementCondition(row) {
    const keys = {
      clear: 'map.achievementCondition.clear',
      score_at_least: 'map.achievementCondition.scoreAtLeast',
      no_wrong_captures: 'map.achievementCondition.noWrongCaptures',
      max_duration_seconds: 'map.achievementCondition.maxDuration',
      max_lines_drawn: Number(row.target) === 0 ? 'map.achievementCondition.noLines' : 'map.achievementCondition.maxLines',
    };
    return keys[row.criterion] ? Inkball.t(keys[row.criterion], { target: row.target }) : '';
  }
  function renderAchievements(map, difficulty) {
    const target = $('#detail-achievements');
    target.replaceChildren();
    if (!map.official) return;
    const definitions = [...(map.difficulties[difficulty]?.achievements || [])]
      .sort((a, b) => a.display_order - b.display_order);
    for (const row of definitions) {
      const item = textNode('div', '', `map-achievement ${achievements[row.code] ? 'is-unlocked' : 'is-locked'}`);
      item.dataset.achievementCode = row.code;
      const trophy = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      trophy.setAttribute('class', 'map-achievement__trophy');
      trophy.setAttribute('viewBox', '0 0 24 24');
      trophy.innerHTML = '<path class="trophy-cup" d="M6 2h12v7c0 4.3-2.5 6.8-6 6.8S6 13.3 6 9V2ZM10.5 15h3v3H17v3H7v-3h3.5v-3Z"/><path class="trophy-handles" d="M6 4H2v4a4 4 0 0 0 4 4m12-8h4v4a4 4 0 0 1-4 4"/><path class="trophy-shine" d="M8 4h8M8 5v4c0 2.5 1.1 4 3 4.5"/>';
      trophy.setAttribute('aria-hidden', 'true');
      const copy = textNode('span', '', 'map-achievement__copy');
      copy.append(textNode('span', row.name_zh || row.name, 'map-achievement__title'),
        textNode('small', achievementCondition(row), 'map-achievement__condition'));
      item.append(trophy, copy);
      target.append(item);
    }
  }
  function positionDetailHero() {
    const hero = $('#detail-hero');
    const header = $('.app-header');
    const headerHeight = header?.getBoundingClientRect().height || 76;
    const size = Math.max(180, Math.min(576, window.innerWidth - 48, window.innerHeight - headerHeight - 48));
    hero.style.width = `${size}px`; hero.style.height = `${size}px`;
    hero.style.left = `${(window.innerWidth - size) / 2}px`;
    hero.style.top = `${headerHeight + (window.innerHeight - headerHeight - size) / 2}px`;
  }
  function finishDetailAnimation() {
    if (detailAnimation) detailAnimation.cancel();
    detailAnimation = null;
    $('#detail-view').classList.remove('is-map-entering');
  }
  function clearDetailReturnFly() {
    detailReturnFly?.remove();
    detailReturnFly = null;
  }
  function openMapDetail(map, origin = null) {
    clearDetailReturnFly();
    finishDetailAnimation();
    const source = origin?.querySelector('canvas');
    if (source && !origin.querySelector('.is-preview-ready') && window.InkballMapPreview) {
      InkballMapPreview.drawSync(source, defaultPreviewLevel(map));
    }
    const from = source?.getBoundingClientRect();
    const animateEntry = !!(source && from?.width > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    detailMap = map;
    if (map.official) $('#maps-view').dataset.returnMapSlug = map.id;
    $('#detail-export-status').textContent = '';
    detailDifficulty = difficultyOptions(map)[0] || 'easy';
    delete $('#detail-board').dataset.previewKey;
    delete $('#detail-board').dataset.mapID;
    if (animateEntry) $('#detail-view').classList.add('is-map-entering');
    show('detail');
    const hero = $('#detail-hero');
    const to = hero.getBoundingClientRect();
    if (!animateEntry || !to.width) { finishDetailAnimation(); return; }
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    detailAnimation = hero.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`, filter: 'brightness(1)' },
      { transform: 'none', filter: 'brightness(.52)' },
    ], { duration: 900, easing: 'ease-in-out', fill: 'both' });
    const animation = detailAnimation;
    let finished = false;
    const finish = () => { if (finished || detailAnimation !== animation) return; finished = true; finishDetailAnimation(); };
    animation.finished.then(finish).catch(() => {});
    window.setTimeout(finish, 1100);
  }
  function leaveMapDetail() {
    const route = detailMap?.official ? 'maps' : 'personal';
    if (route !== 'maps' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { show(route); return; }
    const source = $('#detail-board');
    const from = $('#detail-hero').getBoundingClientRect();
    if (!(from.width > 0)) { show(route); return; }
    clearDetailReturnFly();
    const fly = document.createElement('canvas');
    fly.className = 'map-home-return-fly'; fly.width = 576; fly.height = 576;
    const ctx = fly.getContext('2d');
    ctx.drawImage($('#detail-floor'), 0, 0, 576, 576);
    ctx.drawImage(source, 0, 0, 576, 576);
    ctx.save();
    for (const layer of [$('#detail-outgoing'), $('#detail-incoming')]) {
      if (layer.hidden) continue;
      ctx.globalAlpha = Number(getComputedStyle(layer).opacity);
      ctx.drawImage(layer, 0, 0, 576, 576);
    }
    ctx.restore();
    Object.assign(fly.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.append(fly); detailReturnFly = fly;
    show(route);
    const cards = all(`#official-map-list .map-card[data-map-slug="${detailMap.id}"]`);
    const targetCard = cards.reduce((nearest, card) => {
      const rect = card.getBoundingClientRect();
      if (!rect.width) return nearest;
      const distance = Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2);
      return !nearest || distance < nearest.distance ? { card, distance } : nearest;
    }, null)?.card;
    const to = targetCard?.querySelector('canvas')?.getBoundingClientRect();
    if (!to?.width) { clearDetailReturnFly(); return; }
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const animation = fly.animate([
      { transform: 'none', filter: 'brightness(.52)' },
      { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width}, ${to.height / from.height})`, filter: 'brightness(1)' },
    ], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
    const finish = () => { if (detailReturnFly === fly) clearDetailReturnFly(); };
    animation.finished.then(finish).catch(() => {});
    window.setTimeout(finish, 1100);
  }
  function levelBallCount(level) {
    const rows = String(level.layout_content || '').split('\n');
    const stride = rows.some((row) => row.length > 18) ? 2 : 1;
    const placed = rows.reduce((total, row) => {
      for (let x = 0; x < row.length; x += stride) if (row[x] === 'B') total += 1;
      return total;
    }, 0);
    return (level.balls?.length || 0) + placed;
  }
  function renderDetail() {
    if (!detailMap) return;
    const map = detailMap;
    const level = map.difficulties[detailDifficulty];
    $('#detail-type').textContent = map.official ? '官方地图' : '自制地图';
    $('#detail-name').toggleAttribute('translate', !map.official);
    if (!map.official) $('#detail-name').setAttribute('translate', 'no');
    $('#detail-name').textContent = displayName(map);
    $('#detail-author').textContent = map.official ? 'SPHERAIL / THE ORIGINAL COLLECTION' : `作者 · ${map.author || '本机玩家'}`;
    $('#detail-time').textContent = `${level.time} s`;
    $('#detail-interval').textContent = `${level.spawn_interval} s`;
    $('#detail-ball-count').textContent = String(levelBallCount(level));
    const record = records[`${map.id}|${detailDifficulty}`] || {};
    $('#detail-best-score').textContent = record.bestScore == null ? '—' : String(record.bestScore);
    $('#detail-best-time').textContent = record.bestTime == null ? '—' : `${Math.floor(record.bestTime / 60)}:${String(record.bestTime % 60).padStart(2, '0')}`;
    $('#detail-best-accuracy').textContent = record.bestAccuracy == null ? '—' : `${record.bestAccuracy}%`;
    $('#detail-clear-count').textContent = record.clears == null ? '—' : `${record.clearsApproximate ? '≥' : ''}${record.clears}`;
    $('#detail-last-score').textContent = record.lastScore == null ? '—' : String(record.lastScore);
    $('#detail-last-duration').textContent = record.lastDuration == null ? '—' : `${record.lastDuration} s`;
    $('#detail-last-result').textContent = record.lastCleared == null ? '—' : record.lastCleared ? '通关' : '时间到';
    $('#detail-recent-panel').hidden = !!map.official;
    $('#detail-achievements-panel').hidden = !map.official;
    renderAchievements(map, detailDifficulty);
    $('#detail-export-tools').hidden = false;
    const tabs = $('#detail-difficulties'); tabs.replaceChildren();
    for (const difficulty of difficultyOptions(map)) {
      const button = actionButton('', () => { detailDifficulty = difficulty; renderDetail(); }, 'map-detail__tab');
      button.dataset.detailDifficulty = difficulty;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-current', difficulty === detailDifficulty ? 'page' : 'false');
      button.append(textNode('span', String(levelBallCount(map.difficulties[difficulty])), 'map-detail__ball-count'));
      button.append(textNode('span', labels[difficulty], 'map-detail__difficulty-label'));
      button.classList.toggle('active', difficulty === detailDifficulty);
      tabs.append(button);
    }
    updateDetailPreview(map, level);
    detail3D?.update(map, detailDifficulty);
  }

  function updateDetailPreview(map, level) {
    if (!window.InkballMapPreview) return;
    const board = $('#detail-board');
    const difficulty = detailDifficulty;
    const key = `${map.id}|${difficulty}`;
    if (board.dataset.previewKey === key) return;
    const animate = board.dataset.mapID === map.id && detailPreviewLevel &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const before = detailPreviewLevel;
    const request = ++detailPreviewRequest;
    window.clearTimeout(detailPreviewTimer);
    detailPreviewTimer = null;
    detailElementAnimations.forEach((animation) => animation.cancel());
    detailElementAnimations = [];
    const outgoing = $('#detail-outgoing'), incoming = $('#detail-incoming');
    outgoing.hidden = incoming.hidden = true;
    delete board.dataset.transitioning;
    board.dataset.mapID = map.id;
    board.dataset.previewKey = key;
    detailPreviewLevel = level;
    const paint = () => {
      if (request !== detailPreviewRequest) return;
      InkballMapPreview.drawLayersSync($('#detail-floor'), board, level);
      board.dataset.renderedDifficulty = difficulty;
    };
    const changed = animate && InkballMapPreview.drawDifferenceLayersSync(
      $('#detail-floor'), board, outgoing, incoming, before, level);
    if (changed) {
      board.dataset.transitioning = 'true';
      outgoing.hidden = incoming.hidden = false;
      detailElementAnimations = [
        outgoing.animate([{ opacity: 1 }, { opacity: 0, offset: .5 }, { opacity: 0 }],
          { duration: 440, easing: 'ease-in-out', fill: 'both' }),
        incoming.animate([{ opacity: 0 }, { opacity: 0, offset: .5 }, { opacity: 1 }],
          { duration: 440, easing: 'ease-in-out', fill: 'both' }),
      ];
      detailPreviewTimer = window.setTimeout(() => {
        detailPreviewTimer = null;
        paint();
        outgoing.hidden = incoming.hidden = true;
        detailElementAnimations.forEach((animation) => animation.cancel());
        detailElementAnimations = [];
        delete board.dataset.transitioning;
      }, 440);
    } else paint();
    InkballMapPreview.ready().then(() => {
      if (request === detailPreviewRequest && detailPreviewTimer === null) paint();
    });
  }

  function applyDetailTransparency(value) {
    const parsed = Number(value);
    const transparency = Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 20;
    $('#detail-view').style.setProperty('--detail-ui-opacity', String(1 - transparency / 100));
    $('#profile-transparency-preview').style.setProperty('--detail-ui-opacity', String(1 - transparency / 100));
    $('#profile-detail-transparency').value = String(transparency);
    $('#profile-detail-transparency-value').textContent = String(transparency);
  }

  function renderProfileTransparencyPreview() {
    const map = detailMap || official[0];
    const difficulty = map?.difficulties?.[detailDifficulty] ? detailDifficulty : (map && difficultyOptions(map)[0]);
    const level = map?.difficulties?.[difficulty];
    all('.profile-transparency-preview__tabs span').forEach((tab, index) => tab.classList.toggle('is-active', Object.keys(labels)[index] === difficulty));
    if (!level || !window.InkballMapPreview) return;
    $('#profile-transparency-map-name').textContent = displayName(map);
    InkballMapPreview.draw($('#profile-transparency-board'), level);
  }

  function updateProfileUI() {
    $('#header-name').textContent = profile.name;
    $('#header-avatar').src = avatarSource(profile);
    if (!$('#profile-dialog').open) applyDetailTransparency(profile.detailTransparency ?? 20);
    else renderProfileTransparencyPreview();
  }
  function avatarSource(player) {
    const data = player?.avatarData;
    return typeof data === 'string' && data.length < 22000 && data.startsWith('data:image/jpeg;base64,')
      ? data : 'img/ui/avatar-default.svg';
  }
  function releaseCropImage() {
    if (cropObjectURL) URL.revokeObjectURL(cropObjectURL);
    cropObjectURL = null;
    cropImage = null;
    cropDrag = null;
  }
  function updateCrop() {
    if (!cropImage) return;
    const stage = $('#profile-crop-stage');
    const size = stage.clientWidth;
    const scale = Math.max(size / cropImage.naturalWidth, size / cropImage.naturalHeight) * cropZoom;
    const width = cropImage.naturalWidth * scale;
    const height = cropImage.naturalHeight * scale;
    cropOffset.x = Math.max((size - width) / 2, Math.min((width - size) / 2, cropOffset.x));
    cropOffset.y = Math.max((size - height) / 2, Math.min((height - size) / 2, cropOffset.y));
    const display = $('#profile-crop-image');
    display.style.width = `${width}px`;
    display.style.height = `${height}px`;
    display.style.transform = `translate(calc(-50% + ${cropOffset.x}px),calc(-50% + ${cropOffset.y}px))`;
    const sourceSize = size / scale;
    const sourceX = cropImage.naturalWidth / 2 - sourceSize / 2 - cropOffset.x / scale;
    const sourceY = cropImage.naturalHeight / 2 - sourceSize / 2 - cropOffset.y / scale;
    const output = document.createElement('canvas');
    output.width = output.height = 96;
    output.getContext('2d').drawImage(cropImage, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 96, 96);
    let quality = .84;
    let data = output.toDataURL('image/jpeg', quality);
    while (data.length > 21860 && quality > .4) {
      quality -= .08;
      data = output.toDataURL('image/jpeg', quality);
    }
    if (data.length > 21860) {
      $('#profile-status').textContent = '图片无法压缩到头像大小，请选择另一张图片。';
      return;
    }
    selectedAvatarData = data;
    $('#profile-avatar-preview').src = data;
    $('#profile-status').textContent = '';
  }
  function openProfile() {
    $('#profile-name').value = profile.name;
    $('#profile-language').value = profile.language === 'en' ? 'en' : 'zh';
    $('#profile-status').textContent = '';
    applyDetailTransparency(profile.detailTransparency ?? 20);
    releaseCropImage();
    selectedAvatarData = profile.avatarData || '';
    $('#profile-avatar-preview').src = avatarSource(profile);
    $('#profile-preview-name').textContent = profile.name;
    $('#profile-avatar-file').value = '';
    $('#profile-crop-tools').hidden = true;
    $('#profile-dialog').showModal();
    renderProfileTransparencyPreview();
  }

  function editorImage(url) {
    if (!url) return null;
    if (!editorImages.has(url)) {
      const img = new Image();
      img.onload = () => {
        if (draft) drawEditor();
        refreshGuideIcons();
      };
      img.src = url;
      editorImages.set(url, img);
    }
    const image = editorImages.get(url);
    return image.complete && image.naturalWidth ? image : null;
  }
  function editorSprite(token, attr) {
    const color = /^[0-4]$/.test(attr) ? Number(attr) : 0;
    if (token === 'S') return window.INKBALL_SPRITES.entrypoint;
    if (token === 'X' || /^[1-4]$/.test(token)) return window.INKBALL_SPRITES.walls[token === 'X' ? 0 : Number(token)];
    if (token === 'B') return window.INKBALL_SPRITES.balls[color];
    if (token === 'H') return window.INKBALL_SPRITES.holes[color];
    if (token === 'K') return window.INKBALL_SPRITES.bricks[color][0];
    if ('UDLR'.includes(token)) return window.INKBALL_SPRITES.one_way[token][color];
    if ('udlr'.includes(token)) return window.INKBALL_SPRITES.accelerators[token.toUpperCase()];
    if ('CYVG'.includes(token)) return `img/editor/${token}${color}.png`;
    if (token === 'T') return `img/editor/T${String(Inkball.decodeTimedSeconds(attr)).padStart(2, '0')}.png`;
    return null;
  }
  function drawEditorTile(ctx, token, attr, x, y, size) {
    const image = editorImage(editorSprite(token, attr));
    if (image) {
      if (token === 'B') {
        ctx.save(); ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size * .44, 0, Math.PI * 2);
        ctx.clip(); ctx.drawImage(image, x, y, size, size); ctx.restore();
      } else ctx.drawImage(image, x, y, size, size);
      return;
    }
    const color = colorFill[/^[0-4]$/.test(attr) ? Number(attr) : 0];
    ctx.fillStyle = token === 'C' || token === 'G' || token === 'V' ? '#2a2e38' : color;
    ctx.fillRect(x, y, size, size);
    if (token === 'H') {
      ctx.fillStyle = '#111820'; ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size * .35, 0, Math.PI * 2); ctx.fill();
    } else if (token === 'C') {
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, size * .09); ctx.strokeRect(x + 3, y + 3, size - 6, size - 6);
    } else if (!'X1234B'.includes(token)) {
      ctx.fillStyle = token === 'T' ? '#24393b' : '#14292d';
      ctx.font = `bold ${Math.floor(size * .48)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(token === 'T' ? String(Inkball.decodeTimedSeconds(attr)) : token, x + size / 2, y + size / 2);
    }
  }
  function paletteGroups() {
    const colorNames = ['灰色', '橙色', '蓝色', '绿色', '黄色'];
    const directions = { U: '向上', D: '向下', L: '向左', R: '向右' };
    const colored = (token, name) => indices.map((i) => ({
      token, attr: String(i), title: `${name} · ${colorNames[i]}`,
    }));
    const directed = (token) => indices.map((i) => ({
      token, attr: String(i), title: `单向墙 · ${directions[token]} · ${colorNames[i]}`,
    }));
    return [
      ['球与发球点', ...colored('B', '小球'), { token: 'S', attr: ' ', title: '发球点' }],
      ['墙与机关', { token: 'X', attr: ' ', title: '颜色墙 · 灰色' },
        ...[1, 2, 3, 4].map((i) => ({ token: String(i), attr: ' ', title: `颜色墙 · ${colorNames[i]}` })),
        ...colored('K', '可破坏墙'), ...'UDLR'.split('').flatMap(directed),
        ...colored('C', '颜色门'), ...colored('Y', '钥匙墙'),
        ...colored('V', '墙体开关'), { token: 'T', attr: ' ', title: '限时墙' }],
      ['加速器', ...'udlr'.split('').map((token) => ({ token, attr: ' ', title: `加速砖 · ${directions[token.toUpperCase()]}` }))],
      ['球洞与开关', ...colored('H', '洞口'), ...colored('G', '洞口开关')],
    ];
  }
  function closeEditorGuide() {
    const panel = $('#editor-guide-panel');
    if (!panel) return;
    panel.hidden = true;
    $('#editor-guide').setAttribute('aria-expanded', 'false');
  }
  function closePlayGuide() {
    const panel = $('#play-guide-panel');
    if (!panel) return;
    panel.hidden = true;
    $('#play-guide').setAttribute('aria-expanded', 'false');
  }
  function renderTileGuide(panel, hint) {
    panel.replaceChildren();
    panel.append(textNode('h2', '砖块图例', 'tile-guide__title'));
    const list = textNode('ul', '', 'tile-guide__list');
    const descriptions = {
      wall: ['颜色墙', '球撞上后会变成对应颜色。', ['实心墙，不会改变球的颜色。', '球撞上后会变成对应颜色。'], 'X'],
      brick: ['可破坏墙', '有效撞击三次后破碎。', ['任意球撞击三次后破碎。', '同色球撞击三次后破碎。'], 'K'],
      oneWay: ['单向墙', '只允许球沿箭头方向通过。', ['同色球可沿箭头方向通过，其他球反弹。'], 'R'],
      timed: ['限时墙', '显示剩余秒数，倒计时结束后消失。', null, 'T'],
      gate: ['颜色门', '匹配颜色的球通过，其他球反弹。', ['同色球通过，其他球反弹。'], 'C'],
      keyWall: ['钥匙墙', 'V 标识表示关闭；触碰同色开关后变为可通行的虚线框。', ['V 标识表示关闭；触碰同色开关后变为可通行的虚线框。'], 'Y'],
      switch: ['墙体开关', '切换对应钥匙墙的开关状态。', ['任意球可撞击。切换灰色钥匙墙。', '灰色或同色球可撞击。切换对应颜色的钥匙墙。'], 'V'],
      hole: ['洞口', '吸入匹配颜色的球。', ['可以吸入任意颜色的球。', '吸入同色或灰色球；其他颜色会判失误。'], 'H'],
      holeSwitch: ['洞口开关', '启用或禁用对应颜色的洞。', ['任意球可撞击。启用或禁用所有洞。', '灰色或同色球可撞击。切换对应颜色的洞。'], 'G'],
      accelerator: ['加速砖', '沿箭头方向加速，效果持续 2 秒。', null, 'u'],
    };
    const colorNames = ['灰色', '橙色', '蓝色', '绿色', '黄色'];
    const icon = (token, color) => {
      const canvas = document.createElement('canvas');
      canvas.className = 'tile-guide__icon';
      canvas.width = canvas.height = token === 'H' ? 64 : Inkball.CELLSIZE;
      canvas.dataset.token = token;
      canvas.dataset.color = String(color);
      canvas.setAttribute('aria-hidden', 'true');
      drawGuideIcon(canvas);
      return canvas;
    };
    for (const [kind, [title, description, colorDetails, token]] of Object.entries(descriptions)) {
      const item = textNode('li', '', 'tile-guide__item'); item.dataset.tileKind = kind;
      const row = textNode('div', '', 'tile-guide__row');
      row.append(icon(token, 0));
      const copy = textNode('span', '', 'tile-guide__copy');
      copy.append(textNode('strong', title), textNode('span', description, 'tile-guide__desc'));
      row.append(copy);
      if (colorDetails) {
        const arrow = document.createElement('button'); arrow.type = 'button';
        arrow.className = 'tile-guide__arrow'; arrow.setAttribute('aria-label', '展开颜色说明');
        arrow.setAttribute('aria-expanded', 'false'); row.append(arrow);
        const swatches = textNode('ul', '', 'tile-guide__swatches'); swatches.hidden = true;
        for (let color = 0; color < 5; color++) {
          const swatch = textNode('li', '', 'tile-guide__swatch');
          const detail = textNode('span', '', 'tile-guide__copy');
          detail.append(textNode('strong', colorNames[color]), textNode('span', colorDetails[color === 0 ? 0 : colorDetails.length - 1], 'tile-guide__desc'));
          swatch.append(icon(token, color), detail); swatches.append(swatch);
        }
        item.append(row, swatches);
        arrow.addEventListener('click', () => {
          const open = !item.classList.contains('is-open');
          panel.querySelectorAll('.tile-guide__item').forEach((other) => {
            const active = other === item && open;
            other.classList.toggle('is-open', active);
            const otherArrow = other.querySelector('.tile-guide__arrow');
            if (otherArrow) otherArrow.setAttribute('aria-expanded', String(active));
            const otherSwatches = other.querySelector('.tile-guide__swatches');
            if (otherSwatches) otherSwatches.hidden = !active;
          });
        });
      } else item.append(row);
      list.append(item);
    }
    panel.append(list, textNode('p', hint, 'tile-guide__hint'));
  }
  function refreshGuideIcons() {
    all('.tile-guide__icon').forEach(drawGuideIcon);
  }
  function drawGuideIcon(canvas) {
    const token = canvas.dataset.token;
    const color = Number(canvas.dataset.color);
    const paths = window.INKBALL_SPRITES;
    const floor = editorImage(paths.tile);
    if (!floor) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y += Inkball.CELLSIZE) {
      for (let x = 0; x < canvas.width; x += Inkball.CELLSIZE) {
        ctx.drawImage(floor, x, y, Inkball.CELLSIZE, Inkball.CELLSIZE);
      }
    }
    const image = (path) => editorImage(path);
    const pack = { tileImage: floor, keyWallImages: [], wallImages: [], brickImages: [], oneWayImages: {}, acceleratorImages: {}, holeImages: [] };
    let tile;
    if (token === 'S') {
      pack.spawnerImage = image(paths.entrypoint);
      tile = new Inkball.LevelElement('spawner', 0, 0);
    } else if (token === 'B') {
      const ball = image(paths.balls[color]);
      if (ball) Inkball.drawBallImage(ctx, ball, 6, 6, 20);
      return;
    } else if (token === 'H') {
      pack.holeImages[color] = image(paths.holes[color]);
      new Inkball.Hole(pack, color, 0, 0).draw(ctx);
      return;
    } else if (token === 'X') {
      pack.wallImages[color] = image(paths.walls[color]);
      tile = new Inkball.WallTile(0, 0, color);
    } else if (token === 'K') {
      pack.brickImages[color] = [image(paths.bricks[color][0])];
      tile = new Inkball.BrickTile(0, 0, color);
    } else if (token === 'R') {
      pack.oneWayImages.R = [];
      pack.oneWayImages.R[color] = image(paths.one_way.R[color]);
      tile = new Inkball.OneWayTile(0, 0, 'R', color);
    } else if (token === 'T') {
      pack.wallImages[0] = image(paths.walls[0]);
      tile = new Inkball.TimedTile(0, 0, Inkball.DEFAULT_TIMED_TILE_SECONDS);
    } else if (token === 'C') {
      tile = new Inkball.ColourGateTile(0, 0, color);
    } else if (token === 'Y') {
      pack.keyWallImages[color] = image(paths.key_walls[color]);
      tile = new Inkball.KeyWallTile(0, 0, color);
    } else if (token === 'V') {
      tile = new Inkball.KeyActivatorTile(0, 0, color);
    } else if (token === 'G') {
      tile = new Inkball.HoleGateTile(0, 0, color);
    } else if (token === 'u') {
      pack.acceleratorImages.U = image(paths.accelerators.U);
      tile = new Inkball.AccelTile(0, 0, 'U');
    }
    if (!tile) return;
    ctx.save();
    ctx.translate(0, -Inkball.TOP_OFFSET);
    tile.draw(ctx, pack);
    ctx.restore();
  }
  function renderEditorGuide() {
    renderTileGuide($('#editor-guide-panel'), '左键：放置素材 · 拖动以调整发球顺序 · 右键：删除');
  }
  function renderPlayGuide() {
    renderTileGuide($('#play-guide-panel'), '左键或画笔：画线 · 橡皮、右键或 Control+左键：擦除 · 空格：暂停 · R：重新开始');
  }
  function selectEditorSpec(spec) {
    selectedSpec = { token: spec.token, attr: spec.attr };
    $('#editor-tool').value = spec.token;
    if (/^[0-4]$/.test(spec.attr)) $('#editor-color').value = spec.attr;
    setEditorMode('place');
    all('.community-palette__item').forEach((button) => button.classList.toggle('is-selected', button.dataset.token === spec.token && button.dataset.attr === spec.attr));
    if (draft) drawEditor();
  }
  function setEditorMode(mode) {
    editorMode = mode;
    $('#editor-place-mode').setAttribute('aria-pressed', mode === 'place' ? 'true' : 'false');
    $('#editor-erase-mode').setAttribute('aria-pressed', mode === 'erase' ? 'true' : 'false');
    $('#editor-board').classList.toggle('is-erasing', mode === 'erase');
    if (draft) drawEditor();
  }
  function renderPalette() {
    const palette = $('#editor-palette'); palette.replaceChildren();
    for (const [title, ...specs] of paletteGroups()) {
      const group = textNode('section', '', 'community-palette__group');
      group.append(textNode('h2', title, 'community-palette__title'));
      const row = textNode('div', '', 'community-palette__items');
      for (const spec of specs) {
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'community-palette__item'; button.title = spec.title;
        button.setAttribute('aria-label', spec.title);
        button.dataset.token = spec.token; button.dataset.attr = spec.attr;
        button.classList.toggle('is-selected', spec.token === selectedSpec?.token && spec.attr === selectedSpec?.attr);
        button.draggable = true;
        const image = document.createElement('img');
        image.src = editorSprite(spec.token, spec.attr);
        image.alt = '';
        button.append(image);
        button.addEventListener('click', () => selectEditorSpec(spec));
        button.addEventListener('dragstart', (event) => {
          selectEditorSpec(spec);
          event.dataTransfer.setData('text/plain', JSON.stringify(spec));
          event.dataTransfer.effectAllowed = 'copy';
        });
        row.append(button);
      }
      group.append(row); palette.append(group);
    }
  }
  function renderServeQueue() {
    const level = currentLevel();
    const list = $('#editor-serve-list');
    const scrollLeft = list.scrollLeft;
    list.replaceChildren();
    if (!level.balls?.length) list.append(textNode('span', '尚未添加小球', 'community-serve__empty'));
    for (const [index, color] of (level.balls || []).entries()) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'community-serve__item'; button.title = `移除第 ${index + 1} 个 ${color} 球`;
      button.draggable = true; button.dataset.serveIndex = String(index);
      const img = document.createElement('img'); img.src = window.INKBALL_SPRITES.balls[Math.max(0, colors.indexOf(color))]; img.alt = color;
      button.append(img, textNode('span', String(index + 1), 'community-serve__number'));
      button.addEventListener('click', () => { level.balls.splice(index, 1); $('#editor-balls').value = level.balls.join(', '); renderServeQueue(); });
      button.addEventListener('dragstart', (event) => { event.dataTransfer.setData('application/x-inkball-ball-index', String(index)); });
      button.addEventListener('dragover', (event) => event.preventDefault());
      button.addEventListener('drop', (event) => {
        event.preventDefault();
        const from = Number(event.dataTransfer.getData('application/x-inkball-ball-index'));
        if (!Number.isInteger(from) || from < 0 || from >= level.balls.length) return;
        const [ball] = level.balls.splice(from, 1); level.balls.splice(index, 0, ball);
        $('#editor-balls').value = level.balls.join(', '); renderServeQueue();
      });
      list.append(button);
    }
    list.scrollLeft = scrollLeft;
    updateServeScrollControls();
    const source = $('#editor-serve-source'); source.replaceChildren();
    colors.forEach((color, index) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'community-serve-source__item'; button.title = `加入${['灰', '橙', '蓝', '绿', '黄'][index]}球`;
      const img = document.createElement('img'); img.src = window.INKBALL_SPRITES.balls[index]; img.alt = color;
      button.append(img);
      button.addEventListener('click', () => {
        if (level.balls.length >= 200) return;
        level.balls.push(color); $('#editor-balls').value = level.balls.join(', '); renderServeQueue();
        scrollServeQueue($('#editor-serve-list').scrollWidth);
      });
      source.append(button);
    });
  }

  function updateServeScrollControls() {
    const list = $('#editor-serve-list');
    $('#editor-serve-prev').disabled = list.scrollLeft <= 1;
    $('#editor-serve-next').disabled = list.scrollLeft + list.clientWidth >= list.scrollWidth - 1;
  }
  function scrollServeQueue(distance) {
    $('#editor-serve-list').scrollBy({ left: distance,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function blankLevel() {
    return { layout_content: InkballCommunityEditorState.blankLayout(), layout: 'custom.txt', time: 100, spawn_interval: 4,
      balls: [], score_increase_from_hole_capture_modifier: 1, score_decrease_from_wrong_hole_modifier: 1 };
  }
  function openEditor(map = null) {
    draft = map ? clone(map) : { name: '', author: profile.name, difficulties: { easy: blankLevel() } };
    savedDraft = clone(draft);
    activeDifficulty = difficultyOptions(draft)[0] || 'easy';
    editorHistories = Object.fromEntries(['easy', 'hard', 'master'].map((key) => [key, InkballEditorHistory.create(80)]));
    history = editorHistories[activeDifficulty];
    editorHover = null;
    selectedSpec = null;
    editorMode = 'place';
    closeEditorGuide();
    $('#editor-name').value = draft.name;
    renderPalette();
    setEditorMode('place');
    renderEditor();
  }
  function currentLevel() {
    return draft.difficulties[activeDifficulty] || (draft.difficulties[activeDifficulty] = blankLevel());
  }
  function captureEditorFields() {
    if (!draft) return;
    draft.name = $('#editor-name').value.trim();
    const level = currentLevel();
    level.time = Number($('#editor-time').value);
    level.spawn_interval = Number($('#editor-interval').value);
    level.balls = $('#editor-balls').value.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  }
  function editorHasUnsavedChanges() {
    if (!draft || !savedDraft) return false;
    captureEditorFields();
    return JSON.stringify(draft) !== JSON.stringify(savedDraft);
  }
  function renderEditor() {
    if (!draft) openEditor();
    const level = currentLevel();
    $('#editor-name').value = draft.name;
    $('#editor-time').value = level.time;
    $('#editor-interval').value = level.spawn_interval;
    $('#editor-balls').value = (level.balls || []).join(', ');
    all('[data-difficulty]').forEach((button) => {
      const active = button.dataset.difficulty === activeDifficulty;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    $('#editor-difficulty-status').textContent = `正在编辑 · ${labels[activeDifficulty]}`;
    $('#editor-export').disabled = false;
    $('#editor-undo').disabled = !history.canUndo();
    $('#editor-redo').disabled = !history.canRedo();
    renderServeQueue();
    drawEditor();
  }
  function drawEditor() {
    const canvas = $('#editor-board');
    const ctx = canvas.getContext('2d');
    const rows = currentLevel().layout_content.split('\n');
    const floor = editorImage(window.INKBALL_SPRITES.tile);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
      if (floor) ctx.drawImage(floor, x * 32, y * 32, 32, 32);
      else { ctx.fillStyle = '#2a2e38'; ctx.fillRect(x * 32, y * 32, 32, 32); }
    }
    for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
      const token = rows[y]?.[x * 2] || ' ';
      if (token === ' ') continue;
      const attr = rows[y]?.[x * 2 + 1] || ' ';
      drawEditorTile(ctx, token, attr, x * 32, y * 32, token === 'H' ? 64 : 32);
    }
    if (editorMode === 'place' && editorHover && selectedSpec) {
      ctx.save(); ctx.globalAlpha = 0.45;
      const token = selectedSpec.token;
      const attr = token === 'T' ? Inkball.encodeTimedSeconds(39) : selectedSpec.attr;
      drawEditorTile(ctx, token, attr, editorHover.x * 32, editorHover.y * 32, token === 'H' ? 64 : 32);
      ctx.restore();
    }
  }
  function editorCell(rows, x, y) { return rows[y]?.slice(x * 2, x * 2 + 2) || '  '; }
  function setEditorCell(rows, x, y, value) {
    rows[y] = rows[y].slice(0, x * 2) + value + rows[y].slice(x * 2 + 2);
  }
  function editorCellAt(event) {
    const canvas = $('#editor-board');
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * 18 / rect.width);
    const y = Math.floor((event.clientY - rect.top) * 18 / rect.height);
    return x >= 0 && x < 18 && y >= 0 && y < 18 ? { x, y } : null;
  }
  function editorOccupant(rows, x, y) {
    for (let originY = Math.max(0, y - 1); originY <= y; originY++) {
      for (let originX = Math.max(0, x - 1); originX <= x; originX++) {
        if (editorCell(rows, originX, originY)[0] === 'H') return { x: originX, y: originY, token: 'H' };
      }
    }
    const token = editorCell(rows, x, y)[0];
    return token && token !== ' ' ? { x, y, token } : null;
  }
  function placeEditor(spec, cell) {
    if (!spec || !cell) return false;
    const { x, y } = cell;
    const size = spec.token === 'H' ? 2 : 1;
    if (x < 1 || y < 1 || x + size > 17 || y + size > 17) return false;
    captureEditorFields();
    const level = currentLevel();
    const rows = level.layout_content.split('\n');
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const occupant = editorOccupant(rows, x + dx, y + dy);
      if (occupant && (occupant.x !== x || occupant.y !== y)) {
        $('#editor-status').textContent = '该位置已被占用。';
        return false;
      }
    }
    const attr = spec.token === 'T' ? Inkball.encodeTimedSeconds(39) : spec.attr;
    const next = spec.token + attr;
    if (editorCell(rows, x, y) === next) return false;
    history.record(clone(level));
    setEditorCell(rows, x, y, next);
    level.layout_content = rows.join('\n');
    drawEditor();
    $('#editor-status').textContent = '';
    $('#editor-undo').disabled = !history.canUndo();
    $('#editor-redo').disabled = true;
    return true;
  }
  function eraseEditor(cell, checkpoint = true) {
    if (!cell || cell.x < 1 || cell.y < 1 || cell.x >= 17 || cell.y >= 17) return false;
    captureEditorFields();
    const level = currentLevel();
    const rows = level.layout_content.split('\n');
    const occupant = editorOccupant(rows, cell.x, cell.y);
    if (!occupant) return false;
    if (checkpoint) history.record(clone(level));
    setEditorCell(rows, occupant.x, occupant.y, '  ');
    level.layout_content = rows.join('\n');
    drawEditor();
    $('#editor-undo').disabled = !history.canUndo();
    $('#editor-redo').disabled = true;
    return true;
  }
  function openTimedWall(cell) {
    timedEditCell = cell;
    const rows = currentLevel().layout_content.split('\n');
    $('#editor-timed-value').value = Inkball.decodeTimedSeconds(editorCell(rows, cell.x, cell.y)[1]);
    $('#editor-timed-dialog').showModal();
    $('#editor-timed-value').focus();
    $('#editor-timed-value').select();
  }
  function editHistory(direction) {
    captureEditorFields();
    const level = currentLevel();
    const value = history[direction](clone(level));
    if (value === null) return;
    draft.difficulties[activeDifficulty] = value;
    renderEditor();
  }
  function validateDraft() {
    captureEditorFields();
    if (!draft.name) throw new Error('请输入地图名称。');
    if (draft.name.length > 20) throw new Error('地图名称最多 20 个字符。');
    let authored = 0;
    const colorNames = ['灰', '橙', '蓝', '绿', '黄'];
    for (const [difficulty, level] of Object.entries(draft.difficulties)) {
      if (!Number.isInteger(level.time) || level.time < 1 || level.time > 3600) throw new Error('限时应为 1–3600 秒。');
      if (!Number.isInteger(level.spawn_interval) || level.spawn_interval < 0 || level.spawn_interval > 600) throw new Error('发球间隔应为 0–600 秒。');
      if (level.balls.some((ball) => !colors.includes(ball))) throw new Error('发球颜色只能使用 grey、orange、blue、green、yellow。');
      if (level.time < level.balls.length * level.spawn_interval) throw new Error('总时间不能少于发球数量乘以发球间隔。');
      const rows = level.layout_content.split('\n');
      const placedBalls = [];
      const holes = new Set();
      const walls = new Set();
      let hasTiles = false;
      let hasSpawner = false;
      for (let y = 1; y < 17; y++) for (let x = 1; x < 17; x++) {
        const [token, attr] = editorCell(rows, x, y);
        if (!token || token === ' ') continue;
        hasTiles = true;
        if (token === 'S') hasSpawner = true;
        if (token === 'B' && /^[0-4]$/.test(attr)) placedBalls.push(colors[Number(attr)]);
        if (token === 'H' && /^[0-4]$/.test(attr)) holes.add(Number(attr));
        if (/^[1-4]$/.test(token)) walls.add(Number(token));
      }
      if (!hasTiles && level.balls.length === 0) continue;
      authored++;
      const prefix = `${labels[difficulty]}：`;
      const allBalls = [...level.balls, ...placedBalls];
      if (allBalls.length === 0) throw new Error(prefix + '至少添加一个球。');
      if (level.balls.length > 0 && !hasSpawner) throw new Error(prefix + '发球顺序中有小球时，至少放置一个发球点。');
      if (holes.size === 0) throw new Error(prefix + '至少放置一个球洞。');
      for (const color of new Set(allBalls)) {
        const index = colors.indexOf(color);
        if (index > 0 && !holes.has(0) && !holes.has(index) && !walls.has(index)) {
          throw new Error(prefix + `${colorNames[index]}色球需要同色球洞、灰色球洞或同色墙。`);
        }
      }
    }
    if (authored === 0) throw new Error('至少添加一个球和一个球洞。');
    return draft;
  }
  async function saveEditor() {
    const saved = await native.call('saveMap', { map: validateDraft() });
    draft = saved;
    savedDraft = clone(saved);
    customMaps = customMaps.filter((row) => row.id !== saved.id).concat(saved);
    $('#editor-status').textContent = '已保存在本机。';
    renderEditor();
    return saved;
  }

  async function openCode() {
    codeMode = 'import';
    $('#code-title').textContent = $('#editor-view').hidden ? '导入地图代码' : `导入到${labels[activeDifficulty]}`;
    $('#code-status').textContent = '';
    $('#code-action').hidden = false;
    $('#code-copy').hidden = true;
    $('#map-code').readOnly = false;
    $('#map-code').value = '';
    $('#code-dialog').showModal();
    $('#map-code').focus();
  }
  async function copyDifficultyCode(level, statusSelector) {
    const { code } = await native.call('exportDifficultyCode', { level, author: profile.name });
    await native.call('copyText', { text: code });
    $(statusSelector).textContent = '已复制到剪切板';
  }

  function renderMatch() {
    $('#match-entry-label').textContent = matchEntry ? `${displayName(matchEntry.map)} · ${labels[matchEntry.difficulty]} · ${matchEntry.map.official ? '官方地图' : '自制地图'}` : '';
    const pending = ['connecting', 'accepted', 'countdown'].includes(match.phase);
    $('#match-pending').hidden = !pending;
    $('#match-pending-text').textContent = match.phase === 'connecting' ? `正在邀请 ${match.peer?.name || '附近玩家'}…` : match.phase === 'countdown' ? '对战即将开始' : '对方已接受邀请';
    const hasWiFi = match.wifiState === 'ready';
    const hasBluetooth = match.bluetoothState === 'ready' || (!('bluetoothState' in match) && !('wifiState' in match));
    $('#match-status').textContent = matchErrorMessage || (pending ? '等待对方响应'
      : !hasWiFi && !hasBluetooth ? '请连接同一 Wi-Fi 或开启蓝牙。' : '正在寻找附近玩家…');
    const list = $('#match-peers'); list.replaceChildren();
    if (peers.size === 0) {
      list.append(textNode('p', '尚未发现附近的绘轨玩家。请确认双方连接同一 Wi-Fi 或开启蓝牙。', 'match-peer-empty'));
    }
    for (const peer of peers.values()) {
      const row = document.createElement('div'); row.className = 'match-peer';
      const info = document.createElement('div'); info.className = 'match-peer__info';
      info.append(textNode('strong', peer.name || '附近玩家'),
        textNode('span', `${peer.deviceName || 'Mac'} · ${peer.transport || '蓝牙'}${Number.isFinite(peer.rssi) ? ` · ${peer.rssi} dBm` : ''}`));
      const avatar = document.createElement('img');
      avatar.className = 'match-peer__avatar';
      avatar.src = avatarSource(peer);
      avatar.alt = '';
      row.append(avatar);
      const button = actionButton('邀请', run(async () => {
        if (!matchEntry) throw new Error('请从地图难度页面进入对战。');
        matchErrorMessage = '';
        updateMatch(await native.call('matchInvite', { id: peer.id, map: matchEntry.map, difficulty: matchEntry.difficulty }));
      }), 'primary');
      button.disabled = match.phase !== 'idle' || (!hasWiFi && !hasBluetooth);
      row.append(info, button); list.append(row);
    }
  }
  function updateMatch(value) {
    match = value || {};
    if (match.phase === 'idle' || match.phase === 'finished') closeCountdown();
    if ((match.bluetoothState === 'ready' || match.wifiState === 'ready') &&
        matchErrorMessage === 'Bluetooth is unavailable or switched off.') matchErrorMessage = '';
    if (Array.isArray(match.peers)) {
      peers.clear();
      for (const peer of match.peers) peers.set(peer.id, { ...peer, seenAt: Date.now() });
    }
    renderMatch(); updateMatchMetrics(match);
  }
  function updateMatchMetrics(value) {
    const latency = value?.latencyMs;
    const signal = value?.signalDBm;
    const transport = value?.transport || match?.transport;
    $('#match-transport').textContent = transport === 'wifi' ? 'Wi-Fi' : transport === 'bluetooth' ? '蓝牙' : '—';
    $('[data-match-sync-latency]').textContent = Number.isFinite(latency) ? `${latency} ms` : '—';
    $('#match-signal').textContent = Number.isFinite(signal) ? `${signal} dBm` : '—';
    if (Number.isFinite(latency) && game?.matchSync) {
      game.matchSync.lastLatencyMs = latency;
      game.matchSync.updateInterpolationDelay();
    }
  }
  function closeCountdown() {
    window.clearInterval(countdownTicker); countdownTicker = null;
    $('#match-countdown').hidden = true;
  }
  function startCountdown(seconds) {
    closeCountdown();
    const endsAt = performance.now() + seconds * 1000;
    const tick = () => { $('#match-countdown-number').textContent = String(Math.max(1, Math.ceil((endsAt - performance.now()) / 1000))); };
    $('#match-countdown').hidden = false; tick();
    countdownTicker = window.setInterval(tick, 100);
  }
  async function leaveActiveMatch() {
    await native.call('matchLeave');
    matchLocalResult = null; matchOutcome = null; closeCountdown();
    $('#match-finish-choice').hidden = true;
    $('#match-watch-leave').hidden = true;
    stopGame();
    show(matchEntry ? 'detail' : 'personal');
  }
  function openMatchEntry() {
    if (!detailMap?.difficulties?.[detailDifficulty]) return;
    matchEntry = { map: detailMap, difficulty: detailDifficulty };
    matchOutcome = null;
    matchLocalResult = null;
    show('match');
    native.call('matchState').then(updateMatch).catch(report);
  }
  function clearMatchRun() {
    if (!currentPlay?.inMatch) return;
    const map = currentPlay.map;
    currentPlay.map = { id: map.id, name: map.name, author: map.author, official: map.official };
    currentPlay.boot = null;
    $('#inkball-play').textContent = '{}';
  }

  async function play(map, difficulty, fromEditor, inMatch = false) {
    stopGame();
    const level = clone(map.difficulties[difficulty]);
    level.layout = level.layout || `${map.id || 'custom'}_${difficulty}.txt`;
    const boot = {
      map: map.id || 'playtest', difficulty, level,
      inlineConfig: { levels: [level], score_increase_from_hole_capture: window.INKBALL_OFFICIAL.score_increase_from_hole_capture,
        score_decrease_from_wrong_hole: window.INKBALL_OFFICIAL.score_decrease_from_wrong_hole },
      fromEditor, authenticated: false, resultUrl: 'desktop-result', returnUrl: 'index.html',
    };
    if (inMatch) boot.match = { room_id: match.session, interval_ms: 250, opponent: { label: match.peer?.name || '对手' } };
    currentPlay = { map, difficulty, fromEditor, inMatch, boot };
    $('#inkball-play').textContent = JSON.stringify(boot);
    closePlayGuide();
    $('#pause-home-label').textContent = fromEditor ? '返回编辑器' : '返回地图';
    $('#pause-dialog-title').textContent = '暂停';
    $('[data-pause-restart]').hidden = false;
    $('#opponent-panel').hidden = !inMatch;
    $('#play-view').classList.toggle('in-match', inMatch);
    $('#match-connection-metrics').hidden = !inMatch;
    $('#match-finish-choice').hidden = true;
    $('#match-watch-leave').hidden = true;
    if (inMatch) updateMatchMetrics(match);
    show('play');
    try {
      game = new Inkball.App($('#game'));
      window.inkballApp = game;
      attachWallClock(game);
      await initializeGame(game);
      startWallClock(game);
      if (inMatch) {
        bindMatchMenu(game);
        const sync = game.matchSync;
        // Keep the opponent's timer updated when WebKit hides this window.
        sync.tick = function () {
          if (this.stopped || this.inFlight || this.opponentStatus === 'forfeited') return;
          this.inFlight = true;
          this.send().catch(() => null).finally(() => { this.inFlight = false; });
        };
        const originalOverlay = sync.updateSignalOverlay.bind(sync);
        sync.updateSignalOverlay = function (now) {
          if (this.connectionState !== 'connected' || ['completed', 'failed', 'forfeited'].includes(this.opponentStatus)) {
            return originalOverlay(now);
          }
          const limit = Math.max(3500, this.snapshotIntervalMs * 4 + this.snapshotJitterMs * 3,
            (this.lastLatencyMs || 0) * 2 + 1000);
          const stalled = this.lastSnapshotReceivedAt > 0 && now - this.lastSnapshotReceivedAt >= limit;
          this.waitingNode.hidden = !stalled;
          this.connectionNode.textContent = stalled ? '正在同步对手画面…' : '';
        };
        // Keep receiving the opponent's snapshots after this board finishes.
        sync.flush = function (status) {
          if (this.timer) { window.clearInterval(this.timer); this.timer = null; }
          return this.send(status).catch(() => null);
        };
      }
      game.draw(0);
    } catch (error) {
      stopGame();
      $('#status').hidden = false;
      $('#status').textContent = `无法开始游戏：${error.message}`;
    }
  }

  function captureResultHandoff() {
    const handoff = game?._boardHandoff?.();
    if (!handoff?.rect?.width || handoff.image || !game?.canvas) return handoff;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Inkball.WIDTH;
      canvas.height = Inkball.WIDTH;
      const scaleX = game.canvas.width / Inkball.WIDTH;
      const scaleY = game.canvas.height / Inkball.HEIGHT;
      canvas.getContext('2d').drawImage(game.canvas, 0, Inkball.TOP_OFFSET * scaleY,
        Inkball.WIDTH * scaleX, Inkball.WIDTH * scaleY, 0, 0, canvas.width, canvas.height);
      handoff.canvas = canvas;
    } catch (error) { console.error(error); }
    return handoff;
  }
  function revealResult(handoff) {
    const page = $('#result-view');
    const card = $('#result-board');
    const cover = $('#result-handoff');
    const image = cover.querySelector('img');
    if (resultAnimation) resultAnimation.cancel();
    window.clearTimeout(resultRevealTimer);
    resultAnimation = null;
    page.classList.remove('is-result-handoff', 'is-result-ready', 'is-result-leaving');
    cover.querySelector('canvas')?.remove();
    cover.hidden = true;
    image.removeAttribute('src');
    image.hidden = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!handoff?.rect?.width || reduced) return;
    if (handoff.image) {
      image.src = handoff.image;
      cover.hidden = false;
    } else if (handoff.canvas) {
      image.hidden = true;
      cover.append(handoff.canvas);
      cover.hidden = false;
    }
    page.classList.add('is-result-handoff');
    const from = handoff.rect;
    const to = card.getBoundingClientRect();
    const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
    const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
    resultAnimation = card.animate([
      { transform: `translate(${dx}px,${dy}px) scale(${from.width / to.width},${from.height / to.height})` },
      { transform: 'none' },
    ], { duration: 600, easing: 'ease-in-out' });
    let finished = false;
    const finish = () => {
      if (finished || !page.classList.contains('is-result-handoff')) return;
      finished = true;
      window.clearTimeout(resultRevealTimer);
      page.classList.add('is-result-ready');
      resultRevealTimer = window.setTimeout(() => {
        page.classList.remove('is-result-handoff', 'is-result-ready');
        cover.hidden = true;
      }, 660);
    };
    resultAnimation.finished.then(finish).catch(() => {});
    resultRevealTimer = window.setTimeout(finish, 720);
  }

  function populateResult(run, { score, duration, accuracy, cleared, best, newRecord, handoff }) {
    $('#result-type').textContent = run.inMatch ? '对战' : run.fromEditor ? '编辑器试玩' : run.map.official ? '官方地图' : '自制地图';
    $('#result-map').toggleAttribute('translate', !run.map.official);
    if (!run.map.official) $('#result-map').setAttribute('translate', 'no');
    $('#result-map').textContent = displayName(run.map);
    $('#result-map').title = displayName(run.map);
    $('#result-difficulty').textContent = labels[run.difficulty];
    $('#result-outcome').textContent = run.inMatch ? '等待对手结束' : cleared ? '通关' : '时间到';
    $('#result-outcome').classList.toggle('result-card__title--fail', !cleared && !run.inMatch);
    $('#result-emblem').src = cleared || run.inMatch ? 'img/ui/arcade-medal.svg' : 'img/ui/arcade-mark.svg';
    $('#result-new-record').hidden = !newRecord || run.fromEditor || run.inMatch;
    $('#result-time').textContent = `${duration}s`;
    $('#result-score').textContent = String(score);
    $('#result-accuracy').textContent = `${accuracy}%`;
    $('#result-best').textContent = run.fromEditor ? '—' : String(best);
    $('#result-board').classList.toggle('result-card--match', run.inMatch);
    $('#result-solo-stats').hidden = !!run.inMatch;
    $('#result-match-stats').hidden = !run.inMatch;
    $('#result-again').hidden = !!run.inMatch;
    $('#result-continue').hidden = !!run.inMatch;
    if (run.inMatch) {
      $('#result-you-name').textContent = profile.name;
      $('#result-peer-name').textContent = match.peer?.name || '对手';
      $('#result-you-score').textContent = String(score);
      $('#result-you-accuracy').textContent = `${accuracy}%`;
      $('#result-you-time').textContent = `${duration}s`;
      $('#result-peer-score').textContent = '—';
      $('#result-peer-accuracy').textContent = '—';
      $('#result-peer-time').textContent = '—';
    }
    show('result');
    window.InkballAmbient?.restartResult?.(cleared || (run.inMatch && matchOutcome?.outcome === 'won'));
    document.documentElement.classList.remove('is-play-to-result');
    revealResult(handoff);
  }

  function leaveResult(callback) {
    $('#result-view').classList.add('is-result-leaving');
    $('#result-again').disabled = true;
    $('#result-continue').disabled = true;
    window.setTimeout(() => {
      $('#result-again').disabled = false;
      $('#result-continue').disabled = false;
      callback();
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420);
  }

  async function showResult(url, lines = game?.linesDrawn || 0) {
    const values = new URL(url, window.location.href).searchParams;
    const score = Number(values.get('score') || 0);
    const duration = Number(values.get('time') || 0);
    const cleared = values.get('cleared') === '1';
    const run = currentPlay;
    const correct = Number(values.get('correct') || 0);
    const wrong = Number(values.get('wrong') || 0);
    const accuracy = correct + wrong ? Math.round(100 * correct / (correct + wrong)) : 0;
    const handoff = captureResultHandoff();
    let best = records[`${run.map.id}|${run.difficulty}`]?.bestScore ?? score;
    let newRecord = score > best;
    if (!run.fromEditor && !(run.inMatch && !run.map.official && !customMaps.some((map) => map.id === run.map.id))) {
      try {
        const record = await native.call('recordResult', { mapID: run.map.id, difficulty: run.difficulty,
          score, cleared, duration, correct, wrong, lines });
        best = record.bestScore;
        newRecord = !!record.newRecord;
        records[`${run.map.id}|${run.difficulty}`] = record;
        for (const code of record.newlyUnlocked || []) achievements[code] = true;
      } catch (error) { console.error(error); }
    }
    if (run.inMatch) {
      matchLocalResult = { score, duration, accuracy, cleared, best, newRecord, handoff };
      await native.call('matchFinish', { score, duration, cleared, accuracy });
      if (!$('#result-view').hidden) return;
      if (!matchOutcome) {
        $('#match-finish-choice').hidden = false;
        return;
      }
    }
    populateResult(run, matchLocalResult || { score, duration, accuracy, cleared, best, newRecord, handoff });
    if (run.inMatch && matchOutcome) applyMatchOutcome(matchOutcome);
  }
  window.InkballScene = {
    navigate(url) {
      if (url.startsWith('desktop-result')) { showResult(url).catch(report); return; }
      if (currentPlay?.fromEditor) show('editor');
      else show(currentPlay?.map.official ? 'detail' : 'personal');
    },
  };
  function applyMatchOutcome(result) {
    matchOutcome = result;
    if ($('#result-view').hidden || !currentPlay?.inMatch) return;
    const won = result.outcome === 'won';
    if ($('#result-ambient').dataset.ambientBurst !== (won ? '1' : '0')) {
      window.InkballAmbient?.restartResult?.(won);
    }
    const outcome = { won: '胜利', lost: '落败', draw: '平局' }[result.outcome] || '对战结束';
    $('#result-outcome').textContent = outcome;
    $('#result-outcome').classList.toggle('result-card__title--fail', result.outcome === 'lost');
    if (result.local) {
      $('#result-you-score').textContent = String(result.local.score ?? '—');
      $('#result-you-accuracy').textContent = result.local.accuracy == null ? '—' : `${result.local.accuracy}%`;
      $('#result-you-time').textContent = result.local.duration == null ? '—' : `${result.local.duration}s`;
    }
    if (result.remote) {
      $('#result-peer-score').textContent = String(result.remote.score ?? '—');
      $('#result-peer-accuracy').textContent = result.remote.accuracy == null ? '—' : `${result.remote.accuracy}%`;
      $('#result-peer-time').textContent = result.remote.duration == null ? '—' : `${result.remote.duration}s`;
    } else if (result.reason) {
      $('#result-peer-name').textContent = result.reason === 'opponent_left' ? '对手已离开' : '连接超时';
    }
    $('#result-continue').hidden = false;
  }
  function report(error) {
    console.error(error);
    const section = all('.view').find((view) => !view.hidden);
    const status = section?.id === 'editor-view' ? $('#editor-status') : section?.querySelector('[role=status]') || $('#status');
    status.hidden = false; status.textContent = error.message || String(error);
  }
  function run(callback) { return (event) => Promise.resolve(callback(event)).catch(report); }

  async function initialize() {
    const data = await native.call('bootstrap');
    profile = data.profile; customMaps = data.maps; records = data.records;
    const appVersion = data.appInfo?.version || 'Development';
    $('#profile-version').textContent = `v${appVersion}`;
    $('#profile-version').title = `Spherail ${appVersion}${data.appInfo?.build ? ` (${data.appInfo.build})` : ''}`;
    detail3D = InkballDesktop3D.create({
      root: $('#detail-view'), hero: $('#detail-hero'), layer: $('#detail-3d-layer'),
      frame: $('#detail-3d-frame'), toggle: $('#detail-3d-toggle'), duel: $('#detail-duel'), status: $('#detail-3d-status'),
      getBoot(difficulty) {
        const map = detailMap, level = clone(map.difficulties[difficulty]);
        return { language: profile.language, catalog: [{ slug: map.id, name: displayName(map),
          levels: difficultyOptions(map).map(tier => ({ difficulty: tier, label: labels[tier] })) }],
          selected: { map: map.id, map_name: displayName(map), difficulty, difficulty_label: labels[difficulty],
            personalMap: !map.official, authenticated: false, result_url: 'desktop-result',
            home_url: 'desktop-return', return_url: 'desktop-return', layout: level.layout_content, config: level } };
      },
      onStart() {
        stopGame();
        closePlayGuide();
        currentPlay = { map: detailMap, difficulty: detailDifficulty, fromEditor: false, inMatch: false, renderMode: '3d' };
      },
      onResult(url, lines) { showResult(url, lines).catch(report); },
      onHome() {
        detail3D.dispose();
        if (detailMap.official) show('maps');
        else show('detail');
      },
    });
    achievements = data.achievements || {}; match = data.match;
    window.InkballDesktopI18n.setLanguage(profile.language);
    updateProfileUI(); renderMaps(); renderMatch(); renderPalette(); renderEditorGuide(); renderPlayGuide(); show('maps');
    $('#official-map-list').addEventListener('click', (event) => {
      const card = event.target.closest('a.map-card');
      if (!card) return;
      event.preventDefault();
      const map = mapByID(card.dataset.mapSlug);
      if (map) openMapDetail(map, card);
    });
    const track = $('#official-map-list');
    new MutationObserver(() => {
      const selected = track.querySelector('.map-card.is-center');
      if (selected) $('#maps-view [data-carousel-position]').textContent = String(Number(selected.dataset.mapIndex) + 1).padStart(2, '0');
    }).observe(track, { subtree: true, attributes: true, attributeFilter: ['class'] });
    $('#detail-back').addEventListener('click', leaveMapDetail);
    window.addEventListener('resize', () => { if (!$('#detail-view').hidden) positionDetailHero(); });
    $('#detail-start').addEventListener('click', run(() => {
      if (!detail3D.start()) return play(detailMap, detailDifficulty, false);
    }));
    $('#detail-duel').addEventListener('click', openMatchEntry);
    $('#detail-export').addEventListener('click', run(() => copyDifficultyCode(detailMap.difficulties[detailDifficulty], '#detail-export-status')));
    $('#delete-map-cancel').addEventListener('click', () => $('#delete-map-dialog').close());
    $('#delete-map-dialog').addEventListener('close', () => { pendingDeleteMap = null; });
    $('#delete-map-confirm').addEventListener('click', run(async () => {
      const map = pendingDeleteMap;
      if (!map) return;
      await native.call('deleteMap', { id: map.id });
      customMaps = customMaps.filter((row) => row.id !== map.id);
      $('#delete-map-dialog').close();
      renderMaps();
    }));
    $('#match-exit-cancel').addEventListener('click', () => $('#match-exit-dialog').close());
    $('#match-exit-confirm').addEventListener('click', run(async () => {
      updateMatch(await native.call('matchLeave'));
      $('#match-exit-dialog').close();
      matchLocalResult = null; matchOutcome = null;
      clearMatchRun();
      show(matchEntry ? 'match' : 'personal');
    }));
    $('#personal-query').addEventListener('input', renderMaps);
    $('#personal-sort').addEventListener('change', renderMaps);
    const navResize = new ResizeObserver(() => updateNavHighlight(false));
    navResize.observe($('.app-header nav'));
    all('.app-header nav button').forEach((button) => navResize.observe(button));
    $('#personal-search-form').addEventListener('submit', (event) => { event.preventDefault(); renderMaps(); });
    all('[data-route]').forEach((button) => button.addEventListener('click', () => show(button.dataset.route)));
    all('[data-close]').forEach((button) => button.addEventListener('click', () => $('#' + button.dataset.close).close()));
    $('#profile-open').addEventListener('click', openProfile);
    $('#profile-dialog').addEventListener('close', () => {
      releaseCropImage();
      applyDetailTransparency(profile.detailTransparency ?? 20);
    });
    $('#profile-detail-transparency').addEventListener('input', (event) => applyDetailTransparency(event.target.value));
    $('#profile-name').addEventListener('input', (event) => {
      $('#profile-preview-name').textContent = event.target.value.trim() || profile.name;
    });
    const serveList = $('#editor-serve-list');
    serveList.addEventListener('scroll', updateServeScrollControls);
    new ResizeObserver(updateServeScrollControls).observe(serveList);
    $('#editor-serve-prev').addEventListener('click', () => scrollServeQueue(-serveList.clientWidth * .8));
    $('#editor-serve-next').addEventListener('click', () => scrollServeQueue(serveList.clientWidth * .8));
    serveList.addEventListener('wheel', (event) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (serveList.scrollWidth <= serveList.clientWidth) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? serveList.clientWidth : 1);
      const canScroll = delta > 0 ? serveList.scrollLeft + serveList.clientWidth < serveList.scrollWidth - 1 : serveList.scrollLeft > 1;
      if (!canScroll) return;
      event.preventDefault();
      serveList.scrollLeft += delta;
    }, { passive: false });
    serveList.addEventListener('dragover', (event) => {
      const rect = serveList.getBoundingClientRect();
      if (event.clientX < rect.left + 24) serveList.scrollLeft -= 16;
      else if (event.clientX > rect.right - 24) serveList.scrollLeft += 16;
    });
    $('#profile-avatar-choose').addEventListener('click', () => $('#profile-avatar-file').click());
    $('#profile-avatar-reset').addEventListener('click', () => {
      releaseCropImage();
      selectedAvatarData = '';
      $('#profile-avatar-preview').src = avatarSource(null);
      $('#profile-crop-tools').hidden = true;
      $('#profile-avatar-file').value = '';
      $('#profile-status').textContent = '';
    });
    $('#profile-avatar-file').addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 12_000_000) {
        $('#profile-status').textContent = '请选择不超过 12 MB 的图片。';
        return;
      }
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) {
          URL.revokeObjectURL(url);
          $('#profile-status').textContent = '无法读取这张图片。';
          return;
        }
        releaseCropImage();
        cropObjectURL = url;
        cropImage = image;
        cropOffset = { x: 0, y: 0 };
        cropZoom = 1;
        $('#profile-crop-zoom').value = '1';
        $('#profile-crop-image').src = url;
        $('#profile-crop-tools').hidden = false;
        updateCrop();
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        $('#profile-status').textContent = '无法读取这张图片。';
      };
      image.src = url;
    });
    $('#profile-crop-zoom').addEventListener('input', (event) => {
      cropZoom = Number(event.target.value);
      updateCrop();
    });
    const cropStage = $('#profile-crop-stage');
    cropStage.addEventListener('pointerdown', (event) => {
      if (!cropImage) return;
      cropDrag = { x: event.clientX, y: event.clientY, offsetX: cropOffset.x, offsetY: cropOffset.y };
      cropStage.setPointerCapture(event.pointerId);
    });
    cropStage.addEventListener('pointermove', (event) => {
      if (!cropDrag) return;
      cropOffset.x = cropDrag.offsetX + event.clientX - cropDrag.x;
      cropOffset.y = cropDrag.offsetY + event.clientY - cropDrag.y;
      updateCrop();
    });
    cropStage.addEventListener('pointerup', () => { cropDrag = null; });
    cropStage.addEventListener('pointercancel', () => { cropDrag = null; });
    $('#profile-language').addEventListener('change', run(async (event) => {
      profile = await native.call('updateLanguage', { language: event.target.value });
      window.InkballDesktopI18n.setLanguage(profile.language);
      updateProfileUI();
    }));
    $('#profile-save').addEventListener('click', async () => {
      try {
        profile = await native.call('updateProfile', { name: $('#profile-name').value, avatarData: selectedAvatarData, detailTransparency: Number($('#profile-detail-transparency').value) });
        updateProfileUI();
        $('#profile-dialog').close();
      } catch (error) {
        $('#profile-status').textContent = error.message || String(error);
      }
    });
    $('#editor-import').addEventListener('click', run(openCode));
    $('#editor-export').addEventListener('click', run(async () => {
      captureEditorFields();
      await copyDifficultyCode(currentLevel(), '#editor-export-status');
    }));
    $('#editor-back').addEventListener('click', () => {
      if (editorHasUnsavedChanges()) $('#editor-leave-dialog').showModal();
      else show('personal');
    });
    $('#editor-leave-cancel').addEventListener('click', () => $('#editor-leave-dialog').close());
    $('#editor-leave-confirm').addEventListener('click', () => {
      $('#editor-leave-dialog').close();
      show('personal');
    });
    $('#editor-guide').addEventListener('click', () => {
      const panel = $('#editor-guide-panel'); panel.hidden = !panel.hidden;
      $('#editor-guide').setAttribute('aria-expanded', String(!panel.hidden));
    });
    $('#play-guide').addEventListener('click', () => {
      const panel = $('#play-guide-panel'); panel.hidden = !panel.hidden;
      $('#play-guide').setAttribute('aria-expanded', String(!panel.hidden));
    });
    $('#editor-timed-cancel').addEventListener('click', () => $('#editor-timed-dialog').close());
    $('#editor-timed-dialog').addEventListener('close', () => { timedEditCell = null; });
    $('#editor-timed-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const seconds = Number($('#editor-timed-value').value);
      if (!Number.isInteger(seconds) || seconds < 0 || seconds > 99 || !timedEditCell) return;
      captureEditorFields();
      const level = currentLevel();
      const rows = level.layout_content.split('\n');
      if (editorCell(rows, timedEditCell.x, timedEditCell.y)[0] === 'T') {
        const next = `T${Inkball.encodeTimedSeconds(seconds)}`;
        if (editorCell(rows, timedEditCell.x, timedEditCell.y) !== next) {
          history.record(clone(level));
          setEditorCell(rows, timedEditCell.x, timedEditCell.y, next);
          level.layout_content = rows.join('\n');
          drawEditor();
          $('#editor-undo').disabled = !history.canUndo();
          $('#editor-redo').disabled = true;
        }
      }
      timedEditCell = null;
      $('#editor-timed-dialog').close();
    });
    $('#editor-place-mode').addEventListener('click', () => setEditorMode('place'));
    $('#editor-erase-mode').addEventListener('click', () => setEditorMode('erase'));
    $('#code-action').addEventListener('click', run(async () => {
      if (codeMode !== 'import') return;
      const code = $('#map-code').value.trim();
      if (code.startsWith('INKBALL-LEVEL/1\n')) {
        const { level } = await native.call('importDifficultyCode', { code });
        if ($('#editor-view').hidden) {
          openEditor();
          draft.difficulties.easy = { ...blankLevel(), ...level };
          $('#code-dialog').close();
          show('editor');
        } else {
          captureEditorFields();
          const previous = clone(currentLevel());
          history.record(previous);
          draft.difficulties[activeDifficulty] = { ...previous, ...level };
          $('#code-dialog').close();
          renderEditor();
        }
        $('#editor-status').textContent = `已导入到${labels[activeDifficulty]}，请保存地图。`;
        return;
      }
      const saved = await native.call('importMap', { code });
      customMaps = customMaps.filter((row) => row.id !== saved.id).concat(saved);
      $('#code-dialog').close(); renderMaps();
      if (!$('#editor-view').hidden) { openEditor(saved); show('editor'); }
    }));
    $('#code-copy').addEventListener('click', run(async () => {
      await native.call('copyText', { text: $('#map-code').value });
      $('#code-status').textContent = '已复制到剪贴板。';
    }));
    $('#editor-board').addEventListener('pointerdown', (event) => {
      if (event.button !== 2 && !(editorMode === 'erase' && event.button === 0)) return;
      event.preventDefault();
      editorStroke = { id: event.pointerId, changed: false };
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) { /* Mouse events still place the tile. */ }
      editorStroke.changed = eraseEditor(editorCellAt(event));
    });
    $('#editor-board').addEventListener('pointermove', (event) => {
      editorHover = editorCellAt(event);
      if (editorStroke?.id === event.pointerId) editorStroke.changed = eraseEditor(editorHover, !editorStroke.changed) || editorStroke.changed;
      else drawEditor();
    });
    $('#editor-board').addEventListener('pointerleave', () => { editorHover = null; drawEditor(); });
    $('#editor-board').addEventListener('pointerup', () => { editorStroke = null; });
    $('#editor-board').addEventListener('pointercancel', () => { editorStroke = null; });
    $('#editor-board').addEventListener('click', (event) => {
      if (editorMode === 'erase') return;
      const cell = editorCellAt(event);
      if (!cell) return;
      const rows = currentLevel().layout_content.split('\n');
      const existing = editorOccupant(rows, cell.x, cell.y);
      if (existing?.token === 'T' && (!selectedSpec || selectedSpec.token === 'T')) { openTimedWall(existing); return; }
      if (selectedSpec) placeEditor(selectedSpec, cell);
    });
    $('#editor-board').addEventListener('contextmenu', (event) => {
      event.preventDefault(); eraseEditor(editorCellAt(event));
    });
    $('#editor-board').addEventListener('dragover', (event) => {
      event.preventDefault(); editorHover = editorCellAt(event); drawEditor();
    });
    $('#editor-board').addEventListener('drop', (event) => {
      event.preventDefault();
      try {
        const spec = JSON.parse(event.dataTransfer.getData('text/plain'));
        if (!spec || typeof spec.token !== 'string') return;
        selectEditorSpec(spec);
        editorHover = null;
        placeEditor(spec, editorCellAt(event));
      } catch (error) { report(error); }
    });
    all('[data-difficulty]').forEach((button) => button.addEventListener('click', () => {
      captureEditorFields(); activeDifficulty = button.dataset.difficulty;
      history = editorHistories[activeDifficulty]; editorHover = null; renderEditor();
    }));
    $('#editor-undo').addEventListener('click', () => editHistory('undo'));
    $('#editor-redo').addEventListener('click', () => editHistory('redo'));
    window.addEventListener('keydown', (event) => {
      if (!$('#editor-view').hidden && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); editHistory(event.shiftKey ? 'redo' : 'undo');
      }
    });
    $('#editor-save').addEventListener('click', run(saveEditor));
    $('#editor-playtest').addEventListener('click', run(async () => {
      validateDraft(); await play(clone(draft), activeDifficulty, true);
    }));
    $('#match-bluetooth-settings').addEventListener('click', run(() => native.call('openBluetoothSettings')));
    $('#match-leave').addEventListener('click', run(async () => { updateMatch(await native.call('matchLeave')); show(matchEntry ? 'detail' : 'personal'); }));
    $('#match-cancel').addEventListener('click', run(async () => updateMatch(await native.call('matchLeave'))));
    $('#match-accept').addEventListener('click', run(async () => {
      updateMatch(await native.call('matchAccept'));
      $('#match-invite-dialog').close();
    }));
    $('#match-decline').addEventListener('click', run(async () => {
      updateMatch(await native.call('matchDecline'));
      $('#match-invite-dialog').close();
    }));
    $('#match-invite-dialog').addEventListener('cancel', (event) => {
      event.preventDefault(); $('#match-decline').click();
    });
    $('#match-watch').addEventListener('click', () => {
      $('#match-finish-choice').hidden = true;
      $('#match-watch-leave').hidden = false;
    });
    $('#match-finish-leave').addEventListener('click', run(leaveActiveMatch));
    $('#match-watch-leave').addEventListener('click', run(leaveActiveMatch));
    $('#result-again').addEventListener('click', run(() => leaveResult(() => {
      if (currentPlay.renderMode === '3d') {
        detailMap = currentPlay.map;
        detailDifficulty = currentPlay.difficulty;
        show('detail');
        detail3D.setMode('3d');
        detail3D.start();
      } else play(currentPlay.map, currentPlay.difficulty, currentPlay.fromEditor);
    })));
    $('#result-continue').addEventListener('click', () => leaveResult(() => {
      if (currentPlay?.inMatch) native.call('matchLeave').catch(report);
      show(currentPlay.fromEditor ? 'editor' : currentPlay.map.official ? 'maps' : 'personal');
    }));
    native.on('matchState', updateMatch);
    native.on('matchPeer', (peer) => { peers.set(peer.id, { ...peer, seenAt: Date.now() }); renderMatch(); });
    native.on('matchInvitation', run(async (state) => {
      if (currentPlay && (!$('#play-view').hidden || detail3D?.playing)) { await native.call('matchDecline'); return; }
      matchEntry = null;
      updateMatch(state);
      const dialog = $('#match-invite-dialog');
      all('dialog[open]').forEach((open) => { if (open !== dialog) open.close(); });
      $('#match-invite-name').textContent = state.peer?.name || '附近玩家';
      const avatar = $('#match-invite-avatar');
      avatar.hidden = false;
      avatar.src = avatarSource(state.peer);
      $('#match-invite-map').textContent = `${displayName(state.map)} · ${labels[state.difficulty]} · ${state.map.official ? '官方地图' : '自制地图'}`;
      if (!dialog.open) dialog.showModal();
    }));
    native.on('matchCountdown', (packet) => {
      updateMatch(packet.match);
      if ($('#match-invite-dialog').open) $('#match-invite-dialog').close();
      startCountdown(packet.seconds || 3);
    });
    native.on('matchStart', run(async (state) => {
      closeCountdown();
      if ($('#match-invite-dialog').open) $('#match-invite-dialog').close();
      updateMatch(state); matchOutcome = null; matchLocalResult = null;
      await play(state.map, state.difficulty, false, true);
    }));
    native.on('matchResult', (outcome) => {
      applyMatchOutcome(outcome);
      if (currentPlay?.inMatch && !$('#play-view').hidden) {
        const score = game?.score || 0, correct = game?.correctCaptures || 0, wrong = game?.wrongCaptures || 0;
        const result = matchLocalResult || { score, duration: game?.startedAt ? Math.max(0, Math.round((Date.now() - game.startedAt) / 1000)) : 0,
          accuracy: correct + wrong ? Math.round(100 * correct / (correct + wrong)) : 0, cleared: false,
          best: records[`${currentPlay.map.id}|${currentPlay.difficulty}`]?.bestScore ?? score,
          newRecord: false, handoff: captureResultHandoff() };
        $('#match-finish-choice').hidden = true;
        $('#match-watch-leave').hidden = true;
        if (game) game._resultSent = true;
        populateResult(currentPlay, result);
        applyMatchOutcome(outcome);
      }
      clearMatchRun();
    });
    native.on('matchMetrics', updateMatchMetrics);
    native.on('matchDeclined', () => { closeCountdown(); if ($('#match-invite-dialog').open) $('#match-invite-dialog').close(); });
    window.setInterval(() => {
      if (!$('#match-view').hidden) native.call('matchState').then(updateMatch).catch(report);
    }, 5000);
    native.on('matchDisconnected', () => {
      if (!currentPlay || $('#play-view').hidden) closeCountdown();
      if (currentPlay?.inMatch && game) {
        $('#status').hidden = false;
        $('#status').textContent = '蓝牙连接中断，正在恢复；本局计时继续。';
      }
    });
    native.on('opponentFinished', (result) => {
      if (currentPlay?.inMatch && game) {
        game.matchSync?.updateOpponentConnection({ status: result?.cleared ? 'completed' : 'failed' });
      }
    });
    native.on('opponentLeft', (event) => {
      if (currentPlay?.inMatch && game && !$('#play-view').hidden) {
        game.matchSync?.updateOpponentConnection({ status: event?.finished
          ? (event.cleared ? 'completed' : 'failed') : 'forfeited' });
        $('#status').hidden = false;
        $('#status').textContent = event?.finished ? '对手已完成并离开，你可以继续完成本局。'
          : event?.reason === 'disconnect_timeout' ? '连接超时，你可以继续完成本局。'
            : '对手已退出，你可以继续完成本局。';
      }
    });
    native.on('matchReconnected', () => {
      if (currentPlay?.inMatch && game) {
        game._lastFrameTime = performance.now();
        if (game._resultSent) {
          game.matchSync?.send(game.currentLevel?.timeUp ? 'failed' : 'completed').catch(() => null);
        }
        $('#status').hidden = true;
      }
    });
    native.on('matchError', (event) => { matchErrorMessage = event.message || ''; renderMatch(); });
  }
  buildOfficialCarousel();
  initialize().catch(report);
})();
