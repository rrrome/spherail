// Local transport adapter for the unchanged 3D game/renderer contracts.
(function () {
  'use strict';
  let boot = null;
  Inkball.t = (key, params = {}) => {
    let text = window.INKBALL_I18N?.[boot.language || 'zh']?.[key] || key;
    for (const [name, value] of Object.entries(params)) text = text.replaceAll('{' + name + '}', value);
    return text;
  };
  const post = (data) => parent.postMessage({ ...data, session: boot.session, map: boot.selected.map,
    difficulty: window.Inkball3D?.level?.config?.difficulty || boot.selected.difficulty }, '*');
  window.InkballOfficialRun = { start: async () => {}, abandon: async () => {} };
  window.InkballRunExit = () => async () => true;
  window.InkballUI = {
    present: (dialog) => dialog.showModal(),
    alert: async (message) => post({ type: 'desktop:3d-error', message }),
  };
  window.InkballScene = {
    navigate(url) {
      if (url.startsWith('desktop-result')) {
        post({ type: 'desktop:3d-result', url, lines: window.Inkball3D?.app.linesDrawn || 0 });
      } else post({ type: 'desktop:3d-home' });
    },
  };
  window.addEventListener('message', (event) => {
    if (event.source !== parent) return;
    if (event.data?.type === 'desktop:3d-boot' && !boot && event.data.boot?.selected) {
      boot = event.data.boot;
      window.INKBALL_3D_SESSION = boot.session;
      document.getElementById('inkball-3d-map').textContent = JSON.stringify(boot);
      window.InkballDesktopI18n.setLanguage(boot.language || 'zh');
      const renderer = document.createElement('script');
      renderer.src = 'js/inkball/prototype-3d.bundle.js';
      renderer.onerror = () => post({ type: 'desktop:3d-error', message: '无法加载 3D 地图，请重试。' });
      document.body.append(renderer);
      return;
    }
    if (!boot || event.data?.map !== boot.selected.map) return;
    if (event.data.type === 'desktop:3d-language') {
      boot.language = event.data.language === 'en' ? 'en' : 'zh';
      window.InkballDesktopI18n.setLanguage(boot.language);
    }
    if (event.data.type === 'inkball:3d-preview-update' && event.data.selected) {
      boot.selected = event.data.selected;
    }
  });
  window.addEventListener('error', event => {
    document.querySelector('[data-prototype-3d]').dataset.renderError = event.message;
    if (boot) post({ type: 'desktop:3d-error', message: event.message });
  });
  parent.postMessage({ type: 'desktop:3d-boot-request' }, '*');
})();
