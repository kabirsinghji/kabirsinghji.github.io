/* The welcome. Arriving at a homepage from outside the site, a visitor meets a front door that waits:
   the seal (QUAERENDO, "by seeking", over KABIR and SINGH, EST. MMV at the sides) around a trefoil
   knot drawn over and under, which turns one way for as long as the page is open and speeds up while
   the pointer is on it; then an Enter button and links straight to each part of the site. Enter, Return, Escape or scrolling down opens the homepage; a link goes where it says.
   The door first appears pressed in clay, on a modelling board, the knot a rolled snake that moves in
   held frames at twelve a second. Pressing the knot plays the long way in, a stop-motion clay film
   (arrival/clay-intro.mp4): proteins drop into a capsule that is capped and taken with water, then
   followed down the throat to an organ the colour of the page. The film lands back on the plain door, and ten seconds later
   its knot turns back to clay, ready to be pressed again.
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
    '#arv .q-enter{min-height:46px;padding:0 26px;border:1px solid currentColor;border-radius:999px;background:none;color:inherit;' +
    'font:500 13px/1 var(--mono);letter-spacing:.24em;cursor:pointer;transition:background .2s,color .2s;animation-delay:.4s}' +
    '#arv .q-enter:hover{background:var(--ink);color:var(--bg)}' +
    '#arv .q-links{display:flex;flex-wrap:wrap;justify-content:center;gap:12px 30px;font:400 12px/1.4 var(--mono);letter-spacing:.2em;animation-delay:.5s}' +
    '#arv .q-links a{color:inherit;text-decoration:none}#arv .q-links a:hover,#arv .q-links a:focus-visible{color:var(--sky)}' +
    '#arv .q-hint{margin:0;font:400 10.5px/1 var(--mono);letter-spacing:.16em;color:var(--soft);animation-delay:.6s}' +
    '#arv :focus-visible{outline:2px solid var(--sky);outline-offset:3px}' +
    // the clay door, and the film
    '#arv.arv-q.q-clay{background:#E8DDCB;color:#3B2E26;--soft:#7A6A5C;--sky:#2E4B9A}' +
    '#arv.q-clay::after{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(120% 90% at 50% 40%,transparent 55%,rgba(60,40,25,.22) 100%)}' +
    '#arv.q-clay .q-words,#arv .q-kg.clay{filter:url(#qClay)}' +
    '#arv.q-clay .q-enter{border:0;background:#F2EADD;box-shadow:0 3px 0 #CDBFA9,0 8px 18px rgba(60,40,25,.18);transition:transform .15s,box-shadow .15s}' +
    '#arv.q-clay .q-enter:hover{background:#F2EADD;color:inherit;transform:translateY(1px);box-shadow:0 2px 0 #CDBFA9,0 5px 12px rgba(60,40,25,.18)}' +
    '#arv .q-hit{cursor:pointer;outline:none}#arv .q-hit:not(.on){pointer-events:none;cursor:default}' +
    '#arv:not(.q-kc) .q-kh{display:none}' +
    '#arv .q-words{transition:opacity .35s}#arv.q-play .q-words{opacity:0}' +
    '#arv.q-play .q-enter,#arv.q-play .q-links,#arv.q-play .q-hint{animation:none;opacity:0;pointer-events:none}' +
    '#arv .q-kg.pop{animation:qPop .34s steps(4,end)}' +
    '@keyframes qPop{0%{transform:scale(.82)}35%{transform:scale(1.1)}70%{transform:scale(.96)}100%{transform:none}}' +
    '#arv .q-film{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;background:#E8DDCB;opacity:0;visibility:hidden;transition:opacity .25s;z-index:3}' +
    '#arv .q-film.on{opacity:1;visibility:visible}' +
    '@media (max-aspect-ratio:1/1){#arv .q-film{object-fit:contain}}' +
    '#arv .q-skip{position:fixed;top:max(20px,env(safe-area-inset-top));right:max(24px,env(safe-area-inset-right));z-index:4;min-height:34px;padding:0 14px;' +
    'border:1px solid #3B2E26;border-radius:999px;background:#F2EADD;color:#3B2E26;font:500 11px/1 var(--mono);letter-spacing:.2em;cursor:pointer;opacity:0;visibility:hidden;transition:opacity .3s}' +
    '#arv .q-skip.on{opacity:1;visibility:visible}' +
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
  // the seal: the words are set once; only the knot moves, one way. In clay it moves in held frames,
  // twelve a second, and the clay boils between them; drawn plain it turns every frame.
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
    svg.innerHTML = '<defs><path id="qT" d="' + a1.d + '"></path><path id="qB" d="' + a2.d + '"></path>' +
      // clay for small pieces: puff, sheen, fingerprints, a slight boil
      '<filter id="qClay" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">' +
      '<feTurbulence class="q-boil" type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="1" result="n"></feTurbulence>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="d"></feDisplacementMap>' +
      '<feGaussianBlur in="d" stdDeviation="1.1" result="h"></feGaussianBlur>' +
      '<feSpecularLighting in="h" surfaceScale="3" specularConstant=".55" specularExponent="16" lighting-color="#ffffff" result="s"><feDistantLight azimuth="225" elevation="48"></feDistantLight></feSpecularLighting>' +
      '<feComposite in="s" in2="d" operator="in" result="s2"></feComposite>' +
      '<feDiffuseLighting in="h" surfaceScale="3" diffuseConstant="1" lighting-color="#ffffff" result="l"><feDistantLight azimuth="225" elevation="55"></feDistantLight></feDiffuseLighting>' +
      '<feComposite in="d" in2="l" operator="arithmetic" k1=".75" k2=".35" result="lit"></feComposite>' +
      '<feComposite in="lit" in2="d" operator="in" result="lit2"></feComposite>' +
      '<feComposite in="lit2" in2="s2" operator="arithmetic" k2="1" k3=".45"></feComposite></filter></defs>' +
      '<g class="q-words">' +
      '<text x="120" y="54" text-anchor="middle" letter-spacing="1.2" font-size="9" ' + F + '>QUAERENDO</text>' +
      '<text font-size="28" ' + F + '><textPath href="#qT" textLength="' + a1.len + '" lengthAdjust="spacing">KABIR</textPath></text>' +
      '<text font-size="28" ' + F + '><textPath href="#qB" textLength="' + a2.len + '" lengthAdjust="spacing" dominant-baseline="hanging">SINGH</textPath></text>' +
      '<text x="70" y="126.7" text-anchor="middle" font-size="7.6" letter-spacing=".4" ' + F + '>EST.</text>' +
      '<text x="170" y="126.7" text-anchor="middle" font-size="7.6" letter-spacing=".4" ' + F + '>MMV</text></g>' +
      '<g transform="translate(120 124)" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<g class="q-kg"><path class="k0"></path><path class="k1"></path><path class="k2"></path></g>' +
      '<circle class="q-hit" r="29" fill="transparent" pointer-events="all" role="button" aria-label="Take the long way in"></circle></g>';
    var K = [], N = 360;
    for (var i = 0; i < N; i++) { var t = TAU * i / N; K.push([(Math.sin(t) + 2 * Math.sin(2 * t)) / 3.1, (Math.cos(t) - 2 * Math.cos(2 * t)) / 3.1, -Math.sin(3 * t) / 3.1]); }
    var k0 = svg.querySelector('.k0'), k1 = svg.querySelector('.k1'), k2 = svg.querySelector('.k2'), kg = svg.querySelector('.q-kg'), hit = svg.querySelector('.q-hit');
    var boil = svg.querySelector('.q-boil'), st = { t: .6, speed: 1, target: 1, live: true, lock: false, clay: false };
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
    // clay: the rolled snake (on the board, or pressed onto the plain door); otherwise the plain line
    function look(clay, onBoard) {
      st.clay = clay;
      kg.classList.toggle('clay', clay); hit.classList.toggle('on', clay); hit.setAttribute('tabindex', clay ? '0' : '-1');
      k0.style.stroke = clay ? '#8C7A68' : 'currentColor'; k0.setAttribute('stroke-width', clay ? 3.6 : 1.3);
      k1.style.stroke = onBoard ? '#E8DDCB' : 'var(--bg)'; k1.setAttribute('stroke-width', clay ? 7.4 : 4.6);
      k2.style.stroke = clay ? '#4A3A30' : 'currentColor'; k2.setAttribute('stroke-width', clay ? 3.6 : 1.3);
    }
    draw();
    var last = performance.now(), acc = 0, seed = 1;
    function frame(now) {
      if (!st.live) return;
      var dt = Math.min(.05, (now - last) / 1000); last = now; acc += dt;
      st.speed += (st.target - st.speed) * Math.min(1, dt * 3.2);
      st.t += dt * .42 * st.speed;
      if (!st.clay) draw();
      else if (acc >= 1 / 12) { acc = 0; draw(); seed = seed % 3 + 1; boil.setAttribute('seed', seed); }
      requestAnimationFrame(frame);
    }
    if (!reduce.matches) requestAnimationFrame(frame);
    svg.addEventListener('pointerenter', function () { if (!st.lock) st.target = 4; });
    svg.addEventListener('pointerleave', function () { if (!st.lock) st.target = 1; });
    return {
      el: svg, hit: hit, look: look,
      isClay: function () { return st.clay; },
      rush: function (on) {                   // the knot spins up and goes blue as the film starts
        st.lock = on; st.target = on ? 14 : 1;
        if (on) { k0.style.stroke = '#7FA3DC'; k2.style.stroke = '#2E4B9A'; }
      },
      pop: function () { kg.classList.add('pop'); setTimeout(function () { kg.classList.remove('pop'); }, 400); },
      stop: function () { st.live = false; }
    };
  }

  // the front door: waits for the visitor, then fades off the homepage beneath it
  function quiet(end) {
    var o = document.createElement('div'), over = false, s = seal(), hidden = [], playing = false, toClay = null;
    o.id = 'arv'; o.className = 'arv-q q-clay q-kc';
    o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Welcome');
    var links = [['CV', 'cv.html'], ['SCIENCE', 'science.html'], ['HISTORY', 'history.html'], ['ABOUT', 'about.html'], ['THE LONG WAY ROUND', 'curious.html']];
    var wrap = document.createElement('div'); wrap.className = 'q-in q-seal'; wrap.appendChild(s.el);
    o.appendChild(wrap);
    s.look(true, true);
    o.insertAdjacentHTML('beforeend',
      '<button class="q-in q-enter" type="button">ENTER &rarr;</button>' +
      '<nav class="q-in q-links" aria-label="Go straight to">' + links.map(function (l) { return '<a href="' + base + l[1] + '">' + l[0] + '</a>'; }).join('') + '</nav>' +
      '<p class="q-in q-hint">PRESS RETURN TO ENTER<span class="q-kh"> &middot; PRESS THE KNOT FOR THE LONG WAY IN</span></p>' +
      '<video class="q-film" muted playsinline preload="metadata" poster="' + base + 'arrival/clay-intro.jpg" aria-label="The long way in, in stop-motion clay">' +
      '<source src="' + base + 'arrival/clay-intro.mp4" type="video/mp4"><source src="' + base + 'arrival/clay-intro.webm" type="video/webm"></video>' +
      '<button class="q-skip" type="button">SKIP &rarr;</button>');
    Array.prototype.forEach.call(document.body.children, function (c) { if (!c.inert) { c.inert = true; hidden.push(c); } });
    document.body.appendChild(o);
    A.started = true;
    var btn = o.querySelector('.q-enter'), film = o.querySelector('.q-film'), skip = o.querySelector('.q-skip');
    try { btn.focus({ preventScroll: true, focusVisible: false }); } catch (e) { btn.focus(); }
    function finish() {
      if (over) return; over = true;
      clearTimeout(toClay); film.pause();
      removeEventListener('keydown', onKey, true); removeEventListener('wheel', onWheel, { passive: true });
      hidden.forEach(function (c) { c.inert = false; });
      end();                                            // the page is shown beneath; the door fades off it
      requestAnimationFrame(function () {
        o.classList.add('q-out');
        setTimeout(function () { s.stop(); o.remove(); }, 700);
      });
    }
    // the long way in: the knot spins up, the film plays, and lands back on the plain door
    function longWay() {
      if (playing || over || !s.isClay()) return;
      playing = true; clearTimeout(toClay);
      o.classList.add('q-play'); s.rush(true);
      film.preload = 'auto';
      try { film.currentTime = 0; } catch (e) {}
      setTimeout(function () {
        if (!playing) return;
        film.classList.add('on'); skip.classList.add('on');
        var p = film.play(); if (p && p.catch) p.catch(land);
      }, 650);
    }
    function land() {
      if (!playing) return;
      playing = false; film.pause(); film.classList.remove('on'); skip.classList.remove('on');
      o.classList.remove('q-play', 'q-clay', 'q-kc'); s.rush(false); s.look(false, false);
      toClay = setTimeout(function () { s.look(true, false); o.classList.add('q-kc'); s.pop(); }, 10000);
      try { btn.focus({ preventScroll: true }); } catch (e) {}
    }
    function onKey(e) {
      if (playing) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); land(); } return; }
      if (document.activeElement === s.hit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); longWay(); return; }
      if (e.key === 'Escape' || (e.key === 'Enter' && !(document.activeElement && document.activeElement.tagName === 'A'))) { e.preventDefault(); finish(); }
    }
    function onWheel(e) { if (!playing && e.deltaY > 30) finish(); }
    var ty = null;
    o.addEventListener('touchstart', function (e) { ty = e.touches[0].clientY; }, { passive: true });
    o.addEventListener('touchmove', function (e) { if (!playing && ty !== null && ty - e.touches[0].clientY > 60) finish(); }, { passive: true });
    btn.addEventListener('click', finish);
    s.hit.addEventListener('click', longWay);
    s.el.addEventListener('pointerenter', function () { film.preload = 'auto'; });
    film.addEventListener('ended', land);
    skip.addEventListener('click', land);
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
