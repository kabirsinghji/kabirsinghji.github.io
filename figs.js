/* Two small figures, drawn as SVG in the site's own colours (the classes are styled in style.css,
   so dark mode follows on its own).
   [data-fig="adapt"]  science.html: a toy signalling pathway. A step of signal reaches a receptor,
                       the response rises, and desensitization feeds back to switch the receptor down.
                       The button weakens that feedback and the response stays high. A model, not data.
   [data-fig="dying"]  history-of-medicine.html: a timeline from Quinlan (1976) to Modern Death (2017),
                       the two court cases above the line and the three books below it.
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
  function arrowDefs(svg) {
    var d = el('defs', {}, svg);
    ['f-sky', 'f-gold', 'f-soft'].forEach(function (c) {
      var m = el('marker', { id: 'ah-' + c, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, d);
      el('path', { d: 'M1 1L9 5L1 9', 'class': c + ' ah' }, m);
    });
  }

  /* ---------------- the signalling pathway ---------------- */
  function adapt(fig) {
    var stage = fig.querySelector('.fig-stage'), btn = fig.querySelector('.fig-btn');
    var T = 8, T0 = 1, DT = 0.005, G = { intact: 2.2, weakened: 0.15 };
    var runs = {};
    Object.keys(G).forEach(function (k) {             // A = u(1-D); R' = (A-R)/0.35; D' = gR(1-D) - D/4
      var R = 0, D = 0, rs = [], as = [], fs = [];
      for (var i = 0; i <= T / DT; i++) {
        var t = i * DT, u = t > T0 ? 1 : 0, A = u * (1 - D);
        rs.push(R); as.push(A); fs.push(G[k] * R * (1 - D));
        R += (A - R) / 0.35 * DT; D += (G[k] * R * (1 - D) - D / 4) * DT;
      }
      runs[k] = { r: rs, a: as, f: fs };
    });
    var rmax = Math.max.apply(null, runs.weakened.r) * 1.08;
    var mode = 'intact', svg, L, refs = {}, t = 0, last = 0, raf = 0, dots = [], acc = { f: 0, b: 0 }, hold = 0, started = false;

    var WIDE = {
      W: 640, H: 236,
      inp: { x: 22, y: 64, w: 140, h: 110 }, out: { x: 474, y: 64, w: 146, h: 110 },
      rec: [252, 119], mes: [364, 119], nodeW: 92,
      fwd: 'M168 119H466', back: 'M364 134C364 196 252 196 252 136', backLab: [308, 210]
    };
    var TALL = {
      W: 340, H: 486,
      inp: { x: 40, y: 44, w: 262, h: 86 }, out: { x: 40, y: 344, w: 262, h: 112 },
      rec: [126, 214], mes: [244, 214], nodeW: 96,
      fwd: 'M60 136V214H244V336', back: 'M244 199C244 160 132 160 132 197', backLab: [188, 152]
    };

    function y(v, box, max) { return box.y + box.h - 6 - v / max * (box.h - 16); }
    function x(tt, box) { return box.x + tt / T * box.w; }
    function trace(vals, box, max, upto) {
      var n = Math.max(2, Math.round(upto / DT)), step = 8, s = '';
      for (var i = 0; i < n; i += step) s += (i ? 'L' : 'M') + x(i * DT, box).toFixed(1) + ' ' + y(vals[i], box, max).toFixed(1);
      return s;
    }

    function build() {
      L = stage.clientWidth >= 520 ? WIDE : TALL;
      stage.innerHTML = '';
      svg = el('svg', { viewBox: '0 0 ' + L.W + ' ' + L.H, role: 'img', 'aria-labelledby': fig.id + '-t' }, stage);
      el('title', { id: fig.id + '-t' }, svg, 'A toy model of a signalling pathway: a step of signal reaches a receptor, the response rises, and desensitization feeds back onto the receptor. With the feedback intact the response peaks and settles; with it weakened the response stays high.');
      arrowDefs(svg);
      [['inp', 'signal in'], ['out', 'response']].forEach(function (p) {
        var b = L[p[0]];
        el('line', { x1: b.x, y1: b.y + b.h, x2: b.x + b.w, y2: b.y + b.h, 'class': 'f-axis' }, svg);
        el('line', { x1: b.x, y1: b.y, x2: b.x, y2: b.y + b.h, 'class': 'f-axis' }, svg);
        el('text', { x: b.x, y: b.y - 12, 'class': 'f-lab' }, svg, p[1]);
        el('text', { x: b.x + b.w, y: b.y + b.h + 16, 'class': 'f-lab', 'text-anchor': 'end' }, svg, 'time');
      });
      refs.fwd = el('path', { d: L.fwd, 'class': 'f-sky f-wire', 'marker-end': 'url(#ah-f-sky)' }, svg);
      refs.back = el('path', { d: L.back, 'class': 'f-gold f-wire f-dash', 'marker-end': 'url(#ah-f-gold)' }, svg);
      refs.backLab = el('text', { x: L.backLab[0], y: L.backLab[1], 'class': 'f-lab f-gold-t', 'text-anchor': 'middle' }, svg, 'desensitization');
      refs.dotLayer = el('g', {}, svg);
      [['rec', 'receptor'], ['mes', 'messenger']].forEach(function (p) {
        var c = L[p[0]], g = el('g', {}, svg);
        el('rect', { x: c[0] - L.nodeW / 2, y: c[1] - 15, width: L.nodeW, height: 30, rx: 15, 'class': 'f-node' }, g);
        el('text', { x: c[0], y: c[1] + 4, 'class': 'f-lab f-ink', 'text-anchor': 'middle' }, g, p[1]);
      });
      // the input is the same in both modes: drawn whole, at once
      var stepIn = [];
      for (var i = 0; i <= T / DT; i++) stepIn.push(i * DT > T0 ? 1 : 0);
      el('path', { d: trace(stepIn, L.inp, 1.25, T), 'class': 'f-soft f-line' }, svg);
      refs.ghost = el('path', { d: '', 'class': 'f-line f-ghost' }, svg);
      refs.resp = el('path', { d: '', 'class': 'f-sky f-line f-thick' }, svg);
      refs.head = el('circle', { r: 3.5, 'class': 'f-sky-fill' }, svg);
      refs.fwdLen = refs.fwd.getTotalLength(); refs.backLen = refs.back.getTotalLength();
      dots = [];
      paint();
    }

    function paint() {
      var other = mode === 'intact' ? 'weakened' : 'intact';
      refs.ghost.setAttribute('d', trace(runs[other].r, L.out, rmax, T));
      refs.resp.setAttribute('d', trace(runs[mode].r, L.out, rmax, Math.max(t, DT * 2)));
      var i = Math.min(runs[mode].r.length - 1, Math.round(t / DT));
      refs.head.setAttribute('cx', x(t, L.out)); refs.head.setAttribute('cy', y(runs[mode].r[i], L.out, rmax));
      fig.classList.toggle('is-weak', mode === 'weakened');
    }

    function frame(ts) {
      raf = 0;
      var now = ts / 1000, dt = Math.min(.05, last ? now - last : .016); last = now;
      if (hold > 0) { hold -= dt; if (hold <= 0) { t = 0; } }
      else { t += dt; if (t >= T) { t = T; hold = 2.6; } }
      var i = Math.min(runs[mode].r.length - 1, Math.round(t / DT)), run = runs[mode];
      // dots: forward ones at the rate the receptor is active, back ones at the rate of desensitization
      if (hold <= 0) {
        acc.f += run.a[i] * 9 * dt; acc.b += run.f[i] * 5 * dt;
        while (acc.f >= 1) { acc.f -= 1; dots.push({ p: refs.fwd, len: refs.fwdLen, s: 0, v: 150, c: 'f-sky-fill' }); }
        while (acc.b >= 1) { acc.b -= 1; dots.push({ p: refs.back, len: refs.backLen, s: 0, v: 90, c: 'f-gold-fill' }); }
      }
      while (refs.dotLayer.firstChild) refs.dotLayer.removeChild(refs.dotLayer.firstChild);
      dots = dots.filter(function (d) {
        d.s += d.v * dt; if (d.s > d.len) return false;
        var pt = d.p.getPointAtLength(d.s);
        el('circle', { cx: pt.x.toFixed(1), cy: pt.y.toFixed(1), r: 3, 'class': d.c }, refs.dotLayer);
        return true;
      });
      paint();
      if (!document.hidden && visible) raf = requestAnimationFrame(frame);
    }

    var visible = false;
    function go() { if (!raf && !reduce) { last = 0; raf = requestAnimationFrame(frame); } }

    btn.addEventListener('click', function () {
      mode = mode === 'intact' ? 'weakened' : 'intact';
      btn.setAttribute('aria-pressed', mode === 'weakened' ? 'true' : 'false');
      btn.textContent = mode === 'weakened' ? '[ feedback weakened · restore it ]' : '[ feedback intact · weaken it ]';
      fig.querySelector('.fig-state').textContent = mode === 'weakened'
        ? 'Weakened: the receptor keeps signalling, and the response stays high.'
        : 'Intact: the response peaks, then desensitization brings it down.';
      t = reduce ? T : 0; hold = 0; dots = []; acc = { f: 0, b: 0 };
      paint();
    });

    build();
    t = reduce ? T : 0; paint();
    var w = stage.clientWidth;
    addEventListener('resize', function () { if ((stage.clientWidth >= 520) !== (w >= 520)) { w = stage.clientWidth; build(); } });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) go(); }).observe(stage);
    } else { visible = true; go(); }
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

  function start() {
    [].forEach.call(document.querySelectorAll('[data-fig="adapt"]'), adapt);
    [].forEach.call(document.querySelectorAll('[data-fig="dying"]'), dying);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
