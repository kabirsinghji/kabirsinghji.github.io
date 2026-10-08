/* LinkedIn posts (admin.html, CV tab).
   data/cv.json keeps the list in site.linkedin = {show, posts: [{url, id, kind, field, text?}], sync?}.
   The GitHub Action runs tools/linkedin.py, which reads each post's text and picture from LinkedIn
   into data/linkedin.json and linkedin/<id>.*; this page shows that status. "Sync" saves and asks
   the build to read every post again. */
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

  function page(ed, data, ui) {
    var el = ui.el;
    data.site = data.site || {};
    var li = data.site.linkedin = data.site.linkedin || { show: 3, posts: [] };
    li.posts = li.posts || [];
    if (!cache) { ed.appendChild(el('p', { class: 'help', text: 'Loading…' })); loadCache(ui.rerender); return; }

    ed.appendChild(el('div', { class: 'card li-intro' }, [
      el('p', { html: 'Paste the link to a post, then press <b>Sync</b>. The site reads the post&rsquo;s text and picture from LinkedIn and shows the newest ones on the homepage, under Selected work. It takes about two minutes, like any save.' }),
      el('p', { class: 'help', html: 'To copy a link on LinkedIn: open the post&rsquo;s <b>&middot;&middot;&middot;</b> menu and choose <b>Copy link to post</b>. LinkedIn&rsquo;s &ldquo;Embed this post&rdquo; code works too. Only public posts can be read.' })
    ]));

    /* add a post */
    var inp = el('input', { type: 'url', id: 'li-new', placeholder: 'https://www.linkedin.com/posts/…', spellcheck: 'false', 'aria-label': 'Link to a LinkedIn post' });
    var msg = el('p', { class: 'li-msg', role: 'status' });
    function add() {
      var p = parse(inp.value);
      if (!p) { msg.textContent = 'That isn’t a link to a LinkedIn post. Copy it from the post’s ··· menu (Copy link to post) and paste the whole thing.'; msg.className = 'li-msg is-err'; return; }
      if (li.posts.some(function (q) { return q.id === p.id; })) { msg.textContent = 'That post is already in the list.'; msg.className = 'li-msg is-err'; return; }
      p.field = 'other';
      li.posts.push(p); li.posts.sort(newestFirst);
      ui.rerender();
      ui.note('ok', 'Post added. Press <b>Sync</b> to put it on the site.');
    }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    ed.appendChild(el('div', { class: 'card' }, [
      el('label', { class: 'f', for: 'li-new' }, [el('span', { text: 'Add a post' }), el('div', { class: 'li-add' }, [
        inp, el('button', { type: 'button', class: 'btn', text: 'Add', onclick: add })
      ])]),
      msg
    ]));

    /* how many, and sync */
    var shown = el('select', { id: 'li-show' });
    SHOWN.forEach(function (o) { shown.appendChild(el('option', { value: o[0], text: o[1] })); });
    shown.value = String(li.show || 3);
    shown.onchange = function () { li.show = Number(shown.value); ui.rerender(); };
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
      if (!got) status = el('p', { class: 'li-status', text: 'Not read yet. Press Sync.' });
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

  return { page: page };
})();
