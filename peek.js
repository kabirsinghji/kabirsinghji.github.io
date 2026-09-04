/* Waris and the Cat pop up somewhere random on every page: one of the two,
   from a random edge, after a random pause, for a few seconds. Click to
   send them away early. Skipped for visitors who prefer reduced motion. */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var who = Math.random() < 0.5
    ? { src: '/waldo-singh.webp', w: 277, h: 360 }
    : { src: '/cat-singh.webp',   w: 369, h: 520 };
  var edge = ['bottom', 'left', 'right'][Math.floor(Math.random() * 3)];

  var img = document.createElement('img');
  img.src = who.src; img.width = who.w; img.height = who.h;
  img.alt = ''; img.setAttribute('aria-hidden', 'true');
  img.className = 'popup popup--' + edge;
  if (edge === 'bottom') img.style.left = (8 + Math.random() * 72) + '%';
  else                   img.style.top  = (12 + Math.random() * 60) + '%';

  var gone = false;
  function hide() {
    if (gone) return; gone = true;
    img.classList.remove('is-in');
    setTimeout(function () { img.remove(); }, 800);
  }
  img.addEventListener('pointerdown', hide);

  setTimeout(function () {
    document.body.appendChild(img);
    requestAnimationFrame(function () { requestAnimationFrame(function () { img.classList.add('is-in'); }); });
    setTimeout(hide, 3800);
  }, 3000 + Math.random() * 7000);
})();
