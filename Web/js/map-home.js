(function () {
  const COMMUNITY_PREVIEWS_KEY = "inkballCommunityHomePreviews";

  function restoreCommunityPreviews() {
    if (!document.documentElement || !document.documentElement.classList ||
        !document.documentElement.classList.contains("is-community-returned")) return;
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(COMMUNITY_PREVIEWS_KEY) || "null"); } catch (err) { return; }
    if (!saved || Date.now() - saved.at > 15 * 60 * 1000 || !saved.images) return;
    document.querySelectorAll("[data-map-carousel] .map-card").forEach(function (card) {
      const source = saved.images[card.getAttribute("data-map-slug")];
      const surface = card.querySelector(".map-preview-surface");
      if (!source || !surface) return;
      const image = document.createElement("img");
      image.className = "map-preview-snapshot is-loaded";
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.src = source;
      surface.appendChild(image);
    });
  }

  function rememberCommunityPreviews() {
    const images = {};
    document.querySelectorAll("[data-map-carousel] .map-card").forEach(function (card) {
      const slug = card.getAttribute("data-map-slug");
      const surface = card.querySelector(".map-preview-surface");
      const canvas = card.querySelector("canvas");
      if (!slug || images[slug] || !surface || !canvas || !surface.classList.contains("is-preview-ready")) return;
      try { images[slug] = canvas.toDataURL("image/webp", 0.82); } catch (err) { /* Keep the existing fallback. */ }
    });
    if (!Object.keys(images).length) return;
    try { sessionStorage.setItem(COMMUNITY_PREVIEWS_KEY, JSON.stringify({ at: Date.now(), images: images })); }
    catch (err) { /* Storage is optional. */ }
  }

  restoreCommunityPreviews();

  function readMaps() {
    const node = document.getElementById("inkball-maps");
    if (!node) return [];
    try {
      return JSON.parse(node.textContent) || [];
    } catch (err) {
      return [];
    }
  }

  function wrap(index, count) {
    return ((index % count) + count) % count;
  }

  function layoutFor(maps, slug) {
    for (let i = 0; i < maps.length; i++) {
      if (maps[i].slug === slug) return maps[i].layout;
    }
    return "";
  }

  function wheelDelta(event) {
    let dx = event.deltaX;
    let dy = event.deltaY;
    if (event.deltaMode === 1) {
      dx *= 16;
      dy *= 16;
    } else if (event.deltaMode === 2) {
      dx *= 800;
      dy *= 800;
    }
    return Math.abs(dx) >= Math.abs(dy) ? dx : dy;
  }

  function mapIndexOf(card) {
    const value = parseInt(card && card.getAttribute("data-map-index"), 10);
    return Number.isNaN(value) ? 0 : value;
  }

  function loginSpinState(start, period, rounds, progress) {
    const t = Math.max(0, Math.min(1, Number(progress) || 0));
    const eased = 1 - Math.pow(1 - t, 4);
    const distance = Math.max(0, period) * Math.max(1, rounds) * eased;
    const phase = period > 0 ? distance % period : 0;
    return {
      offset: t >= 1 ? start : start - phase,
      blur: t >= 1 ? 0 : Math.min(7, Math.max(0, (1 - t) * 8)),
    };
  }

  const LOGIN_SPIN_DURATION_MS = 2800;
  const LOGIN_ENTRANCE_DURATION_MS = 900;
  window.InkballHomeSpin = {
    state: loginSpinState,
    duration: LOGIN_SPIN_DURATION_MS,
    entranceDuration: LOGIN_ENTRANCE_DURATION_MS,
  };

  document.addEventListener("DOMContentLoaded", function () {
    const T = window.InkballMapTransition;
    const communityNav = document.querySelector("a.community-nav");
    if (communityNav && T) {
      communityNav.addEventListener("click", function () {
        rememberCommunityPreviews();
        const icon = communityNav.querySelector(".community-nav__icon") || communityNav;
        const rect = T.rectOf(icon);
        if (window.InkballAmbient && typeof window.InkballAmbient.snapshot === "function") {
          window.InkballAmbient.snapshot(rect ? {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          } : null);
        }
        if (window.InkballAmbient && typeof window.InkballAmbient.markCommunityHandoff === "function") {
          window.InkballAmbient.markCommunityHandoff();
        }
      });
    }

    const root = document.querySelector("[data-map-carousel]");
    const maps = readMaps();
    if (!root || !maps.length) return;

    const viewport = root.querySelector("[data-map-viewport]");
    const track = root.querySelector("[data-map-track]");
    const prevBtn = root.querySelector("[data-map-prev]");
    const nextBtn = root.querySelector("[data-map-next]");
    if (!viewport || !track) return;

    const count = maps.length;
    const loginArrival = root.getAttribute("data-login-arrival") === "true";
    const fullscreenRestore = document.documentElement.classList.contains("is-fullscreen-restoring");
    let offset = 0;
    let step = 0;
    let currentIndex = 0;
    let animId = null;
    let animating = false;
    let snapTimer = null;
    let suppressClick = false;
    let pointerId = null;
    let dragging = false;
    let lastMoveX = 0;
    let lastMoveTime = 0;
    let velocity = 0;
    let introSpinning = false;

    function cards() {
      return Array.prototype.slice.call(track.children);
    }

    function cloneCard(node) {
      const clone = node.cloneNode(true);
      clone.removeAttribute("id");
      return clone;
    }

    function prepareLoop() {
      if (count < 2 || track.dataset.looped === "1") return;
      const origins = cards();
      const head = document.createDocumentFragment();
      const tail = document.createDocumentFragment();
      origins.forEach(function (node) {
        head.appendChild(cloneCard(node));
        tail.appendChild(cloneCard(node));
      });
      track.insertBefore(head, track.firstChild);
      track.appendChild(tail);
      track.dataset.looped = "1";
    }

    function drawPreviews() {
      if (!window.InkballHomePreview) return Promise.resolve([]);
      const groups = new Map();
      cards().forEach(function (card) {
        const slug = card.getAttribute("data-map-slug");
        if (!groups.has(slug)) groups.set(slug, { layout: layoutFor(maps, slug), copies: [] });
        groups.get(slug).copies.push({
          canvas: card.querySelector("canvas"),
          surface: card.querySelector(".map-preview-surface"),
        });
      });
      return window.InkballHomePreview.paintCopies(Array.from(groups.values()));
    }

    function measure() {
      const list = cards();
      if (!list.length) return;
      if (list.length < 2) {
        step = list[0].offsetWidth;
        return;
      }
      step = list[1].offsetLeft - list[0].offsetLeft;
    }

    function restyle() {
      if (!step) return;
      const viewMid = viewport.clientWidth / 2;
      cards().forEach(function (card) {
        const mid = offset + card.offsetLeft + card.offsetWidth / 2;
        const t = Math.max(0, Math.min(1, Math.abs(mid - viewMid) / Math.max(step, 1)));
        const scale = 1.06 - t * 0.22;
        card.style.transform = "scale(" + scale + ")";
        card.style.opacity = String(1 - t * 0.38);
        card.style.zIndex = String(Math.round((1 - t) * 20));
        card.classList.toggle("is-center", t < 0.32);
      });
    }

    function nearestSlot() {
      const viewMid = viewport.clientWidth / 2;
      let nearest = 0;
      let best = Infinity;
      cards().forEach(function (card, index) {
        const mid = offset + card.offsetLeft + card.offsetWidth / 2;
        const dist = Math.abs(mid - viewMid);
        if (dist < best) {
          best = dist;
          nearest = index;
        }
      });
      return nearest;
    }

    function offsetForCard(card) {
      if (!card) return offset;
      return viewport.clientWidth / 2 - (card.offsetLeft + card.offsetWidth / 2);
    }

    function rebaseCopies() {
      if (count < 2 || !step || animating) return false;
      const slot = nearestSlot();
      const period = step * count;
      if (slot < count) {
        offset -= period;
        return true;
      }
      if (slot >= count * 2) {
        offset += period;
        return true;
      }
      return false;
    }

    function apply(allowRebase) {
      if (allowRebase) rebaseCopies();
      track.style.transform = "translate3d(" + offset + "px,0,0)";
      restyle();
    }

    function cancelAnim() {
      if (animId) {
        window.cancelAnimationFrame(animId);
        animId = null;
      }
      animating = false;
    }

    function animateTo(dest) {
      cancelAnim();
      const start = offset;
      const delta = dest - start;
      if (Math.abs(delta) < 0.5) {
        offset = dest;
        apply(true);
        return;
      }
      animating = true;
      const duration = Math.min(420, 220 + Math.abs(delta) * 0.28);
      const t0 = performance.now();
      function frame(now) {
        const t = Math.min(1, (now - t0) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        offset = start + delta * ease;
        apply(false);
        if (t < 1) {
          animId = window.requestAnimationFrame(frame);
          return;
        }
        animId = null;
        animating = false;
        apply(true);
      }
      animId = window.requestAnimationFrame(frame);
    }

    function goToSlot(slot, instant) {
      const list = cards();
      if (!list.length) return;
      const max = list.length - 1;
      const target = Math.max(0, Math.min(max, slot));
      const card = list[target];
      currentIndex = wrap(mapIndexOf(card), count);
      const position = root.querySelector("[data-carousel-position]");
      if (position) position.textContent = String(currentIndex + 1).padStart(2, "0");
      const dest = offsetForCard(card);
      if (instant) {
        cancelAnim();
        offset = dest;
        apply(true);
      } else {
        animateTo(dest);
      }
    }

    function snap() {
      goToSlot(nearestSlot(), false);
    }

    function scheduleSnap() {
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(snap, 140);
    }

    function panBy(dx) {
      if (count < 2 || introSpinning) return;
      cancelAnim();
      offset += dx;
      apply(true);
      scheduleSnap();
    }

    function rotate(delta) {
      if (count < 2 || introSpinning) return;
      window.clearTimeout(snapTimer);
      cancelAnim();
      apply(true);
      goToSlot(nearestSlot() + delta, false);
    }

    function indexForSlug(slug) {
      for (let i = 0; i < maps.length; i++) {
        if (maps[i].slug === slug) return i;
      }
      return 0;
    }

    function cardForSlug(slug) {
      const viewMid = viewport.clientWidth / 2;
      let best = null;
      let bestDist = Infinity;
      cards().forEach(function (card) {
        if (card.getAttribute("data-map-slug") !== slug) return;
        const mid = offset + card.offsetLeft + card.offsetWidth / 2;
        const dist = Math.abs(mid - viewMid);
        if (dist < bestDist) {
          bestDist = dist;
          best = card;
        }
      });
      return best;
    }

    function runLeave(payload) {
      const T = window.InkballMapTransition;
      const preview = window.InkballHomePreview;
      if (!T || !preview || !payload || !payload.slug || !payload.rect) return;
      const card = cardForSlug(payload.slug);
      const canvas = card && card.querySelector("canvas");
      const surface = card && card.querySelector(".map-preview-surface");
      const to = T.rectOf(canvas);
      if (!to) return;

      const fly = document.createElement("div");
      fly.className = "map-home-fly map-preview-surface";
      const duration = payload.duration > 0 ? payload.duration : T.OFFICIAL_DURATION_MS;
      const flyCanvas = document.createElement("canvas");
      flyCanvas.width = 576;
      flyCanvas.height = 576;
      fly.appendChild(flyCanvas);
      preview.snapshot(fly, payload.image);
      cards().forEach(function (item) {
        if (item.getAttribute("data-map-slug") === payload.slug) {
          preview.snapshot(item.querySelector(".map-preview-surface"), payload.image);
        }
      });
      preview.paint(fly, flyCanvas, layoutFor(maps, payload.slug));
      if (surface) surface.classList.add("is-preview-covered");
      document.body.appendChild(fly);
      T.applyBox(fly, to);
      T.flipFrom(fly, payload.rect, to, duration, function () {
        fly.style.filter = "brightness(1)";
        const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.setTimeout(function () { preview.settle(fly, surface); }, reduced ? 0 : duration);
      }, undefined, "ease-in-out");
    }

    prepareLoop();

    function paintCards() {
      const ready = drawPreviews();
      if (window.Inkball && typeof Inkball.applyTranslations === "function") {
        Inkball.applyTranslations(track);
      }
      return ready;
    }

    function start(leaving) {
      measure();
      let startSlot = count < 2 ? 0 : count;
      if (leaving && leaving.slug) {
        const index = indexForSlug(leaving.slug);
        startSlot = count < 2 ? index : count + index;
      }
      goToSlot(startSlot, true);
      if (leaving) {
        const card = cardForSlug(leaving.slug);
        const surface = card && card.querySelector(".map-preview-surface");
        const continuous = window.InkballOfficialMap && window.InkballOfficialMap.attach(surface, leaving.slug);
        if (!continuous) runLeave(leaving);
      }
      return paintCards();
    }

    function finishLoginArrival() {
      if (window.InkballScene && typeof window.InkballScene.finishLoginArrival === "function") {
        window.InkballScene.finishLoginArrival();
      }
    }

    function runLoginEntrance() {
      if (!loginArrival || !window.InkballScene) return;
      window.clearTimeout(snapTimer);
      cancelAnim();
      introSpinning = true;
      animating = true;
      const first = cards()[count];
      const restingOffset = offsetForCard(first);
      const entranceOffset = viewport.clientWidth + Math.max(step, 24);
      const period = step * count;
      const rounds = count < 2 ? 0 : 3;
      const destinationOffset = restingOffset - period * rounds;
      const duration = LOGIN_ENTRANCE_DURATION_MS + LOGIN_SPIN_DURATION_MS;
      const startedAt = performance.now();
      offset = entranceOffset;
      currentIndex = 0;
      apply(false);
      root.classList.add("is-login-entering", "is-login-spin");
      if (typeof window.InkballScene.revealLoginArrival === "function") {
        window.InkballScene.revealLoginArrival();
      }
      root.classList.remove("is-login-loading");

      function frame(now) {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 4);
        const rawOffset = entranceOffset + (destinationOffset - entranceOffset) * eased;
        if (progress >= 1 || period <= 0) {
          offset = restingOffset;
        } else if (rawOffset <= restingOffset) {
          offset = restingOffset - ((restingOffset - rawOffset) % period);
        } else {
          offset = rawOffset;
        }
        track.style.setProperty("--map-spin-blur", String(Math.min(7, (1 - progress) * 8).toFixed(2)) + "px");
        apply(false);
        if (progress < 1) {
          animId = window.requestAnimationFrame(frame);
          return;
        }
        animId = null;
        animating = false;
        introSpinning = false;
        offset = restingOffset;
        apply(false);
        track.style.removeProperty("--map-spin-blur");
        root.classList.remove("is-login-entering", "is-login-spin");
        window.requestAnimationFrame(finishLoginArrival);
      }
      animId = window.requestAnimationFrame(frame);
    }

    const leaving = T ? T.takeLeave() : null;
    if (loginArrival) root.classList.add("is-login-loading");
    // Position the fixed preview surfaces immediately; only the pixels wait for sprites.
    start(leaving);
    window.requestAnimationFrame(function () {
      if (fullscreenRestore) {
        document.documentElement.classList.remove("is-fullscreen-restoring");
        return;
      }
      window.requestAnimationFrame(runLoginEntrance);
    });

    function refreshPosition() {
      if (root.hidden) return;
      if (root.dataset.returnMapSlug) {
        currentIndex = indexForSlug(root.dataset.returnMapSlug);
        delete root.dataset.returnMapSlug;
      }
      measure();
      goToSlot(count < 2 ? currentIndex : count + currentIndex, true);
    }

    window.addEventListener("resize", refreshPosition);
    window.addEventListener("inkball:routechange", refreshPosition);

    if (prevBtn) prevBtn.addEventListener("click", function () { rotate(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { rotate(1); });

    track.addEventListener("click", function (event) {
      const card = event.target.closest("a.map-card");
      if (!card) return;
      if (introSpinning) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const T = window.InkballMapTransition;
      if (!T) return;
      const canvas = card.querySelector("canvas");
      const slug = card.getAttribute("data-map-slug");
      const surface = card.querySelector(".map-preview-surface");
      if (canvas && surface && !surface.classList.contains("is-preview-ready") &&
          window.InkballMapPreview && typeof InkballMapPreview.drawSync === "function") {
        InkballMapPreview.drawSync(canvas, layoutFor(maps, slug));
      }
      const rect = canvas ? T.rectOf(canvas) : null;
      if (slug && rect) T.saveEnter(slug, rect);
      if (slug && rect && window.InkballOfficialMap) {
        window.InkballOfficialMap.capture(card.href, slug, canvas, rect, "enter");
      }
      if (window.InkballAmbient && typeof window.InkballAmbient.snapshot === "function") {
        window.InkballAmbient.snapshot();
      }
    }, true);

    viewport.addEventListener("dragstart", function (event) {
      event.preventDefault();
    });

    viewport.addEventListener(
      "wheel",
      function (event) {
        if (introSpinning) return;
        if (event.ctrlKey || event.metaKey) return;
        if (count < 2) return;
        event.preventDefault();
        panBy(-wheelDelta(event));
      },
      { passive: false }
    );

    viewport.addEventListener("pointerdown", function (event) {
      if (count < 2 || introSpinning) return;
      if (event.pointerType === "mouse") return;
      pointerId = event.pointerId;
      dragging = true;
      suppressClick = false;
      lastMoveX = event.clientX;
      lastMoveTime = performance.now();
      velocity = 0;
      cancelAnim();
      window.clearTimeout(snapTimer);
      apply(true);
      if (viewport.setPointerCapture) {
        try {
          viewport.setPointerCapture(pointerId);
        } catch (err) {
          /* ignore */
        }
      }
    });

    viewport.addEventListener(
      "pointermove",
      function (event) {
        if (!dragging || event.pointerId !== pointerId) return;
        const now = performance.now();
        const dx = event.clientX - lastMoveX;
        if (Math.abs(dx) > 8) suppressClick = true;
        const dt = Math.max(1, now - lastMoveTime);
        velocity = dx / dt;
        lastMoveX = event.clientX;
        lastMoveTime = now;
        offset += dx;
        apply(true);
        event.preventDefault();
      },
      { passive: false }
    );

    function endPointer(event) {
      if (!dragging || (event && event.pointerId !== pointerId)) return;
      dragging = false;
      pointerId = null;
      offset += velocity * 180;
      apply(true);
      snap();
      window.setTimeout(function () {
        suppressClick = false;
      }, 0);
    }

    viewport.addEventListener("pointerup", endPointer);
    viewport.addEventListener("pointercancel", endPointer);

    window.addEventListener("keydown", function (event) {
      if (introSpinning || root.hidden) return;
      if (event.target && event.target.closest && event.target.closest("input, textarea, select")) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        rotate(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        rotate(1);
      }
    });
  });
})();
