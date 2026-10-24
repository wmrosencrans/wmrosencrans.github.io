/* The cell: organelle registry + SVG drawing.
   Every page loads this file. ORGANELLES is the single source of truth for
   which organelle maps to which page — edit it to rename or add pages. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var D = Math.PI / 180;
  var C = {
    nuc: '#6f93ff', mito: '#ff5b4f', er: '#3ddc84', golgi: '#ffc845',
    lyso: '#ff4fd2', centro: '#3fe3ea', mem: '#b49cff', bg: '#03050a'
  };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // zoom: [cx, cy, size] in cell coordinates; label: pill centre.
  var ORGANELLES = [
    { id: 'nucleus', name: 'Nucleus', page: 'About', href: 'about.html', color: C.nuc,
      fn: 'What’s in the genes? A little about my background and mission.',
      zoom: [440, 470, 400], label: [430, 545] },
    { id: 'mito', name: 'Mitochondria', page: 'Research', href: 'research.html', color: C.mito,
      fn: 'Mapping how cells sort, recycle, and destroy their own parts, and building small molecules that rewire that machinery against disease.',
      zoom: [250, 250, 240], label: [285, 340] },
    { id: 'er', name: 'Endoplasmic Reticulum', page: 'Publications', href: 'publications.html', color: C.er,
      fn: 'The rough ER is studded with ribosomes, translating and folding the cell’s output. Here’s what my team and I have been building.',
      zoom: [600, 600, 360], label: [612, 612] },
    { id: 'golgi', name: 'Golgi apparatus', page: 'News', href: 'news.html', color: C.golgi,
      fn: 'The Golgi packages cargo into vesicles and ships it out to the rest of the cell. Here’s what’s shipping.',
      zoom: [700, 245, 220], label: [718, 248] },
    { id: 'centro', name: 'Centrosome', page: 'CV', href: 'cv.html', color: C.centro,
      fn: 'The centrosome organizes the microtubules every other organelle travels along. Check out my track record.',
      zoom: [640, 330, 160], label: [636, 398] },
    { id: 'lyso', name: 'Lysosomes', page: 'Beyond the Bench', href: 'life.html', color: C.lyso,
      fn: 'A little collection of what’s going on when I am not at the bench.',
      zoom: [420, 170, 200], label: [420, 236] },
    { id: 'membrane', name: 'Plasma membrane', page: 'Contact', href: 'contact.html', color: C.mem,
      fn: 'Receptors on the plasma membrane are how a cell hears from the outside world. Send a signal!',
      zoom: [215, 815, 300], label: [252, 752] }
  ];
  var byId = {};
  ORGANELLES.forEach(function (o, i) { o.n = String(i + 1).padStart(2, '0'); byId[o.id] = o; });

  /* ---------- helpers ---------- */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function f(n) { return n.toFixed(1); }

  // Catmull-Rom through points, as cubic Béziers.
  function smoothPath(pts, closed) {
    var n = pts.length, d = 'M' + f(pts[0][0]) + ',' + f(pts[0][1]);
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = pts[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)];
      var p1 = pts[i], p2 = pts[(i + 1) % n];
      var p3 = pts[closed ? (i + 2) % n : Math.min(i + 2, n - 1)];
      d += 'C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ',' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
        f(p2[0] - (p3[0] - p1[0]) / 6) + ',' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' +
        f(p2[0]) + ',' + f(p2[1]);
    }
    return closed ? d + 'Z' : d;
  }
  function harmonics(seed, amp) {
    var r = rng(seed);
    return [2, 3, 4, 5].map(function (fq, k) {
      return { a: amp * (0.4 + 0.6 * r()) / (1 + k * 0.6), fq: fq, p: r() * Math.PI * 2,
        s: (r() < 0.5 ? -1 : 1) * (0.3 + 0.5 * r()) };
    });
  }
  function blobPts(cx, cy, rx, ry, harm, t, n) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var th = i / n * Math.PI * 2, m = 1;
      for (var j = 0; j < harm.length; j++) m += harm[j].a * Math.sin(harm[j].fq * th + harm[j].p + t * harm[j].s);
      pts.push([cx + rx * m * Math.cos(th), cy + ry * m * Math.sin(th)]);
    }
    return pts;
  }
  function blob(cx, cy, rx, ry, seed, amp, n) {
    return smoothPath(blobPts(cx, cy, rx, ry, harmonics(seed, amp), 0, n || 36), true);
  }
  // Annular sector (y squashed by ky) — used as invisible hit areas.
  function sector(r1, r2, a0, a1, ky) {
    function p(r, a) { return f(Math.cos(a) * r) + ',' + f(Math.sin(a) * r * ky); }
    var big = a1 - a0 > Math.PI ? 1 : 0;
    return 'M' + p(r2, a0) + 'A' + r2 + ',' + f(r2 * ky) + ' 0 ' + big + ' 1 ' + p(r2, a1) +
      'L' + p(r1, a1) + 'A' + r1 + ',' + f(r1 * ky) + ' 0 ' + big + ' 0 ' + p(r1, a0) + 'Z';
  }
  function hit(g, attrs) { attrs.class = 'hit'; return el(attrs.d ? 'path' : 'circle', attrs, g); }

  /* ---------- defs ---------- */
  function makeDefs(svg, px) {
    var defs = el('defs', null, svg);
    function radial(id, stops, extra) {
      var g = el('radialGradient', Object.assign({ id: px + '-' + id }, extra || {}), defs);
      stops.forEach(function (s) { el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] }, g); });
    }
    radial('cyto', [[0, '#1b2440', 0.55], [0.75, '#161632', 0.45], [1, '#3a2a66', 0.5]]);
    radial('nuc', [[0, C.nuc, 0.16], [0.75, C.nuc, 0.24], [1, C.nuc, 0.5]]);
    radial('nucleolus', [[0, '#dfe7ff', 0.85], [0.6, C.nuc, 0.55], [1, C.nuc, 0.15]]);
    radial('mito', [[0, C.mito, 0.18], [0.8, C.mito, 0.32], [1, C.mito, 0.55]]);
    radial('lyso', [[0, '#ffd6f5', 0.75], [0.55, C.lyso, 0.45], [1, C.lyso, 0.7]]);
    radial('centro', [[0, C.centro, 0.55], [0.5, C.centro, 0.16], [1, C.centro, 0]]);
    radial('auto', [[0, '#f2ecff', 0.06], [1, '#f2ecff', 0.18]]);
    var flt = el('filter', { id: px + '-blur', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
    el('feGaussianBlur', { stdDeviation: 7 }, flt);
    var flt2 = el('filter', { id: px + '-soft', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: 4 }, flt2);
    return defs;
  }

  /* ---------- organelles (local coordinates) ---------- */
  function drawNucleus(g, ctx) {
    var harm = harmonics(11, 0.035);
    var outer = blobPts(0, 0, 165, 150, harm, 0, 48);
    var inner = blobPts(0, 0, 157, 142, harm, 0, 48);
    el('path', { d: smoothPath(outer, true), fill: C.nuc, opacity: 0.25, filter: 'url(#' + ctx.px + '-blur)' }, g);
    el('path', { d: smoothPath(outer, true), fill: 'url(#' + ctx.px + '-nuc)', stroke: C.nuc, 'stroke-width': 3, 'stroke-opacity': 0.9 }, g);
    el('path', { d: smoothPath(inner, true), fill: 'none', stroke: C.nuc, 'stroke-width': 1.2, 'stroke-opacity': 0.45 }, g);
    var r = rng(5), chrom = el('g', { fill: C.nuc }, g);
    for (var i = 0; i < 120; i++) {
      var a = r() * Math.PI * 2, dd = Math.sqrt(r()) * 0.86;
      var x = Math.cos(a) * dd * 150, y = Math.sin(a) * dd * 136;
      el('ellipse', { cx: f(x), cy: f(y), rx: f(2 + r() * 7), ry: f(2 + r() * 4.5),
        transform: 'rotate(' + f(r() * 180) + ' ' + f(x) + ' ' + f(y) + ')', 'fill-opacity': f(0.12 + r() * 0.35) }, chrom);
    }
    for (var k = 0; k < outer.length; k += 2) {
      el('circle', { cx: f((outer[k][0] + inner[k][0]) / 2), cy: f((outer[k][1] + inner[k][1]) / 2), r: 2.6, fill: '#d7e2ff', 'fill-opacity': 0.75 }, g);
    }
    el('path', { d: blob(28, -38, 44, 40, 3, 0.09), fill: 'url(#' + ctx.px + '-nucleolus)' }, g);
    el('path', { d: blob(-52, 48, 16, 14, 8, 0.1), fill: C.nuc, 'fill-opacity': 0.4 }, g);
    hit(g, { d: smoothPath(outer, true) });
  }

  function capsule(L, w) {
    return 'M' + (-L + w) + ',' + (-w) + 'H' + (L - w) + 'A' + w + ',' + w + ' 0 0 1 ' + (L - w) + ',' + w +
      'H' + (-L + w) + 'A' + w + ',' + w + ' 0 0 1 ' + (-L + w) + ',' + (-w) + 'Z';
  }
  function drawMito(g, ctx, len, w, seed) {
    var L = len / 2, r = rng(seed);
    el('path', { d: capsule(L, w), fill: C.mito, opacity: 0.3, filter: 'url(#' + ctx.px + '-soft)' }, g);
    el('path', { d: capsule(L, w), fill: 'url(#' + ctx.px + '-mito)', stroke: C.mito, 'stroke-width': 2.5 }, g);
    el('path', { d: capsule(L - 5, w - 5), fill: 'none', stroke: C.mito, 'stroke-width': 1.3, 'stroke-opacity': 0.55 }, g);
    var cr = el('g', { stroke: C.mito, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-opacity': 0.8, fill: 'none' }, g);
    var step = Math.max(11, w * 0.5), top = r() < 0.5;
    for (var x = -L + w * 0.75; x < L - w * 0.75; x += step * (0.85 + r() * 0.3)) {
      var over = Math.abs(x) - (L - w);
      var edge = (over > 0 ? Math.sqrt(Math.max(0, w * w - over * over)) : w) - 6;
      var depth = edge * (1.1 + r() * 0.6);
      var y0 = top ? -edge : edge, y1 = top ? -edge + depth : edge - depth;
      var bend = (r() - 0.5) * 6;
      el('path', { d: 'M' + f(x) + ',' + f(y0) + 'Q' + f(x + bend) + ',' + f((y0 + y1) / 2) + ' ' + f(x + bend * 0.5) + ',' + f(y1) }, cr);
      top = !top;
    }
    for (var i = 0; i < 4; i++) {
      el('circle', { cx: f((r() - 0.5) * (len - 2 * w)), cy: f((r() - 0.5) * w), r: f(1.5 + r() * 1.5), fill: '#ffd0c8', 'fill-opacity': 0.7 }, g);
    }
    hit(g, { d: capsule(L + 6, w + 6) });
  }

  // A mitochondrion that endlessly divides and fuses (fission/fusion dynamics,
  // with a nod to David Chan). Returns update(tSeconds).
  function liveMito(g, ctx, len, w, seed, offset) {
    var L = len / 2, r = rng(seed), cid = ctx.px + '-mclip' + seed;
    var halo = el('path', { fill: C.mito, opacity: 0.3, filter: 'url(#' + ctx.px + '-soft)' }, g);
    var body = el('path', { fill: 'url(#' + ctx.px + '-mito)', stroke: C.mito, 'stroke-width': 2.5 }, g);
    var innerM = el('path', { fill: 'none', stroke: C.mito, 'stroke-width': 1.3, 'stroke-opacity': 0.55 }, g);
    var clip = el('clipPath', { id: cid }, g.ownerSVGElement.querySelector('defs'));
    var clipPath = el('path', {}, clip);
    var cr = el('g', { 'clip-path': 'url(#' + cid + ')', stroke: C.mito, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-opacity': 0.8, fill: 'none' }, g);
    var halves = [el('g', null, cr), el('g', null, cr)];
    var step = Math.max(11, w * 0.5), top = r() < 0.5;
    for (var x = -L + w * 0.75; x < L - w * 0.75; x += step * (0.85 + r() * 0.3)) {
      if (Math.abs(x) < w * 0.45) continue;            // keep the division site clear
      var edge = w - 6, depth = edge * (1.1 + r() * 0.6);
      var y0 = top ? -edge : edge, y1 = top ? -edge + depth : edge - depth, bend = (r() - 0.5) * 6;
      el('path', { d: 'M' + f(x) + ',' + f(y0) + 'Q' + f(x + bend) + ',' + f((y0 + y1) / 2) + ' ' + f(x + bend * 0.5) + ',' + f(y1) }, halves[x < 0 ? 0 : 1]);
      top = !top;
    }
    hit(g, { d: capsule(L + 10, w + 8) });

    function cap(x, ww, LL) {                     // half-width of a capsule centred at 0
      var ax = Math.abs(x); ww = Math.min(ww, LL);
      if (ax <= LL - ww) return ww;
      var u = (ax - (LL - ww)) / ww; return u >= 1 ? 0 : ww * Math.sqrt(1 - u * u);
    }
    // closed outline from a half-width function, optionally rotated about (cx, 0)
    function loop(x0, x1, hfn, dx, ang, cx) {
      var n = 26, topE = [], botE = [], ca = Math.cos(ang || 0), sa = Math.sin(ang || 0);
      function pt(x, y) { var px = x - cx; return [cx + px * ca - y * sa + dx, px * sa + y * ca]; }
      for (var i = 0; i <= n; i++) {
        var xx = x0 + (x1 - x0) * i / n, h = Math.max(hfn(xx), 0.4);
        topE.push(pt(xx, -h)); botE.unshift(pt(xx, h));
      }
      return smoothPath(topE.concat(botE.slice(1, -1)), true);
    }
    // u = 1: one tubule; u = 0: two normal daughter tubules touching end to end.
    // gap > 0: the daughters have separated and drift independently.
    function outline(ww, LL, u, gap, ang) {
      var hl = LL / 2;
      function dL(x) { return cap(x + hl, ww, hl); }
      function dR(x) { return cap(x - hl, ww, hl); }
      if (gap < 0.5) return loop(-LL, LL, function (x) { return (1 - u) * Math.max(dL(x), dR(x)) + u * cap(x, ww, LL); }, 0, 0, 0);
      return loop(-LL, 0, dL, -gap / 2, -ang, -hl) + loop(0, LL, dR, gap / 2, ang, hl);
    }
    function ease(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
    var period = 12 + r() * 6, G = 0.3 * len, A = (6 + r() * 8) * D * (r() < 0.5 ? -1 : 1);
    return function update(t) {
      var p = ((t / period) + offset) % 1, u = 1, sep = 0;
      if (p < 0.3) u = 1;                                   // one continuous tubule
      else if (p < 0.42) u = 1 - ease((p - 0.3) / 0.12);    // constriction at the division site
      else if (p < 0.56) { u = 0; sep = ease((p - 0.42) / 0.14); }        // scission; daughters move apart
      else if (p < 0.7) { u = 0; sep = 1; }                 // two normal mitochondria
      else if (p < 0.82) { u = 0; sep = 1 - ease((p - 0.7) / 0.12); }     // they meet end to end
      else if (p < 0.95) u = ease((p - 0.82) / 0.13);       // fusion: the junction widens
      var gap = G * sep, ang = A * sep;
      var d = outline(w, L, u, gap, ang);
      body.setAttribute('d', d); halo.setAttribute('d', d); clipPath.setAttribute('d', d);
      innerM.setAttribute('d', outline(w - 5, L - 5, u, gap, ang));
      halves[0].setAttribute('transform', 'translate(' + f(-gap / 2) + ' 0) rotate(' + f(-ang / D) + ' ' + f(-L / 2) + ' 0)');
      halves[1].setAttribute('transform', 'translate(' + f(gap / 2) + ' 0) rotate(' + f(ang / D) + ' ' + f(L / 2) + ' 0)');
    };
  }

  function erSheets() {
    var r = rng(21), sheets = [];
    for (var s = 0; s < 4; s++) {
      var r0 = 194 + s * 24, a0 = (-15 + s * 4 + r() * 6) * D, a1 = (115 - s * 7 - r() * 8) * D, pts = [];
      for (var a = a0; a <= a1; a += 0.035) {
        var rr = r0 + 5 * Math.sin(a * 9 + s * 1.7) + 3 * Math.sin(a * 23 + s);
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.92]);
      }
      sheets.push(pts);
    }
    return sheets;
  }
  function drawER(g, ctx) {
    var r = rng(33), sheets = erSheets();
    var membranes = el('g', { fill: 'none', 'stroke-linecap': 'round' }, g);
    var ribos = el('g', { fill: '#c4ffdc' }, g);
    // a few bridges between neighbouring sheets
    for (var b = 0; b < 3; b++) {
      var s = b, idx = 6 + Math.floor(r() * (Math.min(sheets[s].length, sheets[s + 1].length) - 12));
      sheets.push([sheets[s][idx], sheets[s + 1][idx]]);
    }
    sheets.forEach(function (pts, si) {
      var d = smoothPath(pts, false);
      el('path', { d: d, stroke: C.er, 'stroke-width': 12, 'stroke-opacity': 0.16, filter: 'url(#' + ctx.px + '-soft)' }, membranes);
      el('path', { d: d, stroke: C.er, 'stroke-width': 9, 'stroke-opacity': 0.85 }, membranes);
      el('path', { d: d, stroke: '#04140c', 'stroke-width': 4.2, 'stroke-opacity': 0.9 }, membranes);
      if (si > 3) return;
      for (var i = 1; i < pts.length - 1; i++) {
        var nx = pts[i + 1][1] - pts[i - 1][1], ny = -(pts[i + 1][0] - pts[i - 1][0]);
        var nl = Math.hypot(nx, ny) || 1, side = r() < 0.5 ? 1 : -1;
        el('circle', { cx: f(pts[i][0] + nx / nl * 7.5 * side), cy: f(pts[i][1] + ny / nl * 7.5 * side), r: f(1.8 + r() * 0.8), 'fill-opacity': f(0.6 + r() * 0.4) }, ribos);
      }
    });
    hit(g, { d: sector(182, 282, -18 * D, 118 * D, 0.92) });
  }

  function drawGolgi(g, ctx) {
    var r = rng(41);
    var stack = el('g', { fill: 'none', 'stroke-linecap': 'round' }, g);
    for (var i = 0; i < 5; i++) {
      var rr = 84 + i * 15, mid = -55 * D, half = (40 - Math.abs(i - 2) * 4 + r() * 3) * D, pts = [];
      for (var a = mid - half; a <= mid + half; a += 0.04) {
        var q = rr + 2.5 * Math.sin(a * 14 + i);
        pts.push([Math.cos(a) * q, Math.sin(a) * q]);
      }
      var d = smoothPath(pts, false);
      el('path', { d: d, stroke: C.golgi, 'stroke-width': 13, 'stroke-opacity': 0.14, filter: 'url(#' + ctx.px + '-soft)' }, stack);
      el('path', { d: d, stroke: C.golgi, 'stroke-width': 10, 'stroke-opacity': 0.85 }, stack);
      el('path', { d: d, stroke: '#1a1204', 'stroke-width': 3.6 }, stack);
      [pts[0], pts[pts.length - 1]].forEach(function (p) {
        el('circle', { cx: f(p[0]), cy: f(p[1]), r: 7.5, fill: C.golgi, 'fill-opacity': 0.7 }, g);
      });
    }
    for (var v = 0; v < 16; v++) {
      var trans = v < 9, ang = trans ? (-95 + r() * 80) * D : (r() < 0.5 ? -103 - r() * 10 : -7 + r() * 10) * D;
      var rad = trans ? 158 + r() * 18 : 86 + r() * 52, vr = 3.5 + r() * 3.5;
      el('circle', { cx: f(Math.cos(ang) * rad), cy: f(Math.sin(ang) * rad), r: f(vr),
        fill: C.golgi, 'fill-opacity': 0.25, stroke: C.golgi, 'stroke-width': 1.8 }, g);
    }
    hit(g, { d: sector(70, 182, -112 * D, 2 * D, 1) });
  }

  function drawCentrosome(g, ctx) {
    el('circle', { cx: 0, cy: 0, r: 40, fill: 'url(#' + ctx.px + '-centro)' }, g);
    [['translate(-7 -6)'], ['translate(9 7) rotate(90)']].forEach(function (t) {
      var c = el('g', { transform: t[0] }, g);
      el('rect', { x: -17, y: -7, width: 34, height: 14, rx: 5, fill: C.centro, 'fill-opacity': 0.18, stroke: C.centro, 'stroke-width': 2.4 }, c);
      for (var x = -11; x <= 11; x += 5.5) el('line', { x1: x, y1: -4, x2: x, y2: 4, stroke: C.centro, 'stroke-width': 1.4, 'stroke-opacity': 0.8 }, c);
    });
    hit(g, { cx: 0, cy: 0, r: 46 });
  }

  function drawLyso(g, ctx, R, seed) {
    var r = rng(seed);
    el('circle', { cx: 0, cy: 0, r: R * 1.1, fill: C.lyso, opacity: 0.35, filter: 'url(#' + ctx.px + '-soft)' }, g);
    el('path', { d: blob(0, 0, R, R * 0.95, seed, 0.05), fill: 'url(#' + ctx.px + '-lyso)', stroke: C.lyso, 'stroke-width': 2 }, g);
    for (var i = 0; i < 5; i++) {
      var a = r() * Math.PI * 2, d = r() * R * 0.5, vr = R * (0.1 + r() * 0.13);
      el('circle', { cx: f(Math.cos(a) * d), cy: f(Math.sin(a) * d), r: f(vr), fill: '#ffe6fa', 'fill-opacity': 0.35, stroke: '#ffd6f5', 'stroke-width': 1, 'stroke-opacity': 0.7 }, g);
    }
    hit(g, { cx: 0, cy: 0, r: R + 8 });
  }

  // Double-membraned autophagosome engulfing a mitochondrial fragment (mitophagy).
  // The mitochondrion next to the mitophagy site, on the same 18 s clock as
  // mitophagy(): it divides asymmetrically, the small daughter (`rd` half-length)
  // is handed to the autophagy machinery, and the remaining daughter elongates
  // back to full length before dividing again.
  var TURNOVER_PERIOD = 18;
  function turnoverMito(g, ctx, L0, w, rd, seed) {
    var r = rng(seed), cid = ctx.px + '-mturn', xs = L0 - 2 * rd;
    var halo = el('path', { fill: C.mito, opacity: 0.3, filter: 'url(#' + ctx.px + '-soft)' }, g);
    var body = el('path', { fill: 'url(#' + ctx.px + '-mito)', stroke: C.mito, 'stroke-width': 2.5 }, g);
    var innerM = el('path', { fill: 'none', stroke: C.mito, 'stroke-width': 1.3, 'stroke-opacity': 0.55 }, g);
    var clipPath = el('path', {}, el('clipPath', { id: cid }, g.ownerSVGElement.querySelector('defs')));
    var cr = el('g', { 'clip-path': 'url(#' + cid + ')', stroke: C.mito, 'stroke-width': 3.4, 'stroke-linecap': 'round', 'stroke-opacity': 0.8, fill: 'none' }, g);
    var top = true;
    for (var x = -L0 + w * 0.8; x < L0 - w * 0.6; x += 9 + r() * 3) {
      if (Math.abs(x - xs) < w * 0.6) continue;           // keep the division site clear
      var edge = w - 4, depth = edge * (1.2 + r() * 0.5), y0 = top ? -edge : edge, y1 = top ? -edge + depth : edge - depth;
      el('path', { d: 'M' + f(x) + ',' + f(y0) + 'L' + f(x + (r() - 0.5) * 3) + ',' + f(y1) }, cr);
      top = !top;
    }
    hit(g, { d: capsule(L0 + 10, w + 8) });

    function capSeg(x, a, b, ww) {               // capsule spanning [a, b]
      var c = (a + b) / 2, L = (b - a) / 2, ax = Math.abs(x - c); ww = Math.min(ww, L);
      if (ax <= L - ww) return ww;
      var u = (ax - (L - ww)) / ww; return u >= 1 ? 0 : ww * Math.sqrt(1 - u * u);
    }
    function loop(x0, x1, hfn) {
      var n = 28, topE = [], botE = [];
      for (var i = 0; i <= n; i++) {
        var xx = x0 + (x1 - x0) * i / n, h = Math.max(hfn(xx), 0.4);
        topE.push([xx, -h]); botE.unshift([xx, h]);
      }
      return smoothPath(topE.concat(botE.slice(1, -1)), true);
    }
    function before(u, ins) {                    // u = 1 whole, u = 0 two touching daughters
      var a = -L0 + ins, b = L0 - ins, ww = w - ins;
      return loop(a, b, function (x) {
        return (1 - u) * Math.max(capSeg(x, a, xs - ins / 2, ww), capSeg(x, xs + ins / 2, b, ww)) + u * capSeg(x, a, b, ww);
      });
    }
    function after(e, ins) {                     // the remaining daughter, growing to the right
      var a = -L0 + ins, b = e - ins, ww = w - ins;
      return loop(a, b, function (x) { return capSeg(x, a, b, ww); });
    }
    function ease(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
    return function update(t) {
      var p = (t / TURNOVER_PERIOD) % 1, d, di;
      if (p < 0.12) {
        var u = p < 0.05 ? 1 : 1 - ease((p - 0.05) / 0.07);   // constriction near one end
        d = before(u, 0); di = before(u, 5);
      } else {
        var e = xs + (L0 - xs) * ease((p - 0.14) / 0.78);     // elongation back to full length
        d = after(e, 0); di = after(e, 5);
      }
      body.setAttribute('d', d); halo.setAttribute('d', d); clipPath.setAttribute('d', d);
      innerM.setAttribute('d', di);
    };
  }

  // STING trafficking, on a loop (cell coordinates). STING is drawn as a
  // transmembrane protein (TM segment in the bilayer, ligand-binding domain and
  // C-terminal tail in the cytosol) and keeps that topology everywhere: on the ER,
  // on COPII vesicles and post-Golgi carriers (cytosolic face outward), in Golgi
  // cisternae, and in the lysosome's limiting membrane before it is internalised
  // and degraded. cGAMP binds, STING oligomerises in the ER membrane, moves cis ->
  // trans through the Golgi while it signals (IRF3 to the nucleus), and is
  // delivered to a lysosome. Returns update(tSeconds).
  var UNITS_PER_UM = 15;
  var STING_LYSO = [820, 392];
  function stingTraffic(g) {
    var period = 20, DIM = '#a0714f', ON = '#ff8a3d', N = 3, VR = 11, LR = 18;
    var GOLGI_C = [640, 330], GOLGI_R = [84, 99, 114, 129, 144], GOLGI_A = -15 * D;
    var CGAS = [602, 520], NUC = [520, 452];

    // points on the outer membrane of an ER sheet, with the cytosol-facing normal
    var sheet = erSheets()[1], k0 = 0, best = 9;
    sheet.forEach(function (q, i) { var a = Math.atan2(q[1], q[0]); if (Math.abs(a - 10 * D) < best) { best = Math.abs(a - 10 * D); k0 = i; } });
    k0 = Math.max(9, Math.min(sheet.length - 10, k0));
    function erPoint(i) {
      var q0 = sheet[i - 1], q = sheet[i], q1 = sheet[i + 1];
      var tx = q1[0] - q0[0], ty = q1[1] - q0[1], tl = Math.hypot(tx, ty), nx = ty / tl, ny = -tx / tl;
      if (nx * q[0] + ny * q[1] < 0) { nx = -nx; ny = -ny; }       // away from the nucleus
      return { x: 440 + q[0] + nx * 4.5, y: 470 + q[1] + ny * 4.5, a: Math.atan2(ny, nx) };
    }
    var ER0 = [erPoint(k0 - 7), erPoint(k0), erPoint(k0 + 7)];     // scattered
    var ER1 = [erPoint(k0 - 1), erPoint(k0), erPoint(k0 + 1)];     // oligomer
    var EXIT = { x: ER1[1].x + Math.cos(ER1[1].a) * (VR + 2), y: ER1[1].y + Math.sin(ER1[1].a) * (VR + 2) };
    var CIS = [GOLGI_C[0] + Math.cos(GOLGI_A) * (GOLGI_R[0] - 14), GOLGI_C[1] + Math.sin(GOLGI_A) * (GOLGI_R[0] - 14)];
    var TRANS = [GOLGI_C[0] + Math.cos(GOLGI_A) * (GOLGI_R[4] + 16), GOLGI_C[1] + Math.sin(GOLGI_A) * (GOLGI_R[4] + 16)];

    var halo = el('circle', { r: 0, fill: ON, opacity: 0 }, g);
    var flash = el('circle', { cx: STING_LYSO[0], cy: STING_LYSO[1], r: LR, fill: 'none', stroke: C.lyso, 'stroke-width': 2, opacity: 0 }, g);
    var ves = el('circle', { r: VR, fill: 'rgba(255,255,255,.05)', stroke: '#f3eadf', 'stroke-width': 1.5, opacity: 0 }, g);
    var cgamp = ER0.map(function () { return el('circle', { r: 2.2, fill: '#ffffff', opacity: 0 }, g); });
    var irf = [0, 1, 2].map(function () { return el('circle', { r: 2.4, fill: C.centro, opacity: 0 }, g); });
    // one STING: local +x points into the cytosol
    var mols = ER0.map(function () {
      var m = el('g', null, g);
      el('rect', { x: -2.4, y: -1.7, width: 4.8, height: 3.4, rx: 1, 'class': 'tm' }, m);   // in the bilayer
      el('path', { d: 'M2.4,0 L5,0', 'stroke-width': 1.4, fill: 'none', 'class': 'line' }, m);
      el('ellipse', { cx: 8.2, cy: -2.5, rx: 3.4, ry: 2.4, transform: 'rotate(-20 8.2 -2.5)' }, m);  // LBD lobes
      el('ellipse', { cx: 8.2, cy: 2.5, rx: 3.4, ry: 2.4, transform: 'rotate(20 8.2 2.5)' }, m);
      el('path', { d: 'M11.4,0 q3,1.6 5,-1', 'stroke-width': 1.2, fill: 'none', 'class': 'line' }, m);  // C-terminal tail
      return m;
    });

    function ease(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
    function seg(p, a, b) { return ease((p - a) / (b - a)); }
    function lerp(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; }
    function quad(a, c, b, u) { return lerp(lerp(a, c, u), lerp(c, b, u), u); }
    function onCircle(c, r, a) { return { x: c[0] + Math.cos(a) * r, y: c[1] + Math.sin(a) * r, a: a }; }

    return function update(t) {
      var p = (t / period) % 1;
      var act = seg(p, 0.14, 0.22), olig = seg(p, 0.2, 0.3), exitER = seg(p, 0.3, 0.42), golgi = seg(p, 0.42, 0.6),
          toLyso = seg(p, 0.6, 0.72), fuse = seg(p, 0.72, 0.8), degrade = seg(p, 0.82, 0.95), fresh = seg(p, 0.95, 1);
      var pose = [], c = null, scale = 1;
      if (p < 0.2 || p >= 0.95) pose = ER0;
      else if (p < 0.3) pose = ER0.map(function (q, i) { var r = ER1[i]; return { x: q.x + (r.x - q.x) * olig, y: q.y + (r.y - q.y) * olig, a: q.a + (r.a - q.a) * olig }; });
      else if (p < 0.42) {
        // a COPII vesicle buds from the ER and carries the oligomer to the cis-Golgi
        c = quad([EXIT.x, EXIT.y], [748, 404], CIS, exitER);
        var a0 = ER1[1].a + Math.PI;
        pose = [-0.55, 0, 0.55].map(function (da) { return onCircle(c, VR, a0 + Math.PI + da); });
      } else if (p < 0.6) {
        // hop cisterna by cisterna, cis -> trans; heads stay on the cytosolic side
        var hop = golgi * (GOLGI_R.length - 1), i0 = Math.floor(Math.min(hop, GOLGI_R.length - 1.001)), fr = ease((hop - i0) * 1.4);
        var rr = GOLGI_R[i0] + (GOLGI_R[i0 + 1] - GOLGI_R[i0]) * fr + 5;
        pose = [-1, 0, 1].map(function (j) { var a = GOLGI_A + j * 8 / rr; return onCircle(GOLGI_C, rr, a); });
        c = [GOLGI_C[0] + Math.cos(GOLGI_A) * rr, GOLGI_C[1] + Math.sin(GOLGI_A) * rr];
      } else if (p < 0.72) {
        c = quad(TRANS, [822, 316], [STING_LYSO[0] - (LR + VR - 4), STING_LYSO[1] - 6], toLyso);
        pose = [-0.6, 0, 0.6].map(function (da) { return onCircle(c, VR, GOLGI_A + da); });
      } else {
        // fusion: STING enters the lysosome's limiting membrane, then is internalised and degraded
        var dock = [STING_LYSO[0] - (LR + VR - 4), STING_LYSO[1] - 6];
        c = lerp(dock, STING_LYSO, fuse);
        var r = VR + (LR - VR) * fuse, inward = degrade;
        pose = [-0.6, 0, 0.6].map(function (da) {
          var a = Math.PI + 0.3 + da * (1 - 0.3 * fuse), q = onCircle(c, r * (1 - 0.65 * inward), a);
          return q;
        });
        scale = 1 - 0.5 * degrade;
      }
      var col = act > 0.5 && p < 0.95 ? ON : DIM, op = p < 0.82 ? 1 : (p < 0.95 ? 1 - degrade : fresh);
      mols.forEach(function (m, i) {
        var q = pose[i];
        m.setAttribute('transform', 'translate(' + f(q.x) + ' ' + f(q.y) + ') rotate(' + f(q.a / D) + ') scale(' + f(scale) + ')');
        m.setAttribute('fill', col); m.setAttribute('stroke', col);
        m.setAttribute('opacity', f(op));
      });
      // cGAMP from cGAS in the cytosol to each STING's ligand-binding domain
      cgamp.forEach(function (dot, i) {
        var u = seg(p, 0.08 + i * 0.02, 0.16 + i * 0.02), tgt = [ER0[i].x + Math.cos(ER0[i].a) * 8, ER0[i].y + Math.sin(ER0[i].a) * 8], q = lerp(CGAS, tgt, u);
        dot.setAttribute('cx', f(q[0])); dot.setAttribute('cy', f(q[1]));
        dot.setAttribute('opacity', p > 0.08 && p < 0.2 ? f(Math.min(1, u * 4) * (1 - seg(p, 0.16 + i * 0.02, 0.2))) : '0');
      });
      var mid = c || [pose[1].x, pose[1].y];
      halo.setAttribute('cx', f(mid[0])); halo.setAttribute('cy', f(mid[1]));
      halo.setAttribute('r', f(14 + 4 * Math.sin(t * 4)));
      halo.setAttribute('opacity', f(p >= 0.2 && p < 0.82 ? 0.2 * act : 0));
      irf.forEach(function (dot, i) {
        var u = seg(p, 0.46 + i * 0.04, 0.62 + i * 0.04), q = lerp(mid, NUC, u);
        dot.setAttribute('cx', f(q[0])); dot.setAttribute('cy', f(q[1]));
        dot.setAttribute('opacity', u > 0 && u < 1 ? f(Math.sin(Math.PI * u)) : '0');
      });
      var inVes = (p >= 0.3 && p < 0.42) || (p >= 0.6 && p < 0.8);
      if (c) { ves.setAttribute('cx', f(c[0])); ves.setAttribute('cy', f(c[1])); }
      ves.setAttribute('r', f(p >= 0.72 ? VR * (1 - fuse) : VR));
      ves.setAttribute('opacity', inVes ? f(p < 0.42 ? Math.min(1, exitER * 6) : (p >= 0.72 ? 1 - fuse : Math.min(1, toLyso * 6))) : '0');
      flash.setAttribute('opacity', p >= 0.72 && p < 0.9 ? f(Math.sin(Math.PI * seg(p, 0.72, 0.9)) * 0.8) : '0');
      flash.setAttribute('r', f(LR + 8 * seg(p, 0.72, 0.9)));
    };
  }

  // Mitophagy, on a loop. A mitochondrial fragment buds off a neighbour and
  // depolarises; a phagophore (one continuous membrane sheet, so the inner and
  // outer membranes join at the rim) grows around it and seals into a double-
  // membrane autophagosome. A lysosome that was already sitting nearby docks
  // and fuses with the outer membrane, its contents fill the vesicle, the inner
  // membrane and cargo are degraded, and the autolysosome shrinks back into a
  // lysosome at its home position. Returns update(tSeconds).
  function mitophagy(g, ctx, src) {
    var MEM = '#e9e2ff', R1 = 31, R2 = 25, RL = 14, period = TURNOVER_PERIOD;
    var HOME = [72, -52];
    // where the small daughter sits at the moment of scission, in this group's coordinates
    var sr = src.rot * D, sc = src.L0 - src.rd;
    var BUD = [src.x + sc * Math.cos(sr) - src.ox, src.y + sc * Math.sin(sr) - src.oy];
    var phago = el('path', { fill: MEM, 'fill-opacity': 0.16, 'fill-rule': 'evenodd', stroke: MEM, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
    var auto = el('circle', { r: R1, fill: C.lyso, 'fill-opacity': 0.3, stroke: C.lyso, 'stroke-width': 2 }, g);
    var innerVes = el('circle', { r: R2, fill: 'none', stroke: MEM, 'stroke-width': 1.5 }, g);
    var cargo = el('g', null, g);
    var cBody = el('path', { d: capsule(src.rd, src.w), fill: 'url(#' + ctx.px + '-mito)', stroke: C.mito, 'stroke-width': 2.5 }, cargo);
    var cCr = el('path', { d: 'M-11,-10 v9 M-3,10 v-9 M5,-10 v9 M12,9 v-7', stroke: C.mito, 'stroke-width': 3.4, 'stroke-linecap': 'round' }, cargo);
    var lyso = el('g', null, g);
    drawLyso(lyso, ctx, RL, 77);

    function pt(r, a) { return f(Math.cos(a) * r) + ',' + f(Math.sin(a) * r); }
    // a cup of double membrane: outer arc, rounded rim, inner arc back, rounded rim
    function cup(span) {
      var c = 200 * D, h = span / 2 * D, a0 = c - h, a1 = c + h, rr = (R1 - R2) / 2, big = span > 180 ? 1 : 0;
      return 'M' + pt(R1, a0) + 'A' + R1 + ',' + R1 + ' 0 ' + big + ',1 ' + pt(R1, a1) +
        'A' + rr + ',' + rr + ' 0 0,1 ' + pt(R2, a1) +
        'A' + R2 + ',' + R2 + ' 0 ' + big + ',0 ' + pt(R2, a0) +
        'A' + rr + ',' + rr + ' 0 0,1 ' + pt(R1, a0) + 'Z';
    }
    function ring() {
      return 'M' + (-R1) + ',0a' + R1 + ',' + R1 + ' 0 1,0 ' + 2 * R1 + ',0a' + R1 + ',' + R1 + ' 0 1,0 ' + (-2 * R1) + ',0Z' +
             'M' + (-R2) + ',0a' + R2 + ',' + R2 + ' 0 1,0 ' + 2 * R2 + ',0a' + R2 + ',' + R2 + ' 0 1,0 ' + (-2 * R2) + ',0Z';
    }
    function ease(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
    function seg(p, a, b) { return ease((p - a) / (b - a)); }
    function mix(a, b, u) { return a + (b - a) * u; }

    return function update(t) {
      var p = (t / period) % 1;
      var bud = seg(p, 0.12, 0.24), damage = seg(p, 0.22, 0.3), grow = seg(p, 0.3, 0.5),
          dock = seg(p, 0.52, 0.63), fuse = seg(p, 0.63, 0.72), digest = seg(p, 0.72, 0.88), reform = seg(p, 0.88, 1);
      var sealed = p >= 0.5, fused = p >= 0.63;

      // cargo: buds off the neighbouring mitochondrion, then loses membrane potential
      // cargo: the small daughter from the neighbouring fission, which then depolarises
      cargo.setAttribute('transform', 'translate(' + f(mix(BUD[0], 0, bud)) + ' ' + f(mix(BUD[1], 0, bud)) + ') rotate(' + f(mix(src.rot, -25, bud)) + ') scale(' + f(1 - 0.85 * digest) + ')');
      cargo.setAttribute('opacity', p < 0.12 ? '0' : f(1 - digest));
      cBody.setAttribute('fill-opacity', f(mix(1, 0.35, damage)));
      cBody.setAttribute('stroke-opacity', f(mix(1, 0.6, damage)));
      cBody.setAttribute('stroke-dasharray', damage > 0.5 ? '5 2.5' : 'none');
      cCr.setAttribute('stroke-opacity', f(mix(0.85, 0.35, damage)));

      // phagophore cup -> sealed double-membrane autophagosome
      phago.setAttribute('d', p < 0.3 || fused ? '' : (sealed ? ring() : cup(30 + 330 * grow)));

      // lysosome: always present; docks, fuses, and is re-formed from the autolysosome
      var dx = R1 + RL - 3, dockPt = [Math.cos(-40 * D) * dx, Math.sin(-40 * D) * dx];
      lyso.setAttribute('transform', 'translate(' + f(mix(HOME[0], dockPt[0], dock) * (1 - fuse)) + ' ' + f(mix(HOME[1], dockPt[1], dock) * (1 - fuse)) + ') scale(' + f(1 - fuse) + ')');
      lyso.setAttribute('opacity', p < 0.88 ? f(1 - fuse) : '0');

      // autolysosome: a single limiting membrane around the inner vesicle
      var ar = mix(R1, RL, reform);
      auto.setAttribute('r', f(ar));
      auto.setAttribute('cx', f(mix(0, HOME[0], reform))); auto.setAttribute('cy', f(mix(0, HOME[1], reform)));
      auto.setAttribute('opacity', fused ? f(Math.min(1, fuse * 1.5) * (p >= 0.88 ? 1 - reform : 1)) : '0');
      innerVes.setAttribute('opacity', fused ? f(1 - digest) : '0');
      // at the very end the re-formed lysosome takes over again
      if (p >= 0.88) lyso.setAttribute('transform', 'translate(' + HOME[0] + ' ' + HOME[1] + ')'), lyso.setAttribute('opacity', f(reform));
    };
  }

  // Receptor pointing toward local -y.
  function drawReceptor(g, x, y, rot, s) {
    var rc = el('g', { transform: 'translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(rot) + ') scale(' + (s || 1) + ')',
      stroke: '#e3d9ff', 'stroke-width': 2.4, 'stroke-linecap': 'round', fill: 'none' }, g);
    el('path', { d: 'M0,10 V-9 M0,-9 L-7,-19 M0,-9 L7,-19' }, rc);
    el('circle', { cx: -7, cy: -19, r: 2.6, fill: C.mem, stroke: 'none' }, rc);
    el('circle', { cx: 7, cy: -19, r: 2.6, fill: C.mem, stroke: 'none' }, rc);
    return rc;
  }

  function group(parent, o, transform) {
    var a = el('a', { href: o.href, 'data-org': o.id, class: 'org', 'aria-label': o.name + ' — ' + o.page, style: 'color:' + o.color }, parent);
    return transform ? el('g', { transform: transform }, a) : a;
  }
  function inner(a, transform, cls) {
    var w = el('g', { class: cls || '' }, a);
    return el('g', { transform: transform }, w);
  }

  /* ---------- the whole cell (home page) ---------- */
  function build(svg) {
    var ctx = { px: 'c' };
    makeDefs(svg, ctx.px);
    var memHarm = harmonics(7, 0.03);
    function memPts(t) { return blobPts(500, 500, 440, 420, memHarm, t, 72); }
    var pts0 = memPts(0), d0 = smoothPath(pts0, true);

    var cyto = el('path', { d: d0, fill: 'url(#c-cyto)' }, svg);
    var memGlow = el('path', { d: d0, fill: 'none', stroke: C.mem, 'stroke-width': 18, 'stroke-opacity': 0.22, filter: 'url(#c-blur)' }, svg);

    // cytosol speckle (free ribosomes)
    var r = rng(91), speck = el('g', { fill: '#a9b8dc', class: 'deco' }, svg);
    for (var i = 0; i < 280; i++) {
      var a = r() * Math.PI * 2, dd = Math.sqrt(r()) * 0.9;
      el('circle', { cx: f(500 + Math.cos(a) * dd * 440), cy: f(500 + Math.sin(a) * dd * 420), r: f(0.9 + r() * 1.1), 'fill-opacity': f(0.1 + r() * 0.25) }, speck);
    }

    // microtubules from the centrosome
    var mtLayer = el('g', { fill: 'none', stroke: C.centro, 'stroke-width': 1.4, 'stroke-opacity': 0.16, class: 'deco' }, svg);
    var mts = [];
    for (var m = 0; m < 30; m++) {
      var p = pts0[Math.floor(m * pts0.length / 30 + r() * 2) % pts0.length];
      var ex = 500 + (p[0] - 500) * 0.96, ey = 500 + (p[1] - 500) * 0.96;
      var mx = (640 + ex) / 2, my = (330 + ey) / 2, nx = -(ey - 330), ny = ex - 640, nl = Math.hypot(nx, ny);
      var off = (r() - 0.5) * 90;
      mts.push(el('path', { d: 'M640,330Q' + f(mx + nx / nl * off) + ',' + f(my + ny / nl * off) + ' ' + f(ex) + ',' + f(ey) }, mtLayer));
    }

    drawER(group(svg, byId.er, 'translate(440 470)'), ctx);
    drawNucleus(group(svg, byId.nucleus, 'translate(440 470)'), ctx);
    drawGolgi(group(svg, byId.golgi, 'translate(640 330)'), ctx);
    drawCentrosome(group(svg, byId.centro, 'translate(640 330)'), ctx);

    var mitoA = group(svg, byId.mito), mitos = [];
    [[250, 250, -35, 205, 29], [185, 580, 78, 165, 26], [760, 690, 55, 150, 27], [865, 500, 95, 78, 22]]
      .forEach(function (mm, k) {
        var up = liveMito(inner(mitoA, 'translate(' + mm[0] + ' ' + mm[1] + ') rotate(' + mm[2] + ')', 'drift d' + k), ctx, mm[3], mm[4], 100 + k, k * 0.21);
        up(0); mitos.push(up);
      });
    var lysoA = group(svg, byId.lyso);
    [[125, 420, 26], [660, 800, 22], [420, 170, 20]].forEach(function (l, k) {
      drawLyso(inner(lysoA, 'translate(' + l[0] + ' ' + l[1] + ')', 'drift d' + (k + 2)), ctx, l[2], 70 + k);
    });
    // the lysosome that receives STING from the Golgi (kept still so the carrier lands on it)
    drawLyso(inner(lysoA, 'translate(' + STING_LYSO[0] + ' ' + STING_LYSO[1] + ')', ''), ctx, 18, 74);
    // mitochondrial turnover: asymmetric fission hands a daughter to mitophagy
    var TURN = { x: 520, y: 852, rot: -8, L0: 55, w: 15, rd: 20, ox: 585, oy: 772 };
    var turnUp = turnoverMito(el('g', { transform: 'translate(' + TURN.x + ' ' + TURN.y + ') rotate(' + TURN.rot + ')' }, mitoA), ctx, TURN.L0, TURN.w, TURN.rd, 102);
    mitos.push(turnUp);
    var mph = mitophagy(el('g', { transform: 'translate(' + TURN.ox + ' ' + TURN.oy + ')', class: 'deco' }, svg), ctx, TURN);
    var still = reduceMotion ? 9.4 : 0;
    turnUp(still); mph(still);
    var sting = stingTraffic(el('g', { class: 'deco' }, svg));
    sting(reduceMotion ? 10 : 0);

    var vesLayer = el('g', { class: 'deco' }, svg);

    // membrane = contact
    var memA = group(svg, byId.membrane);
    var memLine = el('path', { d: d0, fill: 'none', stroke: C.mem, 'stroke-width': 4, 'stroke-opacity': 0.95 }, memA);
    var memInner = el('path', { d: d0, fill: 'none', stroke: C.mem, 'stroke-width': 1.4, 'stroke-opacity': 0.45,
      transform: 'translate(500 500) scale(0.982) translate(-500 -500)' }, memA);
    var memHit = el('path', { d: d0, class: 'hit hit-stroke' }, memA);
    // receptors all around the membrane, with a denser patch by the Contact label
    var RSLOT = 54;                                   // top of the cell: the receptor that turns over
    var recIdx = [], recScale = [], receptors = [], rr0 = rng(55);
    for (var ri = 0; ri < 9; ri++) { recIdx.push(Math.round((118 + ri * 3.6) / 360 * 72) % 72); recScale.push(1.15); }
    for (var rj = 0; rj < 72; rj += 3) {
      var deg = rj / 72 * 360;
      if (deg > 108 && deg < 156) continue;
      if (rr0() < 0.25 || rj === RSLOT) continue;       // irregular spacing; RSLOT is the cycling one
      recIdx.push(rj); recScale.push(0.75 + rr0() * 0.35);
    }
    recIdx.forEach(function (idx, k) { receptors.push(drawReceptor(memA, 0, 0, 0, recScale[k])); });
    function placeReceptors(pts) {
      recIdx.forEach(function (idx, k) {
        var p = pts[idx], th = Math.atan2(p[1] - 500, p[0] - 500) / D;
        receptors[k].setAttribute('transform', 'translate(' + f(p[0]) + ' ' + f(p[1]) + ') rotate(' + f(th + 90) + ') scale(' + recScale[k] + ')');
      });
    }
    placeReceptors(pts0);

    // Receptor turnover. One receptor is taken up by clathrin-mediated endocytosis
    // (its ligand-binding end faces the pit, then the vesicle lumen: topologically
    // outside), uncoats, and is delivered to a lysosome and degraded. A replacement
    // is made at the ER (binding end in the ER lumen), goes ER -> Golgi -> plasma
    // membrane, and when its vesicle fuses the lumen opens outward, so the binding
    // end faces out again in the same spot.
    var RLYSO = [420, 170], RPERIOD = 22;
    var rg = el('g', { class: 'deco' }, svg);
    var pitMask = el('path', { fill: 'none', stroke: '#221b3d', 'stroke-width': 5.5, 'stroke-linecap': 'butt' }, rg);
    var pit = el('path', { fill: 'none', stroke: C.mem, 'stroke-width': 3, 'stroke-linecap': 'round' }, rg);
    var coat = el('path', { fill: 'none', stroke: '#dfe6f5', 'stroke-width': 2.2, 'stroke-dasharray': '2 2.6', 'stroke-linecap': 'round' }, rg);
    var eVes = el('circle', { r: 11, fill: 'rgba(180,156,255,.08)', stroke: C.mem, 'stroke-width': 1.6, opacity: 0 }, rg);
    var eCoat = el('circle', { r: 13.5, fill: 'none', stroke: '#dfe6f5', 'stroke-width': 2, 'stroke-dasharray': '2 2.6', opacity: 0 }, rg);
    var sVes = el('circle', { r: 11, fill: 'rgba(255,255,255,.05)', stroke: '#f3eadf', 'stroke-width': 1.5, opacity: 0 }, rg);
    var rFlash = el('circle', { cx: RLYSO[0], cy: RLYSO[1], r: 20, fill: 'none', stroke: C.lyso, 'stroke-width': 2, opacity: 0 }, rg);
    var oldRec = drawReceptor(rg, 0, 0, 0, 1), newRec = drawReceptor(rg, 0, 0, 0, 1);
    // Bent form for thin lumens (ER, Golgi): local x runs along the membrane, +y is
    // the cytosol. The TM stem crosses the membrane band, then the Y lies in the lumen.
    var bent = el('g', { stroke: '#e3d9ff', 'stroke-width': 1.25, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none', opacity: 0 }, rg);
    el('path', { d: 'M0,4.6 L0,-3.3 L5.5,-3.3 M5.5,-3.3 L9.6,-1.7 M5.5,-3.3 L9.6,-4.9' }, bent);
    el('circle', { cx: 9.6, cy: -1.7, r: 1, fill: C.mem, stroke: 'none' }, bent);
    el('circle', { cx: 9.6, cy: -4.9, r: 1, fill: C.mem, stroke: 'none' }, bent);
    function setBent(M, t, n, op) {
      bent.setAttribute('transform', 'matrix(' + [t[0], t[1], n[0], n[1], M[0], M[1]].map(function (v) { return v.toFixed(3); }).join(' ') + ')');
      bent.setAttribute('opacity', f(op));
    }
    // an ER sheet point a little way along sheet 0, with its tangent and outward normal
    var sh0 = erSheets()[0], ek = 0, eb = 9;
    sh0.forEach(function (q, i) { var a = Math.atan2(q[1], q[0]); if (Math.abs(a + 2 * D) < eb) { eb = Math.abs(a + 2 * D); ek = i; } });
    ek = Math.max(2, Math.min(sh0.length - 3, ek));
    var eq = sh0[ek], eq0 = sh0[ek - 1], eq1 = sh0[ek + 1];
    var etx = eq1[0] - eq0[0], ety = eq1[1] - eq0[1], etl = Math.hypot(etx, ety); etx /= etl; ety /= etl;
    var enx = ety, eny = -etx;
    if (enx * eq[0] + eny * eq[1] < 0) { enx = -enx; eny = -eny; }
    // ER sheets are drawn 9 wide with a ~4 wide lumen: put the TM stem in the outer
    // membrane band and lay the Y along the lumen, tipped slightly inward
    var ER_M = [440 + eq[0] + enx * 3.3, 470 + eq[1] + eny * 3.3];
    var ER_M_BAND = [440 + eq[0] + enx * 3.3, 470 + eq[1] + eny * 3.3];  // middle of the outer membrane band
    var ER_EXIT = [ER_M[0] + enx * 10, ER_M[1] + eny * 10];
    var GA = -84 * D, GC = [640, 330];
    var R_CIS = [GC[0] + Math.cos(GA) * 72, GC[1] + Math.sin(GA) * 72], R_TRANS = [GC[0] + Math.cos(GA) * 162, GC[1] + Math.sin(GA) * 162];
    function setRec(r, x, y, dir, sc, op) {
      r.setAttribute('transform', 'translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(dir / D + 90) + ') scale(' + f(sc) + ')');
      r.setAttribute('opacity', f(op));
    }
    // Place a receptor whose transmembrane stem crosses the membrane at M, with the
    // Y (ligand-binding domain) pointing along `dir` into the lumen / extracellular side.
    function anchor(r, M, dir, sc, op) {
      setRec(r, M[0] + Math.cos(dir) * 3 * sc, M[1] + Math.sin(dir) * 3 * sc, dir, sc, op);
    }
    var VR = 11, SM = 0.58;                       // vesicle radius; receptor scale inside organelles
    var GOLGI_RS = [84, 99, 114, 129, 144];
    function ez(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
    function sg(p, a, b) { return ez((p - a) / (b - a)); }
    function lp(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; }
    function qd(a, c, b, u) { return lp(lp(a, c, u), lp(c, b, u), u); }
    function recCycle(t, pts) {
      var p = (t / RPERIOD) % 1, P = pts[RSLOT], q0 = pts[RSLOT - 1], q1 = pts[RSLOT + 1];
      var tx = q1[0] - q0[0], ty = q1[1] - q0[1], tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
      var nx = P[0] - 500, ny = P[1] - 500, nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;     // outward normal
      var OUT = Math.atan2(ny, nx), IN = OUT + Math.PI;
      var uncoat = sg(p, 0.26, 0.31), travel = sg(p, 0.31, 0.44),
          fuse = sg(p, 0.44, 0.5), degr = sg(p, 0.5, 0.6);

      // clathrin-mediated endocytosis: a shallow coated pit deepens into a round bud on a
      // neck; the neck lengthens into a stalk, is constricted, and the vesicle pinches off
      var DV = 34, R = VR, d = 0, w = 0, br = 0, budding = p >= 0.1 && p < 0.25, retract = p >= 0.25 && p < 0.29;
      var s1 = sg(p, 0.1, 0.15), s2 = sg(p, 0.15, 0.21), s3 = sg(p, 0.21, 0.25);
      if (p < 0.15) { br = 3 + (R - 3) * s1; w = br; d = br * 0.35; }             // shallow pit
      else if (p < 0.21) { br = R; w = R - (R - 3.2) * s2; d = R * 0.35 + (DV - R * 0.35) * s2; }  // invagination, neck forms
      else { br = R; w = 3.2 * (1 - s3) + 0.3 * s3; d = DV; }                    // the stalk is constricted
      var C2 = [P[0] - nx * d, P[1] - ny * d];
      function pt2(o, a, b) { return f(o[0] + tx * a - nx * b) + ',' + f(o[1] + ty * a - ny * b); }   // a along membrane, b inward
      if (budding) {
        var fl = 4.5, h = Math.sqrt(Math.max(0, br * br - w * w));            // bud/neck junction above the bud centre
        var jl = [-w, d - h], jr = [w, d - h], big = 1;
        var dd = 'M' + pt2(P, -w - fl, 0) + 'Q' + pt2(P, -w, 0) + ' ' + pt2(P, -w, 2.5) +
          'L' + pt2(P, jl[0], Math.max(2.5, jl[1])) +
          'A' + f(br) + ',' + f(br) + ' 0 ' + big + ',0 ' + pt2(P, jr[0], Math.max(2.5, jr[1])) +
          'L' + pt2(P, w, 2.5) + 'Q' + pt2(P, w, 0) + ' ' + pt2(P, w + fl, 0);
        pit.setAttribute('d', dd);
        // clathrin coat on the cytosolic face of the bud
        var cr2 = br + 2.6, ca = Math.asin(Math.min(1, w / br));
        var c0 = [-Math.sin(ca) * cr2, d - Math.cos(ca) * cr2], c1 = [Math.sin(ca) * cr2, d - Math.cos(ca) * cr2];
        coat.setAttribute('d', 'M' + pt2(P, c0[0], c0[1]) + 'A' + f(cr2) + ',' + f(cr2) + ' 0 1,0 ' + pt2(P, c1[0], c1[1]));
        coat.removeAttribute('transform');
        pitMask.setAttribute('d', 'M' + pt2(P, -w - fl, 0) + 'L' + pt2(P, w + fl, 0));
        pit.setAttribute('opacity', '1'); coat.setAttribute('opacity', f(Math.min(1, s1 * 3))); pitMask.setAttribute('opacity', '1');
      } else if (retract) {
        // after scission the stalk remnant is drawn back into the plasma membrane
        var rl = 12 * (1 - sg(p, 0.25, 0.29));
        pit.setAttribute('d', 'M' + pt2(P, -6, 0) + 'Q' + pt2(P, -0.3, 0) + ' ' + pt2(P, -0.3, 2) + 'L' + pt2(P, -0.3, rl) + 'M' + pt2(P, 6, 0) + 'Q' + pt2(P, 0.3, 0) + ' ' + pt2(P, 0.3, 2) + 'L' + pt2(P, 0.3, rl));
        pitMask.setAttribute('d', 'M' + pt2(P, -6, 0) + 'L' + pt2(P, 6, 0));
        pit.setAttribute('opacity', f(rl > 0.5 ? 1 : 0)); pitMask.setAttribute('opacity', f(rl > 0.5 ? 1 : 0)); coat.setAttribute('opacity', '0');
      } else { pit.setAttribute('opacity', '0'); coat.setAttribute('opacity', '0'); pitMask.setAttribute('opacity', '0'); }

      // the old receptor: pit -> coated vesicle -> lysosome -> degraded
      var V0 = [P[0] - nx * 34, P[1] - ny * 34];
      var dv = [V0[0] - RLYSO[0], V0[1] - RLYSO[1]], dl = Math.hypot(dv[0], dv[1]); dv = [dv[0] / dl, dv[1] / dl];
      var DOCK = [RLYSO[0] + dv[0] * 28, RLYSO[1] + dv[1] * 28];
      var V = p < 0.31 ? V0 : (p < 0.44 ? qd(V0, [V0[0] - 30, V0[1] + 30], DOCK, travel) : lp(DOCK, RLYSO, fuse));
      var u = [Math.cos(OUT), Math.sin(OUT)];
      if (p < 0.1) setRec(oldRec, P[0], P[1], OUT, 1, 1);
      else if (p < 0.25) {
        // in the bud membrane at the bottom of the pit, Y in the bud lumen (extracellular)
        anchor(oldRec, [C2[0] - nx * br, C2[1] - ny * br], OUT, 1 - (1 - SM) * sg(p, 0.1, 0.17), 1);
      } else if (p < 0.44) {
        // in the vesicle membrane, Y in the lumen
        anchor(oldRec, [V[0] - u[0] * VR, V[1] - u[1] * VR], OUT, SM, 1);
      } else if (p < 0.6) {
        // in the lysosome's limiting membrane, then internalised and degraded
        var RL2 = VR + (20 - VR) * fuse, k = 1 - 0.75 * degr;
        anchor(oldRec, [V[0] - u[0] * RL2 * k, V[1] - u[1] * RL2 * k], OUT, SM * (1 - 0.5 * degr), 1 - degr);
      } else setRec(oldRec, RLYSO[0], RLYSO[1], IN, 0.3, 0);
      eVes.setAttribute('cx', f(V[0])); eVes.setAttribute('cy', f(V[1]));
      eVes.setAttribute('r', f(p >= 0.44 ? VR * (1 - fuse) : VR));
      eVes.setAttribute('opacity', p >= 0.25 && p < 0.5 ? f(p < 0.44 ? 1 : 1 - fuse) : '0');
      eCoat.setAttribute('cx', f(V[0])); eCoat.setAttribute('cy', f(V[1]));
      eCoat.setAttribute('opacity', p >= 0.25 && p < 0.31 ? f(1 - uncoat) : '0');
      rFlash.setAttribute('opacity', p >= 0.44 && p < 0.58 ? f(Math.sin(Math.PI * sg(p, 0.44, 0.58)) * 0.8) : '0');
      rFlash.setAttribute('r', f(20 + 8 * sg(p, 0.44, 0.58)));

      // the replacement: ER -> COPII -> Golgi cis->trans -> secretory vesicle -> plasma membrane.
      // Its Y stays in the lumen throughout; in the thin ER and Golgi lumens it lies angled along them.
      var ERIN = Math.atan2(-eny, -enx), PD = [P[0] - nx * (VR + 4), P[1] - ny * (VR + 4)], S = null;
      var inThin = false;
      if (p >= 0.4 && p < 0.5) { inThin = true; setBent(ER_M_BAND, [etx, ety], [enx, eny], sg(p, 0.4, 0.46)); setRec(newRec, ER_M[0], ER_M[1], 0, SM, 0); }
      else if (p >= 0.5 && p < 0.6) {
        S = qd(ER_EXIT, [ER_EXIT[0] + 30, ER_EXIT[1] - 60], R_CIS, sg(p, 0.5, 0.6));
        anchor(newRec, [S[0] - enx * VR, S[1] - eny * VR], Math.atan2(eny, enx), SM, 1);
      } else if (p >= 0.6 && p < 0.72) {
        var hop = sg(p, 0.6, 0.72) * (GOLGI_RS.length - 1), i0 = Math.min(GOLGI_RS.length - 2, Math.floor(hop)), fr = ez((hop - i0) * 1.3);
        // cisternae are drawn 10 wide with a ~4 wide lumen: stem in the inner membrane
        // band, Y along the lumen, tipped slightly outward
        // the cisternae are drawn with a slight wave (see drawGolgi): use their true radius here
        function cr(i) { return GOLGI_RS[i] + 2.5 * Math.sin(GA * 14 + i); }
        var rr2 = cr(i0) + (cr(i0 + 1) - cr(i0)) * fr - 3.4;
        inThin = true;
        setBent([GC[0] + Math.cos(GA) * rr2, GC[1] + Math.sin(GA) * rr2], [-Math.sin(GA), Math.cos(GA)], [-Math.cos(GA), -Math.sin(GA)], 1);
        setRec(newRec, GC[0], GC[1], 0, SM, 0);
      } else if (p >= 0.72 && p < 0.86) {
        S = qd(R_TRANS, [R_TRANS[0] - 70, R_TRANS[1] - 40], PD, sg(p, 0.72, 0.86));
        anchor(newRec, [S[0] - nx * VR, S[1] - ny * VR], OUT, SM, 1);
      } else if (p >= 0.86 && p < 0.92) {
        // fusion: the vesicle lumen opens to the outside and the receptor ends up facing out
        var fz = sg(p, 0.86, 0.92);
        S = lp(PD, P, fz);
        var Mz = lp([PD[0] - nx * VR, PD[1] - ny * VR], P, fz);
        anchor(newRec, Mz, OUT, SM + (1 - SM) * fz, 1);
      } else if (p >= 0.92) setRec(newRec, P[0], P[1], OUT, 1, 1);
      else setRec(newRec, ER_M[0], ER_M[1], ERIN, SM, 0);
      if (!inThin) bent.setAttribute('opacity', '0');
      if (S) { sVes.setAttribute('cx', f(S[0])); sVes.setAttribute('cy', f(S[1])); }
      sVes.setAttribute('r', f(p >= 0.86 && p < 0.92 ? VR * (1 - sg(p, 0.86, 0.92)) : VR));
      sVes.setAttribute('opacity', (p >= 0.5 && p < 0.6) || (p >= 0.72 && p < 0.92) ? '1' : '0');
      if (p >= 0.92 || p < 0.1) oldRec.setAttribute('opacity', p < 0.1 ? '1' : '0');
      if (p < 0.4) newRec.setAttribute('opacity', '0');
    }
    recCycle(reduceMotion ? 0 : 0, pts0);

    // labels
    var labLayer = el('g', { class: 'labels' }, svg);
    var labels = ORGANELLES.map(function (o) {
      var a = el('a', { href: o.href, 'data-org': o.id, class: 'lab', tabindex: '-1', 'aria-hidden': 'true', style: 'color:' + o.color }, labLayer);
      var g = el('g', { transform: 'translate(' + o.label[0] + ' ' + o.label[1] + ')' }, a);
      var pill = el('rect', { class: 'lab-pill', rx: 16 }, g);
      var t1 = el('text', { class: 'lab-org', y: -9, 'text-anchor': 'middle' }, g); t1.textContent = o.name.toUpperCase();
      var t2 = el('text', { class: 'lab-page', y: 19, 'text-anchor': 'middle' }, g); t2.textContent = o.page;
      return { pill: pill, texts: [t1, t2] };
    });
    function sizePills() {
      labels.forEach(function (l) {
        var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        l.texts.forEach(function (t) {
          var b = t.getBBox(); if (!b.width) return;
          x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
        });
        if (x0 === Infinity) return;
        l.pill.setAttribute('x', f(x0 - 16)); l.pill.setAttribute('y', f(y0 - 9));
        l.pill.setAttribute('width', f(x1 - x0 + 32)); l.pill.setAttribute('height', f(y1 - y0 + 18));
      });
    }
    sizePills();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizePills);
    window.matchMedia('(max-width: 720px)').addEventListener('change', function () { requestAnimationFrame(sizePills); });

    /* --- motion --- */
    var ves = [];
    for (var vi = 0; vi < 8; vi++) {
      var path = mts[(vi * 7 + 3) % mts.length];
      ves.push({ path: path, len: path.getTotalLength(), t: r(), v: 0.035 + r() * 0.04,
        dot: el('circle', { r: f(3.5 + r() * 2), fill: C.golgi, 'fill-opacity': 0.85 }, vesLayer) });
    }
    function placeVes() {
      ves.forEach(function (v) {
        var pt = v.path.getPointAtLength(v.len * (0.35 + v.t * 0.6));
        v.dot.setAttribute('cx', f(pt.x)); v.dot.setAttribute('cy', f(pt.y));
        v.dot.setAttribute('fill-opacity', f(0.85 * Math.sin(Math.PI * v.t)));
      });
    }
    placeVes();
    if (!reduceMotion) {
      var last = performance.now(), acc = 0;
      (function frame(now) {
        var dt = Math.min(0.05, (now - last) / 1000); last = now; acc += dt;
        if (!svg.classList.contains('zooming') && acc > 1 / 40) {
          var pts = memPts(now / 1000 * 0.5), d = smoothPath(pts, true);
          cyto.setAttribute('d', d); memGlow.setAttribute('d', d); memLine.setAttribute('d', d);
          memInner.setAttribute('d', d); memHit.setAttribute('d', d);
          placeReceptors(pts);
          recCycle(now / 1000, pts);
          mitos.forEach(function (up) { up(now / 1000); });
          mph(now / 1000);
          sting(now / 1000);
          ves.forEach(function (v) { v.t = (v.t + v.v * acc) % 1; });
          placeVes();
          acc = 0;
        }
        requestAnimationFrame(frame);
      })(last);
    }

    /* --- interaction --- */
    var card = { name: document.getElementById('sc-name'), fn: document.getElementById('sc-fn'), dot: document.querySelector('.sc-dot') };
    var cardDefault = card.fn ? card.fn.textContent : '';
    var allOrg = document.querySelectorAll('[data-org]');
    function setActive(id) {
      svg.classList.toggle('has-active', !!id);
      document.body.classList.toggle('has-active', !!id);
      allOrg.forEach(function (n) { n.classList.toggle('is-active', n.getAttribute('data-org') === id); });
      if (!card.name) return;
      var o = byId[id];
      card.name.textContent = o ? o.n + ' · ' + o.name + ' → ' + o.page : 'Field of view';
      card.fn.textContent = o ? o.fn : cardDefault;
      if (card.dot) card.dot.style.background = o ? o.color : '';
    }
    // Leaving waits a moment, so moving organelles and edges don't make the highlight flicker.
    var leaveTimer = null;
    function enterOrg(id) { clearTimeout(leaveTimer); setActive(id); }
    function leaveOrg() { clearTimeout(leaveTimer); leaveTimer = setTimeout(function () { setActive(null); }, 120); }
    allOrg.forEach(function (n) {
      var id = n.getAttribute('data-org');
      n.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') enterOrg(id); });
      n.addEventListener('pointerleave', leaveOrg);
      n.addEventListener('focus', function () { enterOrg(id); });
      n.addEventListener('blur', leaveOrg);
      n.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        zoomTo(byId[id]);
      });
    });

    var coord = document.getElementById('hud-coord');
    if (coord) svg.addEventListener('pointermove', function (e) {
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      var p = pt.matrixTransform(svg.getScreenCTM().inverse());
      coord.textContent = 'x ' + (p.x / UNITS_PER_UM).toFixed(1) + ' µm · y ' + (p.y / UNITS_PER_UM).toFixed(1) + ' µm';
    });
    var bar = document.querySelector('.scalebar i');
    // ~15 drawing units per µm: the cell (~880 units across) is ~59 µm in diameter
    function sizeBar() { if (bar) bar.style.width = (svg.getBoundingClientRect().width * 10 * UNITS_PER_UM / 1000) + 'px'; }
    sizeBar(); window.addEventListener('resize', sizeBar);

    function zoomTo(o) {
      setActive(o.id);
      if (reduceMotion) { location.href = o.href; return; }
      var to = [o.zoom[0] - o.zoom[2] / 2, o.zoom[1] - o.zoom[2] / 2, o.zoom[2], o.zoom[2]];
      var t0 = performance.now(), dur = 800;
      svg.classList.add('zooming'); document.body.classList.add('zooming');
      document.documentElement.style.setProperty('--veil', o.color);
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        svg.setAttribute('viewBox', [0, 0, 1000, 1000].map(function (v, i) { return f(v + (to[i] - v) * e); }).join(' '));
        if (k < 1) requestAnimationFrame(step); else location.href = o.href;
      })(t0);
    }
    window.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      svg.setAttribute('viewBox', '0 0 1000 1000');
      svg.classList.remove('zooming'); document.body.classList.remove('zooming');
      setActive(null);
    });
  }

  /* ---------- single-organelle hero art (inner pages) ---------- */
  var uid = 0;
  function art(svg, type) {
    var ctx = { px: 'a' + (++uid) };
    makeDefs(svg, ctx.px);
    var g = el('g', { class: 'art-body' }, svg);
    var r = rng(7);
    switch (type) {
      case 'nucleus':
        svg.setAttribute('viewBox', '-230 -200 460 400');
        drawER(el('g', { opacity: 0.35 }, g), ctx);
        drawNucleus(g, ctx);
        break;
      case 'mito':
        svg.setAttribute('viewBox', '-160 -80 320 160');
        drawMito(el('g', { transform: 'rotate(-8)' }, g), ctx, 280, 52, 3);
        break;
      case 'er':
        svg.setAttribute('viewBox', '-150 -110 450 380');
        drawNucleus(el('g', { opacity: 0.3 }, g), ctx);
        drawER(g, ctx);
        break;
      case 'golgi':
        svg.setAttribute('viewBox', '-60 -205 260 230');
        drawCentrosome(el('g', { opacity: 0.5 }, g), ctx);
        drawGolgi(g, ctx);
        break;
      case 'centro':
        svg.setAttribute('viewBox', '-150 -100 300 200');
        var mt = el('g', { stroke: C.centro, 'stroke-opacity': 0.35, 'stroke-width': 1.5, fill: 'none' }, g);
        for (var i = 0; i < 24; i++) {
          var a = i / 24 * Math.PI * 2 + r() * 0.2, L = 110 + r() * 60, bend = (r() - 0.5) * 40;
          el('path', { d: 'M0,0Q' + f(Math.cos(a) * L / 2 - Math.sin(a) * bend) + ',' + f(Math.sin(a) * L / 2 + Math.cos(a) * bend) + ' ' + f(Math.cos(a) * L) + ',' + f(Math.sin(a) * L) }, mt);
        }
        drawCentrosome(el('g', { transform: 'scale(1.8)' }, g), ctx);
        break;
      case 'lyso':
        svg.setAttribute('viewBox', '-110 -70 220 140');
        drawLyso(g, ctx, 50, 4);
        drawLyso(el('g', { transform: 'translate(78 32)' }, g), ctx, 18, 9);
        drawLyso(el('g', { transform: 'translate(-82 -30)' }, g), ctx, 14, 12);
        break;
      case 'membrane':
        svg.setAttribute('viewBox', '0 0 440 170');
        function wave(y0) { var p = []; for (var x = -10; x <= 450; x += 20) p.push([x, y0 + 9 * Math.sin(x / 55)]); return p; }
        var top = wave(92), bot = wave(116);
        [top, bot].forEach(function (pp) {
          el('path', { d: smoothPath(pp, false), fill: 'none', stroke: C.mem, 'stroke-width': 3 }, g);
          for (var x = 0; x <= 440; x += 9) el('circle', { cx: x, cy: f(pp[0][1] + 9 * Math.sin(x / 55) - (pp === top ? 3 : -3)), r: 2.6, fill: C.mem, 'fill-opacity': 0.75 }, g);
        });
        [60, 150, 205, 300, 380].forEach(function (x, k) {
          drawReceptor(g, x, 104 + 9 * Math.sin(x / 55), 0, k === 2 ? 2.4 : 1.8);
        });
        break;
    }
  }

  window.Cell = { ORGANELLES: ORGANELLES, byId: byId, build: build, art: art };
})();
