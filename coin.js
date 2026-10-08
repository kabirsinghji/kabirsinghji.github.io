/* The coin under the hero (tools/build.py why_section). A click turns it over and shows that
   side's story; the matching research half below gets a light highlight (style.css, [data-side]).
   Without this script both stories simply show, one after the other. */
(function () {
  'use strict';
  var coin = document.querySelector('.coin');
  if (!coin) return;
  var stories = document.querySelectorAll('.why-story');
  var hint = document.querySelector('.coin-hint');
  var HINT = {
    molecules: 'Molecules side. Tap the coin for the other story.',
    manuscripts: 'Manuscripts side. Tap the coin to turn it back.'
  };

  function show(side) {
    Array.prototype.forEach.call(stories, function (s) { s.hidden = s.getAttribute('data-side') !== side; });
    if (hint) hint.textContent = HINT[side];
  }
  show('molecules');

  coin.addEventListener('click', function () {
    var flipped = coin.classList.toggle('is-flipped');
    var side = flipped ? 'manuscripts' : 'molecules';
    coin.setAttribute('aria-pressed', String(flipped));
    show(side);
    document.documentElement.setAttribute('data-side', side);
  });

  /* tip it partway over once, when it first comes into view, so it reads as something to turn */
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var seen = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { coin.classList.add('peek'); seen.disconnect(); }
    }, { threshold: 0.6 });
    seen.observe(coin);
  }
})();
