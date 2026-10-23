/* Microscope intro on the home page: "look through the eyepiece" zooms into
   the eyepiece lens, then the cell is revealed through a widening, focusing
   circle. Shown once per browser session; skipped for index.html#cell links. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('intro')) return;

  var screen = document.getElementById('intro');
  var art = screen.querySelector('.scope-art');
  var lenses = screen.querySelectorAll('.scope-lens');
  var btn = screen.querySelector('.scope-enter');
  var stage = document.querySelector('.stage');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var entered = false;

  try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); }

  function finish() {
    root.classList.remove('intro');
    screen.remove();
    stage.classList.remove('revealing', 'open');
    ['--rx', '--ry', '--rr'].forEach(function (p) { stage.style.removeProperty(p); });
    window.dispatchEvent(new Event('resize'));
  }

  // Zoom by animating the SVG's viewBox rather than a CSS transform, so the
  // vector drawing is re-rendered crisply at every frame instead of a bitmap
  // snapshot being stretched. (sx, sy) is the screen point that stays fixed.
  function zoomViewBox(sx, sy, zoom, dur) {
    var vb = art.viewBox.baseVal, x = vb.x, y = vb.y, w = vb.width, h = vb.height;
    var r = art.getBoundingClientRect();
    var s = Math.min(r.width / w, r.height / h);                       // preserveAspectRatio: meet
    var ox = r.left + (r.width - w * s) / 2, oy = r.top + (r.height - h * s) / 2;
    var ux = x + (sx - ox) / s, uy = y + (sy - oy) / s;                 // anchor in drawing units
    var fx = (ux - x) / w, fy = (uy - y) / h, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = k * k * k;            // accelerate into the eyepieces
      var zk = Math.pow(zoom, e), ww = w / zk, hh = h / zk;
      art.setAttribute('viewBox', (ux - fx * ww).toFixed(3) + ' ' + (uy - fy * hh).toFixed(3) + ' ' + ww.toFixed(3) + ' ' + hh.toFixed(3));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function enter() {
    if (entered) return;
    entered = true;
    try { sessionStorage.setItem('seenScope', '1'); } catch (e) { /* private mode: show again next time */ }

    if (reduceMotion) {
      screen.style.transition = 'opacity .4s ease';
      screen.style.opacity = '0';
      setTimeout(finish, 420);
      return;
    }

    // 1. Rush in between the two eyepieces, like looking through the binocular head.
    var a = art.getBoundingClientRect(), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, lw = 0;
    lenses.forEach(function (el) {
      var r = el.getBoundingClientRect();
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); lw = Math.max(lw, r.width);
    });
    var ex = (x0 + x1) / 2, ey = (y0 + y1) / 2;
    var zoom = Math.min(60, 1.3 * Math.max(innerWidth, innerHeight) / Math.max(lw, 8));
    screen.classList.add('entering');
    zoomViewBox(ex, ey, zoom, 950);

    // 2. Open the field of view onto the cell, coming into focus.
    setTimeout(function () {
      var s = stage.getBoundingClientRect();
      var rx = ex - s.left, ry = ey - s.top;
      var rr = Math.hypot(Math.max(rx, s.width - rx), Math.max(ry, s.height - ry));
      stage.style.setProperty('--rx', rx.toFixed(0) + 'px');
      stage.style.setProperty('--ry', ry.toFixed(0) + 'px');
      stage.style.setProperty('--rr', Math.ceil(rr) + 'px');
      stage.classList.add('revealing');
      void stage.offsetWidth; // commit the closed state before transitioning
      stage.classList.add('open');
    }, 620);

    setTimeout(finish, 620 + 1250);
  }

  screen.addEventListener('click', function (e) {
    if (e.target.closest('.scope-art, .scope-enter')) enter();
  });
  document.addEventListener('keydown', function (e) {
    if (!entered && (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ')) {
      e.preventDefault();
      enter();
    }
  });
})();
