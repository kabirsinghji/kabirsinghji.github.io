/* ms_docking — put CAP8 back where it belongs.
   The antibody Fv is fixed. You move the peptide in the plane of the screen
   and spin it; depth is locked to the plane of the real complex, so this is
   a three-degrees-of-freedom puzzle, not real docking. Contacts and clashes
   are counted over all heavy atoms within 20 A of the site, so the numbers
   are honest even though the search is not. */
(function () {
  var D = window.DOCK;
  var canvas = document.getElementById('dock');
  if (!D || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var COL = { light: [155, 168, 186], heavy: [102, 118, 142], site: [27, 77, 62],
              C: [27, 77, 62], N: [72, 108, 190], O: [190, 70, 62], paper: [244, 246, 248] };
  var CONTACT = 4.0, CLASH = 2.6, WIN_RMSD = 1.5;

  /* ---- data ---- */
  function triples(a) { var o = []; for (var i = 0; i < a.length; i += 3) o.push([a[i], a[i + 1], a[i + 2]]); return o; }
  var pep = triples(D.pep), near = triples(D.near), site = triples(D.site);
  var trace = triples(D.trace);
  var pc = pep.reduce(function (s, p) { return [s[0] + p[0] / pep.length, s[1] + p[1] / pep.length, s[2] + p[2] / pep.length]; }, [0, 0, 0]);
  var local = pep.map(function (p) { return [p[0] - pc[0], p[1] - pc[1], p[2] - pc[2]]; });

  /* spatial hash over the antibody atoms near the site */
  var CELL = 4.5, grid = {};
  near.forEach(function (a, i) {
    var k = Math.floor(a[0] / CELL) + ':' + Math.floor(a[1] / CELL) + ':' + Math.floor(a[2] / CELL);
    (grid[k] || (grid[k] = [])).push(i);
  });

  /* ---- state: peptide offset from the true pose ---- */
  var st = { dx: 0, dy: 0, th: 0 }, solved = false, showSite = false;
  function randomStart() {
    /* start clear of the Fv: off to one side, or above. Reject any start that
       begins buried in the protein. */
    for (var tries = 0; tries < 12; tries++) {
      var side = Math.floor(Math.random() * 3);
      if (side === 0)      { st.dx = -30 + Math.random() * 9;  st.dy = -6 + Math.random() * 15; }
      else if (side === 1) { st.dx =  21 + Math.random() * 9;  st.dy = -6 + Math.random() * 15; }
      else                 { st.dx = -10 + Math.random() * 20; st.dy =  8 + Math.random() * 6;  }
      st.th = (Math.random() * 2 - 1) * 2.6;
      if (score(placed()).clashes === 0) break;
    }
    solved = false; canvas.classList.remove('is-solved');
    document.getElementById('dock-done').hidden = true;
  }
  function placed() {
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
      var a = cur[i], b = pep[i], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
      t += dx * dx + dy * dy + dz * dz;
    }
    return Math.sqrt(t / cur.length);
  }
  function score(cur) {
    var contacts = 0, clashes = 0;
    for (var i = 0; i < cur.length; i++) {
      var a = cur[i], gx = Math.floor(a[0] / CELL), gy = Math.floor(a[1] / CELL), gz = Math.floor(a[2] / CELL);
      var touched = false;
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) for (var oz = -1; oz <= 1; oz++) {
        var cell = grid[(gx + ox) + ':' + (gy + oy) + ':' + (gz + oz)];
        if (!cell) continue;
        for (var k = 0; k < cell.length; k++) {
          var b = near[cell[k]], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
          var d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < CLASH * CLASH) clashes++;
          else if (d2 < CONTACT * CONTACT) touched = true;
        }
      }
      if (touched) contacts++;
    }
    return { contacts: contacts, clashes: clashes };
  }

  /* ---- drawing ---- */
  function spline(pts) {
    var out = [], n = pts.length;
    for (var i = 0; i < n - 1; i++) {
      var p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n - 1)];
      for (var s = 0; s < 4; s++) {
        var t = s / 4, t2 = t * t, t3 = t2 * t, q = [];
        for (var k = 0; k < 3; k++) q[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        out.push(q);
      }
    }
    out.push(pts[n - 1]);
    return out;
  }
  var chains = [{ pts: spline(trace.slice(0, D.split)), col: COL.light },
                { pts: spline(trace.slice(D.split)),    col: COL.heavy }];

  var W = 0, H = 0, S = 1, cx = 0, cy = 0;
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* world window: x -46..46, y -24..50 A — the Fv plus the area starts use */
    S = Math.min(W / 92, H / 74);
    cx = W / 2; cy = H / 2 + 13 * S;
  }
  function sx(p) { return cx + p[0] * S; }
  function sy(p) { return cy - p[1] * S; }
  function fog(col, z, amt) {
    var f = amt * (1 - z / 26) / 2;
    return 'rgb(' + Math.round(col[0] + (COL.paper[0] - col[0]) * f) + ',' + Math.round(col[1] + (COL.paper[1] - col[1]) * f) + ',' + Math.round(col[2] + (COL.paper[2] - col[2]) * f) + ')';
  }
  function draw(cur) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    chains.forEach(function (ch) {
      for (var i = 1; i < ch.pts.length; i++) {
        var a = ch.pts[i - 1], b = ch.pts[i];
        ctx.beginPath();
        ctx.strokeStyle = fog(ch.col, (a[2] + b[2]) / 2, 0.4);
        ctx.lineWidth = (0.5 + 0.3 * (a[2] + 26) / 52) * S;
        ctx.moveTo(sx(a), sy(a)); ctx.lineTo(sx(b), sy(b)); ctx.stroke();
      }
    });
    if (showSite && !solved) {
      site.forEach(function (p) {
        ctx.beginPath(); ctx.strokeStyle = 'rgba(27,77,62,.55)'; ctx.lineWidth = 1.5;
        ctx.arc(sx(p), sy(p), 0.9 * S, 0, 6.2832); ctx.stroke();
      });
    }
    for (var b = 0; b < D.bonds.length; b += 2) {
      var p = cur[D.bonds[b]], q = cur[D.bonds[b + 1]];
      ctx.beginPath();
      ctx.strokeStyle = fog(COL.C, (p[2] + q[2]) / 2, 0.3);
      ctx.lineWidth = 0.4 * S;
      ctx.moveTo(sx(p), sy(p)); ctx.lineTo(sx(q), sy(q)); ctx.stroke();
    }
    cur.forEach(function (p, i) {
      ctx.beginPath();
      ctx.fillStyle = fog(COL[D.el[i]] || COL.C, p[2], 0.3);
      ctx.arc(sx(p), sy(p), 0.38 * S, 0, 6.2832); ctx.fill();
    });
  }

  /* ---- loop ---- */
  var out = { r: document.getElementById('out-rmsd'), c: document.getElementById('out-contacts'), x: document.getElementById('out-clashes') };
  function update() {
    var cur = placed(), r = rmsd(cur), sc = score(cur);
    draw(cur);
    out.r.textContent = r.toFixed(1) + ' \u00c5';
    out.c.textContent = sc.contacts;
    out.x.textContent = sc.clashes;
    out.x.classList.toggle('is-bad', sc.clashes > 0);
    if (!solved && r < WIN_RMSD) {
      solved = true;
      st.dx = 0; st.dy = 0; st.th = 0;
      draw(placed());
      var f = score(pep);
      out.r.textContent = '0.0 \u00c5'; out.c.textContent = f.contacts; out.x.textContent = f.clashes;
      out.x.classList.toggle('is-bad', f.clashes > 0);
      canvas.classList.add('is-solved');
      document.getElementById('dock-done').hidden = false;
    }
  }

  /* ---- interaction ---- */
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
    var step = e.shiftKey ? 2 : 0.6, k = e.key, done = true;
    if (k === 'ArrowLeft') st.dx -= step; else if (k === 'ArrowRight') st.dx += step;
    else if (k === 'ArrowUp') st.dy += step; else if (k === 'ArrowDown') st.dy -= step;
    else if (k === 'q' || k === 'Q') st.th -= 0.08;
    else if (k === 'e' || k === 'E') st.th += 0.08;
    else done = false;
    if (done) { e.preventDefault(); update(); }
  });
  document.getElementById('spin-left').addEventListener('click', function () { if (!solved) { st.th -= 0.12; update(); } });
  document.getElementById('spin-right').addEventListener('click', function () { if (!solved) { st.th += 0.12; update(); } });
  document.getElementById('dock-hint').addEventListener('click', function () {
    showSite = !showSite;
    this.textContent = showSite ? 'Hide the site' : 'Show me the site';
    update();
  });
  document.getElementById('dock-reset').addEventListener('click', function () { randomStart(); update(); });
  window.addEventListener('resize', function () { resize(); update(); });

  resize(); randomStart(); update();
})();
