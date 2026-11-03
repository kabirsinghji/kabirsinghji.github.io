/* The science page's opening figure: the anti-GlialCAM antibody fragment from the paper, drawn from
   its C-alpha coordinates (aligned on its long axis; light chain in lapis, heavy chain in ink). It
   turns as the cursor moves over it. Nine copies of CAP8 drift around it; they follow the cursor
   when it comes near, and a click (or Enter) sends them all to the binding site, where they give
   way to the docked CAP8 from the model. Reduced motion: no drift, and docking happens at once. */
(function () {
  'use strict';
  var M = {"light":[[1.3,8.0,-16.3],[3.5,7.0,-13.3],[4.5,3.3,-13.4],[7.0,1.9,-11.0],[9.5,-0.9,-11.7],[11.6,-2.6,-9.1],[14.9,-4.3,-9.6],[16.1,-6.8,-8.8],[13.0,-8.9,-8.1],[15.1,-11.5,-6.3],[17.7,-10.3,-3.8],[19.7,-13.0,-2.0],[22.0,-11.4,0.6],[24.6,-13.1,2.8],[23.5,-12.6,6.4],[25.0,-9.4,7.8],[26.0,-7.9,4.4],[24.5,-4.7,3.0],[22.1,-4.8,0.1],[19.8,-2.4,-1.7],[16.7,-2.4,-3.9],[16.1,-0.1,-6.8],[12.8,1.5,-7.9],[12.5,3.4,-11.1],[9.6,5.3,-12.5],[8.3,6.1,-16.0],[7.6,9.6,-14.8],[9.0,12.0,-12.2],[7.6,11.3,-8.8],[7.7,15.0,-7.9],[4.1,16.4,-7.5],[2.9,19.9,-8.2],[3.5,20.9,-4.6],[7.2,20.0,-4.9],[7.0,16.9,-2.7],[7.8,13.4,-3.7],[5.3,10.9,-2.2],[7.5,7.8,-2.4],[7.2,5.1,0.3],[8.9,1.7,0.9],[7.2,-1.2,2.6],[8.2,-4.7,3.8],[5.8,-7.7,4.0],[7.1,-10.7,6.0],[5.6,-14.2,5.6],[2.3,-14.3,7.4],[2.2,-10.6,8.0],[0.6,-7.5,6.5],[2.8,-5.0,4.8],[4.5,-2.6,7.2],[6.0,0.8,6.4],[9.8,1.3,6.2],[10.7,4.5,4.6],[8.6,7.5,3.7],[9.2,10.7,1.7],[12.1,9.0,-0.1],[14.5,8.9,2.8],[12.8,9.4,6.1],[12.8,6.4,8.5],[9.7,5.7,10.5],[9.9,5.3,14.3],[9.4,1.5,14.4],[11.8,0.7,11.6],[15.4,-0.4,12.3],[18.2,2.2,11.9],[19.8,0.1,9.0],[17.0,1.1,6.7],[17.3,4.3,4.7],[16.1,5.6,1.4],[17.5,8.1,-1.1],[17.1,9.3,-4.7],[15.3,11.8,-6.8],[13.4,12.1,-10.1],[12.8,8.7,-11.5],[15.6,6.7,-9.8],[15.3,5.8,-6.2],[17.0,3.3,-3.9],[16.2,1.5,-0.6],[19.5,0.8,1.2],[19.8,-1.8,4.0],[23.0,-1.4,5.9],[23.1,-5.0,7.4],[20.5,-7.5,6.1],[19.2,-9.6,9.0],[17.1,-12.8,9.0],[14.1,-10.7,10.0],[14.5,-8.8,6.6],[13.3,-11.8,4.6],[10.1,-10.8,2.8],[8.6,-8.9,-0.1],[9.6,-5.2,-0.5],[7.4,-2.7,-2.3],[7.8,0.8,-3.6],[4.7,2.9,-3.7],[4.1,6.3,-5.2],[1.1,8.5,-4.5],[2.4,11.6,-6.2],[0.2,11.4,-9.2],[-3.1,9.6,-9.7],[-3.8,6.7,-9.9],[-1.7,5.4,-6.9],[0.6,2.8,-8.4],[2.8,0.1,-6.8],[5.8,-1.8,-7.8],[5.6,-5.5,-8.5],[7.5,-6.4,-5.4],[11.1,-7.6,-4.7],[11.7,-10.9,-2.8],[14.6,-10.7,-0.3],[16.3,-13.7,1.2],[19.3,-14.8,3.2],[22.2,-16.6,1.4]],"heavy":[[-3.8,2.0,15.9],[-5.6,-1.2,15.0],[-7.7,-2.1,11.9],[-9.9,-5.2,12.3],[-11.2,-6.7,9.1],[-13.8,-9.3,8.1],[-16.3,-10.1,5.4],[-14.4,-11.8,2.6],[-15.7,-15.0,1.2],[-16.4,-17.3,-1.7],[-18.8,-15.9,-4.4],[-19.5,-17.2,-7.9],[-18.4,-14.9,-10.8],[-21.0,-12.2,-11.3],[-22.1,-11.9,-7.6],[-21.4,-9.3,-4.9],[-20.0,-9.1,-1.4],[-19.3,-6.3,1.1],[-16.1,-5.9,3.2],[-16.0,-4.3,6.6],[-13.2,-2.8,8.6],[-13.6,-1.4,12.0],[-10.9,1.0,13.2],[-9.6,1.8,16.7],[-6.9,3.8,18.4],[-7.4,7.0,16.4],[-10.1,9.4,15.3],[-11.6,7.8,12.2],[-13.1,11.1,10.9],[-9.6,12.7,10.8],[-7.9,10.4,8.4],[-8.2,9.4,4.8],[-8.6,5.6,4.4],[-7.9,3.3,1.6],[-8.1,-0.3,0.3],[-5.3,-2.5,-1.1],[-5.6,-6.0,-2.3],[-3.1,-8.9,-2.9],[-3.6,-11.6,-5.4],[-2.5,-15.1,-4.3],[1.2,-15.5,-4.8],[1.3,-11.9,-6.1],[2.1,-8.4,-5.0],[-0.1,-5.5,-3.9],[-2.5,-3.7,-6.1],[-4.0,-0.3,-5.0],[-7.8,-0.5,-5.0],[-9.3,2.8,-3.9],[-9.0,5.9,-1.7],[-11.8,7.7,0.1],[-11.4,11.0,1.9],[-12.6,11.9,5.3],[-16.2,12.7,4.5],[-16.6,10.6,1.3],[-16.8,13.6,-0.9],[-13.7,12.4,-2.9],[-13.3,8.8,-4.1],[-10.4,7.5,-6.3],[-10.3,4.0,-7.8],[-7.7,2.0,-9.7],[-8.7,1.3,-13.3],[-9.0,-2.5,-12.5],[-12.1,-1.9,-10.4],[-13.7,1.2,-11.9],[-17.4,0.8,-12.3],[-17.4,-2.3,-10.1],[-16.1,-1.6,-6.6],[-17.6,1.3,-4.5],[-15.9,2.6,-1.3],[-17.8,4.0,1.7],[-17.2,5.3,5.2],[-19.3,5.3,8.3],[-17.9,8.1,10.5],[-20.4,7.4,13.2],[-19.3,3.7,13.7],[-15.6,4.4,12.9],[-15.9,1.9,10.1],[-14.7,1.5,6.5],[-16.6,-0.5,3.9],[-16.0,-1.7,0.3],[-18.9,-2.9,-1.9],[-17.6,-5.4,-4.4],[-20.1,-5.8,-7.3],[-19.7,-7.8,-10.6],[-17.0,-10.1,-9.1],[-14.6,-11.5,-11.7],[-12.1,-14.4,-11.3],[-9.2,-11.9,-11.1],[-10.7,-10.3,-8.0],[-9.5,-13.3,-5.9],[-7.0,-12.1,-3.2],[-6.7,-10.6,0.2],[-8.1,-7.2,0.7],[-6.6,-4.8,3.2],[-7.9,-1.8,5.2],[-5.2,1.0,5.4],[-4.9,4.3,7.2],[-3.5,7.6,5.7],[-3.0,7.3,1.9],[-0.6,7.9,0.2],[1.5,6.8,3.2],[-0.4,3.7,4.3],[1.2,3.8,7.8],[-1.2,1.2,9.2],[-2.5,-2.0,7.7],[-5.1,-4.4,9.2],[-5.1,-8.1,9.2],[-6.8,-8.3,5.7],[-9.6,-10.6,4.6],[-9.7,-13.2,1.8],[-12.0,-12.9,-1.2],[-12.4,-15.8,-3.6],[-14.2,-15.8,-6.9]],"cap8":[[-3.6,26.5,1.1],[-6.3,24.4,-0.3],[-5.9,21.7,2.3],[-2.3,20.7,2.8],[-3.2,17.4,1.2],[-3.3,19.2,-2.1],[-1.3,22.3,-2.0],[-0.2,25.3,0.1]]};
  var fig = document.querySelector('.mol'); if (!fig) return;
  var cv = fig.querySelector('canvas'), chip = fig.querySelector('.mol-chip'), g = cv.getContext('2d');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var VW = 580, VH = 460, S = 8.4, CX = 290, CY = 258;

  function spline(P, n) {
    var out = [], L = P.length;
    for (var i = 0; i < L - 1; i++) {
      var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(L - 1, i + 2)];
      for (var s = 0; s < n; s++) {
        var t = s / n, t2 = t * t, t3 = t2 * t, q = [];
        for (var d = 0; d < 3; d++) q.push(.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3));
        out.push(q);
      }
    }
    out.push(P[L - 1]); return out;
  }
  var Q = { light: spline(M.light, 3), heavy: spline(M.heavy, 3), cap8: spline(M.cap8, 4) };
  var c8 = M.cap8.reduce(function (s, p) { return [s[0] + p[0] / 8, s[1] + p[1] / 8, s[2] + p[2] / 8]; }, [0, 0, 0]);
  var C8 = Q.cap8.map(function (p) { return [p[0] - c8[0], p[1] - c8[1], p[2] - c8[2]]; });

  var yaw = 0, pitch = -.3, ptr = null, dockUntil = 0, boundUntil = 0, capO = 0, last = 0, raf = 0, colors = {};
  function readColors() {
    var cs = getComputedStyle(fig);
    colors = { light: cs.getPropertyValue('--sky').trim() || '#2B48C8', heavy: cs.getPropertyValue('--ink').trim() || '#231D18', cap: cs.getPropertyValue('--gold').trim() || '#A83A22' };
  }
  readColors();
  addEventListener('themechange', function () { readColors(); kick(); });

  function R(p, sc, ox, oy) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var x = cy * p[0] + sy * p[2], z = -sy * p[0] + cy * p[2], y2 = cp * p[1] - sp * z, z2 = sp * p[1] + cp * z;
    return [(ox == null ? CX : ox) + x * (sc || S), (oy == null ? CY : oy) - y2 * (sc || S), z2];
  }

  var P = [];
  for (var i = 0; i < 9; i++) {
    var a = i / 9 * Math.PI * 2 + .3;
    P.push({ a: a, rx: 240 + (i % 3) * 10, ry: 178 + (i % 2) * 8, x: CX + Math.cos(a) * 240, y: CY + Math.sin(a) * 178, vx: 0, vy: 0, spin: i * .7, s: 1, o: 1, mode: 'drift' });
  }

  function resize() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    g.setTransform(cv.width / VW, 0, 0, cv.height / VH, 0, 0);
    kick();
  }

  function step(now, dt) {
    var live = ptr && now - ptr.t < 4 ? ptr : null;
    var ty = live ? (live.u - .5) * 1.6 : (reduce ? 0 : .35 * Math.sin(now * .35));
    var tp = live ? -.3 + (live.v - .5) * .9 : (reduce ? -.3 : -.3 + .08 * Math.sin(now * .27));
    yaw += (ty - yaw) * Math.min(1, dt * 3); pitch += (tp - pitch) * Math.min(1, dt * 3);
    var site = R(c8), docking = now < dockUntil, bound = now < boundUntil;
    capO += ((bound && !docking ? 1 : 0) - capO) * Math.min(1, dt * 5);
    chip.classList.toggle('is-on', bound);
    P.forEach(function (p, i) {
      var tx, ty2, k, sc = 1, op = 1;
      if (p.mode === 'dock' && bound) { tx = site[0] + Math.cos(i * .7) * 5; ty2 = site[1] + Math.sin(i * .7) * 5; k = 46; sc = .5; op = docking ? 1 : 0; }
      else if (live && Math.hypot(p.x - live.x, p.y - live.y) < 170) {
        p.mode = 'follow';
        var aa = now * 2.2 + i * .7, rr = 20 + 8 * (i % 3);
        tx = live.x + Math.cos(aa) * rr; ty2 = live.y + Math.sin(aa) * rr * .8; k = 24 - i;
      } else {
        p.mode = 'drift';
        if (!reduce) p.a += dt * .05 * (i % 2 ? 1 : -1);
        tx = CX + Math.cos(p.a) * p.rx + (reduce ? 0 : Math.sin(now * .7 + i) * 7); ty2 = CY + Math.sin(p.a) * p.ry + (reduce ? 0 : Math.cos(now * .6 + i * 2) * 7); k = 6;
      }
      if (reduce) { p.x = tx; p.y = ty2; p.s = sc; p.o = op; }
      else {
        var c = 2 * Math.sqrt(k);
        p.vx += (k * (tx - p.x) - c * p.vx) * dt; p.vy += (k * (ty2 - p.y) - c * p.vy) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.s += (sc - p.s) * Math.min(1, dt * 8); p.o += (op - p.o) * Math.min(1, dt * 6);
      }
      p.spin += dt * (p.mode === 'drift' ? .3 : 2);
    });
    return site;
  }

  function draw(site) {
    g.clearRect(0, 0, VW, VH);
    g.lineCap = 'round'; g.lineJoin = 'round';
    var B = [];
    ['light', 'heavy'].forEach(function (k) {
      var q = Q[k];
      for (var i = 0; i < q.length - 1; i++) {
        var a = R(q[i]), b = R(q[i + 1]), band = Math.max(0, Math.min(4, Math.floor(((a[2] + b[2]) / 2 + 26) / 52 * 5)));
        (B[band * 2 + (k === 'heavy' ? 1 : 0)] = B[band * 2 + (k === 'heavy' ? 1 : 0)] || []).push(a, b);
      }
    });
    for (var j = 0; j < 10; j++) {
      var seg = B[j]; if (!seg) continue;
      var band = j >> 1;
      g.strokeStyle = (j & 1) ? colors.heavy : colors.light;
      g.globalAlpha = .28 + band * .18; g.lineWidth = 1.1 + band * .75;
      g.beginPath();
      for (var s = 0; s < seg.length; s += 2) { g.moveTo(seg[s][0], seg[s][1]); g.lineTo(seg[s + 1][0], seg[s + 1][1]); }
      g.stroke();
    }
    g.globalAlpha = 1;
    // the binding site, until something is in it
    if (performance.now() / 1000 >= boundUntil) {
      g.strokeStyle = colors.cap; g.globalAlpha = .8; g.lineWidth = 1.2; g.setLineDash([3, 4]);
      g.beginPath(); g.arc(site[0], site[1], 24, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      g.font = '500 12px "IBM Plex Mono", monospace'; g.fillStyle = colors.cap; g.fillText('[binding site]', site[0] + 30, site[1] - 18);
      g.globalAlpha = 1;
    }
    // CAP8 from the model, once docked
    if (capO > .01) {
      g.globalAlpha = capO; g.strokeStyle = colors.cap; g.lineWidth = 4;
      g.beginPath(); Q.cap8.forEach(function (p, i) { var q = R(p); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.stroke();
      g.globalAlpha = 1;
    }
    // the drifting copies: small CAP8 traces, each turning on its own
    P.forEach(function (p) {
      if (p.o < .02) return;
      g.globalAlpha = p.o; g.strokeStyle = colors.cap; g.lineWidth = 2;
      var cy = Math.cos(p.spin), sy = Math.sin(p.spin), sc = 3.1 * p.s;
      g.beginPath();
      C8.forEach(function (q, i) { var x = p.x + (cy * q[0] - sy * q[1]) * sc, y = p.y - (sy * q[0] + cy * q[1]) * sc; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
    });
    g.globalAlpha = 1;
  }

  function frame(t) {
    raf = 0;
    var now = t / 1000, dt = Math.min(.05, last ? now - last : .016); last = now;
    draw(step(now, dt));
    var busy = !reduce || now < boundUntil + 1 || (ptr && now - ptr.t < 2);
    if (busy && inView && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

  var inView = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { inView = e[0].isIntersecting; if (inView) kick(); }).observe(cv);
  document.addEventListener('visibilitychange', kick);
  cv.addEventListener('pointermove', function (e) {
    var r = cv.getBoundingClientRect();
    ptr = { u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height, x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH, t: performance.now() / 1000 };
    kick();
  });
  cv.addEventListener('pointerleave', function () { ptr = null; });
  function dock() { var t = performance.now() / 1000; P.forEach(function (p) { p.mode = 'dock'; }); dockUntil = t + (reduce ? 0 : 1.2); boundUntil = t + 4.8; kick(); }
  cv.addEventListener('click', dock);
  cv.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dock(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); ptr = { u: e.key === 'ArrowLeft' ? .2 : .8, v: .5, x: -999, y: -999, t: performance.now() / 1000 }; kick(); }
  });
  addEventListener('resize', resize);
  resize();
})();
