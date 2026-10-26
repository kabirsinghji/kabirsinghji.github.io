/* The beat: a small heart monitor that travels with the cursor. It keeps a rate that climbs the
   faster you move and settles when you stop. Rest the cursor and the monitor parks beside it;
   click it then to send it away. The switch in the footer (added here on every page) brings it
   back; the choice is remembered. Only for a mouse or trackpad, never for touch; off by default
   for anyone who asks their device for reduced motion. */
(function () {
  'use strict';
  if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var KEY = 'beat', reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var on = !reduce;
  try { var saved = localStorage.getItem(KEY); if (saved === 'on' || saved === 'off') on = saved === 'on'; } catch (e) {}

  var css = document.createElement('style');
  css.textContent =
    '.beat{position:fixed;left:0;top:0;z-index:40;display:flex;align-items:center;gap:6px;height:26px;padding:0 9px 0 6px;' +
    'border:1px solid rgba(35,29,24,.22);border-radius:999px;background:var(--surface,#FAF7F1);color:var(--gold,#A83A22);' +
    'font:600 11px/1 "IBM Plex Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;box-shadow:0 6px 18px -8px rgba(35,29,24,.45);' +
    'pointer-events:none;cursor:pointer;opacity:0;transition:opacity .25s,border-color .2s;will-change:transform}' +
    '.beat.is-on{opacity:.96}.beat.is-parked{pointer-events:auto}.beat.is-parked:hover{border-color:var(--gold,#A83A22)}' +
    '.beat canvas{display:block;width:52px;height:18px}' +
    '.beat-toggle .dot{display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:var(--gold,#A83A22);vertical-align:1px}' +
    '.beat-toggle[aria-pressed="false"] .dot{background:none;box-shadow:inset 0 0 0 1px currentColor}' +
    '@media print{.beat{display:none!important}}';
  document.head.appendChild(css);

  var chip, cv, g, bpm, W = 52, H = 18, dpr = Math.min(2, window.devicePixelRatio || 1);
  var x = -100, y = -100, vx = 0, vy = 0, px = -100, py = -100, lastMove = 0, speed = 0, parked = false, seen = false;
  var hr = 64, phase = 0, acc = 0, col = [], head = 0, raf = 0, last = 0, shown = '';
  for (var i = 0; i < W; i++) col.push(0);

  function wave(p) {                               // one PQRST complex over phase 0..1
    function q(c, w, a) { var d = (p - c) / w; return a * Math.exp(-d * d); }
    return q(.16, .03, .12) + q(.285, .012, -.14) + q(.31, .011, 1) + q(.335, .012, -.28) + q(.56, .05, .3);
  }

  function build() {
    chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'beat';
    chip.tabIndex = -1;
    chip.setAttribute('aria-hidden', 'true');
    chip.title = 'Click to send the heart monitor away';
    cv = document.createElement('canvas');
    cv.width = W * dpr; cv.height = H * dpr;
    g = cv.getContext('2d'); g.scale(dpr, dpr);
    bpm = document.createElement('span');
    chip.appendChild(cv); chip.appendChild(bpm);
    chip.addEventListener('click', function () { set(false); });
    document.body.appendChild(chip);
  }

  function frame(t) {
    raf = 0;
    if (!on) return;
    var now = t / 1000, dt = Math.min(.05, last ? now - last : .016); last = now;
    var still = now - lastMove;
    // follow the cursor with a little lag; rest it and the monitor parks beside it
    if (!parked && still > .6 && seen) parked = true;
    if (parked && Math.hypot(px - (x + 30), py - (y + 13)) > 120) parked = false;
    if (!parked) {
      var tx = px + 16, ty = py + 20, k = 90, c = 2 * Math.sqrt(k);
      vx += (k * (tx - x) - c * vx) * dt; vy += (k * (ty - y) - c * vy) * dt;
      x += vx * dt; y += vy * dt;
    }
    chip.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    chip.classList.toggle('is-parked', parked);
    // the rate follows how fast the cursor travels: one beat per 130 px; up quickly, down slowly
    var target = still < .15 ? Math.max(64, Math.min(178, speed / 130 * 60)) : 64;
    hr += (target - hr) * Math.min(1, dt * (target > hr ? 3 : .5));
    // a sweep at 60 px/s, each column the loudest point of its slice of the beat
    var per = hr / 60 / 60;
    acc += dt * 60;
    while (acc >= 1) {
      acc -= 1;
      var best = 0;
      for (var s = 0; s < 4; s++) { var v = wave((phase + per * s / 4) % 1); if (Math.abs(v) > Math.abs(best)) best = v; }
      phase = (phase + per) % 1;
      head = (head + 1) % W; col[head] = best;
    }
    g.clearRect(0, 0, W, H);
    g.strokeStyle = getComputedStyle(chip).color; g.lineWidth = 1.3; g.lineJoin = 'round';
    g.beginPath();
    for (var j = 1; j <= W - 4; j++) {               // oldest to newest, with a small gap ahead of the head
      var c2 = (head + 4 + j) % W, yy = 12.5 - col[c2] * 10;
      if (j === 1) g.moveTo(j, yy); else g.lineTo(j, yy);
    }
    g.stroke();
    var txt = Math.round(hr) + '';
    if (txt !== shown) { bpm.textContent = txt; shown = txt; }
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }

  function move(e) {
    var t = performance.now() / 1000, dx = e.clientX - px, dy = e.clientY - py, gap = t - lastMove;
    if (seen && gap > .004 && gap < .25) speed += (Math.hypot(dx, dy) / gap - speed) * Math.min(1, gap * 6);
    else if (gap >= .25) speed = 0;
    if (!seen) { x = e.clientX + 16; y = e.clientY + 20; seen = true; chip && chip.classList.toggle('is-on', on); }
    px = e.clientX; py = e.clientY; lastMove = t;
    if (on && !raf) raf = requestAnimationFrame(frame);
  }

  function set(v) {
    on = v;
    try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) {}
    if (chip) { chip.classList.toggle('is-on', v && seen); if (!v) parked = false; }
    [].forEach.call(document.querySelectorAll('.beat-toggle'), function (b) { b.setAttribute('aria-pressed', v ? 'true' : 'false'); });
    if (v && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  }

  function toggles() {
    // a switch in every footer, plus any .beat-toggle a page already has (curious.html)
    var meta = document.querySelector('.foot .meta');
    if (meta && !meta.querySelector('.beat-toggle')) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'beat-toggle';
      b.innerHTML = '<span class="dot"></span>heartbeat cursor';
      meta.appendChild(document.createTextNode(' · '));
      meta.appendChild(b);
    }
    [].forEach.call(document.querySelectorAll('.beat-toggle'), function (b) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', function () { set(!on); });
    });
  }

  function start() {
    build(); toggles();
    addEventListener('pointermove', move, { passive: true });
    document.addEventListener('mouseleave', function () { chip.classList.remove('is-on'); seen = false; });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && on && !raf) { last = 0; raf = requestAnimationFrame(frame); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
