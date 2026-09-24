/* Present › Death & dying tab for admin.html: a workspace for the think piece.

   Everything lives in one file in the PRIVATE data repository:
     research/death-dying.json

   The sections follow the assignment: what each author is saying, how the
   authors compare, your interpretation with 1–2 quotes per claim, and how
   secondary writers read each piece; then an outline sized to 5–7 pages.
   It starts with only the steps and section headings; the writing is yours.
   Saving, the offline copy and merging work as in the Sikh research tab. */
(function () {
  'use strict';
  var A = window.AdminCore;
  if (!A) return;

  var PATH = 'research/death-dying.json', CACHE = 'adm.dying.cache';
  var PIECE_STATUS = [['toread', 'To read'], ['reading', 'Reading'], ['read', 'Read'], ['summarized', 'Summarized']];
  var SEC2_STATUS = [['find', 'To find'], ['reading', 'Reading'], ['read', 'Read'], ['noted', 'Notes done']];
  var RELATION = [['', 'Not compared yet'], ['agrees', 'Agrees with you'], ['extends', 'Extends your reading'], ['complicates', 'Complicates it'], ['disagrees', 'Disagrees']];
  var SEC_STATUS = [['', 'Not started'], ['notes', 'Notes'], ['drafting', 'Drafting'], ['drafted', 'Drafted'], ['revised', 'Revised']];
  var TAGS = [['note', 'Note'], ['reading', 'Reading'], ['idea', 'Idea'], ['question', 'Question'], ['meeting', 'Meeting']];
  function label(list, v) { var x = list.filter(function (o) { return o[0] === v; })[0]; return x ? x[1] : v; }

  var S = { doc: null, sha: null, repoOk: false, pending: false, saving: false, rev: 0, err: '', savedAt: null, timer: null, open: {}, openText: {}, tag: '' };
  var root, R = {};

  /* ------------------------------------------------------------ utils -- */
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, k) {
    if (k == null || k === false) return;
    if (Array.isArray(k)) { k.forEach(function (x) { add(e, x); }); return; }
    e.appendChild(k.nodeType ? k : document.createTextNode(k));
  }
  function fill(e) { e.replaceChildren(); for (var i = 1; i < arguments.length; i++) add(e, arguments[i]); return e; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function now() { return new Date().toISOString(); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function daysUntil(iso) { return Math.round((new Date(iso + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function fmtDate(iso) { try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return iso; } }
  function leftLabel(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? Math.abs(n) + 'd overdue' : n + ' days'; }
  function live(arr) { return (arr || []).filter(function (x) { return !x.deleted; }); }
  /* words as Google Docs counts them: space-separated, punctuation on its own doesn't count, hyphenated words count once */
  function countWords(t) { return String(t || '').split(/\s+/).filter(function (w) { return /[\p{L}\p{N}]/u.test(w); }).length; }
  function byOrder(a, b) { return (a.order || 0) - (b.order || 0); }
  function nextOrder(arr) { return (arr || []).reduce(function (m, x) { return Math.max(m, x.order || 0); }, 0) + 1; }
  function repo() { return A.cfg().dataRepo; }
  function sel(list, value, aria, onchange) {
    var s = h('select', { 'aria-label': aria }, list.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    s.value = value || list[0][0];
    s.addEventListener('change', function () { onchange(s.value); });
    return s;
  }
  function textIn(value, aria, oninput, opts) {
    opts = opts || {};
    var e = h(opts.area ? 'textarea' : 'input', { type: opts.area ? null : (opts.type || 'text'), rows: opts.area ? (opts.rows || 2) : null, 'aria-label': aria, placeholder: opts.ph || null });
    e.value = value == null ? '' : value;
    e.addEventListener('input', function () { oninput(opts.type === 'number' ? (e.value === '' ? null : Number(e.value)) : e.value); });
    return e;
  }
  function field(lbl, input, hint) { return h('label', { class: 'rs-f' }, h('span', { text: lbl }), input, hint ? h('small', { text: hint }) : null); }
  function hint(t) { return h('p', { class: 'rs-hint', text: t }); }
  function delBtn(what, onyes) {
    return h('button', { class: 'ms-x', type: 'button', 'aria-label': 'Delete ' + what, title: 'Delete', text: '✕', onclick: function (e) {
      var b = e.currentTarget;
      if (b.dataset.arm) { onyes(); return; }
      b.dataset.arm = '1'; b.textContent = 'Delete?';
      setTimeout(function () { if (b.isConnected) { delete b.dataset.arm; b.textContent = '✕'; } }, 3500);
    } });
  }
  /* an "add" row: text box + button, Enter adds */
  function adder(ph, btnText, onadd, id) {
    var t = h('input', { type: 'text', placeholder: ph, 'aria-label': ph, id: id || null });
    function go() { var v = t.value.trim(); if (!v) { t.focus(); return; } onadd(v); if (id) { var n = document.getElementById(id); if (n) n.focus(); } }
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    return h('div', { class: 'ms-add rs-add2' }, t, h('button', { class: 'btn', type: 'button', text: btnText, onclick: go }));
  }

  /* --------------------------------------------------------- pieces -- */
  function pieces() { return live(S.doc.pieces).sort(byOrder); }
  function pieceName(p) { return p.author || p.title || 'Untitled piece'; }
  function pieceTitle(p) { return [p.author, p.title].filter(Boolean).join(', ') + (p.year ? ' (' + p.year + ')' : '') || 'Untitled piece'; }
  /* keep every label that names a piece current while its fields are typed in */
  function relabel(p) {
    root.querySelectorAll('[data-pl="' + p.id + '"]').forEach(function (e) { e.textContent = pieceName(p); });
    root.querySelectorAll('[data-pt="' + p.id + '"]').forEach(function (e) { e.textContent = pieceTitle(p); });
  }

  /* ------------------------------------------------------------- seed -- */
  function P(v) { return { v: v, updated: '2026-09-24T00:00:00Z' }; }
  function item(o) { o.id = o.id || uid(); o.updated = o.updated || '2026-09-24T00:00:00Z'; return o; }
  function seed() {
    var steps = [
      'Read each piece and note what it is saying',
      'Summarize each author’s argument in your own words',
      'Compare the authors: where they agree and where they split',
      'Settle your interpretation',
      'Choose 1–2 quotes as evidence for each claim',
      'Find secondary analyses of each piece',
      'Compare how the secondary writers read each piece',
      'Outline to 5–7 pages',
      'Draft',
      'Revise and submit'
    ];
    var outline = ['Introduction', 'What they are saying', 'Comparing the authors', 'My interpretation, with evidence', 'How the secondary literature reads them', 'Conclusion'];
    return {
      version: 1, updated: null,
      plan: {
        title: P(''), course: P(''), instructor: P(''), due: P(''),
        pagesMin: P(5), pagesMax: P(7), wpp: P(275),
        prompt: P('Think piece.\n· What are they saying\n· Comparing authors\n· Your interpretation → evidence, c. 1–2 quotes\n· Then compare secondary analyses of each of these pieces and look at how they think about it\n5–7 pages'),
        angle: P('')
      },
      steps: steps.map(function (t, i) { return item({ text: t, due: '', done: false, order: i + 1, suggested: true }); }),
      tasks: [],
      pieces: [],
      compare: [],
      claims: [],
      secondary: [],
      outline: outline.map(function (t, i) { return item({ title: t, status: '', words: null, notes: '', order: i + 1 }); }),
      log: []
    };
  }

  /* -------------------------------------------------------------- sync -- */
  function newer(a, b) { if (!a) return b; if (!b) return a; return (b.updated || '') > (a.updated || '') ? b : a; }
  function mergeArr(a, b) {
    var by = {}, order = [];
    (a || []).concat(b || []).forEach(function (it) { if (!by[it.id]) order.push(it.id); by[it.id] = newer(by[it.id], it); });
    return order.map(function (id) { return by[id]; });
  }
  function merge(a, b) {
    var out = { version: 1, plan: {} };
    Object.keys(a).concat(Object.keys(b)).forEach(function (k) {
      if (k === 'version' || k === 'plan' || k === 'updated' || out[k]) return;
      out[k] = mergeArr(a[k], b[k]);
    });
    var pa = a.plan || {}, pb = b.plan || {};
    Object.keys(pa).concat(Object.keys(pb)).forEach(function (k) { out.plan[k] = newer(pa[k], pb[k]); });
    out.updated = (a.updated || '') > (b.updated || '') ? a.updated : b.updated;
    return out;
  }
  function cacheSave() { try { localStorage.setItem(CACHE, JSON.stringify({ repo: repo(), doc: S.doc, pending: S.pending })); } catch (e) {} }
  function cacheLoad() { try { var c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && c.repo === repo() ? c : null; } catch (e) { return null; } }
  function changed() {
    S.doc.updated = now(); S.pending = true; S.rev++; S.err = '';
    cacheSave(); renderSync();
    clearTimeout(S.timer); S.timer = setTimeout(push, 2000);
  }
  function touch(obj) { obj.updated = now(); changed(); }
  function setPlan(k, v) { S.doc.plan[k] = { v: v, updated: now() }; changed(); }
  function plan(k) { return (S.doc.plan[k] || {}).v; }

  function getFile() { return A.gh('/repos/' + repo() + '/contents/' + PATH).then(function (f) { return { text: A.b64decode(f.content), sha: f.sha }; }); }
  function push(retry) {
    if (!S.pending || !S.repoOk) return;
    if (S.saving) { clearTimeout(S.timer); S.timer = setTimeout(push, 1000); return; }
    S.saving = true; renderSync();
    var rev = S.rev, body = { message: 'Update death & dying tracker', content: A.b64encode(JSON.stringify(S.doc, null, 1) + '\n') };
    if (S.sha) body.sha = S.sha;
    A.gh('/repos/' + repo() + '/contents/' + PATH, { method: 'PUT', body: body }).then(function (res) {
      S.sha = res.content.sha; S.saving = false; S.savedAt = new Date();
      if (S.rev === rev) S.pending = false; else { clearTimeout(S.timer); S.timer = setTimeout(push, 800); }
      cacheSave(); renderSync();
    }).catch(function (e) {
      S.saving = false;
      if ((e.status === 409 || e.status === 422) && !retry) {
        return getFile().then(function (f) {
          S.doc = merge(S.doc, JSON.parse(f.text)); S.sha = f.sha; S.rev++;
          cacheSave(); renderAll(); push(true);
        }).catch(function (e2) { S.err = e2.message; renderSync(); });
      }
      S.err = e.status === 401 || e.status === 403 ? 'GitHub refused the save. Check the token can write to ' + repo() + '.' : e.message;
      renderSync();
    });
  }
  window.addEventListener('beforeunload', function (e) { if (S.pending) { push(); e.preventDefault(); e.returnValue = ''; } });

  /* -------------------------------------------------------------- load -- */
  function load() {
    fill(root, h('p', { class: 'ms-empty', text: 'Loading your think-piece workspace…' }));
    if (!A.cfg().token) return setup('token');
    A.gh('/repos/' + repo()).then(function (r) {
      if (!r.private) return setup('public');
      S.repoOk = !!(r.permissions && r.permissions.push);
      return getFile().then(function (f) { return f; }, function (e) { if (e.status === 404) return null; throw e; }).then(function (f) {
        var fresh = !f;
        S.doc = f ? JSON.parse(f.text) : seed(); S.sha = f ? f.sha : null;
        var c = cacheLoad();
        if (c && c.pending && c.doc) { S.doc = merge(S.doc, c.doc); S.pending = true; S.rev++; clearTimeout(S.timer); S.timer = setTimeout(push, 1500); }
        else if (fresh) { S.pending = true; S.rev++; clearTimeout(S.timer); S.timer = setTimeout(push, 800); }
        renderMain(fresh);
      });
    }).catch(function (e) {
      if (e.status === 404) return setup('norepo');
      fill(root, h('div', { class: 'note note--err', text: 'Could not load the workspace: ' + e.message }));
    });
  }
  function setup(kind) {
    var c = A.cfg(), name = c.dataRepo.split('/')[1] || 'admin-data';
    var box = h('div', { class: 'ms-setup' }, h('h2', { text: 'Death & dying' }));
    if (kind === 'token') box.append(h('p', { text: 'Connect GitHub in Settings first. This workspace is saved to a private repository with the same token.' }),
      h('p', null, h('button', { class: 'btn btn--primary', type: 'button', text: 'Open Settings', onclick: A.goSettings })));
    if (kind === 'norepo') box.append(h('p', null, 'The workspace is kept in a private repository, ', h('b', { text: c.dataRepo }), ', which this token can’t reach yet.'),
      h('ol', null,
        h('li', null, h('a', { href: 'https://github.com/new?name=' + encodeURIComponent(name) + '&visibility=private', target: '_blank', rel: 'noopener', text: 'Create a repository' }), ' named ', h('b', { text: name }), '. Choose ', h('b', { text: 'Private' }), '.'),
        h('li', null, h('a', { href: 'https://github.com/settings/personal-access-tokens', target: '_blank', rel: 'noopener', text: 'Edit your token' }), ': add the repository, with Contents set to Read and write.'),
        h('li', null, 'Come back and press Reload.')),
      h('p', null, h('button', { class: 'btn btn--primary', type: 'button', text: 'Reload', onclick: load })));
    if (kind === 'public') box.append(h('div', { class: 'note note--err' }, h('b', { text: c.dataRepo }), ' is public, so your notes would be visible to anyone. Make it private on GitHub, then reload.'),
      h('p', null, h('button', { class: 'btn btn--primary', type: 'button', text: 'Reload', onclick: load })));
    fill(root, box);
  }

  /* ------------------------------------------------------------ render -- */
  function renderSync() {
    if (!R.sync) return;
    var cls = 'ms-sync', text;
    if (!S.repoOk) { cls += ' err'; text = 'Read-only: the token can’t write to ' + repo(); }
    else if (S.err) { cls += ' err'; text = 'Not saved: ' + S.err; }
    else if (S.saving) { cls += ' busy'; text = 'Saving…'; }
    else if (S.pending) { cls += ' busy'; text = 'Unsaved changes'; }
    else { cls += ' ok'; text = S.savedAt ? 'Saved to GitHub at ' + S.savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Up to date'; }
    R.sync.className = cls;
    fill(R.sync, h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', { text: text }),
      S.err ? h('button', { class: 'btn btn--small', type: 'button', text: 'Retry', onclick: function () { S.err = ''; push(); } }) : null);
  }

  function section(n, title, desc, count, body) {
    return h('section', { class: 'rs-sec', 'aria-label': title },
      h('div', { class: 'ms-box-h' }, h('h3', null, n ? h('span', { class: 'dd-n', text: n }) : null, title), count), desc ? hint(desc) : null, body);
  }
  function renderMain(fresh) {
    R.sync = h('div', { class: 'ms-sync', role: 'status', 'aria-live': 'polite' });
    R.eyebrow = h('p', { class: 'eyebrow' }); R.title = h('h2');
    R.plan = h('div', { class: 'rs-project' });
    R.sum = h('div', { class: 'ms-sum' });
    R.steps = h('div', { class: 'ms-box' }); R.tasks = h('div', { class: 'ms-box' });
    R.pieces = h('div', { class: 'rs-sources' }); R.pieceCount = h('span', { class: 'c' });
    R.cmp = h('div'); R.cmpCount = h('span', { class: 'c' });
    R.claims = h('div'); R.claimCount = h('span', { class: 'c' });
    R.sec = h('div'); R.secCount = h('span', { class: 'c' });
    R.outline = h('div', { class: 'rs-outline' }); R.outTotal = h('span', { class: 'c' });
    R.log = h('div', { class: 'ms-box ms-notes' });
    R.logTa = h('textarea', { rows: 2, placeholder: 'What did you read, notice, decide or wonder about?', 'aria-label': 'New note' });
    S.att = S.att || AdminAttach.composer('research/attachments/dying');   /* one per visit: a draft's files survive re-draws */
    S.att.bind(R.logTa);
    fill(root, h('div', { class: 'ms rs dd' },
      h('div', { class: 'ms-head' }, h('div', null, R.eyebrow, R.title),
        h('div', { class: 'ms-sync-wrap' }, R.sync, h('button', { class: 'btn btn--small', type: 'button', text: 'Reload', onclick: load }))),
      h('details', { class: 'ms-sec', open: fresh ? true : null },
        h('summary', null, h('h3', { text: 'The assignment' }), h('span', { class: 'c', text: 'Prompt, due date, length, your angle' })), R.plan),
      R.sum,
      h('div', { class: 'ms-cols' }, R.steps, R.tasks),
      section('1', 'What are they saying', 'Each piece you are reading, and its argument in your own words.', R.pieceCount, R.pieces),
      section('2', 'Comparing the authors', 'A row for each point of comparison; a column for each author.', R.cmpCount, R.cmp),
      section('3', 'Your interpretation → evidence', 'Each claim you make, backed by one or two quotes.', R.claimCount, R.claims),
      section('4', 'Secondary analyses', 'Who has written about each piece, how they read it, and how that sits with your reading.', R.secCount, R.sec),
      section('', 'Outline', null, R.outTotal, R.outline),
      R.log));
    renderAll();
  }
  function renderAll() {
    if (!R.sum) return;
    renderSync(); renderHead(); renderPlan(); renderSummary(); renderSteps(); renderTasks();
    renderPieces(); renderCompare(); renderClaims(); renderSecondary(); renderOutline(); renderLog();
  }
  function renderHead() {
    R.eyebrow.textContent = [plan('course'), plan('instructor')].filter(Boolean).join(' · ') || 'Think piece';
    R.title.textContent = plan('title') || 'Death & dying';
  }

  function renderPlan() {
    function area(k, lbl, rows, ph) { return field(lbl, textIn(plan(k), lbl, function (v) { setPlan(k, v); if (k === 'title') renderHead(); }, { area: true, rows: rows, ph: ph })); }
    function one(k, lbl, type, note) { return field(lbl, textIn(plan(k), lbl, function (v) { setPlan(k, v); renderHead(); renderSummary(); renderOutlineTotal(); }, { type: type }), note); }
    fill(R.plan,
      area('title', 'Working title', 1),
      h('div', { class: 'rs-grid3' }, one('course', 'Course'), one('instructor', 'Instructor'), one('due', 'Due', 'date')),
      h('div', { class: 'rs-grid3' }, one('pagesMin', 'Pages, at least', 'number'), one('pagesMax', 'Pages, at most', 'number'),
        one('wpp', 'Words per page', 'number', 'About 275 double-spaced; used to turn word counts into pages')),
      area('prompt', 'The assignment', 6),
      area('angle', 'Your question or angle', 3, 'What you want to find out. Fill it in as it sharpens.'));
  }

  function words() { return live(S.doc.outline).reduce(function (n, s) { return n + (Number(s.words) || 0); }, 0); }
  function pageInfo() {
    var wpp = Number(plan('wpp')) || 275, lo = Number(plan('pagesMin')) || 0, hi = Number(plan('pagesMax')) || lo, w = words();
    return { wpp: wpp, lo: lo, hi: hi, w: w, pages: w / wpp };
  }
  function quoteOk(c) { var n = (c.quotes || []).length; return n >= 1 && n <= 2; }

  function renderSummary() {
    var steps = live(S.doc.steps).sort(byOrder), done = steps.filter(function (s) { return s.done; }).length;
    var next = steps.filter(function (s) { return !s.done; })[0], due = plan('due');
    var stepPct = steps.length ? Math.round(100 * done / steps.length) : 0, nextText = next ? 'Next: ' + next.text : 'All steps done';
    var n = due ? daysUntil(due) : null;
    var dueTile = due
      ? stat('Due', n === 0 ? 'Today' : n < 0 ? Math.abs(n) + 'd late' : plural(n, 'day', 'days'), fmtDate(due) + ' · ' + nextText, stepPct)
      : stat('Due', '—', 'Set the due date under The assignment · ' + nextText, stepPct);
    var ps = pieces(), summ = ps.filter(function (p) { return p.status === 'summarized'; }).length;
    var sec = live(S.doc.secondary), covered = ps.filter(function (p) { return sec.some(function (s) { return s.piece === p.id; }); }).length;
    var cl = live(S.doc.claims), good = cl.filter(quoteOk).length;
    var pi = pageInfo();
    fill(R.sum,
      dueTile,
      stat('Readings', summ + '/' + ps.length + ' summarized', ps.length ? covered + ' of ' + ps.length + ' with a secondary reading' : 'Add the pieces under 1', ps.length ? Math.round(100 * summ / ps.length) : 0),
      stat('Evidence', good + '/' + cl.length + ' claims', cl.length ? 'backed by 1–2 quotes' : 'Add your claims under 3', cl.length ? Math.round(100 * good / cl.length) : 0),
      stat('Draft', pi.pages.toFixed(1) + ' pages', pi.w.toLocaleString() + ' words · aim for ' + pi.lo + '–' + pi.hi + ' pages', pi.hi ? Math.min(100, Math.round(100 * pi.pages / pi.hi)) : null));
    function stat(k, n, s, bar) {
      return h('div', { class: 'ms-stat' }, h('span', { class: 'k', text: k }), h('span', { class: 'n rs-n', text: n }), h('span', { class: 's', text: s }),
        bar != null ? h('div', { class: 'ms-bar', role: 'img', 'aria-label': bar + '%' }, h('i', { style: 'width:' + bar + '%' })) : null);
    }
  }

  /* ------------------------------------------------------ steps, tasks -- */
  function renderSteps() {
    var steps = live(S.doc.steps).sort(byOrder);
    fill(R.steps,
      h('div', { class: 'ms-box-h' }, h('h3', { text: 'Steps' }), steps.some(function (s) { return s.suggested; }) ? h('span', { class: 'opt', text: 'Suggested from your list: edit freely' }) : null),
      h('ul', { class: 'ms-tasks rs-ms' }, steps.map(function (m) {
        var cb = h('input', { type: 'checkbox', 'aria-label': 'Done: ' + m.text }); cb.checked = !!m.done;
        var li;
        cb.addEventListener('change', function () { m.done = cb.checked; touch(m); li.className = m.done ? 'done' : ''; renderSummary(); });
        var n = m.due ? daysUntil(m.due) : null;
        var t = textIn(m.text, 'Step', function (v) { m.text = v; touch(m); }, { area: true, rows: 1 }); t.className = 'rs-inline';
        var d = textIn(m.due, 'Date for ' + m.text, function (v) { m.due = v; touch(m); d.className = 'rs-date' + (v ? '' : ' empty'); }, { type: 'date' });
        d.className = 'rs-date' + (m.due ? '' : ' empty');
        li = h('li', { class: m.done ? 'done' : '' }, cb,
          h('div', null, t, h('span', { class: 'rs-due' }, d, n != null && !m.done ? h('span', { class: 'ms-days ' + (n < 0 || n <= 2 ? 'hot' : n <= 7 ? 'soon' : ''), text: leftLabel(n) }) : null)),
          delBtn('step', function () { m.deleted = true; touch(m); renderSteps(); renderSummary(); }));
        return li;
      })),
      adder('Add a step', 'Add', function (v) { S.doc.steps.push(item({ text: v, due: '', done: false, order: nextOrder(S.doc.steps), updated: now() })); changed(); renderSteps(); renderSummary(); }, 'dd-newstep'));
  }

  function renderTasks() {
    var tasks = live(S.doc.tasks).sort(function (a, b) { return (a.done - b.done) || ((a.due || '9999') < (b.due || '9999') ? -1 : 1); });
    var text = h('input', { type: 'text', placeholder: 'Add a task: request a book, email the instructor…', 'aria-label': 'New task', id: 'dd-newtask' });
    var due = h('input', { type: 'date', 'aria-label': 'Due date (optional)' });
    function addTask() {
      var v = text.value.trim(); if (!v) { text.focus(); return; }
      S.doc.tasks.push(item({ text: v, due: due.value || '', done: false, updated: now() })); changed(); renderTasks();
      document.getElementById('dd-newtask').focus();
    }
    text.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addTask(); } });
    var openEl = h('span', { class: 'opt', text: tasks.filter(function (t) { return !t.done; }).length + ' open' });
    fill(R.tasks,
      h('div', { class: 'ms-box-h' }, h('h3', { text: 'Tasks' }), openEl),
      tasks.length ? h('ul', { class: 'ms-tasks' }, tasks.map(function (t) {
        var cb = h('input', { type: 'checkbox', 'aria-label': 'Done: ' + t.text }); cb.checked = !!t.done;
        var li = h('li', { class: t.done ? 'done' : '' }, cb,
          h('div', null, t.due ? h('span', { class: 'when' + (!t.done && daysUntil(t.due) <= 3 ? ' hot' : ''), text: fmtDate(t.due) + ' · ' + leftLabel(daysUntil(t.due)) }) : null, h('span', { class: 'what', text: t.text })),
          delBtn('task', function () { t.deleted = true; touch(t); renderTasks(); }));
        cb.addEventListener('change', function () { t.done = cb.checked; touch(t); li.className = t.done ? 'done' : '';
          openEl.textContent = live(S.doc.tasks).filter(function (x) { return !x.done; }).length + ' open'; });
        return li;
      })) : hint('Small jobs go here: books to request, readings to print, questions for the instructor.'),
      h('div', { class: 'ms-add' }, text, due, h('button', { class: 'btn', type: 'button', text: 'Add', onclick: addTask })));
  }

  /* ------------------------------------------- 1. what are they saying -- */
  function renderPieces() {
    var ps = pieces();
    R.pieceCount.textContent = pieceCountText();
    fill(R.pieces,
      ps.length ? ps.map(pieceCard) : h('div', { class: 'ms-empty', text: 'No pieces yet. Add each author or text you are reading.' }),
      adder('Add a piece: author, or author and title', 'Add piece', function (v) {
        var p = item({ author: v, title: '', year: '', citation: '', status: 'toread', saying: '', claims: '', passages: '', order: nextOrder(S.doc.pieces), updated: now() });
        S.doc.pieces.push(p); S.open[p.id] = true; changed(); structural();
      }));
  }
  function pieceCard(p) {
    var d = h('details', { class: 'rs-src', open: S.open[p.id] ? true : null });
    d.addEventListener('toggle', function () { S.open[p.id] = d.open; });
    var pill = h('span', { class: 'rs-pill pc-' + p.status, text: label(PIECE_STATUS, p.status) });
    var meta = h('span', { class: 'rs-src-m' });
    function paintMeta() {
      var nq = live(S.doc.claims).reduce(function (n, c) { return n + (c.quotes || []).filter(function (q) { return q.piece === p.id; }).length; }, 0);
      var ns = live(S.doc.secondary).filter(function (s) { return s.piece === p.id; }).length;
      meta.textContent = [p.saying ? p.saying.slice(0, 90) + (p.saying.length > 90 ? '…' : '') : 'No summary yet', ns + ' secondary', nq + (nq === 1 ? ' quote used' : ' quotes used')].join(' · ');
    }
    paintMeta();
    function up(k, after) { return function (v) { p[k] = v; touch(p); if (after) after(); }; }
    function named(k, lbl, ph) { var e = textIn(p[k], lbl, up(k, function () { relabel(p); }), { ph: ph }); return field(lbl, e); }
    var st = sel(PIECE_STATUS, p.status, 'Status', up('status', function () {
      pill.className = 'rs-pill pc-' + p.status; pill.textContent = label(PIECE_STATUS, p.status); renderSummary();
      R.pieceCount.textContent = pieceCountText();
    }));
    d.append(h('summary', null, pill, h('span', { class: 'rs-src-h' }, h('span', { class: 'rs-src-t', 'data-pt': p.id, text: pieceTitle(p) }), meta)),
      h('div', { class: 'rs-src-body' },
        h('div', { class: 'rs-grid2' }, named('author', 'Author'), named('title', 'Title')),
        h('div', { class: 'rs-grid3' }, named('year', 'Year'), field('Status', st), field('Citation', textIn(p.citation, 'Citation', up('citation')))),
        field('What they are saying', textIn(p.saying, 'What they are saying', up('saying', paintMeta), { area: true, rows: 4, ph: 'Their argument, in your words' })),
        field('Key claims, terms and moves', textIn(p.claims, 'Key claims', up('claims'), { area: true, rows: 3 })),
        field('Passages worth quoting', textIn(p.passages, 'Passages worth quoting', up('passages'), { area: true, rows: 3, ph: 'With page numbers' })),
        h('div', { class: 'rs-src-foot' }, delBtn('piece ' + pieceName(p), function () { p.deleted = true; touch(p); structural(); }))));
    return d;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function pieceCountText() { var ps = pieces(); return plural(ps.length, 'piece', 'pieces') + ' · ' + ps.filter(function (p) { return p.status === 'summarized'; }).length + ' summarized'; }
  function claimCountText() { var cl = live(S.doc.claims); return plural(cl.length, 'claim', 'claims') + ' · ' + cl.filter(quoteOk).length + ' with 1–2 quotes'; }
  /* adding or removing a piece changes columns, pickers and groups elsewhere */
  function structural() { renderPieces(); renderCompare(); renderClaims(); renderSecondary(); renderSummary(); renderLog(); }

  /* ------------------------------------------ 2. comparing the authors -- */
  function renderCompare() {
    var ps = pieces(), rows = live(S.doc.compare).sort(byOrder);
    R.cmpCount.textContent = rows.length + (rows.length === 1 ? ' point' : ' points');
    if (!ps.length) { fill(R.cmp, h('div', { class: 'ms-empty', text: 'Add the pieces you are reading under 1; each becomes a column here.' })); return; }
    function cellIn(val, aria, set) { return textIn(val, aria, set, { area: true, rows: 3 }); }
    var body = rows.length ? rows.map(function (r) {
      r.cells = r.cells || {};
      return h('tr', null,
        h('th', { scope: 'row' }, cellIn(r.point, 'Point of comparison', function (v) { r.point = v; touch(r); })),
        ps.map(function (p) { return h('td', null, cellIn(r.cells[p.id], pieceName(p) + ' on this point', function (v) { r.cells[p.id] = v; touch(r); })); }),
        h('td', null, cellIn(r.takeaway, 'Where they meet or split', function (v) { r.takeaway = v; touch(r); })),
        h('td', { class: 'dd-del' }, delBtn('comparison point', function () { r.deleted = true; touch(r); renderCompare(); })));
    }) : h('tr', null, h('td', { class: 'dd-empty', colspan: ps.length + 3, text: 'Add a point of comparison below: a theme, question or term the authors all take up.' }));
    fill(R.cmp,
      h('div', { class: 'dd-scroll' }, h('table', { class: 'dd-matrix' },
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Point of comparison' }),
          ps.map(function (p) { return h('th', { scope: 'col', 'data-pl': p.id, text: pieceName(p) }); }),
          h('th', { scope: 'col', text: 'Where they meet or split' }), h('td'))),
        h('tbody', null, body))),
      adder('Add a point of comparison', 'Add point', function (v) {
        S.doc.compare.push(item({ point: v, cells: {}, takeaway: '', order: nextOrder(S.doc.compare), updated: now() })); changed(); renderCompare();
      }, 'dd-newpoint'));
  }

  /* ---------------------------------- 3. your interpretation → evidence -- */
  function renderClaims() {
    var cl = live(S.doc.claims).sort(byOrder);
    R.claimCount.textContent = claimCountText();
    fill(R.claims,
      cl.length ? h('ol', { class: 'dd-claims' }, cl.map(claimCard)) : h('div', { class: 'ms-empty', text: 'No claims yet. Add each point of your interpretation, then attach its evidence.' }),
      adder('Add a claim: one point of your interpretation', 'Add claim', function (v) {
        S.doc.claims.push(item({ text: v, notes: '', quotes: [], order: nextOrder(S.doc.claims), updated: now() })); changed(); renderClaims(); renderSummary();
      }, 'dd-newclaim'));
  }
  function claimCard(c, i) {
    c.quotes = c.quotes || [];
    var badge = h('span', { class: 'rs-pill dd-qn' });
    var qlist = h('div', { class: 'dd-quotes' });
    function paint() {
      var n = c.quotes.length;
      badge.className = 'rs-pill dd-qn ' + (n === 0 ? 'none' : n <= 2 ? 'ok' : 'over');
      badge.textContent = n === 0 ? 'No quote yet' : n <= 2 ? n + (n === 1 ? ' quote' : ' quotes') : n + ' quotes: pick 1–2';
    }
    function renderQuotes(counts) {
      fill(qlist, c.quotes.map(function (q) { return quoteRow(c, q, function () { renderQuotes(true); }); }));
      paint();
      if (counts) { renderSummary(); R.claimCount.textContent = claimCountText(); renderPieces(); }
    }
    var t = textIn(c.text, 'Claim', function (v) { c.text = v; touch(c); }, { area: true, rows: 2 }); t.className = 'rs-inline rs-strong';
    var li = h('li', { class: 'dd-claim' },
      h('div', { class: 'dd-claim-h' }, h('span', { class: 'rs-num', text: String(i + 1) }), t, badge,
        delBtn('claim', function () { c.deleted = true; touch(c); renderClaims(); renderSummary(); })),
      qlist,
      h('div', { class: 'dd-claim-f' },
        h('button', { class: 'btn btn--small', type: 'button', text: '+ Add a quote', onclick: function () {
          var ps = pieces();
          c.quotes.push({ id: uid(), piece: ps.length === 1 ? ps[0].id : '', page: '', text: '' }); touch(c); renderQuotes(true);
          var boxes = qlist.querySelectorAll('textarea'); if (boxes.length) boxes[boxes.length - 1].focus();
        } }),
        field('Why this evidence supports the claim', textIn(c.notes, 'Why this evidence supports the claim', function (v) { c.notes = v; touch(c); }, { area: true, rows: 1 }))));
    renderQuotes(false);
    return li;
  }
  function quoteRow(c, q, rerender) {
    var ps = pieces();
    var pick = h('select', { 'aria-label': 'Which piece' }, h('option', { value: '', text: 'Which piece?' }),
      ps.map(function (p) { return h('option', { value: p.id, 'data-pl': p.id, text: pieceName(p) }); }));
    pick.value = ps.some(function (p) { return p.id === q.piece; }) ? q.piece : '';
    pick.addEventListener('change', function () { q.piece = pick.value; touch(c); });
    return h('div', { class: 'dd-quote' },
      pick,
      textIn(q.page, 'Page', function (v) { q.page = v; touch(c); }, { ph: 'p.' }),
      textIn(q.text, 'Quote', function (v) { q.text = v; touch(c); }, { area: true, rows: 2, ph: '“…”' }),
      delBtn('quote', function () { c.quotes = c.quotes.filter(function (x) { return x !== q; }); touch(c); rerender(); }));
  }

  /* ----------------------------------------------- 4. secondary analyses -- */
  function renderSecondary() {
    var ps = pieces(), all = live(S.doc.secondary);
    var covered = ps.filter(function (p) { return all.some(function (s) { return s.piece === p.id; }); }).length;
    R.secCount.textContent = all.length + ' secondary · ' + covered + ' of ' + ps.length + ' pieces covered';
    var orphans = all.filter(function (s) { return !ps.some(function (p) { return p.id === s.piece; }); });
    if (!ps.length && !orphans.length) { fill(R.sec, h('div', { class: 'ms-empty', text: 'Add the pieces you are reading under 1; each gets a place here for the scholars who have written about it.' })); return; }
    fill(R.sec,
      ps.map(function (p) { return group(p, all.filter(function (s) { return s.piece === p.id; })); }),
      orphans.length ? group(null, orphans) : null);
  }
  function group(p, items) {
    return h('div', { class: 'dd-group' },
      h('div', { class: 'dd-group-h' }, h('span', { class: 'dd-on', text: 'On' }),
        p ? h('b', { 'data-pt': p.id, text: pieceTitle(p) }) : h('b', { text: 'Not linked to a piece' }),
        h('span', { class: 'c', text: items.length ? items.length + ' secondary' : 'none yet' })),
      items.length ? h('div', { class: 'rs-sources' }, items.map(secCard)) : null,
      p ? adder('Add a secondary source on ' + pieceName(p) + ': author and title', 'Add', function (v) {
        var s = item({ piece: p.id, author: v, title: '', citation: '', status: 'find', reading: '', relation: '', mine: '', updated: now() });
        S.doc.secondary.push(s); S.open[s.id] = true; changed(); renderSecondary(); renderSummary(); renderPieces();
      }) : null);
  }
  function secCard(s) {
    var d = h('details', { class: 'rs-src', open: S.open[s.id] ? true : null });
    d.addEventListener('toggle', function () { S.open[s.id] = d.open; });
    var pill = h('span', { class: 'rs-pill pc-' + s.status, text: label(SEC2_STATUS, s.status) });
    var head = h('span', { class: 'rs-src-t' }), meta = h('span', { class: 'rs-src-m' });
    function repaint() {
      pill.className = 'rs-pill pc-' + s.status; pill.textContent = label(SEC2_STATUS, s.status);
      head.textContent = [s.author, s.title].filter(Boolean).join(', ') || 'Untitled';
      meta.textContent = s.relation ? label(RELATION, s.relation) : 'Not yet compared with your reading';
      meta.className = 'rs-src-m' + (s.relation ? ' rel rel-' + s.relation : '');
    }
    repaint();
    function up(k) { return function (v) { s[k] = v; touch(s); repaint(); }; }
    var ps = pieces();
    var move = h('select', { 'aria-label': 'About which piece' }, ps.map(function (p) { return h('option', { value: p.id, 'data-pl': p.id, text: pieceName(p) }); }));
    move.value = s.piece;
    move.addEventListener('change', function () { s.piece = move.value; touch(s); S.open[s.id] = true; renderSecondary(); renderSummary(); renderPieces(); });
    d.append(h('summary', null, pill, h('span', { class: 'rs-src-h' }, head, meta)),
      h('div', { class: 'rs-src-body' },
        h('div', { class: 'rs-grid2' }, field('Author', textIn(s.author, 'Author', up('author'))), field('Title', textIn(s.title, 'Title', up('title')))),
        h('div', { class: 'rs-grid3' }, field('About', move), field('Status', sel(SEC2_STATUS, s.status, 'Status', up('status'))), field('Citation', textIn(s.citation, 'Citation', up('citation')))),
        field('How they read it', textIn(s.reading, 'How they read it', up('reading'), { area: true, rows: 4, ph: 'Their take on the piece, and how they think about it' })),
        h('div', { class: 'rs-grid2' },
          field('Against your reading', sel(RELATION, s.relation, 'Against your reading', up('relation'))),
          field('Why', textIn(s.mine, 'Why', up('mine'), { area: true, rows: 2 }))),
        h('div', { class: 'rs-src-foot' }, delBtn('secondary source', function () { s.deleted = true; touch(s); renderSecondary(); renderSummary(); renderPieces(); }))));
    return d;
  }

  /* ------------------------------------------------------------ outline -- */
  function renderOutlineTotal() {
    var pi = pageInfo();
    R.outTotal.textContent = pi.w.toLocaleString() + ' words ≈ ' + pi.pages.toFixed(1) + ' pages of ' + pi.lo + '–' + pi.hi;
  }
  function renderOutline() {
    var secs = live(S.doc.outline).sort(byOrder);
    renderOutlineTotal();
    function move(i, d) {
      var a = secs[i], b = secs[i + d]; if (!b) return;
      var t = a.order; a.order = b.order; b.order = t; a.updated = b.updated = now(); changed(); renderOutline();
    }
    var rows = secs.map(function (s, i) {
      var title = textIn(s.title, 'Section title', function (v) { s.title = v; touch(s); }, { area: true, rows: 1 }); title.className = 'rs-inline rs-strong';
      var st = sel(SEC_STATUS, s.status, 'Status of ' + s.title, function (v) { s.status = v; touch(s); st.className = 'sec-' + (v || 'none'); });
      st.className = 'sec-' + (s.status || 'none');
      var w = textIn(s.words, 'Words written', function (v) { s.words = v; touch(s); renderOutlineTotal(); renderSummary(); }, { type: 'number', ph: 'words' });
      var notes = textIn(s.notes, 'Notes for ' + s.title, function (v) { s.notes = v; touch(s); }, { area: true, rows: 1, ph: 'What goes here' });
      var tx = sectionText(s, w, function () { renderOutlineTotal(); renderSummary(); });
      return h('div', { class: 'rs-sec-row dd-sec-row' },
        h('span', { class: 'rs-num', text: String(i + 1) }),
        h('div', { class: 'rs-sec-main' }, title, notes, tx.button, tx.box),
        h('div', { class: 'rs-sec-side' }, st, w),
        h('div', { class: 'rs-sec-ctl' },
          h('button', { class: 'icon', type: 'button', 'aria-label': 'Move up', text: '↑', disabled: i === 0 ? true : null, onclick: function () { move(i, -1); } }),
          h('button', { class: 'icon', type: 'button', 'aria-label': 'Move down', text: '↓', disabled: i === secs.length - 1 ? true : null, onclick: function () { move(i, 1); } }),
          delBtn('section', function () { s.deleted = true; touch(s); renderOutline(); renderSummary(); })));
    });
    fill(R.outline, rows, adder('Add a section', 'Add section', function (v) {
      S.doc.outline.push(item({ title: v, status: '', words: null, notes: '', order: nextOrder(S.doc.outline), updated: now() })); changed(); renderOutline();
    }, 'dd-newsec'));
  }

  /* A section's own text: write or paste it here and its word count keeps itself up to date.
     With no text, the count box stays free for a number typed in by hand (for drafts kept elsewhere). */
  function sectionText(s, w, after) {
    var box = textIn(s.text, 'Text of ' + (s.title || 'this section'), function (v) {
      s.text = v; s.words = countWords(v) || null; touch(s); sync(); after();
    }, { area: true, rows: 10, ph: 'Write or paste this section here; its words are counted as you type.' });
    box.className = 'rs-draft'; box.hidden = !S.openText[s.id];
    var button = h('button', { class: 'rs-draft-btn', type: 'button', onclick: function () {
      box.hidden = !box.hidden; S.openText[s.id] = !box.hidden; sync(); if (!box.hidden) box.focus();
    } });
    function sync() {
      var auto = !!(s.text && s.text.trim());
      w.readOnly = auto; w.classList.toggle('rs-auto', auto); w.title = auto ? 'Counted from the section’s text' : '';
      if (auto || s.words == null) w.value = s.words == null ? '' : s.words;
      button.textContent = !box.hidden ? 'Hide text' : auto ? 'Show text' : 'Write or paste the text';
      button.setAttribute('aria-expanded', String(!box.hidden));
    }
    sync();
    return { box: box, button: button };
  }

  /* ---------------------------------------------------------------- log -- */
  function renderLog() {
    var ps = pieces(), byId = {};
    ps.forEach(function (p) { byId[p.id] = p; });
    var tag = sel(TAGS, 'note', 'Kind of entry', function () {});
    var pc = h('select', { 'aria-label': 'Related piece (optional)' }, h('option', { value: '', text: 'No piece' }), ps.map(function (p) { return h('option', { value: p.id, 'data-pl': p.id, text: pieceName(p) }); }));
    var ta = R.logTa;
    var entries = live(S.doc.log).filter(function (e) { return !S.tag || e.tag === S.tag; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var chips = h('div', { class: 'ms-tracks' }, [['', 'All']].concat(TAGS).map(function (t) {
      return h('button', { type: 'button', 'aria-pressed': S.tag === t[0] ? 'true' : 'false', text: t[1], onclick: function () { S.tag = t[0]; renderLog(); } });
    }));
    fill(R.log,
      h('div', { class: 'ms-box-h' }, h('h3', { text: 'Notes' }), h('span', { class: 'opt', text: plural(live(S.doc.log).length, 'entry', 'entries') })),
      ta, S.att.el, h('div', { class: 'rs-logopts dd-logopts' }, tag, pc, AdminAttach.addButton('Add note', S.att, ta, function (v, files) {
        S.doc.log.push(item({ date: now(), tag: tag.value, piece: pc.value || '', text: v, files: files, updated: now() })); changed(); renderLog();
      })),
      chips,
      entries.length ? h('ul', { class: 'ms-journal' }, entries.map(function (e) {
        var p = h('p', { text: e.text }), pp = e.piece && byId[e.piece];
        return h('li', null,
          h('span', { class: 'd' },
            h('span', null, h('span', { class: 'rs-pill tag-' + e.tag, text: label(TAGS, e.tag) }), ' ',
              new Date(e.date).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
              pp ? ' · ' + pieceName(pp) : ''),
            h('span', null,
              h('button', { class: 'ms-x', type: 'button', text: 'Edit', onclick: function () {
                var ed = h('textarea', { rows: 3, 'aria-label': 'Edit note' }); ed.value = e.text;
                p.replaceWith(h('div', null, ed, h('div', { class: 'rs-row' },
                  h('button', { class: 'btn btn--small btn--primary', type: 'button', text: 'Save', onclick: function () { e.text = ed.value; touch(e); renderLog(); } }),
                  h('button', { class: 'btn btn--small', type: 'button', text: 'Cancel', onclick: renderLog }))));
                ed.focus();
              } }),
              delBtn('note', function () { e.deleted = true; touch(e); renderLog(); }))),
          p, AdminAttach.view(e.files));
      })) : hint(S.tag ? 'No notes of this kind yet.' : 'Readings, ideas, questions and meetings with your instructor go here.'));
  }

  A.register('dying', function (panel) { root = panel; load(); });
  A.on('connect', function () { if (root) load(); });
})();
