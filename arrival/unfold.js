/* The science intro: the protein unfolds into the page. The homepage, painted from what is on
   screen (backgrounds, pictures, every word where it sits), is cut into strips and threaded as a
   ribbon along the real backbone of the anti-GlialCAM antibody (glialcam-cap8.pdb, the structure
   on the Science page): the top half of the page along the light chain, the bottom half along the
   heavy chain, with Kabir's peptide CAP8 bound between them. The folded cartoon turns; CAP8 lets go
   first; the two domains loosen and drift apart; then each chain peels away from its N-terminus,
   twisting as it is pulled straight, and every stretch lays down as its strip of the page until
   the whole page is there, pixel for pixel, and gives way to the real one. Colours are the page's
   own: the page on the strands, its ink on their edges. Drawn with WebGL 2; without it, no intro.
   Called by arrival.js as KSArrival.unfold(done). */
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

  // ---------------------------------------------------------------- the protein: the page as a ribbon
  // The page is cut into N strips; the strips, end to end, are a ribbon threaded along the real
  // backbone: the top half of the page along the light chain, the bottom half along the heavy
  // chain. Folded, it is a cartoon of the antibody with the page printed along its strands.
  var CA = [8.0,-1.3,16.3,7.0,-3.5,13.3,3.3,-4.5,13.4,1.9,-7.0,11.0,-0.9,-9.5,11.7,-2.6,-11.6,9.1,-4.3,-14.9,9.6,-6.8,-16.1,8.8,-8.9,-13.0,8.1,-11.5,-15.1,6.3,-10.3,-17.7,3.8,-13.0,-19.7,2.0,-11.4,-22.0,-0.6,-13.1,-24.6,-2.8,-12.6,-23.5,-6.4,-9.4,-25.0,-7.8,-7.9,-26.0,-4.4,-4.7,-24.5,-3.0,-4.8,-22.1,-0.1,-2.4,-19.8,1.7,-2.4,-16.7,3.9,-0.1,-16.1,6.8,1.5,-12.8,7.9,3.4,-12.5,11.1,5.3,-9.6,12.5,6.1,-8.3,16.0,9.6,-7.6,14.8,12.0,-9.0,12.2,11.3,-7.6,8.8,15.0,-7.7,7.9,16.4,-4.1,7.5,19.9,-2.9,8.2,20.9,-3.5,4.6,20.0,-7.2,4.9,16.9,-7.0,2.7,13.4,-7.8,3.7,10.9,-5.3,2.2,7.8,-7.5,2.4,5.1,-7.2,-0.3,1.7,-8.9,-0.9,-1.2,-7.2,-2.6,-4.7,-8.2,-3.8,-7.7,-5.8,-4.0,-10.7,-7.1,-6.0,-14.2,-5.6,-5.6,-14.3,-2.3,-7.4,-10.6,-2.2,-8.0,-7.5,-0.6,-6.5,-5.0,-2.8,-4.8,-2.6,-4.5,-7.2,0.8,-6.0,-6.4,1.3,-9.8,-6.2,4.5,-10.7,-4.6,7.5,-8.6,-3.7,10.7,-9.2,-1.7,9.0,-12.1,0.1,8.9,-14.5,-2.8,9.4,-12.8,-6.1,6.4,-12.8,-8.5,5.7,-9.7,-10.5,5.3,-9.9,-14.3,1.5,-9.4,-14.4,0.7,-11.8,-11.6,-0.4,-15.4,-12.3,2.2,-18.2,-11.9,0.1,-19.8,-9.0,1.1,-17.0,-6.7,4.3,-17.3,-4.7,5.6,-16.1,-1.4,8.1,-17.5,1.1,9.3,-17.1,4.7,11.8,-15.3,6.8,12.1,-13.4,10.1,8.7,-12.8,11.5,6.7,-15.6,9.8,5.8,-15.3,6.2,3.3,-17.0,3.9,1.5,-16.2,0.6,0.8,-19.5,-1.2,-1.8,-19.8,-4.0,-1.4,-23.0,-5.9,-5.0,-23.1,-7.4,-7.5,-20.5,-6.1,-9.6,-19.2,-9.0,-12.8,-17.1,-9.0,-10.7,-14.1,-10.0,-8.8,-14.5,-6.6,-11.8,-13.3,-4.6,-10.8,-10.1,-2.8,-8.9,-8.6,0.1,-5.2,-9.6,0.5,-2.7,-7.4,2.3,0.8,-7.8,3.6,2.9,-4.7,3.7,6.3,-4.1,5.2,8.5,-1.1,4.5,11.6,-2.4,6.2,11.4,-0.2,9.2,9.6,3.1,9.7,6.7,3.8,9.9,5.4,1.7,6.9,2.8,-0.6,8.4,0.1,-2.8,6.8,-1.8,-5.8,7.8,-5.5,-5.6,8.5,-6.4,-7.5,5.4,-7.6,-11.1,4.7,-10.9,-11.7,2.8,-10.7,-14.6,0.3,-13.7,-16.3,-1.2,-14.8,-19.3,-3.2,-16.6,-22.2,-1.4,2.0,3.8,-15.9,-1.2,5.6,-15.0,-2.1,7.7,-11.9,-5.2,9.9,-12.3,-6.7,11.2,-9.1,-9.3,13.8,-8.1,-10.1,16.3,-5.4,-11.8,14.4,-2.6,-15.0,15.7,-1.2,-17.3,16.4,1.7,-15.9,18.8,4.4,-17.2,19.5,7.9,-14.9,18.4,10.8,-12.2,21.0,11.3,-11.9,22.1,7.6,-9.3,21.4,4.9,-9.1,20.0,1.4,-6.3,19.3,-1.1,-5.9,16.1,-3.2,-4.3,16.0,-6.6,-2.8,13.2,-8.6,-1.4,13.6,-12.0,1.0,10.9,-13.2,1.8,9.6,-16.7,3.8,6.9,-18.4,7.0,7.4,-16.4,9.4,10.1,-15.3,7.8,11.6,-12.2,11.1,13.1,-10.9,12.7,9.6,-10.8,10.4,7.9,-8.4,9.4,8.2,-4.8,5.6,8.6,-4.4,3.3,7.9,-1.6,-0.3,8.1,-0.3,-2.5,5.3,1.1,-6.0,5.6,2.3,-8.9,3.1,2.9,-11.6,3.6,5.4,-15.1,2.5,4.3,-15.5,-1.2,4.8,-11.9,-1.3,6.1,-8.4,-2.1,5.0,-5.5,0.1,3.9,-3.7,2.5,6.1,-0.3,4.0,5.0,-0.5,7.8,5.0,2.8,9.3,3.9,5.9,9.0,1.7,7.7,11.8,-0.1,11.0,11.4,-1.9,11.9,12.6,-5.3,12.7,16.2,-4.5,10.6,16.6,-1.3,13.6,16.8,0.9,12.4,13.7,2.9,8.8,13.3,4.1,7.5,10.4,6.3,4.0,10.3,7.8,2.0,7.7,9.7,1.3,8.7,13.3,-2.5,9.0,12.5,-1.9,12.1,10.4,1.2,13.7,11.9,0.8,17.4,12.3,-2.3,17.4,10.1,-1.6,16.1,6.6,1.3,17.6,4.5,2.6,15.9,1.3,4.0,17.8,-1.7,5.3,17.2,-5.2,5.3,19.3,-8.3,8.1,17.9,-10.5,7.4,20.4,-13.2,3.7,19.3,-13.7,4.4,15.6,-12.9,1.9,15.9,-10.1,1.5,14.7,-6.5,-0.5,16.6,-3.9,-1.7,16.0,-0.3,-2.9,18.9,1.9,-5.4,17.6,4.4,-5.8,20.1,7.3,-7.8,19.7,10.6,-10.1,17.0,9.1,-11.5,14.6,11.7,-14.4,12.1,11.3,-11.9,9.2,11.1,-10.3,10.7,8.0,-13.3,9.5,5.9,-12.1,7.0,3.2,-10.6,6.7,-0.2,-7.2,8.1,-0.7,-4.8,6.6,-3.2,-1.8,7.9,-5.2,1.0,5.2,-5.4,4.3,4.9,-7.2,7.6,3.5,-5.7,7.3,3.0,-1.9,7.9,0.6,-0.2,6.8,-1.5,-3.2,3.7,0.4,-4.3,3.8,-1.2,-7.8,1.2,1.2,-9.2,-2.0,2.5,-7.7,-4.4,5.1,-9.2,-8.1,5.1,-9.2,-8.3,6.8,-5.7,-10.6,9.6,-4.6,-13.2,9.7,-1.8,-12.9,12.0,1.2,-15.8,12.4,3.6,-15.8,14.2,6.9,26.5,3.6,-1.1,24.4,6.3,0.3,21.7,5.9,-2.3,20.7,2.3,-2.8,17.4,3.2,-1.2,19.2,3.3,2.1,22.3,1.3,2.0,25.3,0.2,-0.1];
  var DOMAIN = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2];
  var LIGHT = [0, 112], HEAVY = [112, 225], PEPTIDE = [225, 233];
  var RIBBON = 3.2;                                  // folded ribbon width, Angstrom

  function v3(a, i) { return [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mix3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }

  // a smooth backbone through the C-alphas, with the ribbon's sideways direction (Carson-Bugg:
  // away from the local bend, kept from flipping), sampled by arc length
  function chain(range) {
    var P = [], D = [], i;
    for (i = range[0]; i < range[1]; i++) P.push(v3(CA, i));
    var n = P.length;
    for (i = 0; i < n; i++) {
      var d = i > 0 && i < n - 1 ? norm(sub(mul(P[i], 2), add(P[i - 1], P[i + 1]))) : null;
      D.push(d);
    }
    D[0] = D[1]; D[n - 1] = D[n - 2];
    for (i = 1; i < n; i++) if (dot(D[i], D[i - 1]) < 0) D[i] = mul(D[i], -1);
    D = D.map(function (d, i) { return norm(add(add(D[Math.max(0, i - 1)], mul(d, 2)), D[Math.min(n - 1, i + 1)])); });
    var pts = [], bends = [], len = [0], SUB = 10;
    for (i = 0; i < n - 1; i++) for (var k = 0; k < SUB; k++) {
      var u = k / SUB, p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      var u2 = u * u, u3 = u2 * u;
      pts.push([0, 1, 2].map(function (c) {
        return 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3);
      }));
      bends.push(mix3(D[i], D[i + 1], u));
    }
    pts.push(P[n - 1]); bends.push(D[n - 1]);
    // the ribbon's face looks along the bend (outward on a helix, across the pleat of a strand),
    // so its width lies flat in the sheet, as in a cartoon
    var sides = pts.map(function (p, i) {
      var tg = sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]);
      return norm(cross(tg, bends[i]));
    });
    for (i = 1; i < sides.length; i++) if (dot(sides[i], sides[i - 1]) < 0) sides[i] = mul(sides[i], -1);
    for (i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot.apply(null, sub(pts[i], pts[i - 1])));
    var c = [0, 0, 0];
    P.forEach(function (p) { c = add(c, mul(p, 1 / n)); });
    return { pts: pts, sides: sides, len: len, total: len[len.length - 1], centre: c };
  }
  function at(C, f) {                                // point and side at fraction f of the chain's length
    var L = f * C.total, lo = 0, hi = C.len.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (C.len[m] <= L) lo = m; else hi = m; }
    var k = (L - C.len[lo]) / ((C.len[hi] - C.len[lo]) || 1);
    return { p: mix3(C.pts[lo], C.pts[hi], k), s: mix3(C.sides[lo], C.sides[hi], k) };
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

  // timeline, seconds
  var T = { grow: 0.4, ligandFrom: 0.6, ligandTo: 1.5, looseFrom: 0.9, looseTo: 2.2, unfoldFrom: 1.3, unfoldTo: 4.0,
            span: 1.15, lag: 0.3, flatFrom: 3.7, fadeFrom: 4.1, end: 4.45 };
  function ease(x) { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); }

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
    var tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR); });
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE); });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, painted);

    // ---- geometry that does not change: where every sample of the ribbon sits folded and flat
    var L = chain(LIGHT), Hc = chain(HEAVY), Pp = chain(PEPTIDE), scale = 0.62 * m / 48;
    var wf = RIBBON * scale, N = Math.round(Math.sqrt((L.total + Hc.total) * scale * H / (wf * W)) / 2) * 2;
    N = Math.max(6, Math.min(30, N));
    var h = H / N, M = Math.max(24, Math.round(W / 6)), strips = [];
    for (var k = 0; k < N; k++) {
      var C = k < N / 2 ? L : Hc, kk = k % (N / 2), st = { k: k, chain: C, light: k < N / 2, samples: [] };
      for (var j = 0; j <= M; j++) {
        var f = (kk + j / M) / (N / 2), a = at(C, f);
        st.samples.push({ f: f, p: a.p, s: a.s, x: W * j / M - W / 2, y: H / 2 - (k + 0.5) * h, tu: j / M });
      }
      strips.push(st);
    }
    var pep = { samples: [] };                        // CAP8, the peptide: leaves the antibody first
    for (j = 0; j <= 40; j++) { var b2 = at(Pp, j / 40); pep.samples.push({ p: b2.p, s: b2.s }); }

    var nS = strips.length * (M + 1) + pep.samples.length, nV = nS * 2;
    var dyn = new Float32Array(nV * 7), uvs = new Float32Array(nV * 2), acr = new Float32Array(nV), sol = new Float32Array(nV), idx = [];
    var vi = 0;
    function quads(count) {
      for (var j = 0; j < count - 1; j++) { var a = vi + j * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    }
    strips.forEach(function (st) {
      quads(M + 1);
      st.samples.forEach(function (sm) {
        uvs.set([sm.tu, st.k * h / H, sm.tu, (st.k + 1) * h / H], vi * 2);
        acr[vi] = -0.5; acr[vi + 1] = 0.5; vi += 2;
      });
    });
    quads(pep.samples.length);
    pep.samples.forEach(function () { acr[vi] = -0.5; acr[vi + 1] = 0.5; sol[vi] = sol[vi + 1] = 1; vi += 2; });

    function buffer(data, name, size, usage) {
      var b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      var loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    }
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    buffer(uvs, 'uv', 2, gl.STATIC_DRAW); buffer(acr, 'across', 1, gl.STATIC_DRAW); buffer(sol, 'solid', 1, gl.STATIC_DRAW);
    var dynBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf); gl.bufferData(gl.ARRAY_BUFFER, dyn, gl.DYNAMIC_DRAW);
    [['pos', 3, 0], ['nrm', 3, 12], ['u', 1, 24]].forEach(function (d) {
      var loc = gl.getAttribLocation(prog, d[0]);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, d[1], gl.FLOAT, false, 28, d[2]);
    });
    var ib = gl.createBuffer(), index = new Uint16Array(idx);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);

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

    var pivot = [0, 0, -0.5 * 48 * scale], lift = 0.22 * m, pull = 0.3 * m;
    var dirL = norm(L.centre), dirH = norm(Hc.centre), dirP = norm(Pp.centre);
    // ---- one frame: every sample is folded, on its way, or lying in its strip
    function draw(t) {
      var R = rotation(-150 + 42 * t, 14 * (1 - smooth(0, 3.2, t)));
      var grow = lerp(0.72, 1, 1 - Math.pow(1 - clamp(t / T.grow), 3));
      var loose = smooth(T.looseFrom, T.looseTo, t), sep = 7 * loose;            // the domains let go of each other
      var breathe = 1 + 0.07 * loose;
      function folded(p, dir, extra) {
        var q = add(mul(p, breathe), mul(dir, sep + (extra || 0)));
        return add(pivot, mul(R(q), scale * grow));
      }
      var o = 0;
      strips.forEach(function (st) {
        var dir = st.light ? dirL : dirH, core = folded([0, 0, 0], dir), start = T.unfoldFrom + (st.light ? 0 : T.lag);
        var spread = T.unfoldTo - T.span - start, cs = [], us = [], sideF = [];
        st.samples.forEach(function (sm) {
          var u = ease((t - (start + sm.f * spread)) / T.span);
          var F = folded(sm.p, dir), flat = [sm.x, sm.y, 0];
          var out = norm(sub(F, core)), Cp = add(add(F, mul(out, pull)), [0, 0, lift]);       // pulled out, then laid down
          cs.push(add(add(mul(F, (1 - u) * (1 - u)), mul(Cp, 2 * u * (1 - u))), mul(flat, u * u)));
          us.push(u);
          sideF.push(R(sm.s));
        });
        for (var j = 0; j < cs.length; j++) {
          var u = us[j], tg = norm(sub(cs[Math.min(cs.length - 1, j + 1)], cs[Math.max(0, j - 1)]));
          var side = norm(mix3(sideF[j], [0, -1, 0], u));
          side = norm(sub(side, mul(tg, dot(side, tg))));
          var tw = 2 * Math.PI * ease(u * 1.15), c = Math.cos(tw), s = Math.sin(tw);           // the strand twists as it is pulled straight
          var tx = cross(tg, side);
          side = add(mul(side, c), mul(tx, s));
          var w = lerp(wf * grow, h, Math.pow(u, 1.4)), nr = cross(side, tg);
          var top = add(cs[j], mul(side, -0.5 * w)), bot = add(cs[j], mul(side, 0.5 * w));
          if (u >= 1) { top = [cs[j][0], cs[j][1] + h / 2, 0]; bot = [cs[j][0], cs[j][1] - h / 2, 0]; nr = [0, 0, 1]; }
          dyn.set([top[0], top[1], top[2], nr[0], nr[1], nr[2], u, bot[0], bot[1], bot[2], nr[0], nr[1], nr[2], u], o); o += 14;
        }
      });
      // the peptide drifts out of its pocket and away
      var leave = smooth(T.ligandFrom, T.ligandTo, t), pw = wf * grow * (1 - leave);
      var pc = pep.samples.map(function (sm) { return folded(sm.p, dirP, 30 * leave * leave); });
      for (var j2 = 0; j2 < pc.length; j2++) {
        var tg2 = norm(sub(pc[Math.min(pc.length - 1, j2 + 1)], pc[Math.max(0, j2 - 1)]));
        var sd = R(pep.samples[j2].s); sd = norm(sub(sd, mul(tg2, dot(sd, tg2))));
        var n2 = cross(sd, tg2), a2 = add(pc[j2], mul(sd, -0.5 * pw)), b3 = add(pc[j2], mul(sd, 0.5 * pw));
        dyn.set([a2[0], a2[1], a2[2], n2[0], n2[1], n2[2], 0, b3[0], b3[1], b3[2], n2[0], n2[1], n2[2], 0], o); o += 14;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dyn);
      gl.uniform1f(U.shade, 1 - smooth(T.flatFrom, T.unfoldTo, t));
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
