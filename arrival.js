/* The welcome. Arriving at a homepage from outside the site, a visitor gets a short, quiet one:
   the name on a dark screen, letters rising, a thin line with light passing along it, then the page
   fades up (about two seconds, sooner if they press a key, click or scroll).
   The three long intros play only when asked for, from the long way round (curious.html):
   - procession: figures cut from Mughal, Persian and Sikh paintings parade before the walls of
     Surat (arrival/procession.js)
   - unfold: the page threaded along Kabir's antibody structure; a simulation unfolds it and its
     chains settle onto the page (arrival/unfold.js)
   - darbar: a painted court welcome, drawn from scratch (arrival/darbar.js)
   The quiet welcome is skipped when the visitor comes from another page here, reloads or goes back,
   follows a link to a #section, or their device asks for reduced motion or reduced data, and never
   shown to crawlers. ?arrival=procession|unfold|darbar|quiet forces one and ?arrival=off none.
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
    // the quiet welcome
    'html.arv-q body{background:#16130F!important}' +
    '#arv.arv-q{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'gap:.9rem;background:#16130F;color:#EEE7DA;transition:opacity .7s ease,visibility 0s linear .7s}' +
    '#arv.arv-q.q-out{opacity:0;visibility:hidden}' +
    '.q-w{margin:0;font:400 clamp(1.8rem,4.6vw,2.7rem)/1.1 Newsreader,Georgia,serif;letter-spacing:.05em;white-space:nowrap}' +
    '.q-w span{display:inline-block;opacity:0;transform:translateY(14px);animation:qIn 1.1s cubic-bezier(.2,.9,.3,1) forwards;' +
    'animation-delay:calc(var(--i) * 65ms)}' +
    '.q-w .sp{width:.32em}' +
    '.q-pa{margin:0;font:400 1.05rem/1.5 "Noto Serif Gurmukhi",serif;color:#F0957C;opacity:0;animation:qFade .9s ease .8s forwards}' +
    '.q-bar{position:relative;display:block;width:min(240px,44vw);height:1px;margin-top:1.4rem;background:rgba(238,231,218,.14);overflow:hidden}' +
    '.q-bar i{position:absolute;left:0;top:0;width:35%;height:100%;' +
    'background:linear-gradient(90deg,rgba(238,231,218,0),rgba(238,231,218,.85),rgba(238,231,218,0));animation:qSlide 2s cubic-bezier(.4,0,.2,1) infinite}' +
    '@keyframes qIn{60%,100%{opacity:1;transform:none}}@keyframes qFade{to{opacity:1}}' +
    '@keyframes qSlide{from{transform:translateX(-120%)}to{transform:translateX(360%)}}';
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
  // the quiet welcome: ends once the page has loaded and the name has had time to settle
  function quiet(end) {
    var o = document.createElement('div'), name = 'Kabir Singh', w = '', t0 = performance.now(), over = false;
    for (var i = 0; i < name.length; i++) w += name[i] === ' ' ? '<span class="sp"></span>' : '<span style="--i:' + i + '">' + name[i] + '</span>';
    o.id = 'arv'; o.className = 'arv-q'; o.setAttribute('aria-hidden', 'true');
    o.innerHTML = '<p class="q-w">' + w + '</p><p class="q-pa" lang="pa">\u0a15\u0a2c\u0a40\u0a30 \u0a38\u0a3f\u0a70\u0a18</p><span class="q-bar"><i></i></span>';
    document.body.appendChild(o);
    A.started = true;
    function finish() {
      if (over) return; over = true;
      end();                                            // the page is shown beneath; the screen fades off it
      requestAnimationFrame(function () {
        o.classList.add('q-out');
        setTimeout(function () { o.remove(); }, 800);
      });
    }
    A.skip = finish;
    function ready() { setTimeout(finish, Math.max(0, 1900 - (performance.now() - t0))); }
    if (document.readyState === 'complete') ready(); else addEventListener('load', ready);
    setTimeout(finish, 3200);                           // a slow page still gets shown
  }
  function play(kind) {
    if (running) return;
    running = true;
    A.started = A.cancelled = false;
    clearTimeout(cover);
    cover = setTimeout(function () { if (!A.started) { A.cancelled = true; done(); } }, 4000);   // never leave the page hidden
    EVENTS.forEach(function (ev) { addEventListener(ev, onInput, { capture: true, passive: true }); });
    if (kind === 'quiet') return quiet(done);
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
