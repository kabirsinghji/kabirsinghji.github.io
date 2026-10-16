/* The homepage comes in five designs: index.html and the four home-*.html pages. Each visit
   picks one at random, unless the visitor has kept one with the switch in the corner (saved
   in localStorage) or the address names one (?design=pdb). A link to a section (#...) keeps
   the default design, which is the only one with those sections. Loaded in <head> without
   defer on every design, so the pick happens before the first paint; the address bar always
   shows the plain homepage address. */
(function () {
  var DESIGNS = [
    { id: 'diptych',   file: './',                  name: 'Diptych' },
    { id: 'timescale', file: 'home-timescale.html', name: 'Timescale' },
    { id: 'folio',     file: 'home-folio.html',     name: 'Folio' },
    { id: 'pdb',       file: 'home-pdb.html',       name: 'PDB file' },
    { id: 'landscape', file: 'home-landscape.html', name: 'Landscape' }
  ];
  var KEY = 'homeDesign';
  var root = document.documentElement;
  var params = new URLSearchParams(location.search);

  function find(id) {
    for (var i = 0; i < DESIGNS.length; i++) if (DESIGNS[i].id === id) return DESIGNS[i];
    return null;
  }
  function kept() { try { return find(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function keep(d) { try { if (d) localStorage.setItem(KEY, d.id); else localStorage.removeItem(KEY); } catch (e) {} }
  function open(d) { location.replace(d.id === 'diptych' ? './?design=diptych' : d.file); }

  var here = find(root.getAttribute('data-home'));
  if (!here) return;

  /* index.html decides which design this visit gets */
  if (here.id === 'diptych') {
    var want = find(params.get('design'));
    if (!want && !location.hash) want = kept() || DESIGNS[Math.floor(Math.random() * DESIGNS.length)];
    if (want && want.id !== 'diptych') {
      root.style.visibility = 'hidden';
      location.replace(want.file);
      return;
    }
  }

  /* whichever design shows, the address reads as the homepage */
  params.delete('design');
  var q = params.toString();
  var clean = './' + (q ? '?' + q : '') + location.hash;
  if (new URL(clean, location.href).href !== location.href) history.replaceState(null, '', clean);

  /* the switch: keep this design, or shuffle to another */
  document.addEventListener('DOMContentLoaded', function () {
    var style = document.createElement('style');
    style.textContent =
      '.hs{position:fixed;left:1rem;bottom:calc(1rem + env(safe-area-inset-bottom,0px));z-index:31;display:flex;align-items:center;gap:.35rem;' +
      'padding:.3rem .3rem .3rem .85rem;border-radius:999px;background:rgba(18,19,22,.88);color:#ECEDEF;' +
      'font:500 12.5px/1.2 "Hanken Grotesk",system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25)}' +
      '.hs-t{white-space:nowrap;color:#C9CDD4}' +
      '.hs button{min-height:36px;padding:0 .8rem;border:1px solid rgba(236,237,239,.4);border-radius:999px;background:transparent;' +
      'color:inherit;font:inherit;cursor:pointer}' +
      '.hs button:hover{border-color:#ECEDEF}' +
      '.hs button[aria-pressed="true"]{background:#ECEDEF;color:#121316;border-color:#ECEDEF}' +
      '.hs button:focus-visible{outline:2px solid #8BBEEA;outline-offset:2px}' +
      '@media (max-width:520px){.hs-t{display:none}.hs{padding-left:.3rem}}' +
      '@media print{.hs{display:none}}';
    document.head.appendChild(style);

    var n = DESIGNS.indexOf(here) + 1;
    var box = document.createElement('div');
    box.className = 'hs';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Homepage design');
    box.innerHTML = '<span class="hs-t">Design ' + n + ' of ' + DESIGNS.length + ' · ' + here.name + '</span>' +
      '<button type="button" class="hs-keep"></button><button type="button" class="hs-shuffle">Shuffle</button>';
    var keepBtn = box.querySelector('.hs-keep');

    function show() {
      var on = kept() === here;
      keepBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      keepBtn.textContent = on ? 'Kept' : 'Keep this one';
      keepBtn.title = on ? 'Let the homepage change again' : 'Show this design every time you visit';
    }
    keepBtn.addEventListener('click', function () { keep(kept() === here ? null : here); show(); });
    box.querySelector('.hs-shuffle').addEventListener('click', function () {
      var others = DESIGNS.filter(function (d) { return d !== here; });
      keep(null);
      open(others[Math.floor(Math.random() * others.length)]);
    });
    show();
    document.body.appendChild(box);
  });
})();
