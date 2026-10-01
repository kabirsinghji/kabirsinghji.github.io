/* The homepage protein: a turning, see-through surface generated from the tagged CV entries.
   Data comes from <script id="protein-data">, written by tools/build.py from data/cv.json.
   Activities are the peaks (labelled axes), subjects the coloured hotspots; hidden tags arrive
   without names and only shape the surface. Click or tap a dot and it swells and lights up. */
(function () {
  'use strict';
  var stage = document.getElementById('protein-stage'), dataEl = document.getElementById('protein-data');
  if (!stage || !dataEl) return;
  var D = JSON.parse(dataEl.textContent);
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var q = function (sel) { return stage.querySelector(sel); };

  // tag families: a = activities, i = subjects, q = qualities, k = keywords
  var F = { a: [], i: [], q: [], k: [] }, local = [];
  D.tags.forEach(function (t, j) { local[j] = F[t.k].length; F[t.k].push({ name: t.n || '', verb: t.v || '', vis: !t.h, n: 0 }); });
  var E = D.entries.map(function (e) {
    var o = { s: e.s, title: e.title, sec: e.sec, d: e.d, v: e.v || [], t: e.t, a: [], i: [], q: [], k: [] };
    e.g.forEach(function (j) { var t = D.tags[j]; if (t && F[t.k]) o[t.k].push(local[j]); });
    return o;
  });

  // ---------------------------------------------------------------- small vector and matrix helpers
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function nrm(a) { var l = len(a) || 1; return mul(a, 1 / l); }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function avg(xs) { return xs.reduce(function (s, x) { return s + x; }, 0) / xs.length; }
  function rng(seed) { return function () { seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function mmul(a, b) { var o = new Float32Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); }
  function trans(z) { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, z, 1]); }
  function has(e, f, k) { return e[f].indexOf(k) >= 0; }

  // ---------------------------------------------------------------- the shape, generated from the tags
  // Each activity is a direction; its lobe is longer the more entries carry it. Each quality is a
  // direction too: it tilts the entries that carry it and pushes out an unlabelled bump of its own.
  // Entries sit along their activities' lobes, older near the core and newer further out; entries
  // with no tags (education) sit in the core. Subjects pull an entry to one side of its lobe, so
  // entries about the same thing gather into a coloured patch. Keywords make an entry's bump fuller.
  function fib(slot, n, rot) { var y = 1 - 2 * (slot + .5) / n, r = Math.sqrt(1 - y * y), th = slot * 2.39996 + rot; return [r * Math.cos(th), y, r * Math.sin(th)]; }
  var EL = [24, -18, 20, -30, 8, -16, 34];
  function dirA(k) { if (k < 7) { var az = k * 2 * Math.PI / 7 + .35, el = EL[k] * Math.PI / 180; return [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)]; } return fib((k * 11) % 29, 29, .7); }
  function dirQ(k) { return fib((k * 7) % 24, 24, 1.1); }
  function dirI(k) { return fib((k * 5) % 16, 16, .4); }

  var lobeA = [], lobeQ = [], rank = [];
  function recount() {
    Object.keys(F).forEach(function (f) { F[f].forEach(function (t, k) { t.n = 0; E.forEach(function (e) { if (has(e, f, k)) t.n++; }); }); });
  }
  function layout() {
    recount();
    var aMax = Math.max.apply(null, F.a.map(function (t) { return t.n; }).concat(1)), qMax = Math.max.apply(null, F.q.map(function (t) { return t.n; }).concat(1));
    lobeA = F.a.map(function (t) { return .7 + 1.1 * Math.sqrt(t.n / aMax); });
    lobeQ = F.q.map(function (t) { return .5 + .8 * Math.sqrt(t.n / qMax); });
    rank = F.a.map(function (x, a) {
      var ids = nodes.filter(function (n) { return has(n.e, 'a', a); }).sort(function (p, q) { return p.e.t - q.e.t || p.i - q.i; });
      var m = {}; ids.forEach(function (n, j) { m[n.i] = ids.length > 1 ? j / (ids.length - 1) : 1; }); return m;
    });
    nodes.forEach(function (n) { n.pt = place(n); if (!n.p) n.p = n.pt.slice(); });
  }
  function place(n) {
    var e = n.e, R = rng(n.i * 7919 + 13);
    if (!e.a.length && !e.q.length) {
      var th = R() * 6.283, ph = Math.acos(2 * R() - 1), r0 = .12 + .22 * R();
      return [r0 * Math.sin(ph) * Math.cos(th), r0 * Math.cos(ph), r0 * Math.sin(ph) * Math.sin(th)];
    }
    var d = [0, 0, 0];
    e.a.forEach(function (a) { d = add(d, dirA(a)); });
    e.q.forEach(function (q) { d = add(d, mul(dirQ(q), .22)); });
    if (len(d) < .25) d = e.a.length ? dirA(e.a[0]) : dirQ(e.q[0]);
    d = nrm(d);
    var L = e.a.length ? avg(e.a.map(function (a) { return lobeA[a]; })) : avg(e.q.map(function (q) { return lobeQ[q]; }));
    var u = e.a.length ? avg(e.a.map(function (a) { return rank[a][n.i]; })) : 1;
    var r = .45 + L * (.16 + .84 * u);
    var up = Math.abs(d[1]) < .9 ? [0, 1, 0] : [1, 0, 0], e1 = nrm(cross(d, up)), e2 = cross(d, e1);
    var ang = R() * 6.283, rad = (.1 + .2 * Math.sqrt(R())) * (.7 + .5 * u);
    var off = add(mul(e1, Math.cos(ang) * rad), mul(e2, Math.sin(ang) * rad));
    if (e.i.length) {
      var s = [0, 0, 0]; e.i.forEach(function (k) { s = add(s, dirI(k)); });
      s = sub(s, mul(d, dot(s, d))); if (len(s) > 1e-3) off = add(off, mul(nrm(s), .2));
    }
    return add(mul(d, r), off);
  }
  function bulged(n) { return n.b > 0 ? add(n.p, mul(nrm(n.p), .3 * n.b)) : n.p; }
  function mkNode(e, i) { return { e: e, i: i, p: null, pt: null, g: 1, b: 0, bv: 0, bt: 0, born: -1, sx: 0, sy: 0, w: 1 }; }
  var nodes = E.map(mkNode);
  var SA = [], SQ = [];   // springs for the activity and quality bumps
  function springsFor() { while (SA.length < F.a.length) SA.push({ b: 0, bv: 0, bt: 0 }); while (SQ.length < F.q.length) SQ.push({ b: 0, bv: 0, bt: 0 }); }
  springsFor();
  layout();
  var BR = 0, BRn = 0;
  function bounds() {
    nodes.forEach(function (n) { BRn = Math.max(BRn, len(n.pt) + .45); });
    BR = Math.max(BR, BRn); F.a.forEach(function (t, k) { BR = Math.max(BR, .45 + lobeA[k] + .95); });
  }
  bounds();

  // ---------------------------------------------------------------- metaball field -> mesh (surface nets)
  var ISO = .33;
  function balls() {
    var B = [{ p: [0, 0, 0], R: 1.35, s: 1 }];
    F.a.forEach(function (t, k) {
      var c = 0; nodes.forEach(function (n) { if (n.g > 0 && has(n.e, 'a', k)) c += n.g; });
      if (c > 0) [.35, .72].forEach(function (f) { B.push({ p: mul(dirA(k), .45 + f * lobeA[k]), R: .78 * (1 + .2 * SA[k].b), s: .5 * Math.min(1, c / 3) * (1 + .8 * SA[k].b) }); });
    });
    F.q.forEach(function (t, k) {
      var c = 0; nodes.forEach(function (n) { if (n.g > 0 && has(n.e, 'q', k)) c += n.g; });
      if (c > 0) B.push({ p: mul(dirQ(k), .45 + .8 * lobeQ[k]), R: .6 * (1 + .25 * SQ[k].b), s: .3 * Math.min(1, c / 4) * (1 + .9 * SQ[k].b) });
    });
    nodes.forEach(function (n) {
      if (n.g <= 0) return;
      var nt = n.e.a.length + n.e.i.length + n.e.q.length + n.e.k.length;
      B.push({ p: bulged(n), R: (.55 + .03 * Math.min(8, nt)) * (1 + .3 * n.b), s: .72 * n.g * (1 + .85 * n.b) });
    });
    return B;
  }
  var CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  var ED = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  function surface(B, h) {
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], c, i, j, k, NI = F.i.length;
    B.forEach(function (b) { for (c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], b.p[c] - b.R - h); mx[c] = Math.max(mx[c], b.p[c] + b.R + h); } });
    var nx = Math.ceil((mx[0] - mn[0]) / h) + 1, ny = Math.ceil((mx[1] - mn[1]) / h) + 1, nz = Math.ceil((mx[2] - mn[2]) / h) + 1, sxy = nx * ny;
    var Fd = new Float32Array(sxy * nz);
    B.forEach(function (b) {
      if (b.s <= 0) return;
      var R2 = b.R * b.R, inv = 1 / R2;
      var i0 = Math.max(0, Math.floor((b.p[0] - b.R - mn[0]) / h)), i1 = Math.min(nx - 1, Math.ceil((b.p[0] + b.R - mn[0]) / h));
      var j0 = Math.max(0, Math.floor((b.p[1] - b.R - mn[1]) / h)), j1 = Math.min(ny - 1, Math.ceil((b.p[1] + b.R - mn[1]) / h));
      var k0 = Math.max(0, Math.floor((b.p[2] - b.R - mn[2]) / h)), k1 = Math.min(nz - 1, Math.ceil((b.p[2] + b.R - mn[2]) / h));
      for (k = k0; k <= k1; k++) {
        var dz = mn[2] + k * h - b.p[2], dz2 = dz * dz; if (dz2 >= R2) continue;
        for (j = j0; j <= j1; j++) {
          var dy = mn[1] + j * h - b.p[1], dyz = dy * dy + dz2; if (dyz >= R2) continue;
          var idx = i0 + j * nx + k * sxy;
          for (i = i0; i <= i1; i++, idx++) {
            var dx = mn[0] + i * h - b.p[0], d2 = dx * dx + dyz;
            if (d2 < R2) { var q = 1 - d2 * inv; Fd[idx] += b.s * q * q * q; }
          }
        }
      }
    });
    var V = new Int32Array(sxy * nz).fill(-1), P = [], off = CO.map(function (o) { return o[0] + o[1] * nx + o[2] * sxy; }), val = new Float32Array(8);
    for (k = 0; k < nz - 1; k++) for (j = 0; j < ny - 1; j++) for (i = 0; i < nx - 1; i++) {
      var id = i + j * nx + k * sxy, m = 0;
      for (c = 0; c < 8; c++) { val[c] = Fd[id + off[c]]; if (val[c] > ISO) m |= 1 << c; }
      if (m === 0 || m === 255) continue;
      var ax = 0, ay = 0, az = 0, n = 0;
      for (var e = 0; e < 12; e++) {
        var a = ED[e][0], bb = ED[e][1];
        if (((m >> a) & 1) !== ((m >> bb) & 1)) {
          var t = (ISO - val[a]) / (val[bb] - val[a]);
          ax += CO[a][0] + t * (CO[bb][0] - CO[a][0]); ay += CO[a][1] + t * (CO[bb][1] - CO[a][1]); az += CO[a][2] + t * (CO[bb][2] - CO[a][2]); n++;
        }
      }
      V[id] = P.length / 3;
      P.push(mn[0] + (i + ax / n) * h, mn[1] + (j + ay / n) * h, mn[2] + (k + az / n) * h);
    }
    var I = [];
    function quad(a, b, c2, d, inside) { if (a < 0 || b < 0 || c2 < 0 || d < 0) return; if (inside) I.push(a, b, c2, a, c2, d); else I.push(a, c2, b, a, d, c2); }
    for (k = 1; k < nz - 1; k++) for (j = 1; j < ny - 1; j++) for (i = 1; i < nx - 1; i++) {
      var p0 = i + j * nx + k * sxy, ins = Fd[p0] > ISO;
      if (ins !== (Fd[p0 + 1] > ISO)) quad(V[p0 - nx - sxy], V[p0 - sxy], V[p0], V[p0 - nx], ins);
      if (ins !== (Fd[p0 + nx] > ISO)) quad(V[p0 - 1 - sxy], V[p0 - 1], V[p0], V[p0 - sxy], ins);
      if (ins !== (Fd[p0 + sxy] > ISO)) quad(V[p0 - 1 - nx], V[p0 - nx], V[p0], V[p0 - 1], ins);
    }
    // smooth normals from the field itself
    var nv = P.length / 3, N = new Float32Array(nv * 3);
    for (var v = 0; v < nv; v++) {
      var x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], gx = 0, gy = 0, gz = 0;
      for (var q2 = 0; q2 < B.length; q2++) {
        var b2 = B[q2], ex = x - b2.p[0], ey = y - b2.p[1], ez = z - b2.p[2], dd = ex * ex + ey * ey + ez * ez, RR = b2.R * b2.R;
        if (dd < RR) { var qq = 1 - dd / RR, f = b2.s * qq * qq / RR; gx += f * ex; gy += f * ey; gz += f * ez; }
      }
      var gl2 = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      N[v * 3] = gx / gl2; N[v * 3 + 1] = gy / gl2; N[v * 3 + 2] = gz / gl2;
    }
    // how close each point of the surface is to entries of each subject (the hotspots)
    var W = new Float32Array(nv * NI), S2 = .42 * .42;
    nodes.forEach(function (nd) {
      if (nd.g <= 0 || !nd.e.i.length) return;
      for (var v2 = 0; v2 < nv; v2++) {
        var ex2 = P[v2 * 3] - nd.p[0], ey2 = P[v2 * 3 + 1] - nd.p[1], ez2 = P[v2 * 3 + 2] - nd.p[2], d3 = ex2 * ex2 + ey2 * ey2 + ez2 * ez2;
        if (d3 > 9 * S2) continue;
        var wv = nd.g * Math.exp(-d3 / S2);
        for (var ii = 0; ii < nd.e.i.length; ii++) W[v2 * NI + nd.e.i[ii]] += wv / nd.e.i.length;
      }
    });
    // glow: points near anything that is swelling light up
    var G = new Float32Array(nv), src = [], S3 = .55 * .55;
    nodes.forEach(function (nd) { if (nd.g > 0 && nd.b > .02) src.push([bulged(nd), nd.b * nd.g]); });
    SA.forEach(function (o, k) { if (o.b > .02 && lobeA[k]) src.push([mul(dirA(k), .45 + .72 * lobeA[k]), o.b * .8]); });
    SQ.forEach(function (o, k) { if (o.b > .02 && lobeQ[k]) src.push([mul(dirQ(k), .45 + .8 * lobeQ[k]), o.b * .8]); });
    src.forEach(function (sg) {
      for (var v3 = 0; v3 < nv; v3++) {
        var gx3 = P[v3 * 3] - sg[0][0], gy3 = P[v3 * 3 + 1] - sg[0][1], gz3 = P[v3 * 3 + 2] - sg[0][2], d4 = gx3 * gx3 + gy3 * gy3 + gz3 * gz3;
        if (d4 < 9 * S3) G[v3] += sg[1] * Math.exp(-d4 / S3);
      }
    });
    return { P: new Float32Array(P), N: N, I: new Uint32Array(I), W: W, G: G, nv: nv, ni: NI };
  }

  // ---------------------------------------------------------------- WebGL
  var cv = q('.pr-gl'), ov = q('.pr-ov'), ctx = ov.getContext('2d');
  var gl = null;
  try { gl = cv.getContext('webgl', { antialias: true, alpha: false }); } catch (e) { gl = null; }
  var uintOK = gl && gl.getExtension('OES_element_index_uint');
  var prog, loc = {}, buf = {}, mesh = null, theme = {};
  if (!gl) {
    q('.pr-nogl').hidden = false; stage.classList.add('pr-off');
    return;
  }
  var VS = 'attribute vec3 aP;attribute vec3 aN;attribute vec3 aC;attribute float aH;attribute float aG;uniform mat4 uP;uniform mat4 uMV;uniform float uT;uniform float uB;' +
    'varying vec3 vN;varying vec3 vV;varying vec3 vC;varying float vH;varying float vG;' +
    'void main(){vec3 p=aP+aN*uB*sin(uT*1.1+dot(aP,vec3(2.3,1.7,2.9)));vec4 mv=uMV*vec4(p,1.0);vV=mv.xyz;vN=(uMV*vec4(aN,0.0)).xyz;vC=aC;vH=aH;vG=aG;gl_Position=uP*mv;}';
  var FS = 'precision mediump float;varying vec3 vN;varying vec3 vV;varying vec3 vC;varying float vH;varying float vG;uniform vec3 uRim;uniform vec3 uGlow;uniform float uA0;uniform float uA1;uniform float uFp;uniform float uSp;uniform float uK;' +
    'void main(){vec3 N=normalize(vN);if(!gl_FrontFacing)N=-N;vec3 V=normalize(-vV);float ndv=clamp(dot(N,V),0.0,1.0);float fr=pow(1.0-ndv,uFp);' +
    'vec3 L=normalize(vec3(-0.45,0.75,0.55));float df=max(dot(N,L),0.0);float sp=pow(max(dot(N,normalize(L+V)),0.0),60.0);' +
    'float gw=clamp(vG,0.0,1.2);vec3 col=vC*(0.6+0.4*df);col=mix(col,uRim,fr*0.65*(1.0-vH*0.6));col=mix(col,uGlow,min(1.0,gw*0.7));col+=uGlow*gw*0.25+sp*uSp;' +
    'float a=uA0+uA1*fr+vH*0.22+sp*0.3+gw*0.35;gl_FragColor=vec4(col,clamp(a*uK,0.0,1.0));}';
  var sh = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
  ['aP', 'aN', 'aC', 'aH', 'aG'].forEach(function (n) { loc[n] = gl.getAttribLocation(prog, n); });
  ['uP', 'uMV', 'uT', 'uB', 'uRim', 'uGlow', 'uA0', 'uA1', 'uFp', 'uSp', 'uK'].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
  ['P', 'N', 'C', 'H', 'G', 'I'].forEach(function (n) { buf[n] = gl.createBuffer(); });

  function hex(c) { c = c.trim().replace('#', ''); if (c.length === 3) c = c.replace(/./g, '$&$&'); return [parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255]; }
  function icol(k) { return theme.ints[k % theme.ints.length]; }
  function readTheme() {
    var cs = getComputedStyle(stage), g = function (n) { return cs.getPropertyValue(n).trim(); };
    var ints = []; for (var k = 0; k < 10; k++) ints.push(g('--p-i' + k));
    theme = { bg: g('--bg'), ink: g('--ink'), soft: g('--soft'), node: g('--p-node'), edge: g('--p-edge'), axis: g('--p-axis'), halo: g('--bg'),
      blob: hex(g('--p-blob')), rim: hex(g('--p-rim')), glow: g('--p-glow'), glowRGB: hex(g('--p-glow')), add: g('--p-mode') === 'add', ints: ints, intRGB: ints.map(hex) };
    if (mesh) colourMesh();
  }

  // colours: a pale blue body; visible subjects tint the surface near their entries
  function colourMesh() {
    if (!gl || !mesh) return;
    var nv = mesh.nv, ni = mesh.ni, C = new Float32Array(nv * 3), H = new Float32Array(nv), b = theme.blob;
    var sel = st.sel && st.sel.f === 'i' ? st.sel.k : -1;
    for (var v = 0; v < nv; v++) {
      var sw = 0, r = 0, g = 0, bl = 0;
      for (var k = 0; k < ni; k++) {
        var w = mesh.W[v * ni + k]; if (!F.i[k].vis || (sel >= 0 && k !== sel)) w = 0;
        if (w > 0) { var c = theme.intRGB[k % 10]; r += w * c[0]; g += w * c[1]; bl += w * c[2]; sw += w; }
      }
      var amt = sel >= 0 ? Math.min(1, sw * 1.5) : Math.min(1, sw) * .6;
      if (sw > 0) { r /= sw; g /= sw; bl /= sw; }
      C[v * 3] = b[0] + (r - b[0]) * amt; C[v * 3 + 1] = b[1] + (g - b[1]) * amt; C[v * 3 + 2] = b[2] + (bl - b[2]) * amt;
      H[v] = sel >= 0 ? amt : amt * .35;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.C); gl.bufferData(gl.ARRAY_BUFFER, C, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.H); gl.bufferData(gl.ARRAY_BUFFER, H, gl.DYNAMIC_DRAW);
  }
  var T1 = D.now, T0 = Math.floor((Math.min.apply(null, E.map(function (e) { return e.t; })) - .2) * 4) / 4;
  function grown(n) {
    var g = st.t >= T1 - 1e-6 ? 1 : smooth(n.e.t - .02, n.e.t + .3, st.t);
    if (n.born >= 0) { var x = Math.min(1, (st.clock - n.born) / .9); g = Math.min(g, 1 - Math.pow(1 - x, 3)); }
    return g;
  }
  var built = { t: -1 };
  function rebuild(h) {
    nodes.forEach(function (n) { n.g = grown(n); });
    built.t = st.t;
    if (!gl) return;
    var m = surface(balls(), h);
    if (!uintOK && m.nv > 65000) m = surface(balls(), h * 1.5);
    mesh = m;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.P); gl.bufferData(gl.ARRAY_BUFFER, m.P, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.N); gl.bufferData(gl.ARRAY_BUFFER, m.N, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.G); gl.bufferData(gl.ARRAY_BUFFER, m.G, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.I); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, uintOK ? m.I : new Uint16Array(m.I), gl.DYNAMIC_DRAW);
    colourMesh();
  }

  // ---------------------------------------------------------------- state
  // sel: a picked activity, subject or quality ({f, k}); pick: the entry whose card is open
  var st = { yaw: .5, tilt: .32, vy: 0, vt: 0, show: { axis: true, nodes: true, names: false }, sel: null, hover: -1, pick: -1,
    t: T1, playing: false, drag: null, W: 1, H: 1, dpr: 1, P: null, MV: null, MVP: null, last: 0, clock: 0, refine: false, band: [0, 1] };

  // the bulge: whatever you pick swells out on a spring, and settles back when you let go
  function targets() {
    var pk = st.pick >= 0 ? nodes[st.pick] : null;
    nodes.forEach(function (n) {
      var t = 0;
      if (st.sel && has(n.e, st.sel.f, st.sel.k)) t = .55;
      if (pk) { if (n === pk) t = 1; else if (n.e.i.some(function (k) { return F.i[k].vis && has(pk.e, 'i', k); })) t = Math.max(t, .22); }
      n.bt = t;
    });
    SA.forEach(function (s, k) { s.bt = st.sel && st.sel.f === 'a' && st.sel.k === k ? .7 : 0; });
    SQ.forEach(function (s, k) { s.bt = st.sel && st.sel.f === 'q' && st.sel.k === k ? .9 : 0; });
  }
  function springs(dt) {
    var moving = false;
    function step(o) {
      if (reduce.matches) { if (o.b !== o.bt) { o.b = o.bt; o.bv = 0; moving = true; } return; }
      if (o.b === o.bt && o.bv === 0) return;
      for (var s = 0; s < 3; s++) { var h = dt / 3, acc = 170 * (o.bt - o.b) - 12 * o.bv; o.bv += acc * h; o.b += o.bv * h; }
      if (Math.abs(o.bt - o.b) > .003 || Math.abs(o.bv) > .02) moving = true; else { o.b = o.bt; o.bv = 0; moving = true; }
    }
    nodes.forEach(step); SA.forEach(step); SQ.forEach(step);
    nodes.forEach(function (n) {
      var d = sub(n.pt, n.p);
      if (len(d) > .002 && !reduce.matches) { n.p = add(n.p, mul(d, Math.min(1, dt * 4))); moving = true; }
      else if (len(d) > 0) { n.p = n.pt.slice(); moving = true; }
      if (n.born >= 0 && st.clock - n.born < 1) moving = true;
    });
    return moving;
  }

  function size() {
    var r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    st.W = r.width; st.H = r.height; st.dpr = Math.min(2, window.devicePixelRatio || 1);
    [cv, ov].forEach(function (c) { c.width = Math.round(st.W * st.dpr); c.height = Math.round(st.H * st.dpr); });
    var asp = st.W / st.H, fov = 34 * Math.PI / 180, small = st.W < 640;
    var sw = q('.pr-switches').getBoundingClientRect(), hot = q('.pr-hot').getBoundingClientRect(), grow = q('.pr-grow').getBoundingClientRect();
    var top = small ? sw.bottom - r.top + 4 : 10;
    var bot = (small ? hot.top : grow.top) - r.top - 6;
    var fh = Math.max(160, bot - top), cy = (top + bot) / 2;
    var tv = Math.tan(fov / 2) * fh / st.H, th = Math.tan(fov / 2) * asp * (small ? .98 : .8);
    st.dist = (small ? BRn * 1.04 : BR * .86) / Math.sin(Math.atan(Math.min(tv, th)));
    st.P = persp(fov, asp, .1, 100);
    st.P[9] = 2 * cy / st.H - 1;
    st.band = [small ? top : 0, hot.top - r.top - 4];
  }

  function frame(now) {
    var dt = Math.min(.05, (now - (st.last || now)) / 1000); st.last = now; st.clock += dt;
    var motion = !reduce.matches;
    if (st.playing) {
      st.t = Math.min(T1, st.t + dt * (T1 - T0) / 5.5);
      yearEl.value = st.t.toFixed(2);
      if (st.t >= T1) { st.playing = false; setPlayIcon(); }
    }
    var moving = springs(dt) || st.t !== built.t;
    if (moving) { rebuild(.1); st.refine = true; } else if (st.refine) { rebuild(.065); st.refine = false; }
    label();
    if (!st.drag) {
      st.yaw += st.vy * dt; st.tilt += st.vt * dt;
      st.vy *= Math.pow(.04, dt); st.vt *= Math.pow(.04, dt);
      st.yaw += (motion && st.hover < 0 ? .16 : 0) * dt;
    }
    st.tilt = Math.max(-1.2, Math.min(1.2, st.tilt));
    st.MV = mmul(trans(-st.dist), mmul(rotX(st.tilt), rotY(st.yaw))); st.MVP = mmul(st.P, st.MV);
    if (gl && mesh) {
      var bg = hex(theme.bg);
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.enable(gl.CULL_FACE);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(loc.uP, false, st.P); gl.uniformMatrix4fv(loc.uMV, false, st.MV);
      gl.uniform1f(loc.uT, st.clock); gl.uniform1f(loc.uB, motion ? .018 : 0);
      gl.uniform3fv(loc.uRim, theme.rim); gl.uniform3fv(loc.uGlow, theme.glowRGB);
      gl.uniform1f(loc.uA0, theme.add ? .42 : .13); gl.uniform1f(loc.uA1, theme.add ? .52 : .5);
      gl.uniform1f(loc.uFp, theme.add ? 1.8 : 2.2); gl.uniform1f(loc.uSp, theme.add ? .3 : .55);
      [['P', 3], ['N', 3], ['C', 3], ['H', 1], ['G', 1]].forEach(function (a) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf[a[0]]); gl.enableVertexAttribArray(loc['a' + a[0]]); gl.vertexAttribPointer(loc['a' + a[0]], a[1], gl.FLOAT, false, 0, 0);
      });
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.I);
      var type = uintOK ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      gl.uniform1f(loc.uK, theme.add ? .38 : .5); gl.cullFace(gl.FRONT); gl.drawElements(gl.TRIANGLES, mesh.I.length, type, 0);
      gl.uniform1f(loc.uK, 1); gl.cullFace(gl.BACK); gl.drawElements(gl.TRIANGLES, mesh.I.length, type, 0);
    }
    overlay();
    if (visible) requestAnimationFrame(frame); else running = false;
  }

  // ---------------------------------------------------------------- the 2D layer: axes, nodes, names, links
  function proj(p) {
    var m = st.MVP, x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [(x / w * .5 + .5) * st.W, (.5 - y / w * .5) * st.H, w];
  }
  function active(n) { return n.g > .01 && (!st.sel || has(n.e, st.sel.f, st.sel.k)); }
  function selColour() { return st.sel && st.sel.f === 'i' ? icol(st.sel.k) : theme.ink; }
  var axBtn = { a: [], q: [] };
  function axisList() {
    var L = [];
    F.a.forEach(function (t, k) { L.push({ f: 'a', k: k, t: t, dir: dirA(k), len: .45 + lobeA[k] + .75, b: axBtn.a[k] }); });
    F.q.forEach(function (t, k) { L.push({ f: 'q', k: k, t: t, dir: dirQ(k), len: .45 + .8 * lobeQ[k] + 1.25, b: axBtn.q[k] }); });
    return L;
  }
  function anyGrown(f, k) { for (var i = 0; i < nodes.length; i++) if (nodes[i].g > .01 && has(nodes[i].e, f, k)) return true; return false; }
  function overlay() {
    var c = ctx, W = st.W, H = st.H;
    c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); c.clearRect(0, 0, W, H);
    var O = proj([0, 0, 0]);
    nodes.forEach(function (n) { var q = proj(bulged(n)); n.sx = q[0]; n.sy = q[1]; n.w = q[2]; });
    var near = st.dist - BR, far = st.dist + BR, depth = function (w) { return 1 - Math.min(1, Math.max(0, (w - near) / (far - near))); };

    // axes: a dotted ray per visible activity (and quality, if you make one visible), labelled past
    // its tip. Labels on rays pointing at you or away would pile up in the middle, so they fade out
    // until the ray turns sideways; of two labels that overlap, the nearer one stays.
    var labs = [], maxPL = 1;
    axisList().forEach(function (A) {
      var b = A.b, on = st.sel && st.sel.f === A.f && st.sel.k === A.k;
      if (!st.show.axis || !A.t.vis || !anyGrown(A.f, A.k)) { b.hidden = true; return; }
      b.hidden = false;
      var tip = proj(mul(A.dir, A.len)), dx = tip[0] - O[0], dy = tip[1] - O[1], dl = Math.hypot(dx, dy) || 1, fr = depth(tip[2]) < .42;
      maxPL = Math.max(maxPL, dl);
      c.save(); c.strokeStyle = theme.axis; c.globalAlpha = (on ? .9 : .45) * (fr ? .6 : 1); c.lineWidth = on ? 1.4 : 1;
      c.setLineDash(A.f === 'q' ? [1, 4] : [2, 5]); c.beginPath(); c.moveTo(O[0], O[1]); c.lineTo(tip[0], tip[1]); c.stroke(); c.restore();
      var bw = b.offsetWidth, bh = b.offsetHeight;
      var lx = Math.min(W - bw / 2 - 6, Math.max(bw / 2 + 6, tip[0] + dx / dl * (bw / 2 * Math.abs(dx / dl) + 8))),
        ly = Math.min(st.band[1] - bh / 2 - 6, Math.max(st.band[0] + bh / 2 + 6, tip[1] + dy / dl * (bh / 2 * Math.abs(dy / dl) + 6)));
      b.style.transform = 'translate(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px) translate(-50%,-50%)';
      b.classList.toggle('far', fr && !on);
      labs.push({ b: b, on: on, pl: dl, w: tip[2], r: [lx - bw / 2, ly - bh / 2, lx + bw / 2, ly + bh / 2] });
    });
    labs.sort(function (p, q) { return (q.on - p.on) || p.w - q.w; });
    var kept = [];
    labs.forEach(function (l) {
      var show = l.on || (l.pl > .38 * maxPL && !kept.some(function (o) { return l.r[0] < o[2] && l.r[2] > o[0] && l.r[1] < o[3] && l.r[3] > o[1]; }));
      if (show) kept.push(l.r);
      l.b.classList.toggle('gone', !show);
    });

    // dotted links: the hovered (or picked) entry to others about the same visible subject;
    // a picked peak, hotspot or quality strings its entries together in date order
    var focus = st.hover >= 0 ? st.hover : st.pick;
    c.save(); c.lineCap = 'round'; c.setLineDash([.5, 5]); c.lineWidth = 1.8;
    if (focus >= 0) {
      var f = nodes[focus];
      nodes.forEach(function (n) {
        if (n === f || !active(n)) return;
        var shared = f.e.i.filter(function (k) { return F.i[k].vis && has(n.e, 'i', k) && (!st.sel || st.sel.f !== 'i' || k === st.sel.k); });
        if (!shared.length) return;
        c.strokeStyle = icol(shared[0]); c.globalAlpha = .85;
        c.beginPath(); c.moveTo(f.sx, f.sy); c.lineTo(n.sx, n.sy); c.stroke();
      });
    } else if (st.sel) {
      var chain = nodes.filter(active).sort(function (a, b) { return a.e.t - b.e.t || a.i - b.i; });
      c.strokeStyle = selColour(); c.globalAlpha = .6; c.beginPath();
      chain.forEach(function (n, j) { if (j) c.lineTo(n.sx, n.sy); else c.moveTo(n.sx, n.sy); }); c.stroke();
    }
    c.restore();

    // nodes, back to front
    var order = nodes.filter(function (n) { return n.g > .01; }).sort(function (a, b) { return b.w - a.w; });
    if (st.show.nodes) order.forEach(function (n) {
      var on = active(n), dp = depth(n.w), r = (2.6 + 2.6 * dp) * (.4 + .6 * n.g) * (1 + .35 * Math.max(0, n.b));
      var vi = n.e.i.filter(function (k) { return F.i[k].vis; });
      c.globalAlpha = (on ? .55 + .45 * dp : .16) * Math.min(1, n.g * 1.5);
      c.beginPath(); c.arc(n.sx, n.sy, r, 0, 6.2832);
      if (n.b > .05) { c.shadowColor = theme.glow; c.shadowBlur = 16 * n.b; }
      c.fillStyle = theme.node; c.fill(); c.shadowBlur = 0;
      c.lineWidth = n.i === focus ? 2 : 1.3;
      c.strokeStyle = vi.length ? icol(st.sel && st.sel.f === 'i' && vi.indexOf(st.sel.k) >= 0 ? st.sel.k : vi[0]) : theme.edge;
      c.stroke();
      if (n.i === st.pick) { c.globalAlpha = .9; c.lineWidth = 1.2; c.strokeStyle = theme.ink; c.beginPath(); c.arc(n.sx, n.sy, r + 4, 0, 6.2832); c.stroke(); }
    });
    c.globalAlpha = 1;

    // names, front first, skipping any that would overlap
    if (st.show.names) {
      c.font = '500 11.5px "Hanken Grotesk", system-ui, sans-serif'; c.textBaseline = 'middle';
      var boxes = [];
      order.slice().reverse().forEach(function (n) {
        if (!active(n) || n.i === st.hover) return;
        var tw = c.measureText(n.e.s).width, x = n.sx + 8, y = n.sy, bx = [x - 2, y - 8, x + tw + 2, y + 8];
        if (bx[2] > W - 4 || bx[0] < 4 || y < 8 || y > H - 8) return;
        for (var q = 0; q < boxes.length; q++) { var o = boxes[q]; if (bx[0] < o[2] && bx[2] > o[0] && bx[1] < o[3] && bx[3] > o[1]) return; }
        boxes.push(bx);
        c.globalAlpha = .45 + .55 * depth(n.w);
        c.lineWidth = 3; c.strokeStyle = theme.halo; c.lineJoin = 'round'; c.strokeText(n.e.s, x, y);
        c.fillStyle = theme.ink; c.fillText(n.e.s, x, y);
      });
      c.globalAlpha = 1;
    }

    // hover pill
    var pill = pillEl;
    if (st.hover >= 0) {
      var hn = nodes[st.hover];
      pill.innerHTML = ''; pill.appendChild(document.createTextNode(hn.e.s));
      if (hn.e.d) { var sp = document.createElement('span'); sp.textContent = hn.e.d.replace(/\s*\(Expected\)/, ''); pill.appendChild(sp); }
      pill.hidden = false;
      var pw = pill.offsetWidth, px = Math.min(W - pw - 8, Math.max(8, hn.sx + 14)), py = Math.max(8, hn.sy - 38);
      pill.style.transform = 'translate(' + px + 'px,' + py + 'px)';
    } else pill.hidden = true;
  }

  // ---------------------------------------------------------------- controls
  var yearEl = q('#pr-year'), outEl = q('.pr-grow output'), pillEl = q('.pr-pill'), card = q('.pr-card');
  function pickSel(f, k) {
    st.sel = st.sel && st.sel.f === f && st.sel.k === k ? null : { f: f, k: k };
    syncPressed(); colourMesh(); targets();
  }
  function ensureAxisButtons() {
    ['a', 'q'].forEach(function (f) {
      F[f].forEach(function (t, k) {
        if (axBtn[f][k]) return;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'pr-axl' + (f === 'q' ? ' q' : ''); b.setAttribute('aria-pressed', 'false'); b.hidden = true;
        b.innerHTML = '<span class="nm"><span class="tx"></span><span class="ct"></span></span><span class="vb"></span>';
        b.querySelector('.tx').textContent = t.name; b.querySelector('.ct').textContent = t.n; b.querySelector('.vb').textContent = t.verb;
        b.addEventListener('click', function () { pickSel(f, k); });
        q('.pr-axes').appendChild(b); axBtn[f][k] = b;
      });
    });
  }
  function renderChips() {
    var box = q('.pr-chips'); box.innerHTML = '';
    F.i.forEach(function (x, k) {
      if (!x.vis || !x.n) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pr-chip'; b.style.setProperty('--c', 'var(--p-i' + (k % 10) + ')');
      b.setAttribute('aria-pressed', 'false'); b.dataset.k = k;
      b.innerHTML = '<span class="dot"></span><span class="t"></span><span class="n"></span>';
      b.querySelector('.t').textContent = x.name; b.querySelector('.n').textContent = x.n;
      b.addEventListener('click', function () { pickSel('i', k); });
      box.appendChild(b);
    });
  }
  function syncPressed() {
    ['a', 'q'].forEach(function (f) { axBtn[f].forEach(function (b, k) { if (b) b.setAttribute('aria-pressed', String(!!(st.sel && st.sel.f === f && st.sel.k === k))); }); });
    Array.prototype.forEach.call(q('.pr-chips').children, function (b) { b.setAttribute('aria-pressed', String(!!(st.sel && st.sel.f === 'i' && st.sel.k === +b.dataset.k))); });
  }
  Array.prototype.forEach.call(stage.querySelectorAll('.pr-sw'), function (b) {
    b.addEventListener('click', function () { var k = b.dataset.k; st.show[k] = !st.show[k]; b.setAttribute('aria-pressed', String(st.show[k])); });
  });

  // timeline
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function label() {
    var y = Math.floor(st.t + 1e-6), m = Math.min(11, Math.floor((st.t - y) * 12 + 1e-6)), n = nodes.filter(function (x) { return x.e.t <= st.t || st.t >= T1 - 1e-6; }).length;
    var txt = MON[m] + ' ' + y;
    if (outEl.dataset.v !== txt + n) { outEl.dataset.v = txt + n; outEl.innerHTML = '<b></b> · ' + n + (n === 1 ? ' entry' : ' entries'); outEl.firstChild.textContent = txt; }
  }
  function setPlayIcon() { q('.pr-play path').setAttribute('d', st.playing ? 'M4 2.5h3v11H4zM9 2.5h3v11H9z' : 'M4 2.5v11l9-5.5z'); q('.pr-play').setAttribute('aria-label', st.playing ? 'Pause' : 'Watch it grow'); }
  yearEl.min = T0; yearEl.max = T1; yearEl.value = T1;
  q('.pr-play').addEventListener('click', function () {
    if (st.playing) st.playing = false;
    else { if (st.t >= T1 - .01) st.t = T0; st.playing = true; }
    setPlayIcon();
  });
  yearEl.addEventListener('input', function () { st.playing = false; setPlayIcon(); st.t = parseFloat(yearEl.value); });

  // entry card: what the entry is and its visible tags
  function openCard(i) {
    st.pick = i; targets();
    if (i < 0) { card.hidden = true; return; }
    var e = E[i];
    q('.pr-meta').textContent = e.sec + (e.d ? ' · ' + e.d : '');
    q('.pr-card h3').textContent = e.title;
    var vb = q('.pr-verbs'); vb.innerHTML = '';
    if (e.v.length) { var b = document.createElement('b'); b.textContent = 'Verbs '; vb.appendChild(b); vb.appendChild(document.createTextNode(e.v.join(', '))); vb.hidden = false; } else vb.hidden = true;
    var tg = q('.pr-tags'); tg.innerHTML = '';
    ['a', 'i', 'q', 'k'].forEach(function (f) {
      e[f].forEach(function (k) {
        var t = F[f][k]; if (!t.vis) return;
        var li = document.createElement('li');
        if (f === 'a') li.className = 'act';
        if (f === 'i') { li.style.setProperty('--c', 'var(--p-i' + (k % 10) + ')'); li.innerHTML = '<span class="dot"></span>'; }
        li.appendChild(document.createTextNode(t.name)); tg.appendChild(li);
      });
    });
    if (!tg.children.length && !e.a.length && !e.i.length && !e.q.length && !e.k.length) { var li2 = document.createElement('li'); li2.textContent = 'Education, in the core'; tg.appendChild(li2); }
    tg.hidden = !tg.children.length;
    var rel = nodes.filter(function (n) { return n.i !== i && n.e.i.some(function (k) { return F.i[k].vis && has(e, 'i', k); }); }).length;
    q('.pr-rel').textContent = rel ? 'The dotted lines join it to ' + rel + ' other ' + (rel === 1 ? 'entry' : 'entries') + ' about the same thing.' : '';
    q('.pr-rel').hidden = !rel;
    card.hidden = false;
  }
  q('.pr-x').addEventListener('click', function () { openCard(-1); ov.focus(); });

  // pointer: drag to turn (on touch, sideways only, so the page still scrolls), hover for names,
  // click or tap a dot for its card and the bulge
  function hit(x, y, rad) {
    var best = -1, bd = rad * rad;
    if (!st.show.nodes) return -1;
    nodes.forEach(function (n) {
      if (!active(n)) return;
      var d = (n.sx - x) * (n.sx - x) + (n.sy - y) * (n.sy - y);
      if (d < bd) { bd = d; best = n.i; }
    });
    return best;
  }
  ov.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'mouse') ov.setPointerCapture(ev.pointerId);
    st.drag = { x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, t: performance.now(), moved: false, touch: ev.pointerType !== 'mouse' };
    st.vy = st.vt = 0;
  });
  ov.addEventListener('pointermove', function (ev) {
    var r = ov.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    if (st.drag) {
      var dx = ev.clientX - st.drag.x, dy = ev.clientY - st.drag.y, now = performance.now(), dt = Math.max(1, now - st.drag.t) / 1000;
      if (Math.hypot(ev.clientX - st.drag.x0, ev.clientY - st.drag.y0) > 5) { st.drag.moved = true; ov.classList.add('dragging'); st.hover = -1; }
      if (st.drag.moved) {
        st.yaw += dx * .008; st.vy = dx * .008 / dt * .6;
        if (!st.drag.touch) { st.tilt += dy * .006; st.vt = dy * .006 / dt * .6; }
      }
      st.drag.x = ev.clientX; st.drag.y = ev.clientY; st.drag.t = now;
      return;
    }
    if (ev.pointerType === 'mouse') { st.hover = hit(x, y, 12); ov.classList.toggle('over', st.hover >= 0); }
  });
  function endDrag(ev) {
    if (!st.drag) return;
    var r = ov.getBoundingClientRect();
    if (!st.drag.moved && ev.type === 'pointerup') { var h = hit(ev.clientX - r.left, ev.clientY - r.top, ev.pointerType === 'mouse' ? 12 : 22); openCard(h === st.pick ? -1 : h); }
    st.drag = null; ov.classList.remove('dragging');
  }
  ov.addEventListener('pointerup', endDrag);
  ov.addEventListener('pointercancel', endDrag);
  ov.addEventListener('pointerleave', function () { if (!st.drag) { st.hover = -1; ov.classList.remove('over'); } });
  ov.addEventListener('keydown', function (ev) {
    var k = ev.key;
    if (k === 'ArrowLeft') st.vy -= .9; else if (k === 'ArrowRight') st.vy += .9;
    else if (k === 'ArrowUp') st.vt -= .7; else if (k === 'ArrowDown') st.vt += .7;
    else if (k === 'Escape') openCard(-1); else return;
    ev.preventDefault();
  });

  // follow the site's light/dark switch and the system setting
  document.addEventListener('themechange', readTheme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);

  // ---------------------------------------------------------------- start: only animate while on screen,
  // and grow it the first time it scrolls into view
  var visible = false, running = false, started = false;
  function run() { if (running || !visible) return; running = true; st.last = 0; requestAnimationFrame(frame); }
  function seen() {
    if (started) return; started = true;
    if (!reduce.matches) { st.t = T0; st.playing = true; setPlayIcon(); }
  }
  readTheme(); ensureAxisButtons(); renderChips(); size(); rebuild(.065);
  if ('ResizeObserver' in window) new ResizeObserver(function () { size(); }).observe(stage); else window.addEventListener('resize', size);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { seen(); run(); } }, { threshold: .2 }).observe(stage);
  } else { visible = true; seen(); run(); }
})();
