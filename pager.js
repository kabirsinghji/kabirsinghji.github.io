/* { and } step through the main pages in menu order and round again: Home, CV, Science,
   History, About (the history subpages count as History). Pointing at one, or focusing it,
   fades the page and shows a rosette with where it goes. With nothing focused, the left and
   right arrow keys do the same. Without hover (phones, tablets) the pair sits under the menu
   with the page names, and a tap shows the rosette for a moment before going. */
(function () {
  'use strict';
  var PAGES = [['./', 'Home'], ['cv.html', 'CV'], ['science.html', 'Science'], ['history.html', 'History'], ['about.html', 'About']];
  var ALSO = { '': 0, 'index.html': 0, 'sikh-studies.html': 3, 'medieval-italy.html': 3, 'history-of-medicine.html': 3 };
  var file = location.pathname.split('/').pop();
  var at = ALSO.hasOwnProperty(file) ? ALSO[file] : -1;
  PAGES.forEach(function (p, i) { if (p[0] === file) at = i; });
  if (at < 0) return;
  var prev = PAGES[(at + PAGES.length - 1) % PAGES.length], next = PAGES[(at + 1) % PAGES.length];
  var root = document.documentElement;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && window.matchMedia('(hover: none)').matches;

  /* eight gold petals, eight blue ones between them, a ring of dots: a manuscript rosette */
  function petals(cls, d, from) {
    var out = '';
    for (var i = 0; i < 8; i++) out += '<path class="' + cls + '" d="' + d + '" transform="rotate(' + (from + 45 * i) + ' 60 60)"/>';
    return out;
  }
  var dots = '';
  for (var i = 0; i < 8; i++) dots += '<circle class="ro-dot" cx="60" cy="10" r="1.6" transform="rotate(' + (22.5 + 45 * i) + ' 60 60)"/>';
  var ROSETTE = '<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
    petals('ro-out', 'M60 60C51 45 51 22 60 8C69 22 69 45 60 60Z', 0) +
    petals('ro-in', 'M60 60C55 50 55 36 60 27C65 36 65 50 60 60Z', 22.5) + dots +
    '<circle class="ro-eye" cx="60" cy="60" r="8.5"/><circle class="ro-dot" cx="60" cy="60" r="3.4"/></svg>';

  var row = document.createElement('nav');
  row.className = 'pager-row';
  row.setAttribute('aria-label', 'Previous and next page');
  var veil = document.createElement('div');
  veil.className = 'pager-veil';
  veil.setAttribute('aria-hidden', 'true');
  veil.innerHTML = ROSETTE + '<span class="pager-dir"></span><span class="pager-to"></span>';

  function show(dir) {
    var to = dir === 'prev' ? prev : next;
    veil.querySelector('.pager-dir').textContent = dir === 'prev' ? 'Previous' : 'Next';
    veil.querySelector('.pager-to').textContent = to[1];
    root.classList.add('paging');
  }
  function hide() { root.classList.remove('paging'); }
  function go(dir) {
    var to = dir === 'prev' ? prev : next;
    if (still) { location.href = to[0]; return; }
    show(dir);
    setTimeout(function () { location.href = to[0]; }, 380);
  }

  [['prev', prev, '{'], ['next', next, '}']].forEach(function (x) {
    var a = document.createElement('a');
    a.className = 'pager pager--' + x[0];
    a.href = x[1][0];
    a.setAttribute('aria-label', (x[0] === 'prev' ? 'Previous page: ' : 'Next page: ') + x[1][1]);
    var b = '<span class="pager-b" aria-hidden="true">' + x[2] + '</span>', n = '<span class="pager-n" aria-hidden="true">' + x[1][1] + '</span>';
    a.innerHTML = x[0] === 'prev' ? b + n : n + b;
    a.addEventListener('mouseenter', function () { show(x[0]); });
    a.addEventListener('mouseleave', hide);
    a.addEventListener('focus', function () { show(x[0]); });
    a.addEventListener('blur', hide);
    if (touch) a.addEventListener('click', function (e) { e.preventDefault(); go(x[0]); });
    row.appendChild(a);
  });

  var header = document.querySelector('header.top');
  if (header) header.after(row); else document.body.prepend(row);
  document.body.appendChild(veil);

  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
    var t = document.activeElement;
    if (t && t !== document.body && t !== root) return;      /* a focused control keeps its arrow keys */
    if (e.key === 'ArrowLeft') go('prev');
    else if (e.key === 'ArrowRight') go('next');
  });
  window.addEventListener('pageshow', hide);                 /* coming back with the browser's Back button */
})();
