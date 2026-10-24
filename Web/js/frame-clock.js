// WKWebView can defer iframe rAF even while its host is visible. Whichever
// callback arrives first drives one frame; parking cancels both callbacks.
(function () {
  function create(win) {
    const pending = new Map();
    let sequence = 0;
    return {
      requestAnimationFrame(callback) {
        const id = ++sequence;
        function finish(now) {
          const entry = pending.get(id);
          if (!entry) return;
          pending.delete(id);
          win.cancelAnimationFrame(entry.frame);
          win.clearTimeout(entry.timer);
          callback(now);
        }
        const frame = win.requestAnimationFrame(finish);
        const timer = win.setTimeout(() => finish(win.performance.now()), 1000 / 60);
        pending.set(id, { frame, timer });
        return id;
      },
      cancelAnimationFrame(id) {
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        win.cancelAnimationFrame(entry.frame);
        win.clearTimeout(entry.timer);
      },
    };
  }
  window.InkballFrameClock = { create };
})();
