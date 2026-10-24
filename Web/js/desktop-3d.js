// The desktop host supplies local maps/results; the reference renderer owns play.
(function () {
  'use strict';
  function create(options) {
    const { root, hero, layer, toggle, duel, status } = options;
    let frame = options.frame;
    let mapID = null, difficulty = null, preview = null, ready = false;
    let pendingStart = false, mode = '2d', playing = false, revision = 0, session = '';
    const source = () => `prototype-3d.html?mode=background&map=${encodeURIComponent(mapID)}&difficulty=${encodeURIComponent(difficulty)}`;
    const post = (data) => frame.contentWindow?.postMessage({ ...data, map: mapID, difficulty }, '*');
    function sync() {
      toggle.textContent = mode === '3d' ? '2D' : '3D';
      toggle.setAttribute('aria-pressed', String(mode === '3d'));
      duel.disabled = mode === '3d';
      duel.setAttribute('aria-disabled', String(mode === '3d'));
      duel.title = mode === '3d' ? '3D 模式暂不支持对战' : '';
    }
    function error(message) {
      pendingStart = false;
      playing = false;
      root.classList.remove('is-3d-playing');
      document.body.classList.remove('is-3d-playing');
      setMode('2d');
      status.hidden = false;
      status.dataset.error = message || '';
      status.textContent = '无法加载 3D 地图，请重试。';
    }
    function begin() {
      if (!ready || !pendingStart || mode !== '3d') return;
      pendingStart = false;
      playing = true;
      options.onStart();
      root.classList.add('is-3d-playing');
      document.body.classList.add('is-3d-playing');
      post({ type: 'inkball:start-embedded-3d' });
      frame.contentWindow.focus();
    }
    function dispose() {
      revision++;
      preview?.destroy();
      preview = null;
      ready = false;
      pendingStart = false;
      playing = false;
      mode = '2d';
      const fresh = frame.cloneNode(false);
      fresh.removeAttribute('src');
      fresh.removeAttribute('name');
      frame.replaceWith(fresh);
      frame = fresh;
      layer.hidden = true;
      root.classList.remove('is-3d-render', 'is-3d-frame-ready', 'is-3d-playing');
      document.body.classList.remove('is-3d-playing');
    }
    function update(map, selectedDifficulty) {
      if (mapID !== map.id || !preview) {
        dispose();
        if (mapID !== map.id) mode = '2d';
        mapID = map.id;
        const generation = revision;
        session = `${mapID}:${generation}`;
        preview = InkballRenderPreview.create({ root, hero, layer, frame, map: mapID,
          session, getBoot: tier => ({ ...options.getBoot(tier), session }),
          onReady() {
            if (generation !== revision) return;
            ready = true;
            status.hidden = true;
            begin();
          },
          onError(message) { if (generation === revision) error(message); },
        });
      }
      difficulty = selectedDifficulty;
      ready = preview.update(source(), difficulty);
      preview.setMode(mode);
      post({ type: 'desktop:3d-language', language: options.getBoot(difficulty).language });
      sync();
    }
    function setMode(value) {
      mode = value === '3d' ? '3d' : '2d';
      if (mode === '2d') pendingStart = false;
      status.hidden = true;
      if (mode === '3d' && preview) ready = preview.update(source(), difficulty);
      preview?.setMode(mode);
      sync();
    }
    function start() {
      if (mode !== '3d') return false;
      if (playing || pendingStart) return true;
      pendingStart = true;
      if (!ready) status.textContent = '正在加载 3D 地图…';
      status.hidden = ready;
      begin();
      return true;
    }
    toggle.addEventListener('click', () => setMode(mode === '3d' ? '2d' : '3d'));
    window.addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow || !preview) return;
      if (event.data?.type === 'desktop:3d-boot-request') {
        post({ type: 'desktop:3d-boot', boot: { ...options.getBoot(difficulty), session } });
        return;
      }
      if (event.data?.map !== mapID || event.data?.session !== session) return;
      const data = event.data;
      if (data.type === 'desktop:3d-error') { error(data.message); return; }
      if (!playing || data.difficulty !== difficulty) return;
      if (data.type === 'desktop:3d-result' && typeof data.url === 'string' && data.url.startsWith('desktop-result?')) {
        playing = false;
        options.onResult(data.url, Number.isFinite(data.lines) ? Math.max(0, Math.floor(data.lines)) : 0);
      }
      if (data.type === 'desktop:3d-home') options.onHome();
    });
    sync();
    return { update, setMode, start, dispose, get mode() { return mode; },
      get playing() { return playing; }, get ready() { return ready; } };
  }
  window.InkballDesktop3D = { create };
})();
