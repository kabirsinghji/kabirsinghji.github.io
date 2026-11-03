/* The archived homepages: the five designs this site's front page has had (home-*.html). The
   homepage itself is index.html now; these stay one click in, from curious.html's shelf. A small
   bar in the corner says which design this is, steps to the next one, and goes back home. */
(function () {
  var DESIGNS = [
    { id: 'diptych',   file: 'home-diptych.html',   name: 'Diptych' },
    { id: 'timescale', file: 'home-timescale.html', name: 'Timescale' },
    { id: 'folio',     file: 'home-folio.html',     name: 'Folio' },
    { id: 'pdb',       file: 'home-pdb.html',       name: 'PDB file' },
    { id: 'landscape', file: 'home-landscape.html', name: 'Landscape' }
  ];
  var here = null, root = document.documentElement;
  for (var i = 0; i < DESIGNS.length; i++) if (DESIGNS[i].id === root.getAttribute('data-home')) here = DESIGNS[i];
  if (!here) return;

  document.addEventListener('DOMContentLoaded', function () {
    var style = document.createElement('style');
    style.textContent =
      '.hs{position:fixed;left:1rem;bottom:calc(1rem + env(safe-area-inset-bottom,0px));z-index:31;display:flex;align-items:center;gap:.35rem;' +
      'padding:.3rem .3rem .3rem .85rem;border-radius:999px;background:rgba(18,19,22,.88);color:#ECEDEF;' +
      'font:500 12.5px/1.2 "IBM Plex Mono",ui-monospace,monospace;box-shadow:0 6px 20px rgba(0,0,0,.25)}' +
      '.hs-t{white-space:nowrap;color:#C9CDD4}' +
      '.hs a{display:inline-flex;align-items:center;min-height:36px;padding:0 .8rem;border:1px solid rgba(236,237,239,.4);border-radius:999px;color:inherit;text-decoration:none}' +
      '.hs a:hover{border-color:#ECEDEF}' +
      '.hs a:focus-visible{outline:2px solid #8BBEEA;outline-offset:2px}' +
      '@media (max-width:520px){.hs-t{display:none}.hs{padding-left:.3rem}}' +
      '.foot{padding-bottom:2.5rem}' +                /* room for the bar, so it never covers the footer's links */
      '@media print{.hs{display:none}}';
    document.head.appendChild(style);

    var n = DESIGNS.indexOf(here), next = DESIGNS[(n + 1) % DESIGNS.length];
    var box = document.createElement('div');
    box.className = 'hs';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Archived homepage');
    box.innerHTML = '<span class="hs-t">Old homepage ' + (n + 1) + ' of ' + DESIGNS.length + ' · ' + here.name + '</span>' +
      '<a href="' + next.file + '">Next: ' + next.name + '</a><a href="./">Today&rsquo;s homepage</a>';
    document.body.appendChild(box);
  });
})();
