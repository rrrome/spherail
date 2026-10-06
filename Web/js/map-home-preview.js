/** Keep a static surface visible until the real preview has been painted. */
(function () {
  // Match the real preview's one-second opacity transition in ui-system.css.
  const FADE_MS = 1000;

  function afterPaint(callback) {
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      callback();
    }
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(finish);
    });
    window.setTimeout(finish, 250);
  }

  function paint(surface, canvas, layout) {
    if (!surface || !canvas || !window.InkballMapPreview) return Promise.resolve(false);
    return Promise.resolve().then(function () {
      return window.InkballMapPreview.draw(canvas, layout);
    }).then(function () {
      return new Promise(function (resolve) {
        afterPaint(function () {
          surface.classList.add("is-preview-ready");
          resolve(true);
        });
      });
    }).catch(function () {
      // Keep the fixed surface / return snapshot if drawing is unavailable.
      return false;
    });
  }

  function paintCopies(groups) {
    if (!window.InkballMapPreview) return Promise.resolve([]);
    return Promise.all(groups.map(function (group) {
      const copies = group.copies.filter(function (copy) { return copy.canvas && copy.surface; });
      if (!copies.length) return Promise.resolve([]);
      const original = copies[0].canvas;
      return Promise.resolve().then(function () {
        return window.InkballMapPreview.draw(original, group.layout);
      }).then(function () {
        copies.slice(1).forEach(function (copy) {
          copy.canvas.width = original.width;
          copy.canvas.height = original.height;
          copy.canvas.getContext("2d").drawImage(original, 0, 0);
        });
        return copies;
      }).catch(function () { return []; });
    })).then(function (painted) {
      return new Promise(function (resolve) {
        afterPaint(function () {
          painted.flat().forEach(function (copy) { copy.surface.classList.add("is-preview-ready"); });
          resolve(painted.flat().length);
        });
      });
    });
  }

  function snapshot(surface, source) {
    if (!surface || !source) return;
    const img = document.createElement("img");
    img.className = "map-preview-snapshot";
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    img.onload = function () { img.classList.add("is-loaded"); };
    img.onerror = function () { img.remove(); };
    // The CSS surface stays opaque even before this image loads or if it fails.
    surface.appendChild(img);
    img.src = source;
  }

  function settle(fly, surface) {
    if (surface) surface.classList.remove("is-preview-covered");
    // The same snapshot or fixed surface remains in the moving carousel card.
    // It does not depend on a timeout guessing when sprite loading will finish.
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fly.style.transition = reduced ? "none" : "opacity " + FADE_MS + "ms ease-in-out";
    fly.classList.add("is-preview-settled");
    window.setTimeout(function () { fly.remove(); }, reduced ? 0 : FADE_MS);
  }

  window.InkballHomePreview = { paint: paint, paintCopies: paintCopies, snapshot: snapshot, settle: settle };
})();
