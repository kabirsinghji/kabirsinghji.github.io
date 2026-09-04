/* Docking puzzle. The protein is fixed, so its surface is pre-rendered as two
   images — one for the material behind the peptide's plane, one for the material
   in front — and the peptide ribbon is drawn between them. You move the peptide
   in the plane of the screen and spin it; depth is locked to the plane of the
   modelled complex, so this is three degrees of freedom, not real docking.
   Contacts and clashes are counted over the protein's heavy atoms near the site. */
(function () {
  var D = window.DOCK;
  var canvas = document.getElementById('dock');
  if (!D || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var GREEN = [27, 77, 62], PAPER = [244, 246, 248];
  /* backbone atoms use atom-scale cutoffs; coarse side-chain centroids need
     larger ones, since one point stands in for a whole side chain */
  var CONTACT = [4.0, 5.0], CLASH = [2.6, 3.2], WIN_RMSD = 1.5;

  function triples(a) { var o = []; for (var i = 0; i < a.length; i += 3) o.push([a[i], a[i + 1], a[i + 2]]); return o; }
  var score0 = triples(D.score), ribbon0 = triples(D.ribbon), near = triples(D.near), site = triples(D.site || []);
  var kinds = D.kinds;
  var pc = [0, 0, 0];
  score0.forEach(function (p) { pc[0] += p[0] / score0.length; pc[1] += p[1] / score0.length; pc[2] += p[2] / score0.length; });
  function localise(pts) { return pts.map(function (p) { return [p[0] - pc[0], p[1] - pc[1], p[2] - pc[2]]; }); }
  var scoreL = localise(score0), ribbonL = localise(ribbon0);

  var CELL = 5.5, grid = {};
  near.forEach(function (a, i) {
    var k = Math.floor(a[0] / CELL) + ':' + Math.floor(a[1] / CELL) + ':' + Math.floor(a[2] / CELL);
    (grid[k] || (grid[k] = [])).push(i);
  });

  var st = { dx: 0, dy: 0, th: 0 }, solved = false, showSite = false;
  function place(local) {
    var c = Math.cos(st.th), s = Math.sin(st.th), out = [];
    for (var i = 0; i < local.length; i++) {
      var p = local[i];
      out.push([pc[0] + st.dx + p[0] * c - p[1] * s, pc[1] + st.dy + p[0] * s + p[1] * c, pc[2] + p[2]]);
    }
    return out;
  }
  function rmsd(cur) {
    var t = 0;
    for (var i = 0; i < cur.length; i++) {
      var a = cur[i], b = score0[i], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
      t += dx * dx + dy * dy + dz * dz;
    }
    return Math.sqrt(t / cur.length);
  }
  function tally(cur) {
    var contacts = 0, clashes = 0;
    for (var i = 0; i < cur.length; i++) {
      var a = cur[i], k = kinds[i], cn = CONTACT[k], cl = CLASH[k];
      var gx = Math.floor(a[0] / CELL), gy = Math.floor(a[1] / CELL), gz = Math.floor(a[2] / CELL), touched = false;
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) for (var oz = -1; oz <= 1; oz++) {
        var cell = grid[(gx + ox) + ':' + (gy + oy) + ':' + (gz + oz)];
        if (!cell) continue;
        for (var j = 0; j < cell.length; j++) {
          var b = near[cell[j]], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < cl * cl) clashes++;
          else if (d2 < cn * cn) touched = true;
        }
      }
      if (touched) contacts++;
    }
    return { contacts: contacts, clashes: clashes };
  }
  var SA = D.start[0], SB = D.start[1], SC = D.start[2], SD = D.start[3];
  function randomStart() {
    for (var tries = 0; tries < 14; tries++) {
      st.dx = (Math.random() < 0.5 ? -1 : 1) * (SA + Math.random() * (SB - SA));
      st.dy = SC + Math.random() * (SD - SC);
      st.th = (Math.random() * 2 - 1) * 2.7;
      if (tally(place(scoreL)).clashes === 0) break;
    }
    solved = false;
    canvas.classList.remove('is-solved');
    document.getElementById('dock-done').hidden = true;
  }

  /* ---------- drawing ---------- */
  var back = new Image(), front = new Image(), ready = 0;
  function onload() { ready++; update(); }
  back.onload = onload; front.onload = onload;
  back.src = D.back; front.src = D.front;

  var W = 0, H = 0, S = 1;
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = W / (D.win[1] - D.win[0]);                 /* pixels per angstrom */
  }
  function sx(p) { return (p[0] - D.win[0]) * S; }
  function sy(p) { return (D.win[3] - p[1]) * S; }

  function closedSpline(pts) {
    var out = [], n = pts.length;
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (var s = 0; s < 5; s++) {
        var t = s / 5, t2 = t * t, t3 = t2 * t, q = [];
        for (var k = 0; k < 3; k++) q[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        out.push(q);
      }
    }
    out.push(out[0]);
    return out;
  }
  function mix(col, f) {
    return 'rgb(' + Math.round(col[0] + (PAPER[0] - col[0]) * f) + ',' +
                    Math.round(col[1] + (PAPER[1] - col[1]) * f) + ',' +
                    Math.round(col[2] + (PAPER[2] - col[2]) * f) + ')';
  }
  function drawRibbon(pts) {
    var path = closedSpline(pts), segs = [];
    for (var i = 1; i < path.length; i++) segs.push({ a: path[i - 1], b: path[i], z: (path[i - 1][2] + path[i][2]) / 2 });
    segs.sort(function (p, q) { return p.z - q.z; });
    var zs = pts.map(function (p) { return p[2]; });
    var lo = Math.min.apply(null, zs), hi = Math.max.apply(null, zs), span = Math.max(hi - lo, 1);
    ctx.lineCap = 'round';
    segs.forEach(function (s) {                       /* halo first, so it reads on any surface */
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(244,246,248,.92)';
      ctx.lineWidth = 1.55 * S;
      ctx.moveTo(sx(s.a), sy(s.a)); ctx.lineTo(sx(s.b), sy(s.b)); ctx.stroke();
    });
    segs.forEach(function (s) {
      var near01 = (s.z - lo) / span;
      ctx.beginPath();
      ctx.strokeStyle = mix(GREEN, 0.42 * (1 - near01));
      ctx.lineWidth = (0.78 + 0.34 * near01) * S;
      ctx.moveTo(sx(s.a), sy(s.a)); ctx.lineTo(sx(s.b), sy(s.b)); ctx.stroke();
    });
  }
  function draw(cur) {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    if (back.complete && back.naturalWidth) ctx.drawImage(back, 0, 0, W, H);
    if (showSite && !solved) {
      site.forEach(function (p) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(27,77,62,.6)'; ctx.lineWidth = 2;
        ctx.arc(sx(p), sy(p), 1.1 * S, 0, 6.2832); ctx.stroke();
      });
    }
    drawRibbon(cur);
    if (front.complete && front.naturalWidth) ctx.drawImage(front, 0, 0, W, H);
  }

  var out = { r: document.getElementById('out-rmsd'), c: document.getElementById('out-contacts'), x: document.getElementById('out-clashes') };
  function update() {
    var sc = place(scoreL), r = rmsd(sc), t = tally(sc);
    draw(place(ribbonL));
    out.r.textContent = r.toFixed(1) + '\u00a0\u00c5';
    out.c.textContent = t.contacts;
    out.x.textContent = t.clashes;
    out.x.classList.toggle('is-bad', t.clashes > 0);
    if (!solved && r < WIN_RMSD) {
      solved = true;
      st.dx = 0; st.dy = 0; st.th = 0;
      draw(place(ribbonL));
      var f = tally(score0);
      out.r.textContent = '0.0\u00a0\u00c5'; out.c.textContent = f.contacts; out.x.textContent = f.clashes;
      out.x.classList.toggle('is-bad', f.clashes > 0);
      canvas.classList.add('is-solved');
      document.getElementById('dock-done').hidden = false;
    }
  }

  /* ---------- interaction ---------- */
  var drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    if (solved) return;
    canvas.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    st.dx += (e.clientX - drag.x) / S; st.dy -= (e.clientY - drag.y) / S;
    drag.x = e.clientX; drag.y = e.clientY;
    update();
  });
  function endDrag() { drag = null; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', function (e) {
    if (solved) return;
    e.preventDefault(); st.th += (e.deltaY > 0 ? 1 : -1) * 0.08; update();
  }, { passive: false });
  canvas.addEventListener('keydown', function (e) {
    if (solved) return;
    var step = e.shiftKey ? 2 : 0.6, k = e.key, hit = true;
    if (k === 'ArrowLeft') st.dx -= step; else if (k === 'ArrowRight') st.dx += step;
    else if (k === 'ArrowUp') st.dy += step; else if (k === 'ArrowDown') st.dy -= step;
    else if (k === 'q' || k === 'Q') st.th -= 0.08;
    else if (k === 'e' || k === 'E') st.th += 0.08;
    else hit = false;
    if (hit) { e.preventDefault(); update(); }
  });
  document.getElementById('spin-left').addEventListener('click', function () { if (!solved) { st.th -= 0.12; update(); } });
  document.getElementById('spin-right').addEventListener('click', function () { if (!solved) { st.th += 0.12; update(); } });
  var hint = document.getElementById('dock-hint');
  if (site.length) {
    hint.addEventListener('click', function () {
      showSite = !showSite;
      this.textContent = showSite ? 'Hide the site' : 'Show me the site';
      update();
    });
  } else { hint.hidden = true; }
  document.getElementById('dock-reset').addEventListener('click', function () { randomStart(); update(); });
  window.addEventListener('resize', function () { resize(); update(); });

  resize(); randomStart(); update();
})();
