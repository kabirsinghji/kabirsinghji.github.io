/* The science intro: the protein unfolds into the page. The homepage, painted from what is on
   screen (backgrounds, pictures, every word where it sits), is cut into strips and threaded as a
   cartoon ribbon along the anti-GlialCAM antibody (glialcam-cap8.pdb, the structure on the
   Science page), with Kabir's peptide CAP8 bound in it. Then it is heated in a simulation: a
   Go-like model of the real structure, the standard coarse-grained picture of protein unfolding
   (see "the protein, simulated" below). CAP8 lets go, the two domains come apart, strands lose
   their partners and turn to coil, and each stretch of chain that comes loose settles onto the
   page as its strip; when the last has landed the sheet is the page, pixel for pixel, and gives
   way to the real one. Colours are the page's own: the page on the strands, its ink on their
   edges. Drawn with WebGL 2; without it there is no intro. Called by arrival.js as
   KSArrival.unfold(done). */
(function () {
  'use strict';
  var A = window.KSArrival = window.KSArrival || {};

  function clamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function smooth(a, b, t) { t = clamp((t - a) / (b - a)); return t * t * (3 - 2 * t); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function alpha(c) { var m = c && c.match(/[\d.]+/g); return !m ? 0 : m.length < 4 ? 1 : +m[3]; }
  function rgb(c) { var m = c.match(/[\d.]+/g) || [255, 255, 255]; return [m[0] / 255, m[1] / 255, m[2] / 255]; }

  // ---------------------------------------------------------------- the page, painted
  function pageColour() {
    var els = [document.body, document.documentElement];
    for (var i = 0; i < els.length; i++) { var c = getComputedStyle(els[i]).backgroundColor; if (alpha(c) > 0.5) return c; }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'rgb(17,17,17)' : 'rgb(255,255,255)';
  }
  function radius(cs, w, h) {                       // the four corners, as roundRect wants them
    var r = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map(function (k) {
      var v = cs[k], n = parseFloat(v) || 0;
      return Math.min(/%$/.test(v) ? n / 100 * Math.min(w, h) : n, w / 2, h / 2);
    });
    return r[0] || r[1] || r[2] || r[3] ? r : 0;
  }
  function paint(W, H, dpr, bg) {
    var cv = document.createElement('canvas');
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var g = cv.getContext('2d'), range = document.createRange(), asc = {};
    g.scale(dpr, dpr);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    function visible(r) { return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W; }
    function rr(x, y, w, h, rad) { g.beginPath(); if (g.roundRect && rad) g.roundRect(x, y, w, h, rad); else g.rect(x, y, w, h); }
    function clipToParent(el) {
      for (var p = el.parentElement, n = 0; p && p !== document.body && n < 3; p = p.parentElement, n++) {
        var o = getComputedStyle(p).overflow;
        if (o !== 'visible') { var r = p.getBoundingClientRect(); rr(r.left, r.top, r.width, r.height, radius(getComputedStyle(p), r.width, r.height)); g.clip(); return; }
      }
    }
    function picture(el, cs, r) {
      var src = el.currentSrc || el.src;
      try { if (new URL(src, location.href).origin !== location.origin) return; } catch (e) { return; }   // keep the canvas readable
      var nw = el.naturalWidth, nh = el.naturalHeight;
      if (!el.complete || !nw) return;
      var fit = cs.objectFit, s = fit === 'cover' ? Math.max(r.width / nw, r.height / nh) : fit === 'fill' ? 0 : Math.min(r.width / nw, r.height / nh);
      var iw = s ? nw * s : r.width, ih = s ? nh * s : r.height;
      var pos = cs.objectPosition.split(' '), f = function (v, free) { return /%$/.test(v) ? free * parseFloat(v) / 100 : parseFloat(v) || 0; };
      g.save();
      clipToParent(el);
      rr(r.left, r.top, r.width, r.height, radius(cs, r.width, r.height)); g.clip();
      g.globalAlpha = +cs.opacity;
      g.drawImage(el, r.left + f(pos[0] || '50%', r.width - iw), r.top + f(pos[1] || '50%', r.height - ih), iw, ih);
      g.restore();
    }
    function words(node, cs) {
      var font = [cs.fontStyle, cs.fontVariantCaps === 'small-caps' ? 'small-caps' : '', cs.fontWeight, cs.fontSize, cs.fontFamily].join(' ');
      g.font = font;
      g.fillStyle = cs.webkitTextFillColor && alpha(cs.webkitTextFillColor) ? cs.webkitTextFillColor : cs.color;
      if ('letterSpacing' in g) g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      g.direction = cs.direction === 'rtl' ? 'rtl' : 'ltr';
      g.textAlign = 'left';
      if (!(font in asc)) asc[font] = g.measureText('Hg').fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8;
      var a = asc[font], s = node.nodeValue, re = /\S+/g, m, tt = cs.textTransform, under = cs.textDecorationLine.indexOf('underline') >= 0;
      var fs = parseFloat(cs.fontSize);
      while ((m = re.exec(s))) {
        range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
        var rs = range.getClientRects();
        if (rs.length !== 1 || !visible(rs[0])) continue;
        var r = rs[0], w = tt === 'uppercase' ? m[0].toUpperCase() : tt === 'lowercase' ? m[0].toLowerCase() : m[0];
        g.fillText(w, r.left, r.top + a);
        if (under) g.fillRect(r.left, r.top + a + Math.max(1, fs * 0.09), r.width, Math.max(1, fs / 16));
      }
    }
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 3) return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        if (/^(script|style|noscript|template|svg|video|iframe)$/i.test(n.tagName) || n.id === 'arv' ||
            n.classList.contains('arv-skip') || n.classList.contains('hs')) return NodeFilter.FILTER_REJECT;
        var cs = getComputedStyle(n);
        return cs.display === 'none' || +cs.opacity === 0 ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    for (var n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 3) {
        var pcs = getComputedStyle(n.parentElement);
        if (pcs.visibility !== 'hidden') words(n, pcs);
        continue;
      }
      var cs = getComputedStyle(n), r = n.getBoundingClientRect();
      if (cs.visibility === 'hidden' || !visible(r)) continue;
      if (n.tagName === 'IMG') { picture(n, cs, r); continue; }
      if (n.tagName === 'CANVAS') { try { g.drawImage(n, r.left, r.top, r.width, r.height); } catch (e) {} continue; }
      var fill = alpha(cs.backgroundColor) > 0, bw = parseFloat(cs.borderTopWidth) || 0;
      if (fill || (bw && cs.borderTopStyle !== 'none' && alpha(cs.borderTopColor))) {
        var rad = radius(cs, r.width, r.height);
        g.save();
        g.globalAlpha = +cs.opacity;
        if (fill) { rr(r.left, r.top, r.width, r.height, rad); g.fillStyle = cs.backgroundColor; g.fill(); }
        if (bw && cs.borderTopStyle !== 'none') { rr(r.left + bw / 2, r.top + bw / 2, r.width - bw, r.height - bw, rad); g.lineWidth = bw; g.strokeStyle = cs.borderTopColor; g.stroke(); }
        g.restore();
      }
    }
    return cv;
  }

  // ---------------------------------------------------------------- the protein, simulated
  // A Go-like model, the standard coarse-grained picture of folding and unfolding: one bead per
  // C-alpha, bonded to its neighbours, held in shape by its native contacts (pairs closer than
  // 7.5 A in the structure), every other pair only repelling, and the solvent as damping plus
  // random kicks (Langevin dynamics). Heat it and contacts break in the order simulations and
  // experiments report for antibody fragments: the peptide first, then the VH-VL interface, then
  // the domains, VH before VL, long-range and surface contacts before the local hairpins of the
  // core, each one at a slightly random moment. As a stretch of chain comes loose it settles onto
  // the page, into its own strip (the light chain is the top half of the page, the heavy chain
  // the bottom half), so the page is laid down in the order the protein actually unfolds.
  var CA = [8.0,-1.3,16.3,7.0,-3.5,13.3,3.3,-4.5,13.4,1.9,-7.0,11.0,-0.9,-9.5,11.7,-2.6,-11.6,9.1,-4.3,-14.9,9.6,-6.8,-16.1,8.8,-8.9,-13.0,8.1,-11.5,-15.1,6.3,-10.3,-17.7,3.8,-13.0,-19.7,2.0,-11.4,-22.0,-0.6,-13.1,-24.6,-2.8,-12.6,-23.5,-6.4,-9.4,-25.0,-7.8,-7.9,-26.0,-4.4,-4.7,-24.5,-3.0,-4.8,-22.1,-0.1,-2.4,-19.8,1.7,-2.4,-16.7,3.9,-0.1,-16.1,6.8,1.5,-12.8,7.9,3.4,-12.5,11.1,5.3,-9.6,12.5,6.1,-8.3,16.0,9.6,-7.6,14.8,12.0,-9.0,12.2,11.3,-7.6,8.8,15.0,-7.7,7.9,16.4,-4.1,7.5,19.9,-2.9,8.2,20.9,-3.5,4.6,20.0,-7.2,4.9,16.9,-7.0,2.7,13.4,-7.8,3.7,10.9,-5.3,2.2,7.8,-7.5,2.4,5.1,-7.2,-0.3,1.7,-8.9,-0.9,-1.2,-7.2,-2.6,-4.7,-8.2,-3.8,-7.7,-5.8,-4.0,-10.7,-7.1,-6.0,-14.2,-5.6,-5.6,-14.3,-2.3,-7.4,-10.6,-2.2,-8.0,-7.5,-0.6,-6.5,-5.0,-2.8,-4.8,-2.6,-4.5,-7.2,0.8,-6.0,-6.4,1.3,-9.8,-6.2,4.5,-10.7,-4.6,7.5,-8.6,-3.7,10.7,-9.2,-1.7,9.0,-12.1,0.1,8.9,-14.5,-2.8,9.4,-12.8,-6.1,6.4,-12.8,-8.5,5.7,-9.7,-10.5,5.3,-9.9,-14.3,1.5,-9.4,-14.4,0.7,-11.8,-11.6,-0.4,-15.4,-12.3,2.2,-18.2,-11.9,0.1,-19.8,-9.0,1.1,-17.0,-6.7,4.3,-17.3,-4.7,5.6,-16.1,-1.4,8.1,-17.5,1.1,9.3,-17.1,4.7,11.8,-15.3,6.8,12.1,-13.4,10.1,8.7,-12.8,11.5,6.7,-15.6,9.8,5.8,-15.3,6.2,3.3,-17.0,3.9,1.5,-16.2,0.6,0.8,-19.5,-1.2,-1.8,-19.8,-4.0,-1.4,-23.0,-5.9,-5.0,-23.1,-7.4,-7.5,-20.5,-6.1,-9.6,-19.2,-9.0,-12.8,-17.1,-9.0,-10.7,-14.1,-10.0,-8.8,-14.5,-6.6,-11.8,-13.3,-4.6,-10.8,-10.1,-2.8,-8.9,-8.6,0.1,-5.2,-9.6,0.5,-2.7,-7.4,2.3,0.8,-7.8,3.6,2.9,-4.7,3.7,6.3,-4.1,5.2,8.5,-1.1,4.5,11.6,-2.4,6.2,11.4,-0.2,9.2,9.6,3.1,9.7,6.7,3.8,9.9,5.4,1.7,6.9,2.8,-0.6,8.4,0.1,-2.8,6.8,-1.8,-5.8,7.8,-5.5,-5.6,8.5,-6.4,-7.5,5.4,-7.6,-11.1,4.7,-10.9,-11.7,2.8,-10.7,-14.6,0.3,-13.7,-16.3,-1.2,-14.8,-19.3,-3.2,-16.6,-22.2,-1.4,2.0,3.8,-15.9,-1.2,5.6,-15.0,-2.1,7.7,-11.9,-5.2,9.9,-12.3,-6.7,11.2,-9.1,-9.3,13.8,-8.1,-10.1,16.3,-5.4,-11.8,14.4,-2.6,-15.0,15.7,-1.2,-17.3,16.4,1.7,-15.9,18.8,4.4,-17.2,19.5,7.9,-14.9,18.4,10.8,-12.2,21.0,11.3,-11.9,22.1,7.6,-9.3,21.4,4.9,-9.1,20.0,1.4,-6.3,19.3,-1.1,-5.9,16.1,-3.2,-4.3,16.0,-6.6,-2.8,13.2,-8.6,-1.4,13.6,-12.0,1.0,10.9,-13.2,1.8,9.6,-16.7,3.8,6.9,-18.4,7.0,7.4,-16.4,9.4,10.1,-15.3,7.8,11.6,-12.2,11.1,13.1,-10.9,12.7,9.6,-10.8,10.4,7.9,-8.4,9.4,8.2,-4.8,5.6,8.6,-4.4,3.3,7.9,-1.6,-0.3,8.1,-0.3,-2.5,5.3,1.1,-6.0,5.6,2.3,-8.9,3.1,2.9,-11.6,3.6,5.4,-15.1,2.5,4.3,-15.5,-1.2,4.8,-11.9,-1.3,6.1,-8.4,-2.1,5.0,-5.5,0.1,3.9,-3.7,2.5,6.1,-0.3,4.0,5.0,-0.5,7.8,5.0,2.8,9.3,3.9,5.9,9.0,1.7,7.7,11.8,-0.1,11.0,11.4,-1.9,11.9,12.6,-5.3,12.7,16.2,-4.5,10.6,16.6,-1.3,13.6,16.8,0.9,12.4,13.7,2.9,8.8,13.3,4.1,7.5,10.4,6.3,4.0,10.3,7.8,2.0,7.7,9.7,1.3,8.7,13.3,-2.5,9.0,12.5,-1.9,12.1,10.4,1.2,13.7,11.9,0.8,17.4,12.3,-2.3,17.4,10.1,-1.6,16.1,6.6,1.3,17.6,4.5,2.6,15.9,1.3,4.0,17.8,-1.7,5.3,17.2,-5.2,5.3,19.3,-8.3,8.1,17.9,-10.5,7.4,20.4,-13.2,3.7,19.3,-13.7,4.4,15.6,-12.9,1.9,15.9,-10.1,1.5,14.7,-6.5,-0.5,16.6,-3.9,-1.7,16.0,-0.3,-2.9,18.9,1.9,-5.4,17.6,4.4,-5.8,20.1,7.3,-7.8,19.7,10.6,-10.1,17.0,9.1,-11.5,14.6,11.7,-14.4,12.1,11.3,-11.9,9.2,11.1,-10.3,10.7,8.0,-13.3,9.5,5.9,-12.1,7.0,3.2,-10.6,6.7,-0.2,-7.2,8.1,-0.7,-4.8,6.6,-3.2,-1.8,7.9,-5.2,1.0,5.2,-5.4,4.3,4.9,-7.2,7.6,3.5,-5.7,7.3,3.0,-1.9,7.9,0.6,-0.2,6.8,-1.5,-3.2,3.7,0.4,-4.3,3.8,-1.2,-7.8,1.2,1.2,-9.2,-2.0,2.5,-7.7,-4.4,5.1,-9.2,-8.1,5.1,-9.2,-8.3,6.8,-5.7,-10.6,9.6,-4.6,-13.2,9.7,-1.8,-12.9,12.0,1.2,-15.8,12.4,3.6,-15.8,14.2,6.9,26.5,3.6,-1.1,24.4,6.3,0.3,21.7,5.9,-2.3,20.7,2.3,-2.8,17.4,3.2,-1.2,19.2,3.3,2.1,22.3,1.3,2.0,25.3,0.2,-0.1];
  var DOMAIN = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2];
  var CHAINS = [[0, 112], [112, 225]], PEPTIDE = [225, 233];

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mix3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function ease(x) { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); }

  // timeline, seconds
  var T = { grow: 0.4, settle: 1.1, heatFrom: 0.9, heatTo: 3.2, landFor: 0.85, lastLand: 3.15, exactFrom: 3.75, exactTo: 4.1,
            fadeFrom: 4.2, end: 4.55 };
  var DT = 1 / 480;

  function model(rand, W, H, scale, N, h) {
    var n = DOMAIN.length, i, j, X = new Float64Array(n * 3), V = new Float64Array(n * 3), F = new Float64Array(n * 3);
    var zc = 14;                                     // the folded protein sits a little behind the page
    for (i = 0; i < n; i++) { X[i * 3] = CA[i * 3]; X[i * 3 + 1] = CA[i * 3 + 1]; X[i * 3 + 2] = CA[i * 3 + 2] - zc; }
    var d = function (a, b) { return Math.hypot(CA[a * 3] - CA[b * 3], CA[a * 3 + 1] - CA[b * 3 + 1], CA[a * 3 + 2] - CA[b * 3 + 2]); };
    // native contacts and how hard each one holds
    var C = [], nc = new Float64Array(n);
    for (i = 0; i < n; i++) for (j = i + 3; j < n; j++) {
      var r0 = d(i, j);
      if (r0 < 7.5) { C.push({ i: i, j: j, r0: r0 }); nc[i]++; nc[j]++; }
    }
    var ncMax = Math.max.apply(null, nc);
    C.forEach(function (c) {
      var di = DOMAIN[c.i], dj = DOMAIN[c.j], th;
      if (di === 2 || dj === 2) th = 0.03 + 0.09 * rand();                    // the bound peptide goes first
      else if (di !== dj) th = 0.12 + 0.14 * rand();                          // then the VH-VL interface
      else {
        var sep = c.j - c.i;
        th = (di === 1 ? 0.3 : 0.58) + (sep < 6 ? 0.16 : sep < 20 ? 0.07 : 0) + // VH is the weaker domain; hairpins hold longest
             0.2 * ((nc[c.i] + nc[c.j]) / (2 * ncMax) - 0.5) + 0.16 * (rand() - 0.5);   // buried contacts outlast surface ones
      }
      c.th = Math.max(0.03, Math.min(0.97, th));
    });
    // where each residue lies on the page, and which strip it is in
    var tgt = new Float64Array(n * 3), strip = new Int32Array(n).fill(-1);
    CHAINS.forEach(function (ch, c) {
      var len = ch[1] - ch[0];
      for (var r = 0; r < len; r++) {
        var f = r / (len - 1), kk = Math.min(N / 2 - 1, Math.floor(f * N / 2)), loc = f * N / 2 - kk, k = c * N / 2 + kk, g = ch[0] + r;
        strip[g] = k;
        tgt[g * 3] = (loc * W - W / 2) / scale; tgt[g * 3 + 1] = (H / 2 - (k + 0.5) * h) / scale; tgt[g * 3 + 2] = 0;
      }
    });
    var landAt = new Float64Array(n).fill(Infinity), q = new Float64Array(n).fill(1), land = new Float64Array(n), loose = [];
    var ac = [0, 0, 0], hc = [0, 0, 0];
    for (i = 0; i < n; i++) { var p = [CA[i * 3], CA[i * 3 + 1], CA[i * 3 + 2]]; if (DOMAIN[i] === 0) ac = add(ac, mul(p, 1 / 112)); else if (DOMAIN[i] === 1) hc = add(hc, mul(p, 1 / 113)); }
    var away = [norm(sub(ac, hc)), norm(sub(hc, ac))], pepOut;
    var pc = [0, 0, 0];
    for (i = PEPTIDE[0]; i < PEPTIDE[1]; i++) pc = add(pc, mul([CA[i * 3], CA[i * 3 + 1], CA[i * 3 + 2]], 1 / 8));
    pepOut = norm(sub(pc, mul(add(ac, hc), 0.5)));
    var t = 0, step = 0;

    function bondSpring(a, b, r0, k) {
      var dx = X[b * 3] - X[a * 3], dy = X[b * 3 + 1] - X[a * 3 + 1], dz = X[b * 3 + 2] - X[a * 3 + 2], r = Math.hypot(dx, dy, dz) || 1e-6;
      var f = k * (r - r0) / r;
      F[a * 3] += f * dx; F[a * 3 + 1] += f * dy; F[a * 3 + 2] += f * dz;
      F[b * 3] -= f * dx; F[b * 3 + 1] -= f * dy; F[b * 3 + 2] -= f * dz;
      return r;
    }
    function advance() {
      var heat = smooth(T.heatFrom, T.heatFrom + 1.3, t), D = clamp((t - T.heatFrom) / (T.heatTo - T.heatFrom));
      F.fill(0);
      // the chain: bonds and the 1-3 spacing that keeps it from kinking; a bond between two strips lets go once it lands
      for (i = 0; i < n - 1; i++) {
        for (var s2 = 1; s2 <= 2; s2++) {
          j = i + s2;
          if (j >= n || DOMAIN[j] !== DOMAIN[i]) continue;
          var both = Math.min(land[i], land[j]), cut = strip[i] !== strip[j] && Math.max(land[i], land[j]) > 0.05;
          if (cut) continue;
          var r0 = lerp(d(i, j), Math.hypot(tgt[j * 3] - tgt[i * 3], tgt[j * 3 + 1] - tgt[i * 3 + 1]), both);
          bondSpring(i, j, r0, s2 === 1 ? 6000 : 900);
        }
      }
      // native contacts: springs while they hold, gone once heat and chance break them
      var held = new Float64Array(n), alive = new Float64Array(n);
      for (var c = 0; c < C.length; c++) {
        var cc = C[c], s = clamp((cc.th - D) / 0.1);
        if (s <= 0) continue;
        alive[cc.i] += s; alive[cc.j] += s;
        var dx = X[cc.j * 3] - X[cc.i * 3], dy = X[cc.j * 3 + 1] - X[cc.i * 3 + 1], dz = X[cc.j * 3 + 2] - X[cc.i * 3 + 2], r = Math.hypot(dx, dy, dz);
        if (r > 1.6 * cc.r0) continue;
        var f = 350 * s * (r - cc.r0) / r;
        F[cc.i * 3] += f * dx; F[cc.i * 3 + 1] += f * dy; F[cc.i * 3 + 2] += f * dz;
        F[cc.j * 3] -= f * dx; F[cc.j * 3 + 1] -= f * dy; F[cc.j * 3 + 2] -= f * dz;
        if (r < 1.3 * cc.r0) { held[cc.i] += s; held[cc.j] += s; }
      }
      // everything else only keeps its distance
      if (step % 2 === 0) for (i = 0; i < n; i++) for (j = i + 3; j < n; j++) {
        var ex = X[j * 3] - X[i * 3], ey = X[j * 3 + 1] - X[i * 3 + 1], ez = X[j * 3 + 2] - X[i * 3 + 2];
        if (ex > 4 || ex < -4 || ey > 4 || ey < -4) continue;
        var rr = Math.hypot(ex, ey, ez);
        if (rr >= 4 || rr < 1e-6 || land[i] > 0.5 || land[j] > 0.5) continue;
        var fr = -1200 * (4 - rr) / rr;
        F[i * 3] += fr * ex; F[i * 3 + 1] += fr * ey; F[i * 3 + 2] += fr * ez;
        F[j * 3] -= fr * ex; F[j * 3 + 1] -= fr * ey; F[j * 3 + 2] -= fr * ez;
      }
      // what has come loose settles onto the page
      for (i = 0; i < n; i++) {
        q[i] = nc[i] ? held[i] / nc[i] : 0;
        var dom = DOMAIN[i];
        if (dom < 2) {
          loose[i] = (nc[i] ? alive[i] / nc[i] : 0) < 0.3;
          if (landAt[i] === Infinity && D > 0.05 && loose[i] && (loose[i - 1] || loose[i + 1] || land[i - 1] > 0 || land[i + 1] > 0)) landAt[i] = t;   // it and a neighbour are free
          if (landAt[i] === Infinity && t > T.lastLand) landAt[i] = t;
          land[i] = ease((t - landAt[i]) / T.landFor);
          var ka = 420 * Math.sqrt(land[i]);                                     // the page pulls it down, dragging what it is joined to
          for (var k = 0; k < 3; k++) F[i * 3 + k] += ka * (tgt[i * 3 + k] - X[i * 3 + k]);
          if (D > 0.2) for (k = 0; k < 3; k++) F[i * 3 + k] += 22 * heat * (1 - land[i]) * away[dom][k];   // the domains drift apart
        } else if (D > 0.1) for (k = 0; k < 3; k++) F[i * 3 + k] += 90 * pepOut[k];                    // the peptide leaves
        var kT = (40 + 900 * heat) * Math.max(0, 1 - land[i]), g = 10 + 40 * land[i], kick = Math.sqrt(2 * g * kT * DT);
        for (k = 0; k < 3; k++) {
          var m = i * 3 + k;
          V[m] += (F[m] - g * V[m]) * DT + kick * (rand() + rand() + rand() - 1.5) * 2;
          X[m] += V[m] * DT;
        }
      }
      t += DT; step++;
    }
    return { X: X, q: q, land: land, tgt: tgt, strip: strip, n: n, zc: zc,
             time: function () { return t; }, to: function (until) { while (t < until) advance(); } };
  }
  var VS = '#version 300 es\n' +
    'in vec3 pos, nrm; in vec2 uv; in float across, u, solid;\n' +
    'uniform mat4 proj; uniform float camD;\n' +
    'out vec2 vUv; out vec3 vNrm; out float vAcross, vU, vSolid;\n' +
    'void main() {\n' +
    '  vUv = uv; vNrm = nrm; vAcross = across; vU = u; vSolid = solid;\n' +
    '  gl_Position = proj * vec4(pos - vec3(0.0, 0.0, camD), 1.0);\n' +
    '}\n';
  var FS = '#version 300 es\n' +
    'precision highp float;\n' +
    'in vec2 vUv; in vec3 vNrm; in float vAcross, vU, vSolid;\n' +
    'uniform sampler2D tex; uniform vec3 bg, ink; uniform float shade;\n' +
    'out vec4 o;\n' +
    'void main() {\n' +
    '  vec3 n = normalize(vNrm);\n' +
    '  if (!gl_FrontFacing) n = -n;\n' +
    '  vec3 base = gl_FrontFacing ? texture(tex, vUv).rgb : mix(bg, ink, 0.14);\n' +       // the page on the front, plain on the back
    '  if (vSolid > 0.5) base = mix(ink, bg, 0.2);\n' +
    '  float edge = smoothstep(0.34, 0.5, abs(vAcross)) * (1.0 - vU);\n' +               // the strands drawn in the page's own ink
    '  base = mix(base, ink, edge * 0.85);\n' +
    '  vec3 Ld = normalize(vec3(-0.45, 0.6, 0.75));\n' +
    '  float diff = max(dot(n, Ld), 0.0), spec = pow(max(dot(reflect(-Ld, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);\n' +
    '  vec3 lit = base * (0.5 + 0.6 * diff) + 0.18 * spec;\n' +
    '  o = vec4(mix(base, lit, (1.0 - vU) * shade), 1.0);\n' +
    '}\n';

  function program(gl) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function rotation(spin, tilt) {                     // about the vertical axis, then a tilt toward the viewer
    var a = spin * Math.PI / 180, b = tilt * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    return function (p) {
      var x = ca * p[0] + sa * p[2], z = -sa * p[0] + ca * p[2], y = p[1];
      return [x, cb * y - sb * z, sb * y + cb * z];
    };
  }

  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var r = Math.imul(seed ^ seed >>> 15, 1 | seed); r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
  function catmull(p0, p1, p2, p3, u) {
    var u2 = u * u, u3 = u2 * u;
    return [0, 1, 2].map(function (c) {
      return 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3);
    });
  }

  function run(done) {
    if (A.cancelled) return;
    var W = innerWidth, H = innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1), m = Math.min(W, H);
    var cv = document.createElement('canvas');
    cv.id = 'arv';
    cv.setAttribute('aria-hidden', 'true');
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.cssText = 'position:fixed;left:0;top:0;width:' + W + 'px;height:' + H + 'px;z-index:2147483000;transition:opacity .35s linear';
    var gl = cv.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: !!A.capture });
    if (!gl) { done && done(); return; }               // no WebGL 2: no intro, just the page
    A.started = true;
    A.reveal && A.reveal();                            // paint the real page; the canvas covers it before the next paint
    var bgCss = pageColour(), bg = rgb(bgCss), ink = rgb(getComputedStyle(document.body).color), prog, painted;
    try {
      painted = paint(W, H, dpr, bgCss);
      prog = program(gl);
    } catch (e) { if (window.console) console.warn('intro skipped:', e.message); done && done(); return; }
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR); });
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE); });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, painted);

    // the page as strips: about 4.5 A of chain per residue once it lies on the page
    var scale = 0.6 * m / 48, N = Math.max(6, Math.min(30, Math.round(4.5 * 112 * scale / W) * 2)), h = H / N;
    var M = Math.max(24, Math.round(W / 6));
    var sim = model(rng(A.capture ? 7 : (Date.now() & 0xffff) | 1), W, H, scale, N, h);

    var nV = (N * (M + 1) + 41) * 2, dyn = new Float32Array(nV * 7), uvs = new Float32Array(nV * 2), acr = new Float32Array(nV), sol = new Float32Array(nV), idx = [];
    var vi = 0;
    function quads(count) { for (var j = 0; j < count - 1; j++) { var a = vi + j * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } }
    for (var k = 0; k < N; k++) {
      quads(M + 1);
      for (var j = 0; j <= M; j++) { uvs.set([j / M, k * h / H, j / M, (k + 1) * h / H], vi * 2); acr[vi] = -0.5; acr[vi + 1] = 0.5; vi += 2; }
    }
    quads(41);
    for (j = 0; j <= 40; j++) { acr[vi] = -0.5; acr[vi + 1] = 0.5; sol[vi] = sol[vi + 1] = 1; vi += 2; }
    function buffer(data, name, size) {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(gl.createVertexArray());
    buffer(uvs, 'uv', 2); buffer(acr, 'across', 1); buffer(sol, 'solid', 1);
    var dynBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf); gl.bufferData(gl.ARRAY_BUFFER, dyn, gl.DYNAMIC_DRAW);
    [['pos', 3, 0], ['nrm', 3, 12], ['u', 1, 24]].forEach(function (d) {
      var loc = gl.getAttribLocation(prog, d[0]);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, d[1], gl.FLOAT, false, 28, d[2]);
    });
    var index = new Uint16Array(idx);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);

    var fov = 30 * Math.PI / 180, camD = H / 2 / Math.tan(fov / 2), fl = 1 / Math.tan(fov / 2), near = 20, far = camD + 8 * Math.max(W, H);
    var U = {};
    ['proj', 'camD', 'tex', 'bg', 'ink', 'shade'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    gl.uniformMatrix4fv(U.proj, false, [fl * H / W, 0, 0, 0, 0, fl, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
    gl.uniform1f(U.camD, camD);
    gl.uniform1i(U.tex, 0);
    gl.uniform3f(U.bg, bg[0], bg[1], bg[2]);
    gl.uniform3f(U.ink, ink[0], ink[1], ink[2]);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(bg[0], bg[1], bg[2], 1);

    var X = sim.X, n = sim.n, piv = [0, 0, -sim.zc];
    if (A.capture) A.sim = sim;                        // the recorder can look inside
    function draw(t) {
      sim.to(t);
      // it turns to face us while it settles, then everything is the simulation
      var turn = 1 - ease(t / T.settle), R = rotation(-120 * turn, 12 * turn), grow = lerp(0.75, 1, ease(t / T.grow));
      var exact = ease((t - T.exactFrom) / (T.exactTo - T.exactFrom));
      var P = [], i;
      for (i = 0; i < n; i++) {
        var p = [X[i * 3], X[i * 3 + 1], X[i * 3 + 2]], l = sim.land[i];
        if (l < 1) p = mix3(add(piv, mul(R(sub(p, piv)), grow)), p, l);
        P.push(mul(p, scale));
      }
      var o = 0;
      function ribbon(from, to, samples, pageAt, k) {
        var len = to - from, Q = P.slice(from, to), B = [], r;
        for (r = 0; r < len; r++) B.push(r > 0 && r < len - 1 ? norm(sub(mul(Q[r], 2), add(Q[r - 1], Q[r + 1]))) : null);
        B[0] = B[1]; B[len - 1] = B[len - 2];
        for (r = 1; r < len; r++) if (dot(B[r], B[r - 1]) < 0) B[r] = mul(B[r], -1);
        var cs = [], bs = [], as = [], ws = [];
        samples.forEach(function (f) {
          var rho = f * (len - 1), r0 = Math.min(len - 2, Math.floor(rho)), u = rho - r0, g0 = from + r0, g1 = g0 + 1;
          var c = catmull(Q[Math.max(0, r0 - 1)], Q[r0], Q[r0 + 1], Q[Math.min(len - 1, r0 + 2)], u);
          var L = sim.land, a = pageAt ? Math.max(exact, Math.min(L[g0], L[g1])) : 0;   // on the page once both ends are
          if (pageAt && a < 1) {                         // widen smoothly over a few residues, not residue by residue
            var acc = 0, wsum = 0;
            for (var dg = -2; dg <= 2; dg++) {
              var ga = Math.max(from, Math.min(to - 2, g0 + dg)), wt = 3 - Math.abs(dg);
              acc += wt * Math.min(L[ga], L[ga + 1]); wsum += wt;
            }
            a = Math.max(exact, Math.min(a, acc / wsum));
          }
          var cutHere = pageAt && sim.strip[g0] !== sim.strip[g1] && a < 1 && Math.max(L[g0], L[g1]) > 0.05;   // the join between two strips has let go
          var q = lerp(sim.q[g0], sim.q[g1], u);
          if (pageAt) c = mix3(c, pageAt(f), ease(a));
          cs.push(c); bs.push(mix3(B[r0], B[r0 + 1], u)); as.push(a);
          ws.push(cutHere ? 0 : scale * (1.1 + 2.4 * clamp(q * 1.3)));   // a strand while it holds its contacts, a thin coil once loose
        });
        var prev = null;
        for (var j = 0; j < cs.length; j++) {
          var tg = norm(sub(cs[Math.min(cs.length - 1, j + 1)], cs[Math.max(0, j - 1)])), a = as[j], e = ease(a);
          var side = norm(cross(tg, bs[j]));
          if (prev && dot(side, prev) < 0) side = mul(side, -1);
          if (a > 0.02 && dot(side, [0, -1, 0]) < 0) side = mul(side, -1);
          prev = side;
          side = norm(mix3(side, [0, -1, 0], e));
          side = norm(sub(side, mul(tg, dot(side, tg))));
          var w = pageAt ? (ws[j] || a >= 1 ? lerp(ws[j] * grow, h, e * e * e) : 0) : ws[j] * grow * (k === undefined ? 1 : k), nr = cross(side, tg);
          var top = add(cs[j], mul(side, -0.5 * w)), bot = add(cs[j], mul(side, 0.5 * w));
          if (a >= 1) { top = [cs[j][0], cs[j][1] + h / 2, 0]; bot = [cs[j][0], cs[j][1] - h / 2, 0]; nr = [0, 0, 1]; }
          dyn.set([top[0], top[1], top[2], nr[0], nr[1], nr[2], e, bot[0], bot[1], bot[2], nr[0], nr[1], nr[2], e], o); o += 14;
        }
      }
      for (var s = 0; s < N; s++) {
        var ch = CHAINS[s < N / 2 ? 0 : 1], kk = s % (N / 2), fs = [];
        for (var j2 = 0; j2 <= M; j2++) fs.push((kk + j2 / M) / (N / 2));
        (function (s, kk) {
          ribbon(ch[0], ch[1], fs, function (f) {
            var loc = f * N / 2 - kk;
            return [loc * W - W / 2, H / 2 - (s + 0.5) * h, 0];
          });
        })(s, kk);
      }
      var pf = [];
      for (j2 = 0; j2 <= 40; j2++) pf.push(j2 / 40);
      ribbon(PEPTIDE[0], PEPTIDE[1], pf, null, 0.8 * (1 - smooth(1.3, 2.3, t)));
      gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dyn);
      gl.uniform1f(U.shade, 1 - exact);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);
    }

    var t0 = 0, stopped = false, timer = null;
    function frame(now) {
      if (stopped) return;
      if (!t0) t0 = now;
      var t = (now - t0) / 1000;
      draw(t);
      if (t >= T.fadeFrom && !timer) { cv.style.opacity = 0; timer = setTimeout(finish, (T.end - T.fadeFrom) * 1000); return; }
      requestAnimationFrame(frame);
    }
    function finish() {
      if (stopped) return;
      stopped = true;
      cv.remove();
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      done && done();
    }
    A.skip = function () { clearTimeout(timer); cv.style.transition = 'opacity .2s linear'; cv.style.opacity = 0; timer = setTimeout(finish, 220); };
    A.draw = draw;                                     // lets the canvas mockup step through frames
    draw(0);                                           // drawn before it is shown: no blank first frame
    document.body.appendChild(cv);
    if (!A.capture) requestAnimationFrame(frame);      // capture mode: the recorder calls draw(t) itself
  }

  A.unfold = function (done) {
    // wait for the fonts and the pictures on screen, but not for long
    document.fonts.ready.then(function () {
      var once = function () { if (once) { once = null; run(done); } };
      if (document.readyState === 'complete') return once();
      addEventListener('load', function () { once && once(); });
      setTimeout(function () { once && once(); }, 1200);
    });
  };
})();
