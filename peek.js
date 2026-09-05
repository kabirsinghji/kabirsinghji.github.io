/* Waris, the Cat, the Maharaja and friends pop up from random edges. Each stays 1.5 s. Catch one
   (click or tap) and the next appears at once; miss it and the next comes a
   little later. A counter keeps score for as long as you stay on the page.
   Skipped for visitors who prefer reduced motion; paused while the tab is
   hidden. */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var cast = [
    { src: '/waldo-singh.webp',     w: 277, h: 360 },
    { src: '/cat-singh.webp',       w: 369, h: 520 },
    { src: '/chill-sikh.webp',      w: 409, h: 520 },
    { src: '/sikh-bear.webp',       w: 306, h: 520 },
    { src: '/polo-bear-daari.webp', w: 296, h: 482 },
    { src: '/ranjit-singh.webp',    w: 213, h: 560 }
  ];
  var edges = ['bottom', 'left', 'right'];
  var HOLD = 1500;

  /* Unlocks. The count is per page — it starts again on every page load — and
     nothing on screen says a reward exists until one appears. */
  var UNLOCKS = [
    { at: 5,  url: 'ms-docking.html', name: 'dock it yourself' },
    { at: 10, url: 'escapades.html',  name: 'latest escapades' }
  ];
  var caught = 0, current = null, counter = null;

  function render() {
    if (!counter) {
      counter = document.createElement('div');
      counter.className = 'catch-count';
      counter.setAttribute('aria-live', 'polite');
      document.body.appendChild(counter);
    }
    var html = '<span class="catch-n">' + caught + (caught === 1 ? ' catch' : ' catches') + '</span>';
    UNLOCKS.forEach(function (u) {
      if (caught >= u.at) html += ' <a href="' + u.url + '">' + u.name + ' &rarr;</a>';
    });
    counter.innerHTML = html;
  }
  function score() { caught += 1; render(); }

  function appear() {
    var who  = cast[Math.floor(Math.random() * cast.length)];
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
