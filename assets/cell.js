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
      fn: 'Stores the genome — the core of who I am and where I came from.',
      zoom: [440, 470, 400], label: [430, 545] },
    { id: 'mito', name: 'Mitochondria', page: 'Research', href: 'research.html', color: C.mito,
      fn: 'Mapping how cells sort, recycle, and destroy their own parts, and building small molecules that rewire that machinery against disease.',
      zoom: [250, 250, 240], label: [285, 340] },
    { id: 'er', name: 'Rough ER', page: 'Publications', href: 'publications.html', color: C.er,
      fn: 'Where new proteins are made. Here: everything that has come off my ribosomes.',
      zoom: [600, 600, 360], label: [612, 612] },
    { id: 'golgi', name: 'Golgi apparatus', page: 'News', href: 'news.html', color: C.golgi,
      fn: 'Packages cargo and ships it out (and, it turns out, sends STING to the lysosome). The latest updates.',
      zoom: [735, 215, 260], label: [742, 232] },
    { id: 'centro', name: 'Centrosome', page: 'CV', href: 'cv.html', color: C.centro,
      fn: 'Organizes the microtubule tracks the whole cell runs on — the timeline.',
      zoom: [640, 330, 160], label: [636, 398] },
    { id: 'lyso', name: 'Lysosomes', page: 'Beyond the Bench', href: 'life.html', color: C.lyso,
      fn: 'Digests and recycles — the cell’s kitchen. History, poetry, cooking, hiking, tea.',
      zoom: [420, 170, 200], label: [420, 236] },
    { id: 'membrane', name: 'Plasma membrane', page: 'Contact', href: 'contact.html', color: C.mem,
      fn: 'Where the cell receives signals from outside. Send one.',
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
      var rr = 112 + i * 16, mid = -55 * D, half = (40 - Math.abs(i - 2) * 4 + r() * 3) * D, pts = [];
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
      var rad = trans ? 190 + r() * 20 : 115 + r() * 62, vr = 3.5 + r() * 3.5;
      el('circle', { cx: f(Math.cos(ang) * rad), cy: f(Math.sin(ang) * rad), r: f(vr),
        fill: C.golgi, 'fill-opacity': 0.25, stroke: C.golgi, 'stroke-width': 1.8 }, g);
    }
    hit(g, { d: sector(96, 214, -112 * D, 2 * D, 1) });
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
  function drawAutophagosome(g, ctx) {
    el('path', { d: blob(0, 0, 36, 34, 61, 0.05), fill: 'url(#' + ctx.px + '-auto)', stroke: '#e9e2ff', 'stroke-width': 2, 'stroke-opacity': 0.75 }, g);
    el('path', { d: blob(0, 0, 29, 27, 61, 0.05), fill: 'none', stroke: '#e9e2ff', 'stroke-width': 1.3, 'stroke-opacity': 0.5 }, g);
    var m = el('g', { transform: 'rotate(-25)', opacity: 0.85 }, g);
    el('path', { d: capsule(19, 9), fill: C.mito, 'fill-opacity': 0.3, stroke: C.mito, 'stroke-width': 1.8 }, m);
    el('path', { d: 'M-6,-5 v6 M2,5 v-6 M10,-4 v5', stroke: C.mito, 'stroke-width': 2, 'stroke-linecap': 'round' }, m);
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

    var mitoA = group(svg, byId.mito);
    [[250, 250, -35, 150, 30], [185, 580, 78, 130, 26], [520, 852, -8, 140, 28], [760, 690, 55, 130, 27], [865, 500, 95, 105, 24]]
      .forEach(function (mm, k) {
        drawMito(inner(mitoA, 'translate(' + mm[0] + ' ' + mm[1] + ') rotate(' + mm[2] + ')', 'drift d' + k), ctx, mm[3], mm[4], 100 + k);
      });
    var lysoA = group(svg, byId.lyso);
    [[125, 420, 26], [660, 800, 22], [420, 170, 20]].forEach(function (l, k) {
      drawLyso(inner(lysoA, 'translate(' + l[0] + ' ' + l[1] + ')', 'drift d' + (k + 2)), ctx, l[2], 70 + k);
    });
    drawAutophagosome(el('g', { transform: 'translate(360 800)', class: 'deco' }, svg), ctx);

    var vesLayer = el('g', { class: 'deco' }, svg);

    // membrane = contact
    var memA = group(svg, byId.membrane);
    var memLine = el('path', { d: d0, fill: 'none', stroke: C.mem, 'stroke-width': 4, 'stroke-opacity': 0.95 }, memA);
    var memInner = el('path', { d: d0, fill: 'none', stroke: C.mem, 'stroke-width': 1.4, 'stroke-opacity': 0.45,
      transform: 'translate(500 500) scale(0.982) translate(-500 -500)' }, memA);
    var memHit = el('path', { d: d0, class: 'hit hit-stroke' }, memA);
    var recIdx = [], receptors = [];
    for (var ri = 0; ri < 9; ri++) recIdx.push(Math.round((118 + ri * 3.6) / 360 * 72) % 72);
    recIdx.forEach(function () { receptors.push(drawReceptor(memA, 0, 0, 0, 1.15)); });
    function placeReceptors(pts) {
      recIdx.forEach(function (idx, k) {
        var p = pts[idx], th = Math.atan2(p[1] - 500, p[0] - 500) / D;
        receptors[k].setAttribute('transform', 'translate(' + f(p[0]) + ' ' + f(p[1]) + ') rotate(' + f(th + 90) + ') scale(1.15)');
      });
    }
    placeReceptors(pts0);

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
    allOrg.forEach(function (n) {
      var id = n.getAttribute('data-org');
      n.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') setActive(id); });
      n.addEventListener('pointerleave', function () { setActive(null); });
      n.addEventListener('focus', function () { setActive(id); });
      n.addEventListener('blur', function () { setActive(null); });
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
      coord.textContent = 'x ' + (p.x / 40).toFixed(1) + ' µm · y ' + (p.y / 40).toFixed(1) + ' µm';
    });
    var bar = document.querySelector('.scalebar i');
    function sizeBar() { if (bar) bar.style.width = (svg.getBoundingClientRect().width * 200 / 1000) + 'px'; }
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
        svg.setAttribute('viewBox', '-70 -250 320 280');
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
