/* Custom CVs (admin.html, CV tab): the "profiles" list in data/cv.json.
   Each profile is one CV the build makes as PDF, Word and text: "cv" is cv/cv.*, the general CV with
   every entry; any other is cv/cv-ID.*. A profile takes the entries of its sections (all of them, or
   only those with one of its tags), plus "include" ids, minus "exclude" ids. tools/build.py (picks)
   applies the same rules; keep the two in step. */
window.AdminProfiles = (function () {
  'use strict';
  var current = 'cv';

  function slug(s) {
    return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/\*+|\^\{[^}]*\}|_\{[^}]*\}/g, '').replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '') || 'entry';
  }
  function label(o) { return String(o.short || o.heading || o.title || o.text || '').replace(/\*+/g, '').replace(/\^\{([^}]*)\}|_\{([^}]*)\}/g, '$1$2'); }
  function each(data, fn) {          /* every entry or item a profile can pick, with its section */
    (data.sections || []).forEach(function (sec) {
      (sec.groups || []).forEach(function (g) { (g.entries || []).concat(g.items || []).forEach(function (o) { fn(o, sec); }); });
      if (sec.type !== 'table') (sec.items || []).forEach(function (o) { fn(o, sec); });
    });
  }
  /* give every entry an id, so a profile can name it; returns true if any was added */
  function ensureIds(data) {
    var seen = {}, added = false;
    each(data, function (o) { if (o.id) seen[o.id] = 1; });
    each(data, function (o) {
      if (o.id) return;
      var base = slug(label(o)), id = base, k = 2;
      while (seen[id]) id = base + '-' + (k++);
      o.id = id; seen[id] = 1; added = true;
    });
    return added;
  }
  function sectionOn(sec, p) { return !(p.sections || []).length || p.sections.indexOf(sec.id) >= 0; }
  function picks(o, sec, p) {
    if (!sectionOn(sec, p) || (o.show || 'both') === 'site') return false;
    if ((p.exclude || []).indexOf(o.id) >= 0) return false;
    if ((p.include || []).indexOf(o.id) >= 0) return true;
    var tags = p.tags || [];
    return !tags.length || (o.tags || []).some(function (t) { return tags.indexOf(t) >= 0; });
  }
  function base(p) { return p.id === 'cv' ? 'cv' : 'cv-' + p.id; }
  function toggle(list, v, on) {
    var i = list.indexOf(v);
    if (on && i < 0) list.push(v);
    if (!on && i >= 0) list.splice(i, 1);
  }

  function page(ed, data, ui) {
    var el = ui.el;
    if (ensureIds(data)) ui.sync();
    data.profiles = data.profiles || [];
    if (!data.profiles.some(function (p) { return p.id === 'cv'; }))
      data.profiles.unshift({ id: 'cv', name: 'General (every entry)', tags: [], include: [], exclude: [], descriptions: true, prompts: false });
    var p = data.profiles.filter(function (x) { return x.id === current; })[0] || data.profiles[0];
    current = p.id;
    ['tags', 'include', 'exclude', 'sections'].forEach(function (k) { p[k] = p[k] || []; });

    ed.appendChild(el('p', { class: 'help', html: 'Each custom CV is built as a <b>PDF, a Word file and a text file</b> every time you save. ' +
      '<b>General</b> is the main download on the site (<code>cv/cv.pdf</code>). Pick tags to take only the entries that carry them, then tick or untick single entries. ' +
      'Everything in <code>cv/</code> is public on the site, so leave out anything you would not hand to anyone.' }));

    /* which profile */
    var bar = el('div', { class: 'pf-bar' });
    data.profiles.forEach(function (x) {
      var b = el('button', { type: 'button', class: 'topt', 'aria-pressed': String(x.id === p.id), text: x.name || x.id });
      b.onclick = function () { current = x.id; ui.rerender(); };
      bar.appendChild(b);
    });
    var add = el('button', { type: 'button', class: 'btn btn--small', text: '+ New custom CV' });
    add.onclick = function () {
      var id = 'custom', k = 2;
      while (data.profiles.some(function (x) { return x.id === id; })) id = 'custom-' + (k++);
      data.profiles.push({ id: id, name: 'New custom CV', tags: [], include: [], exclude: [], sections: [], descriptions: true, prompts: false,
                           selected: true, fullLink: true });
      current = id; ui.sync(); ui.rerender();
    };
    bar.appendChild(add);
    ed.appendChild(bar);

    /* the profile's settings */
    var b0 = base(p);
    var files = el('p', { class: 'pf-files', html: 'Files after the next save: <a href="cv/' + b0 + '.pdf" target="_blank" rel="noopener">' + b0 + '.pdf</a> &middot; ' +
      '<a href="cv/' + b0 + '.docx">' + b0 + '.docx</a> &middot; <a href="cv/' + b0 + '.txt" target="_blank" rel="noopener">' + b0 + '.txt</a>' });
    var name = el('input', { type: 'text', 'aria-label': 'Name' }); name.value = p.name || '';
    name.oninput = function () { p.name = name.value; ui.sync(); };
    var kids = [el('label', { class: 'f' }, [el('span', { text: 'Name (for you)' }), name])];
    if (p.id !== 'cv') {
      var fid = el('input', { type: 'text', 'aria-label': 'File name', spellcheck: 'false' }); fid.value = p.id;
      var fidErr = el('small', { text: 'Lower-case letters, numbers and hyphens. The files are cv-' + p.id + '.*' });
      fid.onchange = function () {
        var v = slug(fid.value);
        if (!v || v === 'cv' || data.profiles.some(function (x) { return x !== p && x.id === v; })) { fid.value = p.id; ui.note('warn', 'That file name is taken.'); return; }
        p.id = current = v; ui.sync(); ui.rerender();
      };
      kids.push(el('label', { class: 'f' }, [el('span', { text: 'File name' }), fid, fidErr]));
    }
    var obj = el('textarea', { rows: 2, 'aria-label': 'Objective line', placeholder: (data.meta || {}).objective || '' }); obj.value = p.objective || '';
    obj.oninput = function () { if (obj.value.trim()) p.objective = obj.value; else delete p.objective; ui.sync(); };
    kids.push(el('label', { class: 'f' }, [el('span', { text: 'Objective line' }), obj,
      el('small', { text: 'Blank uses the general one from Header & contact.' })]));
    function check(text, key, dflt, hint) {
      var cb = el('input', { type: 'checkbox' });
      cb.checked = p[key] == null ? dflt : !!p[key];
      cb.onchange = function () { p[key] = cb.checked; ui.sync(); ui.rerender(); };
      return el('label', { class: 'check pf-check' }, [cb, document.createTextNode(' ' + text), hint ? el('small', { text: ' ' + hint }) : null]);
    }
    kids.push(el('div', { class: 'pf-checks' }, [
      check('No objective line', 'hideObjective', false),
      check('Descriptions', 'descriptions', true, '(bullets, projects, coursework; off gives one line per entry)'),
      check('Subheadings', 'subheadings', true),
      p.id !== 'cv' ? check('“Selected” on trimmed sections', 'selected', false, '(e.g. Selected Research Experience)') : null,
      p.id !== 'cv' ? check('Full CV link', 'fullLink', false, '(top of pages 2+)') : null,
      check('Headshot', 'headshot', false, (data.meta || {}).headshot ? '(beside your name)' : '(add one in Header & contact first)'),
      check('Notes to self', 'prompts', false, '(the grey prompts; the files are public)')]));
    kids.push(files);
    if (p.id !== 'cv') {
      var tools = el('div', { class: 'add' });
      var dup = el('button', { type: 'button', class: 'btn btn--small', text: 'Duplicate' });
      dup.onclick = function () {
        var c = JSON.parse(JSON.stringify(p)), id = p.id + '-copy', k = 2;
        while (data.profiles.some(function (x) { return x.id === id; })) id = p.id + '-copy-' + (k++);
        c.id = current = id; c.name = (p.name || p.id) + ' (copy)'; data.profiles.push(c); ui.sync(); ui.rerender();
      };
      var del = el('button', { type: 'button', class: 'btn btn--small btn--danger', text: 'Delete this CV' });
      del.onclick = function () {
        if (!del.dataset.arm) { del.dataset.arm = '1'; del.textContent = 'Click again to delete (its files go on the next save)'; return; }
        data.profiles.splice(data.profiles.indexOf(p), 1); current = 'cv'; ui.sync(); ui.rerender();
      };
      tools.appendChild(dup); tools.appendChild(del); kids.push(tools);
    }
    ed.appendChild(el('div', { class: 'card' }, kids));

    /* sections */
    var secs = el('div', { class: 'opts' });
    data.sections.forEach(function (sec) {
      var on = sectionOn(sec, p);
      var b = el('button', { type: 'button', class: 'topt', 'aria-pressed': String(on), text: sec.title });
      b.onclick = function () {
        if (!p.sections.length) p.sections = data.sections.map(function (s) { return s.id; });
        toggle(p.sections, sec.id, !on);
        if (p.sections.length === data.sections.length) p.sections = [];
        ui.sync(); ui.rerender();
      };
      secs.appendChild(b);
    });
    ed.appendChild(el('div', { class: 'card' }, [el('h3', { class: 'pf-h', text: 'Sections' }), secs]));

    /* tags */
    var tagBox = el('div', { class: 'tpick' });
    var KINDS = [['activity', 'Activities'], ['subject', 'Subjects'], ['quality', 'Qualities'], ['keyword', 'Keywords']];
    KINDS.forEach(function (K) {
      var list = (data.tagset || []).filter(function (t) { return t.kind === K[0]; });
      if (!list.length) return;
      var opts = el('div', { class: 'opts' });
      list.forEach(function (t) {
        var on = p.tags.indexOf(t.id) >= 0;
        var b = el('button', { type: 'button', class: 'topt' + (t.visible ? '' : ' hid'), 'aria-pressed': String(on), text: t.name });
        b.onclick = function () { toggle(p.tags, t.id, !on); ui.sync(); ui.rerender(); };
        opts.appendChild(b);
      });
      tagBox.appendChild(el('div', { class: 'fam' }, [el('span', { text: K[1] }), opts]));
    });
    ed.appendChild(el('div', { class: 'card' }, [el('h3', { class: 'pf-h', text: 'Tags' }),
      el('p', { class: 'pf-sub', text: p.tags.length ? 'Taking entries with any of the ' + p.tags.length + ' tags picked.' : 'None picked: every entry in the sections above.' }),
      p.tags.length ? el('div', { class: 'add' }, [(function () { var c = el('button', { type: 'button', class: 'btn btn--small', text: 'Clear tags' }); c.onclick = function () { p.tags = []; ui.sync(); ui.rerender(); }; return c; })()]) : null,
      tagBox]));

    /* entries */
    var total = 0, inn = 0, list = el('div', { class: 'pf-list' });
    data.sections.forEach(function (sec) {
      var rows = [];
      each({ sections: [sec] }, function (o) {
        if ((o.show || 'both') === 'site') return;
        total++;
        var on = picks(o, sec, p);
        if (on) inn++;
        var why = p.include.indexOf(o.id) >= 0 ? 'added by hand' : p.exclude.indexOf(o.id) >= 0 ? 'removed by hand' : '';
        var cb = el('input', { type: 'checkbox', 'aria-label': label(o) }); cb.checked = on;
        cb.disabled = !sectionOn(sec, p);
        cb.onchange = function () {
          /* a hand choice that matches what the tags give anyway is dropped, so the lists stay short */
          toggle(p.include, o.id, false); toggle(p.exclude, o.id, false);
          if (picks(o, sec, p) !== cb.checked) toggle(cb.checked ? p.include : p.exclude, o.id, true);
          ui.sync(); ui.rerender();
        };
        rows.push(el('label', { class: 'pf-row' + (on ? '' : ' is-out') }, [cb, el('span', { class: 'pf-t', text: label(o) }),
          el('span', { class: 'pf-d', text: String(o.dates || o.year || '').replace(/\n/g, ' ') }), why ? el('span', { class: 'pf-why', text: why }) : null]));
      });
      if (rows.length) list.appendChild(el('details', { class: 'pf-sec', open: '' }, [el('summary', { text: sec.title + (sectionOn(sec, p) ? '' : ' (section off)') })].concat(rows)));
    });
    ed.appendChild(el('div', { class: 'card' }, [el('h3', { class: 'pf-h', text: 'Entries' }),
      el('p', { class: 'pf-sub', text: inn + ' of ' + total + ' entries on this CV. Tick or untick to add or remove one by hand.' }), list]));
  }

  return { page: page, ensureIds: ensureIds, slug: slug };
})();
