/* LinkedIn posts (admin.html, CV tab).
   data/cv.json keeps the list in site.linkedin = {show, posts: [{url, id, kind, field, text?}], sync?}.
   Posts are added by link, or by the "Get LinkedIn posts" bookmark, which opens admin.html?li=<ids>.
   The GitHub Action runs tools/linkedin.py, which reads the newest posts' text and picture from
   LinkedIn into data/linkedin.json and linkedin/<id>.*; this page shows that status. "Sync" saves
   and asks the build to read them again. */
window.AdminLinkedIn = (function () {
  'use strict';
  var FIELDS = [['other', 'Other (grey)'], ['science', 'Science (blue)'], ['history', 'History (gold)']];
  var SHOWN = [1, 2, 3, 4, 5, 6].map(function (n) { return [String(n), String(n)]; });
  var cache = null;          // data/linkedin.json from the live site

  /* A post link, a feed/update link, or LinkedIn's embed code → {url, id, kind} */
  function parse(s) {
    s = String(s || '').trim();
    var m = s.match(/(activity|share|ugcPost)[:-](\d{15,22})/i);
    if (!m) return null;
    var kind = m[1].toLowerCase() === 'ugcpost' ? 'ugcPost' : m[1].toLowerCase();
    var url = ((s.match(/https?:\/\/[^\s"'<>]+/) || [''])[0]).split('?')[0];
    if (/<iframe/i.test(s) || !/^https:\/\/(www\.)?linkedin\.com\/(posts|feed\/update)\//.test(url)) {
      url = 'https://www.linkedin.com/feed/update/urn:li:' + kind + ':' + m[2] + '/';
    }
    return { url: url, id: m[2], kind: kind };
  }
  /* post ids carry their timestamp: the top bits are milliseconds since 1970 */
  function dateOf(id) {
    try { return new Date(Number(BigInt(id) >> 22n)); } catch (e) { return null; }
  }
  function when(id) {
    var d = dateOf(id);
    return d ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }
  function newestFirst(a, b) { var x = BigInt(a.id), y = BigInt(b.id); return x > y ? -1 : x < y ? 1 : 0; }

  function loadCache(done) {
    fetch('data/linkedin.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : { posts: {} }; })
      .catch(function () { return { posts: {} }; })
      .then(function (c) { cache = c || { posts: {} }; cache.posts = cache.posts || {}; done(); });
  }

  /* The bookmark. It runs on LinkedIn, so it stays plain ES5 with block comments only:
     it is turned into a javascript: link. On Kabir's own posts page it collects the newest
     post ids (skipping reposts) and opens admin.html?li=<id>,<id>…; anywhere else it goes
     to that page first. */
  function grab(admin, slug) {
    var page = 'https://www.linkedin.com/in/' + slug + '/recent-activity/all/';
    var here = decodeURIComponent(location.pathname).toLowerCase();
    if (!/(^|\.)linkedin\.com$/.test(location.hostname) || here.indexOf('/in/' + slug.toLowerCase() + '/recent-activity/') !== 0) {
      alert('Opening your LinkedIn posts. Once they have loaded, click the bookmark again.');
      location.href = page;
      return;
    }
    var seen = {}, ids = [];
    function add(id) { if (!seen[id]) { seen[id] = 1; ids.push(id); } }
    var items = document.querySelectorAll('[data-urn^="urn:li:activity:"]');
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.parentElement && it.parentElement.closest('[data-urn^="urn:li:activity:"]')) continue;   /* a post shown inside another */
      var head = it.querySelector('.update-components-header') || it;
      if (/reposted this/i.test((head.textContent || '').replace(/\s+/g, ' ').slice(0, 400))) continue;   /* someone else's post */
      add(it.getAttribute('data-urn').split(':').pop());
    }
    if (!ids.length) (document.body.innerHTML.match(/urn:li:activity:\d{15,22}/g) || []).forEach(function (u) { add(u.split(':').pop()); });
    if (!ids.length) { alert('No posts found yet. Wait for your posts to load, then click the bookmark again.'); return; }
    ids.sort(function (a, b) { return b.length - a.length || (b > a ? 1 : -1); });
    var url = admin + '?li=' + ids.slice(0, 6).join(',');
    if (!window.open(url, '_blank')) location.href = url;
  }

  /* admin.html calls this after loading the CV: adds the posts the bookmark sent, if any.
     Returns a message for the page, or null when the bookmark sent nothing. */
  function take(data) {
    var m = location.search.match(/[?&]li=([\d,]+)/);
    if (!m) return null;
    history.replaceState(null, '', location.pathname + location.hash);
    data.site = data.site || {};
    var li = data.site.linkedin = data.site.linkedin || { show: 3, posts: [] };
    li.posts = li.posts || [];
    var added = 0;
    m[1].split(',').forEach(function (id) {
      if (!/^\d{15,22}$/.test(id) || li.posts.some(function (p) { return p.id === id; })) return;
      li.posts.push({ url: 'https://www.linkedin.com/feed/update/urn:li:activity:' + id + '/', id: id, kind: 'activity', field: 'other' });
      added++;
    });
    li.posts.sort(newestFirst);
    return added
      ? 'Added ' + added + ' new post' + (added > 1 ? 's' : '') + ' from LinkedIn. Check the list below, then press <b>Sync</b>.'
      : 'Your newest LinkedIn posts are already on the list. Press <b>Sync</b> only if you want the site to read them again.';
  }

  function page(ed, data, ui) {
    var el = ui.el;
    /* only stored in the CV once something is added or changed, so just looking isn't an edit */
    var li = (data.site || {}).linkedin || { show: 3, posts: [] };
    li.posts = li.posts || [];
    function keep() { data.site = data.site || {}; data.site.linkedin = li; }
    if (!cache) { ed.appendChild(el('p', { class: 'help', text: 'Loading…' })); loadCache(ui.rerender); return; }

    ed.appendChild(el('div', { class: 'card li-intro' }, [
      el('p', { html: 'The newest posts show on the homepage, right under the opening. Add them with the bookmark below (or one at a time by link), then press <b>Sync</b>: the site reads each post&rsquo;s text and picture from LinkedIn. It takes about two minutes, like any save. Only public posts can be read.' })
    ]));

    /* the bookmark */
    var slug = (String((data.meta || {}).linkedin || '').match(/linkedin\.com\/in\/([^\/?#\s]+)/i) || [])[1];
    if (slug) {
      var code = 'void (' + grab + ')(' + JSON.stringify(location.origin + location.pathname) + ',' + JSON.stringify(slug) + ')';
      var mine = 'https://www.linkedin.com/in/' + slug + '/recent-activity/all/';
      ed.appendChild(el('div', { class: 'card li-bm' }, [
        el('p', { class: 'li-h', text: 'Get the newest posts with one click' }),
        el('ol', {}, [
          el('li', {}, [document.createTextNode('Drag this button to the bookmarks bar (once on each computer): '),
            el('a', { class: 'btn li-bm-btn', href: 'javascript:' + encodeURIComponent(code), title: 'Drag me to the bookmarks bar', text: 'Get LinkedIn posts',
              onclick: function (e) { e.preventDefault(); ui.note('warn', 'Drag the <b>Get LinkedIn posts</b> button to the bookmarks bar instead of clicking it here.'); } })]),
          el('li', { html: 'On LinkedIn, open <a href="' + ui.esc(mine) + '" target="_blank" rel="noopener">your posts</a> and click the bookmark. This page opens with the new posts added. (Clicked anywhere else, it takes you to your posts first.)' }),
          el('li', { html: 'Check the list and press <b>Sync</b>.' })
        ]),
        el('p', { class: 'help', html: 'No bookmarks bar? Press Ctrl+Shift+B (Windows) or &#8984;+Shift+B (Mac). Reposts of other people&rsquo;s posts are skipped. The bookmark works in a desktop browser, not on a phone.' })
      ]));
    } else {
      ed.appendChild(el('p', { class: 'help', html: 'Add the LinkedIn URL under <b>Header &amp; contact</b> to get the one-click bookmark.' }));
    }

    /* add a post */
    var inp = el('input', { type: 'url', id: 'li-new', placeholder: 'https://www.linkedin.com/posts/…', spellcheck: 'false', 'aria-label': 'Link to a LinkedIn post' });
    var msg = el('p', { class: 'li-msg', role: 'status' });
    function add() {
      var p = parse(inp.value);
      if (!p) { msg.textContent = 'That isn’t a link to a LinkedIn post. Copy it from the post’s ··· menu (Copy link to post) and paste the whole thing.'; msg.className = 'li-msg is-err'; return; }
      if (li.posts.some(function (q) { return q.id === p.id; })) { msg.textContent = 'That post is already in the list.'; msg.className = 'li-msg is-err'; return; }
      p.field = 'other';
      li.posts.push(p); li.posts.sort(newestFirst); keep();
      ui.rerender();
      ui.note('ok', 'Post added. Press <b>Sync</b> to put it on the site.');
    }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    ed.appendChild(el('div', { class: 'card' }, [
      el('label', { class: 'f', for: 'li-new' }, [el('span', { text: 'Or add one post by its link' }), el('div', { class: 'li-add' }, [
        inp, el('button', { type: 'button', class: 'btn', text: 'Add', onclick: add })
      ]), el('small', { text: 'On LinkedIn, open the post’s ··· menu and choose Copy link to post. Its “Embed this post” code works too.' })]),
      msg
    ]));

    /* how many, and sync */
    var shown = el('select', { id: 'li-show' });
    SHOWN.forEach(function (o) { shown.appendChild(el('option', { value: o[0], text: o[1] })); });
    shown.value = String(li.show || 3);
    shown.onchange = function () { li.show = Number(shown.value); keep(); ui.rerender(); };
    var last = cache.syncedAt ? 'Last sync ' + new Date(cache.syncedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) + '.' : 'Not synced yet.';
    var syncBtn = el('button', { type: 'button', class: 'btn btn--primary', text: 'Sync',
      title: 'Save, then read every post from LinkedIn again',
      onclick: function () { li.sync = new Date().toISOString(); ui.publish(); } });
    syncBtn.disabled = !li.posts.length;
    ed.appendChild(el('div', { class: 'li-bar' }, [
      el('label', { class: 'li-show', for: 'li-show' }, [document.createTextNode('Show the newest '), shown, document.createTextNode(' on the homepage')]),
      el('span', { class: 'li-last', text: last }),
      el('button', { type: 'button', class: 'btn', text: 'Refresh status', onclick: function () { cache = null; ui.rerender(); } }),
      syncBtn
    ]));

    if (!li.posts.length) {
      ed.appendChild(el('p', { class: 'help', text: 'No posts yet. Nothing shows on the homepage until one is added and synced.' }));
      return;
    }

    li.posts.sort(newestFirst);
    var n = li.show || 3;
    li.posts.forEach(function (p, i) {
      var got = cache.posts[p.id];
      var status;
      if (i >= n) status = el('p', { class: 'li-status', text: 'Not on the homepage: only the newest ' + n + ' are shown, so this one isn’t read.' });
      else if (!got) status = el('p', { class: 'li-status', text: 'Not read yet. Press Sync.' });
      else if (got.ok) status = el('div', { class: 'li-status is-ok' }, [
        got.image ? el('img', { class: 'li-thumb', src: got.image, alt: '', loading: 'lazy' }) : null,
        el('p', { text: 'Read from LinkedIn: “' + String(got.text || '').replace(/\s+/g, ' ').slice(0, 160) + (String(got.text || '').length > 160 ? '…' : '') + '”' })
      ]);
      else status = el('p', { class: 'li-status is-err', text: 'Couldn’t read this post (' + (got.note || 'unknown reason') + '). ' +
        (p.text ? 'The site uses your own text below.' : 'Type its text below and the site will use that instead.') });

      var box = el('span', {});
      var del = el('button', { type: 'button', class: 'icon', title: 'Remove', 'aria-label': 'Remove this post', text: '✕', onclick: function () {
        if (box.dataset.arm) return;
        box.dataset.arm = '1';
        var yes = el('button', { type: 'button', class: 'btn btn--small btn--danger', text: 'Remove?', onclick: function () { li.posts.splice(i, 1); ui.rerender(); } });
        box.appendChild(yes);
        setTimeout(function () { if (yes.parentNode) { yes.remove(); delete box.dataset.arm; } }, 4000);
      } });
      box.appendChild(del);

      ed.appendChild(el('div', { class: 'card li-post' + (i < n ? ' is-on' : '') }, [
        el('div', { class: 'card-top' }, [
          el('span', { class: 'n', text: when(p.id) }),
          i < n ? el('span', { class: 'li-badge', text: 'On the homepage' }) : null,
          el('a', { class: 'li-open', href: p.url, target: '_blank', rel: 'noopener', text: 'Open on LinkedIn ↗' }),
          box
        ]),
        status,
        el('div', { class: 'row' }, [
          field(el, 'Your own text (optional)', p, 'text', { area: true, hint: 'Leave blank to use the post’s text from LinkedIn.' }, ui),
          field(el, 'Colour', p, 'field', { select: FIELDS }, ui)
        ])
      ]));
    });
  }

  /* a small field like admin.html's, with ids for form-state restore */
  var uid = 0;
  function field(el, label, obj, key, o, ui) {
    var id = 'li-f' + (++uid), input;
    if (o.select) {
      input = el('select', { id: id });
      o.select.forEach(function (opt) { input.appendChild(el('option', { value: opt[0], text: opt[1] })); });
      input.value = obj[key] || o.select[0][0];
    } else {
      input = el('textarea', { id: id, rows: 3, spellcheck: 'true' });
      input.value = obj[key] || '';
    }
    input.addEventListener(o.select ? 'change' : 'input', function () {
      if (input.value) obj[key] = input.value; else delete obj[key];
      ui.sync();
    });
    return el('label', { class: 'f', for: id }, [el('span', { text: label }), input, o.hint ? el('small', { text: o.hint }) : null]);
  }

  return { page: page, take: take };
})();
