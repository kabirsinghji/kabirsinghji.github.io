/* Two small figures, drawn as SVG in the site's own colours (the classes are styled in style.css,
   so dark mode follows on its own).
   [data-fig="mapk"]   science.html: a toy MAPK/ERK cascade (Ras, Raf, MEK, ERK) with ERK's negative
                       feedback onto Raf. Two buttons: lock Raf on, as in many cancers, and add a MEK
                       inhibitor. The trace is ERK activity over time. A model, not data.
   [data-fig="dying"]  history-of-medicine.html: a timeline from Quinlan (1976) to Modern Death (2017),
                       the two court cases above the line and the three books below it.
   .flow               science.html: a density of cell-to-cell variation pushed through the MAPK/ERK
                       model (images from tools/erk_density.py); hovering a label picks out one case.
   Each figure lays itself out wide or tall to fit its column, and starts when it scrolls into view.
   With reduced motion, everything is drawn at once and nothing travels. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(name, attrs, parent, text) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function onView(node, fn) {
    if (!('IntersectionObserver' in window)) return fn();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { rootMargin: '0px 0px -15% 0px' });
    io.observe(node);
  }

  /* ---------------- the MAPK/ERK cascade ---------------- */
  // Toy model, fractions active:  Raf' = (3(u/(1+8E) + m)(1-Raf) - Raf)/0.4
  //   MEK' = (2 Raf (1-i)(1-MEK) - MEK)/0.4,   ERK' = (2.5 MEK (1-ERK) - ERK)/0.4
  // u is a growth-factor pulse (t = 1..4), m a Raf that is stuck on, i a MEK inhibitor, and the
  // u/(1+8E) term ERK's negative feedback onto Raf (a stuck Raf ignores it).
  function mapk(fig) {
    var stage = fig.querySelector('.fig-stage'), state = fig.querySelector('.fig-state');
    var bMut = fig.querySelector('[data-k="mut"]'), bInh = fig.querySelector('[data-k="inh"]');
    var T = 10, DT = 0.005, cache = {};
    function sim(m, i) {
      var key = m + '' + i; if (cache[key]) return cache[key];
      var R = 0, M = 0, E = 0, o = { u: [], R: [], M: [], E: [] };
      for (var k = 0; k <= T / DT; k++) {
        var t = k * DT, u = t > 1 && t < 4 ? 1 : 0;
        o.u.push(u); o.R.push(R); o.M.push(M); o.E.push(E);
        var dR = (3 * (u / (1 + 8 * E) + m) * (1 - R) - R) / 0.4,
            dM = (2 * R * (1 - i) * (1 - M) - M) / 0.4,
            dE = (2.5 * M * (1 - E) - E) / 0.4;
        R += dR * DT; M += dM * DT; E += dE * DT;
      }
      return (cache[key] = o);
    }
    var mut = 0, inh = 0, svg, L, refs = {}, t = 0, last = 0, raf = 0, dots = [], acc = [0, 0, 0, 0], hold = 0, visible = false;
    var NOTE = {
      '00': 'Normal: a brief growth signal gives a brief pulse of ERK, and ERK’s feedback onto Raf keeps it in check.',
      '10': 'Raf stuck on: ERK stays high with no growth signal at all, as it does in many cancers.',
      '11': 'Stuck Raf plus a MEK inhibitor: blocking the cascade below the mutation brings ERK back down.',
      '01': 'MEK inhibitor alone: the normal pulse is blunted as well.'
    };

    var WIDE = {
      W: 720, H: 236, inp: { x: 20, y: 64, w: 132, h: 110 }, out: { x: 572, y: 64, w: 132, h: 110 },
      nodes: [[226, 119], [314, 119], [402, 119], [490, 119]], nodeW: 70, axis: 'x',
      fwd: 'M156 119H564', back: 'M490 134C490 200 314 200 314 137', backLab: [402, 212]
    };
    var TALL = {
      W: 340, H: 490, inp: { x: 40, y: 44, w: 262, h: 86 }, out: { x: 40, y: 350, w: 262, h: 110 },
      nodes: [[58, 230], [134, 230], [210, 230], [286, 230]], nodeW: 64, axis: 'y',
      fwd: 'M58 136V230H286V342', back: 'M286 215C286 172 134 172 134 213', backLab: [210, 166]
    };
    var NAMES = ['Ras', 'Raf', 'MEK', 'ERK'];

    function y(v, box, max) { return box.y + box.h - 6 - v / max * (box.h - 16); }
    function x(tt, box) { return box.x + tt / T * box.w; }
    function trace(vals, box, max, upto) {
      var n = Math.max(2, Math.round(upto / DT)), s = '';
      for (var i = 0; i < n; i += 8) s += (i ? 'L' : 'M') + x(i * DT, box).toFixed(1) + ' ' + y(vals[i], box, max).toFixed(1);
      return s;
    }

    function build() {
      L = stage.clientWidth >= 520 ? WIDE : TALL;
      stage.innerHTML = '';
      svg = el('svg', { viewBox: '0 0 ' + L.W + ' ' + L.H, role: 'img', 'aria-labelledby': fig.id + '-t' }, stage);
      el('title', { id: fig.id + '-t' }, svg, 'A toy model of the MAPK/ERK cascade: a growth signal passes from Ras to Raf to MEK to ERK, and ERK feeds back to damp Raf. With Raf stuck on, ERK stays high without any signal; a MEK inhibitor brings it back down.');
      var defs = el('defs', {}, svg);
      var ah = el('marker', { id: 'ah-sky', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs);
      el('path', { d: 'M1 1L9 5L1 9', 'class': 'ah f-sky' }, ah);
      var tee = el('marker', { id: 'tee-gold', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 9, markerHeight: 9, orient: 'auto' }, defs);
      el('path', { d: 'M5 0V10', 'class': 'ah f-gold' }, tee);
      [['inp', 'growth signal'], ['out', 'ERK activity']].forEach(function (p) {
        var b = L[p[0]];
        el('line', { x1: b.x, y1: b.y + b.h, x2: b.x + b.w, y2: b.y + b.h, 'class': 'f-axis' }, svg);
        el('line', { x1: b.x, y1: b.y, x2: b.x, y2: b.y + b.h, 'class': 'f-axis' }, svg);
        el('text', { x: b.x, y: b.y - 12, 'class': 'f-lab' }, svg, p[1]);
        el('text', { x: b.x + b.w, y: b.y + b.h + 16, 'class': 'f-lab', 'text-anchor': 'end' }, svg, 'time');
      });
      refs.fwd = el('path', { d: L.fwd, 'class': 'f-sky f-wire', 'marker-end': 'url(#ah-sky)' }, svg);
      refs.back = el('path', { d: L.back, 'class': 'f-gold f-wire f-dash', 'marker-end': 'url(#tee-gold)' }, svg);
      el('text', { x: L.backLab[0], y: L.backLab[1], 'class': 'f-lab f-gold-t', 'text-anchor': 'middle' }, svg, 'negative feedback');
      refs.dotLayer = el('g', {}, svg);
      refs.nodes = NAMES.map(function (n, k) {
        var c = L.nodes[k], g = el('g', { 'class': 'f-n' }, svg);
        el('rect', { x: c[0] - L.nodeW / 2, y: c[1] - 15, width: L.nodeW, height: 30, rx: 15, 'class': 'f-node' }, g);
        el('text', { x: c[0], y: c[1] + 4, 'class': 'f-lab f-ink', 'text-anchor': 'middle' }, g, n);
        return g;
      });
      var mc = L.nodes[1], ic = L.nodes[2];
      refs.mutTag = el('text', { x: mc[0], y: mc[1] - 24, 'class': 'f-lab f-gold-t f-tag', 'text-anchor': 'middle' }, svg, 'stuck on');
      refs.inhTag = el('g', { 'class': 'f-tag' }, svg);
      el('line', { x1: ic[0] - L.nodeW / 2 - 2, y1: ic[1] + 17, x2: ic[0] + L.nodeW / 2 + 2, y2: ic[1] - 17, 'class': 'f-strike' }, refs.inhTag);
      el('text', { x: ic[0], y: ic[1] - 24, 'class': 'f-lab f-gold-t', 'text-anchor': 'middle' }, refs.inhTag, 'inhibitor');
      refs.inTrace = el('path', { d: '', 'class': 'f-soft f-line' }, svg);
      refs.ghost = el('path', { d: '', 'class': 'f-line f-ghost' }, svg);
      refs.resp = el('path', { d: '', 'class': 'f-sky f-line f-thick' }, svg);
      refs.head = el('circle', { r: 3.5, 'class': 'f-sky-fill' }, svg);
      // the stretches of the forward path between nodes, for spawning dots where each step is active
      refs.len = refs.fwd.getTotalLength(); refs.backLen = refs.back.getTotalLength();
      refs.seg = [0].concat(NAMES.map(function (_, k) { return nearest(refs.fwd, refs.len, L.nodes[k]); }));
      dots = [];
      paint();
    }
    function nearest(path, len, c) {
      var best = 0, bd = 1e9;
      for (var s = 0; s <= len; s += 2) { var p = path.getPointAtLength(s), d = Math.hypot(p.x - c[0], p.y - c[1]); if (d < bd) { bd = d; best = s; } }
      return best;
    }

    function paint() {
      var run = sim(mut, inh), base = sim(0, 0);
      refs.inTrace.setAttribute('d', trace(run.u, L.inp, 1.25, T));
      refs.ghost.setAttribute('d', mut || inh ? trace(base.E, L.out, 0.75, T) : '');
      refs.resp.setAttribute('d', trace(run.E, L.out, 0.75, Math.max(t, DT * 2)));
      var i = Math.min(run.E.length - 1, Math.round(t / DT));
      refs.head.setAttribute('cx', x(t, L.out)); refs.head.setAttribute('cy', y(run.E[i], L.out, 0.75));
      refs.mutTag.style.opacity = mut ? 1 : 0; refs.inhTag.style.opacity = inh ? 1 : 0;
      refs.nodes[1].classList.toggle('is-hot', !!mut);
      fig.classList.toggle('is-ghost', !!(mut || inh));
    }

    function frame(ts) {
      raf = 0;
      var now = ts / 1000, dt = Math.min(.05, last ? now - last : .016); last = now;
      if (hold > 0) { hold -= dt; if (hold <= 0) t = 0; }
      else { t += dt; if (t >= T) { t = T; hold = 2.4; } }
      var run = sim(mut, inh), i = Math.min(run.E.length - 1, Math.round(t / DT));
      if (hold <= 0) {
        // a dot enters each stretch at the rate the node behind it is active
        var rate = [run.u[i], run.R[i], run.M[i], run.E[i]];
        for (var k = 0; k < 4; k++) {
          acc[k] += rate[k] * 7 * dt;
          while (acc[k] >= 1) { acc[k] -= 1; dots.push({ p: refs.fwd, s: refs.seg[k], end: k < 3 ? refs.seg[k + 1] : refs.len, v: 150, c: 'f-sky-fill' }); }
        }
        if (!mut) { acc[4] = (acc[4] || 0) + run.E[i] * run.u[i] * 6 * dt; }
        else acc[4] = 0;
        while (acc[4] >= 1) { acc[4] -= 1; dots.push({ p: refs.back, s: 0, end: refs.backLen, v: 110, c: 'f-gold-fill' }); }
      }
      while (refs.dotLayer.firstChild) refs.dotLayer.removeChild(refs.dotLayer.firstChild);
      dots = dots.filter(function (d) {
        d.s += d.v * dt; if (d.s > d.end) return false;
        var pt = d.p.getPointAtLength(d.s);
        el('circle', { cx: pt.x.toFixed(1), cy: pt.y.toFixed(1), r: 3, 'class': d.c }, refs.dotLayer);
        return true;
      });
      paint();
      if (!document.hidden && visible) raf = requestAnimationFrame(frame);
    }
    function go() { if (!raf && !reduce) { last = 0; raf = requestAnimationFrame(frame); } }

    function set() {
      bMut.setAttribute('aria-pressed', mut ? 'true' : 'false');
      bInh.setAttribute('aria-pressed', inh ? 'true' : 'false');
      bMut.textContent = mut ? '[ Raf stuck on · repair it ]' : '[ Raf normal · mutate it ]';
      bInh.textContent = inh ? '[ MEK inhibitor on · remove it ]' : '[ no drug · add a MEK inhibitor ]';
      state.textContent = NOTE[(mut ? 1 : 0) + '' + (inh ? 1 : 0)];
      t = reduce ? T : 0; hold = 0; dots = []; acc = [0, 0, 0, 0, 0];
      paint();
    }
    bMut.addEventListener('click', function () { mut = mut ? 0 : 1; set(); });
    bInh.addEventListener('click', function () { inh = inh ? 0 : 0.9; set(); });

    build(); t = reduce ? T : 0; paint();
    var w = stage.clientWidth;
    addEventListener('resize', function () { if ((stage.clientWidth >= 520) !== (w >= 520)) { w = stage.clientWidth; build(); } });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) go(); }).observe(stage);
    else { visible = true; go(); }
    document.addEventListener('visibilitychange', function () { if (!document.hidden && visible) go(); });
  }

  /* ---------------- the timeline ---------------- */
  var EVENTS = [
    { y: 1976, side: 'law', t: 'In re Quinlan', s: 'NJ Supreme Court',
      n: 'New Jersey’s Supreme Court lets Karen Ann Quinlan’s father, as her guardian, ask for her ventilator to be withdrawn.' },
    { y: 1990, side: 'law', t: 'Cruzan', s: 'US Supreme Court', row: 1,
      n: 'The Supreme Court lets Missouri require clear and convincing evidence of what Nancy Cruzan would have wanted before her feeding tube is removed.' },
    { y: 1994, side: 'book', t: 'How We Die', s: 'Sherwin Nuland', row: 0, end: true,
      n: 'A surgeon on how people actually die, and on doctors who keep treating the disease past the point of the patient.' },
    { y: 2014, side: 'book', t: 'Being Mortal', s: 'Atul Gawande', row: 0, end: true,
      n: 'A surgeon on aging, nursing homes and hospice, and on asking patients what matters most to them.' },
    { y: 2017, side: 'book', t: 'Modern Death', s: 'Haider Warraich', row: 1, end: true,
      n: 'A cardiologist on how technology and law changed when, where and how Americans die.' }
  ];

  function dying(fig) {
    var stage = fig.querySelector('.fig-stage'), note = fig.querySelector('.fig-state');
    var Y0 = 1970, Y1 = 2020, svg, marks = [], axis, len = 0, wide, drawn = false;
    var idle = note.textContent;

    function build() {
      wide = stage.clientWidth >= 520;
      stage.innerHTML = ''; marks = [];
      var W = wide ? 640 : 340, H = wide ? 250 : 470;
      svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': 'Timeline, 1970 to 2020: two court cases and three books' }, stage);
      function pos(yr) { return wide ? 36 + (yr - Y0) / (Y1 - Y0) * 568 : 34 + (yr - Y0) / (Y1 - Y0) * 412; }
      var AX = wide ? 118 : 62;
      axis = el('line', wide ? { x1: pos(Y0), y1: AX, x2: pos(Y1), y2: AX, 'class': 'f-axis f-time' }
                             : { x1: AX, y1: pos(Y0), x2: AX, y2: pos(Y1), 'class': 'f-axis f-time' }, svg);
      len = (wide ? W : H) - 60;
      for (var d = Y0; d <= Y1; d += 10) {
        var p = pos(d);
        el('text', wide ? { x: p, y: AX + 18, 'class': 'f-lab f-tick', 'text-anchor': 'middle' }
                        : { x: AX - 10, y: p + 4, 'class': 'f-lab f-tick', 'text-anchor': 'end' }, svg, d);
      }
      if (wide) {
        el('text', { x: 36, y: 22, 'class': 'f-lab f-gold-t' }, svg, 'the courts');
        el('text', { x: 36, y: H - 8, 'class': 'f-lab f-sky-t' }, svg, 'the physicians');
      }
      EVENTS.forEach(function (e) {
        var law = e.side === 'law', p = pos(e.y), g = el('g', { 'class': 'f-mark ' + (law ? 'is-law' : 'is-book'), tabindex: 0, role: 'button', 'aria-label': e.y + ', ' + e.t + ', ' + e.s + '. ' + e.n }, svg);
        var tx, ty, anchor = 'start', lx1, ly1, lx2, ly2;
        if (wide) {
          var up = law ? 1 : -1, off = (law ? 44 : 40) + (e.row || 0) * 34;
          lx1 = p; ly1 = AX - up * 6; lx2 = p; ly2 = AX - up * off;
          tx = e.end ? p - 6 : p + 6; anchor = e.end ? 'end' : 'start';
          ty = law ? AX - off - 4 : AX + off + 12;
        } else {
          lx1 = AX + 6; ly1 = p; lx2 = AX + 22; ly2 = p; tx = AX + 28; ty = p - 2;
          if (e.y === 1990) ty -= 8; if (e.y === 1994) ty += 10;
          if (e.y === 2014) ty -= 8; if (e.y === 2017) ty += 10;
        }
        el('line', { x1: lx1, y1: ly1, x2: lx2, y2: wide ? ly2 : ly2, 'class': 'f-leader' }, g);
        el('circle', { cx: wide ? p : AX, cy: wide ? AX : p, r: 5.5, 'class': 'f-dot' }, g);
        el('text', { x: tx, y: ty, 'text-anchor': anchor, 'class': 'f-ttl' }, g, e.t);
        el('text', { x: tx, y: ty + 15, 'text-anchor': anchor, 'class': 'f-lab' }, g, e.y + ' · ' + e.s);
        // a wide, invisible target so the mark is easy to hover
        el('rect', { x: (wide ? p : AX) - 14, y: (wide ? Math.min(AX, ty) - 16 : p - 16), width: wide ? 28 : 260, height: wide ? Math.abs(ty - AX) + 34 : 32, 'class': 'f-hit' }, g);
        function show() { marks.forEach(function (m) { m.g.classList.toggle('is-on', m.g === g); }); note.textContent = e.n; }
        function hide() { g.classList.remove('is-on'); note.textContent = idle; }
        g.addEventListener('mouseenter', show); g.addEventListener('focus', show);
        g.addEventListener('mouseleave', hide); g.addEventListener('blur', hide);
        g.addEventListener('click', show);
        marks.push({ g: g, yr: e.y });
      });
      if (drawn || reduce) finish();
    }

    function finish() {
      drawn = true;
      axis.style.strokeDasharray = 'none';
      marks.forEach(function (m) { m.g.classList.add('is-in'); });
    }

    function play() {
      if (reduce) return finish();
      var t0 = performance.now(), dur = 1800;
      axis.style.strokeDasharray = len + ' ' + len; axis.style.strokeDashoffset = len;
      (function step(ts) {
        var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        axis.style.strokeDashoffset = (len * (1 - e)).toFixed(1);
        var yr = Y0 + e * (Y1 - Y0);
        marks.forEach(function (m) { if (m.yr <= yr + .5) m.g.classList.add('is-in'); });
        if (k < 1) requestAnimationFrame(step); else finish();
      })(t0);
    }

    build();
    var w = stage.clientWidth;
    addEventListener('resize', function () { if ((stage.clientWidth >= 520) !== (w >= 520)) { w = stage.clientWidth; build(); } });
    if (!reduce) { axis.style.strokeDasharray = len + ' ' + len; axis.style.strokeDashoffset = len; onView(stage, play); }
  }

  /* ---------------- the density pushed through the model (science.html) ---------------- */
  function flow(fig) {
    var tags = fig.querySelectorAll('.flow-tag'), layers = fig.querySelectorAll('.flow-c');
    function pick(c) {
      fig.classList.toggle('is-pick', !!c);
      [].forEach.call(tags, function (t) { t.classList.toggle('is-on', t.getAttribute('data-c') === c); });
      [].forEach.call(layers, function (l) { l.classList.toggle('is-on', l.getAttribute('data-c') === c); });
    }
    [].forEach.call(tags, function (t) {
      var c = t.getAttribute('data-c');
      t.addEventListener('mouseenter', function () { pick(c); });
      t.addEventListener('focus', function () { pick(c); });
      t.addEventListener('mouseleave', function () { pick(null); });
      t.addEventListener('blur', function () { pick(null); });
      t.addEventListener('click', function () { pick(fig.classList.contains('is-pick') && t.classList.contains('is-on') ? null : c); });
    });
    if (reduce) return;
    fig.classList.add('is-wait');
    onView(fig, function () {
      fig.classList.add('is-go'); fig.classList.remove('is-wait');
      setTimeout(function () { fig.classList.remove('is-go'); }, 3400);   // so hovering later is not delayed
    });
  }

  function start() {
    [].forEach.call(document.querySelectorAll('[data-fig="mapk"]'), mapk);
    [].forEach.call(document.querySelectorAll('[data-fig="dying"]'), dying);
    [].forEach.call(document.querySelectorAll('.flow'), flow);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
