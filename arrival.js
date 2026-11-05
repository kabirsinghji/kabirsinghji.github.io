/* The welcome. Arriving at a homepage from outside the site, a visitor meets a front door that waits:
   the seal (QUAERENDO, "by seeking", over KABIR and SINGH, EST. MMV at the sides) around a trefoil
   knot drawn over and under, which turns one way for as long as the page is open and speeds up while
   the pointer is on it; then an Enter button and links straight to each part of the site. Enter, Return, Escape or scrolling down opens the homepage; a link goes where it says.
   The three long intros play only when asked for, from the long way round (curious.html):
   - procession: figures cut from Mughal, Persian and Sikh paintings parade before the walls of
     Surat (arrival/procession.js)
   - unfold: the page threaded along Kabir's antibody structure; a simulation unfolds it and its
     chains settle onto the page (arrival/unfold.js)
   - darbar: a painted court welcome, drawn from scratch (arrival/darbar.js)
   The front door is skipped when the visitor comes from another page here, reloads or goes back,
   follows a link to a #section, or their device asks for reduced motion or reduced data, and never
   shown to crawlers. ?arrival=procession|unfold|darbar|quiet forces one (quiet is the front door)
   and ?arrival=off none.
   Loaded in <head> without defer, so it can hide the page before the first paint; the long intros
   are fetched only when one will actually play. */
