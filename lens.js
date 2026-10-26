/* The history page's opening figure: a Mewar painting with its own line drawing underneath. The
   cursor is a lens that shows the drawing, and somewhere in the night sky the drawing hides the
   antibody from the science page. Touch: drag a finger to move the lens. */
(function () {
  'use strict';
  var stage = document.querySelector('.lens-stage'); if (!stage) return;
  var found = stage.querySelector('.lens-found'), R = 112, HIDE = { x: .255, y: .205 };
  function at(e) {
    var r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    var rad = Math.min(R, r.width * .24);
    stage.style.setProperty('--x', (x * 100).toFixed(2) + '%');
    stage.style.setProperty('--y', (y * 100).toFixed(2) + '%');
    stage.style.setProperty('--r', rad + 'px');
    if (found) found.classList.toggle('is-on', Math.hypot((x - HIDE.x) * r.width, (y - HIDE.y) * r.height) < rad * .62);
  }
  stage.addEventListener('pointermove', at);
  stage.addEventListener('pointerdown', at);
  stage.addEventListener('pointerleave', function () { stage.style.setProperty('--r', '0px'); });
})();
