/* Waris and the Cat pop up from random edges. Each stays 1.5 s. Catch one
   (click or tap) and the next appears at once; miss it and the next comes a
   little later. A counter keeps score for as long as you stay on the page.
   Skipped for visitors who prefer reduced motion; paused while the tab is
   hidden. */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var cast = [
    { src: '/waldo-singh.webp', w: 277, h: 360 },
    { src: '/cat-singh.webp',   w: 369, h: 520 }
  ];
  var edges = ['bottom', 'left', 'right'];
  var HOLD = 1500;

  /* Unlocks. Add a line here as each page is built. */
  var UNLOCKS = [
    { at: 5,  url: 'ms-docking.html', name: 'dock it yourself' },
    { at: 10, url: null,              name: 'something else' },
    { at: 15, url: null,              name: 'one more thing' }
  ];
  var KEY = 'ks-catches';
  var caught = 0, current = null, counter = null;
  try { caught = parseInt(localStorage.getItem(KEY), 10) || 0; } catch (e) { caught = 0; }

  function unlocked() {
    return UNLOCKS.filter(function (u) { return caught >= u.at && u.url; });
  }
  function render() {
    if (!counter) {
      counter = document.createElement('div');
      counter.className = 'catch-count';
      counter.setAttribute('aria-live', 'polite');
      document.body.appendChild(counter);
    }
    var got = unlocked(), next = null;
    for (var i = 0; i < UNLOCKS.length; i++) { if (caught < UNLOCKS[i].at) { next = UNLOCKS[i]; break; } }
    var html = '<span class="catch-n">' + caught + (caught === 1 ? ' catch' : ' catches') + '</span>';
    if (got.length) {
      var last = got[got.length - 1];
      html += ' <a href="' + last.url + '">' + last.name + ' &rarr;</a>';
    }
    if (next) html += '<span class="catch-next">' + (next.at - caught) + ' to go</span>';
    counter.innerHTML = html;
  }
  function score() {
    caught += 1;
    try { localStorage.setItem(KEY, caught); } catch (e) {}
    render();
  }
  if (caught > 0) render();

  function appear() {
    var who  = cast[Math.random() < 0.5 ? 0 : 1];
    var edge = edges[Math.floor(Math.random() * edges.length)];
    var img  = document.createElement('img');
    img.src = who.src; img.width = who.w; img.height = who.h;
    img.alt = ''; img.setAttribute('aria-hidden', 'true');
    img.className = 'popup popup--' + edge;
    if (edge === 'bottom') img.style.left = (8 + Math.random() * 72) + '%';
    else                   img.style.top  = (12 + Math.random() * 60) + '%';

    var done = false, timer;
    function leave(wasCaught) {
      if (done) return; done = true;
      clearTimeout(timer);
      img.classList.remove('is-in');
      if (wasCaught) img.classList.add('is-caught');
      setTimeout(function () { img.remove(); }, 600);
      current = null;
      if (wasCaught) { score(); appear(); }          /* next one right away */
      else           { later(5000, 12000); }          /* missed: a short breather */
    }
    img.addEventListener('pointerdown', function (e) { e.preventDefault(); leave(true); });

    current = img;
    document.body.appendChild(img);
    requestAnimationFrame(function () { requestAnimationFrame(function () { img.classList.add('is-in'); }); });
    timer = setTimeout(function () { leave(false); }, HOLD);
  }

  var quiet = document.body.hasAttribute('data-no-popups');   /* score still shows */

  function later(min, max) {
    if (quiet) return;
    setTimeout(function () {
      if (document.hidden) { later(1500, 3000); return; }
      if (!current) appear();
    }, min + Math.random() * (max - min));
  }
  later(2000, 6000);
})();