(function () {
  'use strict';
  var KINDS = ['procession', 'unfold', 'darbar'], V = 2;
  var root = document.documentElement, A = window.KSArrival = window.KSArrival || {};
  var base = (document.currentScript && document.currentScript.src || 'arrival.js').replace(/arrival\.js[^/]*$/, '');
  var params = new URLSearchParams(location.search), forced = params.get('arrival');
  if (forced !== null) {                           // a reload should not force it again
    params.delete('arrival');
    var q = params.toString();
    history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash);
  }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // home.js hides the page when it sends this visit on to another design; that page decides, using
  // how the visitor really got here, which home.js hands on (it would otherwise see a hop from here)
  if (root.style.visibility === 'hidden') return;
  var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  var ref = document.referrer, how = nav ? nav.type : 'navigate';
  try {
    var hop = JSON.parse(sessionStorage.getItem('arrivalRef') || 'null');
    sessionStorage.removeItem('arrivalRef');
    if (hop && Date.now() - hop[1] < 5000) { ref = hop[0]; how = hop[2] || 'navigate'; }
  } catch (e) {}

  function eligible() {
    var outside = !ref || ref.indexOf(location.origin + '/') !== 0;
    return outside && how === 'navigate' && !location.hash && !reduce.matches &&
      !(navigator.connection && navigator.connection.saveData) &&
      !/bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(navigator.userAgent);
  }

  var style = document.createElement('style');
  style.textContent = 'html.arv-cover body>*:not(#arv):not(.arv-skip){opacity:0!important}' +
    '.arv-skip{position:fixed;right:max(14px,env(safe-area-inset-right));top:max(12px,env(safe-area-inset-top));z-index:2147483001;' +
    'min-height:36px;padding:0 16px;border:1px solid currentColor;border-radius:999px;background:rgba(250,246,236,.92);color:#3E2E16;' +
    'font:600 13px/1 "Hanken Grotesk",system-ui,sans-serif;cursor:pointer}' +
    '.arv-skip:focus-visible{outline:2px solid #2A6FAE;outline-offset:2px}' +
    // the front door
    'html.arv-q body{background:var(--bg)!important}' +
    '#arv.arv-q{position:fixed;inset:0;z-index:2147483000;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'gap:clamp(18px,3.4vh,30px);padding:max(28px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(28px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));' +
    'background:var(--bg);color:var(--ink);text-align:center;transition:opacity .6s ease,visibility 0s linear .6s}' +
    '#arv.arv-q.q-out{opacity:0;visibility:hidden}' +
    '#arv .q-in{opacity:0;transform:translateY(8px);animation:qIn .8s cubic-bezier(.16,1,.3,1) forwards}' +
    '#arv .q-seal{width:min(240px,56vw);aspect-ratio:144/180;animation-delay:.05s}' +
    '#arv .q-seal svg{display:block;width:100%;height:100%;overflow:visible}' +
    '#arv .k-hit{cursor:pointer;outline:none}#arv .k0,#arv .k2{transition:stroke .4s,stroke-width .4s}' +
    '#arv .q-words,#arv .q-enter,#arv .q-links,#arv .q-hint{transition:opacity .35s}' +
    '#arv.q-play .q-words,#arv.q-play .q-enter,#arv.q-play .q-links,#arv.q-play .q-hint{opacity:0!important;pointer-events:none}' +
    '#arv.q-play .k0,#arv.q-play .k2{stroke:#4E91DD;stroke-width:2.6}' +
    '#arv .q-enter{min-height:46px;padding:0 26px;border:1px solid currentColor;border-radius:999px;background:none;color:inherit;' +
    'font:500 13px/1 var(--mono);letter-spacing:.24em;cursor:pointer;transition:background .2s,color .2s;animation-delay:.4s}' +
    '#arv .q-enter:hover{background:var(--ink);color:var(--bg)}' +
    '#arv .q-links{display:flex;flex-wrap:wrap;justify-content:center;gap:12px 30px;font:400 12px/1.4 var(--mono);letter-spacing:.2em;animation-delay:.5s}' +
    '#arv .q-links a{color:inherit;text-decoration:none}#arv .q-links a:hover,#arv .q-links a:focus-visible{color:var(--sky)}' +
    '#arv .q-hint{margin:0;font:400 10.5px/1 var(--mono);letter-spacing:.16em;color:var(--soft);animation-delay:.6s}' +
    '#arv :focus-visible{outline:2px solid var(--sky);outline-offset:3px}' +
    '@keyframes qIn{to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){#arv .q-in{animation:none;opacity:1;transform:none}}';
  document.head.appendChild(style);

  var running = false, skipBtn = null, cover = null;
  function reveal() {                              // show the page at once, without its own fade-ins
    if (!root.classList.contains('arv-cover')) return;
    var st = document.createElement('style');
    st.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(st);
    root.classList.remove('arv-cover', 'arv-q');
    void document.body.offsetHeight;
    st.remove();
  }
  A.reveal = reveal;
  function onInput(e) {
    if (!running) return;
    if (e.type === 'keydown' && (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Shift')) return;
    if (A.skip) A.skip();
  }
  var EVENTS = ['keydown', 'pointerdown', 'wheel', 'touchstart'];
  function done() {
    running = false;
    A.skip = null;
    reveal();
    clearTimeout(cover);
    if (skipBtn) { skipBtn.remove(); skipBtn = null; }
    EVENTS.forEach(function (ev) { removeEventListener(ev, onInput, true); });
  }
  function load(kind, then) {
    if (A[kind]) return then();
    var s = document.createElement('script');
    s.src = base + 'arrival/' + kind + '.js?v=' + V;
    s.onload = then;
    s.onerror = done;
    document.head.appendChild(s);
  }
  // the seal: the words are set once; only the knot moves, one way, every frame
  function seal() {
    var NS = 'http://www.w3.org/2000/svg', TAU = Math.PI * 2, cx = 120, cy = 124, ang = 24 * Math.PI / 180;
    function arc(r, top) {
      var x0 = cx - r * Math.cos(ang), x1 = cx + r * Math.cos(ang), y = top ? cy - r * Math.sin(ang) : cy + r * Math.sin(ang);
      return { d: 'M ' + x0 + ' ' + y + ' A ' + r + ' ' + r + ' 0 0 ' + (top ? 1 : 0) + ' ' + x1 + ' ' + y, len: (r * (Math.PI - 2 * ang)).toFixed(1) };
    }
    var a1 = arc(37, true), a2 = arc(39, false), F = 'font-family="Newsreader, Georgia, serif" fill="currentColor"';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '48 34 144 180');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', 'Quaerendo, Kabir Singh, established 2005: a seal around a turning knot');
    svg.innerHTML = '<defs><path id="qT" d="' + a1.d + '"></path><path id="qB" d="' + a2.d + '"></path></defs><g class="q-words">' +
      '<text x="120" y="54" text-anchor="middle" letter-spacing="1.2" font-size="9" ' + F + '>QUAERENDO</text>' +
      '<text font-size="28" ' + F + '><textPath href="#qT" textLength="' + a1.len + '" lengthAdjust="spacing">KABIR</textPath></text>' +
      '<text font-size="28" ' + F + '><textPath href="#qB" textLength="' + a2.len + '" lengthAdjust="spacing" dominant-baseline="hanging">SINGH</textPath></text>' +
      '<text x="70" y="126.7" text-anchor="middle" font-size="7.6" letter-spacing=".4" ' + F + '>EST.</text>' +
      '<text x="170" y="126.7" text-anchor="middle" font-size="7.6" letter-spacing=".4" ' + F + '>MMV</text></g>' +
      '<g transform="translate(120 124)" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path class="k0" stroke="currentColor" stroke-width="1.3"></path>' +
      '<path class="k1" style="stroke:var(--bg)" stroke-width="4.6"></path>' +
      '<path class="k2" stroke="currentColor" stroke-width="1.3"></path>' +
      // the knot itself is the way in to the long version; everything else on the door is the short way
      '<circle class="k-hit" r="29" fill="transparent" pointer-events="all" tabindex="0" role="button" aria-label="Take the long way in"></circle></g>';
    var K = [], N = 360;
    for (var i = 0; i < N; i++) { var t = TAU * i / N; K.push([(Math.sin(t) + 2 * Math.sin(2 * t)) / 3.1, (Math.cos(t) - 2 * Math.cos(2 * t)) / 3.1, -Math.sin(3 * t) / 3.1]); }
    var k0 = svg.querySelector('.k0'), k1 = svg.querySelector('.k1'), k2 = svg.querySelector('.k2');
    var st = { t: .6, speed: 1, target: 1, live: true };
    function strands(P, front) {
      var d = '', open = false;
      for (var i = 0; i <= N; i++) {
        var p = P[i % N];
        if ((p[2] >= 0) === front) { d += (open ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); open = true; } else open = false;
      }
      return d;
    }
    function draw() {
      var a = st.t * .62, b = st.t, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), ct = Math.cos(.35), stt = Math.sin(.35), P = [];
      for (var i = 0; i < N; i++) {
        var p = K[i], y = p[1] * ca - p[2] * sa, z = p[1] * sa + p[2] * ca;   // turn about x
        var x = p[0] * cb + z * sb; z = -p[0] * sb + z * cb;                  // and about y
        var y2 = y * ct - z * stt, z2 = y * stt + z * ct;                     // seen from a little above
        var k = 25 / (1 - z2 * .14);
        P.push([x * k, y2 * k, z2]);
      }
      var front = strands(P, true);
      k0.setAttribute('d', strands(P, false)); k1.setAttribute('d', front); k2.setAttribute('d', front);
    }
    draw();
    var last = performance.now();
    function frame(now) {
      if (!st.live) return;
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      st.speed += (st.target - st.speed) * Math.min(1, dt * 3.2);
      st.t += dt * .42 * st.speed;
      draw();
      requestAnimationFrame(frame);
    }
    if (!reduce.matches) requestAnimationFrame(frame);
    svg.addEventListener('pointerenter', function () { if (!st.lock) st.target = 4; });
    svg.addEventListener('pointerleave', function () { if (!st.lock) st.target = 1; });
    var hit = svg.querySelector('.k-hit');
    return { el: svg, hit: hit, stop: function () { st.live = false; },
      boost: function () { st.lock = true; st.target = 14; },
      rect: function () { var r = hit.getBoundingClientRect(), k = .86; return { left: r.left + r.width * (1 - k) / 2, top: r.top + r.height * (1 - k) / 2, width: r.width * k, height: r.height * k }; } };
  }

  // the front door: waits for the visitor, then fades off the homepage beneath it
  function quiet(end) {
    var o = document.createElement('div'), over = false, s = seal(), hidden = [];
    o.id = 'arv'; o.className = 'arv-q';
    o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Welcome');
    var links = [['CV', 'cv.html'], ['SCIENCE', 'science.html'], ['HISTORY', 'history.html'], ['ABOUT', 'about.html'], ['THE LONG WAY ROUND', 'curious.html']];
    var wrap = document.createElement('div'); wrap.className = 'q-in q-seal'; wrap.appendChild(s.el);
    o.appendChild(wrap);
    o.insertAdjacentHTML('beforeend',
      '<button class="q-in q-enter" type="button">ENTER &rarr;</button>' +
      '<nav class="q-in q-links" aria-label="Go straight to">' + links.map(function (l) { return '<a href="' + base + l[1] + '">' + l[0] + '</a>'; }).join('') + '</nav>' +
      '<p class="q-in q-hint">PRESS RETURN TO ENTER</p>');
    Array.prototype.forEach.call(document.body.children, function (c) { if (!c.inert) { c.inert = true; hidden.push(c); } });
    document.body.appendChild(o);
    A.started = true;
    var btn = o.querySelector('.q-enter');
    try { btn.focus({ preventScroll: true, focusVisible: false }); } catch (e) { btn.focus(); }
    function finish() {
      if (over) return; over = true;
      removeEventListener('keydown', onKey, true); removeEventListener('wheel', onWheel, { passive: true });
      hidden.forEach(function (c) { c.inert = false; });
      end();                                            // the page is shown beneath; the door fades off it
      requestAnimationFrame(function () {
        o.classList.add('q-out');
        setTimeout(function () { s.stop(); o.remove(); }, 700);
      });
    }
    function onKey(e) {
      var at = document.activeElement;
      if (at === s.hit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); longWay(); return; }
      if (e.key === 'Escape' || (e.key === 'Enter' && !(at && at.tagName === 'A'))) { e.preventDefault(); finish(); }
    }
    // the long way in: the knot becomes the peptide, and arrival/capsule.js takes it from there
    var playing = false;
    function load(src) {
      return new Promise(function (ok, no) { var t = document.createElement('script'); t.src = src; t.onload = ok; t.onerror = no; document.head.appendChild(t); });
    }
    function longWay() {
      if (over || playing) return;
      if (reduce.matches) return finish();
      playing = true;
      removeEventListener('keydown', onKey, true); removeEventListener('wheel', onWheel, { passive: true });
      o.classList.add('q-play'); s.boost();
      var wait = new Promise(function (ok) { setTimeout(ok, 650); });
      (window.gsap ? Promise.resolve() : load(base + 'arrival/gsap.min.js'))
        .then(function () { return window.KSCapsule ? null : load(base + 'arrival/capsule.js?v=1'); })
        .then(function () { return wait; })
        .then(function () { window.KSCapsule.play({ rect: s.rect(), onCovered: finish }); })
        .catch(finish);
    }
    s.hit.addEventListener('click', longWay);
    function onWheel(e) { if (e.deltaY > 30) finish(); }
    var ty = null;
    o.addEventListener('touchstart', function (e) { ty = e.touches[0].clientY; }, { passive: true });
    o.addEventListener('touchmove', function (e) { if (ty !== null && ty - e.touches[0].clientY > 60) finish(); }, { passive: true });
    btn.addEventListener('click', finish);
    addEventListener('keydown', onKey, true); addEventListener('wheel', onWheel, { passive: true });
    A.skip = finish;
  }
  function play(kind) {
    if (running) return;
    running = true;
    A.started = A.cancelled = false;
    clearTimeout(cover);
    cover = setTimeout(function () { if (!A.started) { A.cancelled = true; done(); } }, 4000);   // never leave the page hidden
    if (kind === 'quiet') return quiet(done);           // the front door listens for its own keys
    EVENTS.forEach(function (ev) { addEventListener(ev, onInput, { capture: true, passive: true }); });
    load(kind, function () {
      if (!running) return;
      A.base = base;
      A[kind](done);
      skipBtn = document.createElement('button');
      skipBtn.type = 'button';
      skipBtn.className = 'arv-skip';
      skipBtn.textContent = 'Skip';
      document.body.appendChild(skipBtn);
    });
  }

  var kind = KINDS.indexOf(forced) >= 0 || forced === 'quiet' ? forced : forced !== 'off' && eligible() ? 'quiet' : null;
  if (kind) {
    root.classList.add('arv-cover');
    if (kind === 'quiet') root.classList.add('arv-q');
    cover = setTimeout(done, 4000);                // in case the page never finishes loading
    if (kind === 'procession') ['arrival/fort.jpg', 'arrival/cast.webp', 'arrival/welcome.webp'].forEach(function (f) { new Image().src = base + f; });
    document.addEventListener('DOMContentLoaded', function () {
      if (scrollY > 0) { done(); return; }
      play(kind);
    });
  }

})();
