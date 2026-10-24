/** Shared 2D/3D preview handoff and keyed scene updates. */
(function () {
  const DURATION = 720;
  function ease(value) { return 1 - Math.pow(1 - value, 3); }

  function reconcile(options) {
    const groups = new Map();
    let changes = [];
    function finish() {
      changes.forEach(function (change) {
        if (change.old) options.remove(change.old);
        if (change.next) change.next.scale.setScalar(1);
      });
      changes = [];
    }
    function update(rows, animate) {
      finish();
      const incoming = new Set(rows.map(function (row) { return row.key; }));
      rows.forEach(function (row) {
        const previous = groups.get(row.key);
        if (previous && previous.signature === row.signature) return;
        const next = options.create(row);
        groups.set(row.key, { signature: row.signature, node: next });
        if (animate) {
          next.scale.setScalar(0.001);
          changes.push({ old: previous && previous.node, next: next, started: options.now() });
        } else {
          if (previous) options.remove(previous.node);
          next.scale.setScalar(1);
        }
      });
      groups.forEach(function (group, key) {
        if (incoming.has(key)) return;
        groups.delete(key);
        if (animate) changes.push({ old: group.node, started: options.now() });
        else options.remove(group.node);
      });
      return groups;
    }
    function tick(now) {
      changes = changes.filter(function (change) {
        const progress = Math.min(1, Math.max(0, (now - change.started) / (options.duration || 420)));
        if (change.old) change.old.scale.setScalar(Math.max(0.001, 1 - ease(Math.min(1, progress * 2))));
        if (change.next) change.next.scale.setScalar(Math.max(0.001, ease(Math.max(0, progress * 2 - 1))));
        if (progress < 1) return true;
        if (change.old) options.remove(change.old);
        return false;
      });
    }
    return { update: update, tick: tick, finish: finish, groups: groups };
  }

  function create(options) {
    const root = options.root, layer = options.layer, frame = options.frame;
    const win = options.window || window;
    const reduced = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let mode = '2d', loaded = false, current = '', desired = '', url = '', sent = '';
    let request = 0, hideTimer = null, active = true;
    function post(message) {
      if (frame.contentWindow) frame.contentWindow.postMessage(message, '*');
    }
    function morph() {
      post({ type: 'inkball:3d-preview-morph', mode: mode,
        rect: options.hero.getBoundingClientRect(), duration: reduced ? 0 : DURATION });
    }
    function activate() {
      layer.hidden = false;
      if (!active) post({ type: 'inkball:3d-preview-active', map: options.map, active: true });
      active = true;
    }
    function park() {
      if (active) post({ type: 'inkball:3d-preview-active', map: options.map, active: false });
      active = false;
      layer.hidden = true;
    }
    function reveal() {
      if (!loaded || !desired || mode !== '3d' || current !== desired) return;
      win.clearTimeout(hideTimer);
      activate();
      root.classList.add('is-3d-frame-ready');
      const entering = !root.classList.contains('is-3d-render');
      // The entry FLIP leaves an inline transition that excludes preview
      // opacity and shadow. Return control to the shared preview CSS.
      if (entering && options.hero.style) options.hero.style.transition = '';
      // Commit the visible flat board before the depth/camera transition starts.
      void layer.offsetWidth;
      root.classList.add('is-3d-render');
      if (entering) morph();
    }
    function settleReady() {
      if (mode === '3d') reveal();
      else park();
    }
    function update(nextUrl, difficulty) {
      desired = difficulty;
      url = nextUrl;
      // Hidden iframes can pause rAF. Keep layout active at opacity zero until
      // the requested board has rendered and can begin its visible handoff.
      win.clearTimeout(hideTimer);
      layer.hidden = false;
      if (!frame.getAttribute('src')) {
        frame.setAttribute('src', url + '&preview=flat');
        return false;
      }
      if (!loaded) return false;
      if (current === desired && !sent) { settleReady(); return true; }
      activate();
      if (sent !== url) {
        sent = url;
        post({ type: 'inkball:3d-preview-update', map: options.map,
          difficulty: desired, url: url, selected: options.getBoot?.(desired).selected, request: ++request, reducedMotion: reduced || mode === '2d' });
      }
      return false;
    }
    function setMode(next) {
      mode = next === '3d' ? '3d' : '2d';
      win.clearTimeout(hideTimer);
      if (mode === '3d') { reveal(); return; }
      if (root.classList.contains('is-3d-render') && options.hero.style) options.hero.style.transition = '';
      root.classList.remove('is-3d-render');
      if (loaded) morph();
      if (!loaded) layer.hidden = !frame.getAttribute('src');
      else if (reduced) park();
      else hideTimer = win.setTimeout(function () { if (mode === '2d' && current === desired && !sent) park(); }, DURATION);
    }
    function onMessage(event) {
      if (event.origin !== win.location.origin || event.source !== frame.contentWindow) return;
      const data = event.data || {};
      if (data.map !== options.map || (options.session && data.session !== options.session)) return;
      if (data.type === 'inkball:3d-preview-error') {
        if (data.request && data.request !== request) return;
        sent = '';
        if (!loaded) frame.removeAttribute('src');
        setMode('2d');
        if (options.onError) options.onError(data.message);
        return;
      }
      if (data.type !== 'inkball:3d-ready') return;
      if (data.request != null && data.request !== request) return;
      loaded = true;
      current = data.difficulty;
      sent = '';
      if (current !== desired) { update(url, desired); return; }
      settleReady();
      if (options.onReady) options.onReady();
    }
    win.addEventListener('message', onMessage);
    function onResize() {
      win.requestAnimationFrame(function () { if (loaded && active) morph(); });
    }
    win.addEventListener('resize', onResize);
    const doc = options.document || win.document;
    if (doc) ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (event) {
      doc.addEventListener(event, onResize);
    });
    return { update: update, setMode: setMode, destroy: function () {
      win.clearTimeout(hideTimer);
      park();
      loaded = false;
      win.removeEventListener('message', onMessage);
      win.removeEventListener('resize', onResize);
      if (doc) ['fullscreenchange', 'webkitfullscreenchange'].forEach(event => doc.removeEventListener(event, onResize));
    } };
  }
  window.InkballRenderPreview = { create: create, reconcile: reconcile, duration: DURATION };
})();
