/* The intro: a few seconds of welcome when someone arrives at the homepage, then out of the way.
   One of three, picked at random each time:
   - procession: figures cut from Mughal, Persian and Sikh paintings parade before the walls of
     Surat (arrival/procession.js)
   - unfold: a protein whose surface is this very page turns, then unfolds into it (arrival/unfold.js)
   - darbar: a painted court welcome, drawn from scratch (arrival/darbar.js)
   It plays when the visitor arrives at a homepage from outside the site; not when they come from
   another page here, reload or go back, follow a link to a #section, or their device asks for
   reduced motion or reduced data, and never for crawlers. Any key, click, tap or scroll ends it at
   once, and there is a Skip button. The footer, next to Admin, can play any of the three;
   ?arrival=procession|unfold|darbar forces one and ?arrival=off none. Loaded in <head> right after
   home.js, without defer, so it can hide the page before the first paint; the parts that draw are
   fetched only when an intro will actually play. */
(function () {
  'use strict';
  var KINDS = ['procession', 'unfold', 'darbar'], NAMES = { procession: 'Procession', unfold: 'Protein', darbar: 'Darbar' }, V = 2;
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

  function pick() { return KINDS[Math.floor(Math.random() * KINDS.length)]; }
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
    '.arv-skip:focus-visible,.arv-intros button:focus-visible{outline:2px solid #2A6FAE;outline-offset:2px}' +
    '.arv-intros button{margin:0;padding:0;border:0;background:none;font:inherit;color:inherit;text-decoration:underline;' +
    'text-underline-offset:.15em;cursor:pointer}';
  document.head.appendChild(style);

  var running = false, skipBtn = null, cover = null;
  function reveal() {                              // show the page at once, without its own fade-ins
    if (!root.classList.contains('arv-cover')) return;
    var st = document.createElement('style');
    st.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(st);
    root.classList.remove('arv-cover');
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
  function play(kind) {
    if (running) return;
    running = true;
    A.started = A.cancelled = false;
    clearTimeout(cover);
    cover = setTimeout(function () { if (!A.started) { A.cancelled = true; done(); } }, 4000);   // never leave the page hidden
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
  A.play = function (kind) {
    if (running) return;
    scrollTo({ top: 0, left: 0, behavior: 'instant' });    // an intro always lands on the top of the homepage
    root.classList.add('arv-cover');
    play(KINDS.indexOf(kind) >= 0 ? kind : pick());
  };

  var kind = KINDS.indexOf(forced) >= 0 ? forced : forced !== 'off' && eligible() ? pick() : null;
  if (kind) {
    root.classList.add('arv-cover');
    cover = setTimeout(done, 4000);                // in case the page never finishes loading
    if (kind === 'procession') ['arrival/fort.jpg', 'arrival/cast.webp', 'arrival/welcome.webp'].forEach(function (f) { new Image().src = base + f; });
    document.addEventListener('DOMContentLoaded', function () {
      if (scrollY > 0) { done(); return; }
      play(kind);
    });
  }

  // "Intro: Procession · Protein · Darbar" in the footer, after the Admin link
  document.addEventListener('DOMContentLoaded', function () {
    var admin = document.querySelector('a[href="admin.html"]');
    if (!admin) return;
    var span = document.createElement('span');
    span.className = 'arv-intros';
    span.appendChild(document.createTextNode(' · Intro: '));
    KINDS.forEach(function (k, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = NAMES[k];
      b.title = 'Play the ' + NAMES[k].toLowerCase() + ' intro';
      b.addEventListener('click', function () { A.play(k); });
      span.appendChild(b);
      if (i < KINDS.length - 1) span.appendChild(document.createTextNode(' · '));
    });
    admin.parentNode.insertBefore(span, admin.nextSibling);
  });
})();
