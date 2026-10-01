/* Tags for the bucket CV (admin.html, CV tab).
   data/cv.json keeps the tag list in "tagset" and each entry's tags in "tags" (ids). Tags shape the
   protein on the homepage; visible ones are named there, hidden ones only change its shape.
   They never print on the PDF. "short" on an entry is its label on the protein.
   One-time setup: "Set up tags" reads admin/tags-seed.json (a first pass) and matches it to the
   entries as they are now, by their own text, so earlier edits are kept. */
window.AdminTags = (function () {
  'use strict';
  var KINDS = [
    ['activity', 'Activities', 'The peaks: what kind of work it is. Shown as labelled axes on the protein.'],
    ['subject', 'Subjects', 'The hotspots: what the work is about. Shown as colours and as the chips under the protein.'],
    ['quality', 'Qualities', 'Competencies employers look for (from the Cambridge guide), with other words for them. Usually hidden.'],
    ['keyword', 'Keywords', 'Words people search for: methods, tools, languages. Usually hidden.']
  ];
  var SEED = 'admin/tags-seed.json';

  function key(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60); }
  function slug(s) { return String(s || '').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tag'; }
  function textOf(e) { return e.heading || e.title || e.text || ''; }
  function plain(s) { return String(s || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\^\{([^}]*)\}/g, '$1').replace(/\*{3,}/g, '\u0001').replace(/\*+/g, '').replace(/\u0001/g, '*****'); }
  function walk(data, fn) {
    (data.sections || []).forEach(function (sec) {
      (sec.groups || []).forEach(function (g) {
        (g.entries || []).forEach(function (e) { fn(e, sec); });
        (g.items || []).forEach(function (e) { fn(e, sec); });
      });
      (sec.items || []).forEach(function (e) { fn(e, sec); });
    });
  }
  function counts(data) { var c = {}; walk(data, function (e) { (e.tags || []).forEach(function (t) { c[t] = (c[t] || 0) + 1; }); }); return c; }
  function byId(data) { var m = {}; (data.tagset || []).forEach(function (t) { m[t.id] = t; }); return m; }
  function order(data) { var m = {}; (data.tagset || []).forEach(function (t, i) { m[t.id] = i; }); return m; }

  /* ------------------------------------------------ one-time setup from the first pass */
  function setup(data, ui, btn) {
    btn.disabled = true; btn.textContent = 'Setting up…';
    fetch(SEED, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('Could not read ' + SEED + ' (HTTP ' + r.status + ')');
      return r.json();
    }).then(function (seed) {
      data.tagset = JSON.parse(JSON.stringify(seed.tagset));
      var hit = 0, total = 0, missed = [];
      walk(data, function (e, sec) {
        total++;
        var s = seed.entries[key(textOf(e))];
        if (s) { e.tags = s.tags.slice(); if (!e.short && s.short) e.short = s.short; hit++; }
        else if (sec.id !== 'education' && !/education/i.test(sec.title || '')) missed.push(sec.title + ': ' + plain(textOf(e)).slice(0, 90));
      });
      ui.rerender();
      ui.note(missed.length ? 'warn' : 'ok', 'Added ' + data.tagset.length + ' tags and tagged ' + hit + ' of ' + total + ' entries. Review them, then <b>Save &amp; publish</b>; the protein appears on the homepage after the rebuild.' +
        (missed.length ? '<br>No first-pass tags for: ' + missed.map(ui.esc).join('; ') + '. Tag these by hand.' : ''));
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = 'Set up tags';
      ui.note('err', 'Setup failed: ' + ui.esc(e.message));
    });
  }

  /* ------------------------------------------------ the Tags page */
  function page(ed, data, ui) {
    var el = ui.el;
    if (!data.tagset) {
      ed.appendChild(el('div', { class: 'card tg-intro' }, [
        el('p', { html: 'Tags turn this CV into a <b>bucket CV</b>: every entry carries a few tags, and the tags shape the protein on the homepage. ' +
          'Visible tags are named there; hidden ones only change its shape. Tags never print on the PDF.' }),
        el('p', { text: 'Setup adds a first pass: 7 activities, 7 subjects, 14 qualities from the Cambridge guide and 13 keywords, matched to your entries by their text. Nothing is published until you save.' }),
        (function () { var b = el('button', { type: 'button', class: 'btn btn--primary', text: 'Set up tags' }); b.onclick = function () { setup(data, ui, b); }; return b; })()
      ]));
      return;
    }
    var n = counts(data);
    ed.appendChild(el('p', { class: 'help', html: 'Every tag shapes the protein on the homepage. <b>Shown on the site</b> names it there; hidden tags only change the shape. Renaming keeps the tag on its entries. Tags never print on the PDF.' }));
    KINDS.forEach(function (K) {
      var list = data.tagset.filter(function (t) { return t.kind === K[0]; });
      var box = el('section', { class: 'card tg-fam', 'aria-label': K[1] }, [el('h3', { text: K[1] }), el('p', { class: 'tg-desc', text: K[2] })]);
      list.forEach(function (t) { box.appendChild(tagRow(t, data, n[t.id] || 0, ui)); });
      var name = el('input', { type: 'text', placeholder: 'New ' + K[1].toLowerCase().replace(/s$/, '').replace(/ie$/, 'y'), 'aria-label': 'New ' + K[0] + ' tag' });
      var add = el('button', { type: 'button', class: 'btn btn--small', text: '+ Add' });
      add.onclick = function () {
        var nm = name.value.trim(); if (!nm) { name.focus(); return; }
        if (data.tagset.some(function (x) { return x.name.toLowerCase() === nm.toLowerCase(); })) { ui.note('warn', 'There is already a tag called “' + ui.esc(nm) + '”.'); return; }
        var id = slug(nm), base = id, k = 2;
        while (data.tagset.some(function (x) { return x.id === id; })) id = base + '-' + (k++);
        var t = { id: id, name: nm, kind: K[0], visible: K[0] === 'activity' || K[0] === 'subject' };
        if (K[0] === 'activity') t.verb = '';
        data.tagset.push(t); ui.rerender();
      };
      name.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); add.onclick(); } };
      box.appendChild(el('div', { class: 'tg-add' }, [name, add]));
      ed.appendChild(box);
    });
    // entries with no tags yet
    var none = [];
    walk(data, function (e, sec) { if (!(e.tags || []).length && !/education/i.test(sec.title || '')) none.push([sec, e]); });
    var nb = el('section', { class: 'card tg-fam' }, [el('h3', { text: 'Entries with no tags' })]);
    if (!none.length) nb.appendChild(el('p', { class: 'tg-desc', text: 'Every entry has at least one tag (education sits in the core and needs none).' }));
    none.forEach(function (p) {
      var b = el('button', { type: 'button', class: 'tg-jump', text: p[0].title + ': ' + plain(textOf(p[1])).slice(0, 90) });
      b.onclick = function () { ui.go(p[0].id); };
      nb.appendChild(b);
    });
    ed.appendChild(nb);
  }

  function tagRow(t, data, count, ui) {
    var el = ui.el;
    var name = el('input', { type: 'text', 'aria-label': 'Name of tag ' + t.name }); name.value = t.name;
    name.oninput = function () { t.name = name.value; ui.sync(); };
    var vis = el('input', { type: 'checkbox' }); vis.checked = !!t.visible;
    vis.onchange = function () { t.visible = vis.checked; row.classList.toggle('is-hidden', !t.visible); ui.sync(); };
    var extra = null;
    if (t.kind === 'activity') {
      extra = el('input', { type: 'text', placeholder: 'One line in verbs, e.g. Teaches until someone else can do it', 'aria-label': 'Verb line for ' + t.name });
      extra.value = t.verb || ''; extra.oninput = function () { t.verb = extra.value; ui.sync(); };
    } else if (t.kind === 'quality') {
      extra = el('input', { type: 'text', placeholder: 'Other words for it, e.g. cooperation, collaboration', 'aria-label': 'Other words for ' + t.name });
      extra.value = t.also || ''; extra.oninput = function () { t.also = extra.value; ui.sync(); };
    }
    var del = el('button', { type: 'button', class: 'icon', title: 'Delete tag', 'aria-label': 'Delete tag ' + t.name, text: '✕' });
    var tools = el('span', { class: 'tg-tools' }, [del]);
    del.onclick = function () {
      if (tools.dataset.arm) return;
      tools.dataset.arm = '1';
      var yes = el('button', { type: 'button', class: 'btn btn--small btn--danger', text: count ? 'Remove from ' + count + ' entries?' : 'Delete?' });
      yes.onclick = function () {
        data.tagset = data.tagset.filter(function (x) { return x !== t; });
        walk(data, function (e) { if (e.tags) { e.tags = e.tags.filter(function (id) { return id !== t.id; }); if (!e.tags.length) delete e.tags; } });
        ui.rerender();
      };
      tools.appendChild(yes);
      setTimeout(function () { if (yes.parentNode) { yes.remove(); delete tools.dataset.arm; } }, 4000);
    };
    var row = el('div', { class: 'tg-row' + (t.visible ? '' : ' is-hidden') }, [
      name,
      el('label', { class: 'tg-vis' }, [vis, document.createTextNode(' Shown on the site')]),
      el('span', { class: 'tg-n', text: count + (count === 1 ? ' entry' : ' entries') }),
      extra || el('span', {}),
      tools
    ]);
    return row;
  }

  /* ------------------------------------------------ the tags block on each entry */
  function block(e, data, ui) {
    var el = ui.el;
    var box = el('div', { class: 'tagbox' });
    if (!data.tagset) {
      var go = el('button', { type: 'button', class: 'btn btn--small', text: 'Set up tags' }); go.onclick = function () { ui.go('tags'); };
      box.appendChild(el('div', { class: 'tb-head' }, [el('span', { class: 'tb-l', text: 'Tags' }), el('span', { class: 'tb-none', text: 'Not set up yet.' }), go]));
      return box;
    }
    var open = false;
    function draw() {
      box.innerHTML = '';
      var ids = byId(data), ord = order(data);
      e.tags = (e.tags || []).filter(function (id) { return ids[id]; });
      var head = el('div', { class: 'tb-head' }, [el('span', { class: 'tb-l', text: 'Tags' })]);
      if (!e.tags.length) head.appendChild(el('span', { class: 'tb-none', text: 'None yet.' }));
      e.tags.forEach(function (id) {
        var t = ids[id];
        var x = el('button', { type: 'button', 'aria-label': 'Remove tag ' + t.name, text: '×' });
        x.onclick = function () { e.tags = e.tags.filter(function (y) { return y !== id; }); if (!e.tags.length) delete e.tags; ui.sync(); draw(); };
        head.appendChild(el('span', { class: 'tchip k-' + t.kind + (t.visible ? '' : ' hid'), title: kindName(t.kind) + (t.visible ? '' : ', hidden on the site') }, [document.createTextNode(t.name), x]));
      });
      var tog = el('button', { type: 'button', class: 'btn btn--small', text: open ? 'Done' : 'Edit tags', 'aria-expanded': String(open) });
      tog.onclick = function () { open = !open; draw(); };
      head.appendChild(tog);
      box.appendChild(head);
      if (open) {
        var pick = el('div', { class: 'tpick' });
        KINDS.forEach(function (K) {
          var opts = el('div', { class: 'opts' });
          data.tagset.filter(function (t) { return t.kind === K[0]; }).forEach(function (t) {
            var on = (e.tags || []).indexOf(t.id) >= 0;
            var b = el('button', { type: 'button', class: 'topt' + (t.visible ? '' : ' hid'), 'aria-pressed': String(on), text: t.name, title: t.visible ? '' : 'Hidden on the site' });
            b.onclick = function () {
              var cur = e.tags || [];
              if (cur.indexOf(t.id) >= 0) cur = cur.filter(function (y) { return y !== t.id; }); else cur = cur.concat(t.id);
              cur.sort(function (a, c) { return ord[a] - ord[c]; });
              if (cur.length) e.tags = cur; else delete e.tags;
              ui.sync(); draw();
            };
            opts.appendChild(b);
          });
          pick.appendChild(el('div', { class: 'fam' }, [el('span', { text: K[1] }), opts]));
        });
        box.appendChild(pick);
        var sn = el('input', { type: 'text', placeholder: 'e.g. ' + shortGuess(e), 'aria-label': 'Name on the protein' }); sn.value = e.short || '';
        sn.oninput = function () { if (sn.value.trim()) e.short = sn.value; else delete e.short; ui.sync(); };
        box.appendChild(el('label', { class: 'f tb-short' }, [el('span', { text: 'Name on the protein' }), sn, el('small', { text: 'A few words for the dot’s label. Blank: taken from the heading.' })]));
      }
    }
    draw();
    return box;
  }
  function kindName(k) { for (var i = 0; i < KINDS.length; i++) if (KINDS[i][0] === k) return KINDS[i][1].replace(/ies$/, 'y').replace(/s$/, ''); return k; }
  function shortGuess(e) { var t = plain(textOf(e)).split(/[.,;:]\s/)[0]; return t.length > 38 ? t.slice(0, 36) + '…' : t; }

  return { page: page, block: block, count: function (data) { return (data.tagset || []).length; } };
})();
