/* Present › Sikh research tab for admin.html.

   Everything lives in one file in the PRIVATE data repository:
     research/sikh.json   project details, milestones, paper outline, sources,
                          open questions, tasks and the research log

   The first time the tab opens, it starts the file with your Khalsa-authority
   project (question, argument and source groups from your Sikh Studies page)
   and a suggested plan for the fellowship term, all editable.
   Changes save about two seconds after you stop, are kept on this device if
   you are offline, and are merged item by item if another device saved first. */
(function () {
  'use strict';
  var A = window.AdminCore;
  if (!A) return;

  var PATH = 'research/sikh.json', CACHE = 'adm.sikh.cache';
  var SRC_TYPE = [['gurmukhi', 'Primary · Gurmukhi'], ['persian', 'Primary · Persian'], ['european', 'Primary · European'], ['secondary', 'Secondary'], ['other', 'Other']];
  var SRC_STATUS = [['find', 'To find'], ['found', 'Found'], ['reading', 'Reading'], ['read', 'Read'], ['notes', 'Notes done'], ['cited', 'Cited']];
  var SEC_STATUS = [['', 'Not started'], ['notes', 'Notes'], ['drafting', 'Drafting'], ['drafted', 'Drafted'], ['revised', 'Revised']];
  var Q_STATUS = [['open', 'Open'], ['answered', 'Answered'], ['parked', 'Parked']];
  var TAGS = [['note', 'Note'], ['reading', 'Reading'], ['finding', 'Finding'], ['idea', 'Idea'], ['question', 'Question'], ['meeting', 'Meeting']];
  var SCOPE = [['paper', 'For the paper'], ['general', 'General research']];
  var READ = { read: 1, notes: 1, cited: 1 };
  function label(list, v) { var x = list.filter(function (o) { return o[0] === v; })[0]; return x ? x[1] : v; }

  var S = { doc: null, sha: null, repoOk: false, pending: false, saving: false, rev: 0, err: '', savedAt: null, timer: null,
            f: { q: '', scope: '', type: '', status: '' }, lf: { tag: '', scope: '' }, openSrc: null, openText: {} };
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
  function fmtDate(iso) { try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) { return iso; } }
  function leftLabel(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? Math.abs(n) + 'd overdue' : n + ' days'; }
  function live(arr) { return (arr || []).filter(function (x) { return !x.deleted; }); }
  /* words as Google Docs counts them: space-separated, punctuation on its own doesn't count, hyphenated words count once */
  function countWords(t) { return String(t || '').split(/\s+/).filter(function (w) { return /[\p{L}\p{N}]/u.test(w); }).length; }
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
  function delBtn(what, onyes) {
    return h('button', { class: 'ms-x', type: 'button', 'aria-label': 'Delete ' + what, title: 'Delete', text: '✕', onclick: function (e) {
      var b = e.currentTarget;
      if (b.dataset.arm) { onyes(); return; }
      b.dataset.arm = '1'; b.textContent = 'Delete?';
      setTimeout(function () { if (b.isConnected) { delete b.dataset.arm; b.textContent = '✕'; } }, 3500);
    } });
  }

  /* ------------------------------------------------------------- seed -- */
  function P(v) { return { v: v, updated: '2026-09-24T00:00:00Z' }; }
  function item(o) { o.id = o.id || uid(); o.updated = o.updated || '2026-09-24T00:00:00Z'; return o; }
  function seed() {
    var ms = [
      ['2026-09-30', 'Settle the research question and scope with Satnam'],
      ['2026-10-14', 'Survey the sources: what is accessible for each source group'],
      ['2026-10-28', 'Goal 1: map the intellectual landscape and its specific conflicts'],
      ['2026-11-11', 'Outline the paper and share it with Satnam'],
      ['2026-11-25', 'Full draft'],
      ['2026-12-04', 'Revise after mentor feedback'],
      ['2026-12-11', 'Prepare the presentation'],
      ['2026-12-15', 'Submit the paper and give the presentation'],
      ['2026-12-15', 'Stretch, goal 2: prosopography linking intellectual influences to political figures']
    ];
    var outline = [
      'Introduction: a contested panth and the question',
      'Historiography: how the Khalsa’s dominance has been explained',
      'The claimants: Bandai Khalsa, Minas, Ram Raiyas, Hindaliyas',
      'Katha and transmission: Bhai Mani Singh and “authentic” teaching',
      'Hukamname and rahit-nama as instruments of authority',
      'Persian and European accounts: what outsiders saw',
      'Interpretation before power: the argument',
      'Stretch: prosopography of influences and political figures',
      'Conclusion'
    ];
    var sources = [
      ['Works attributed to Bhai Mani Singh', 'gurmukhi'], ['Hukamname', 'gurmukhi'], ['Rahit-nama literature', 'gurmukhi'],
      ['Sampardaic literature', 'gurmukhi'], ['Persian accounts of the period', 'persian'], ['European accounts of the period', 'european']
    ];
    var questions = [
      'How did the Khalsa prevail over the Bandai Khalsa, Minas, Ram Raiyas and Hindaliyas?',
      'What counted as “authentic Sikh teachings”, and who decided?',
      'How did katha circulate, and who controlled it?',
      'Which intellectual influences connect to which political figures? (prosopography)'
    ];
    return {
      version: 1, updated: null,
      plan: {
        title: P('Dissemination and the making of Khalsa authority in a contested panth'),
        program: P('Emerging Scholars Research Fellowship, Harvard Sikh Center'),
        mentor: P('Satnam Singh'),
        start: P('2026-09-15'), end: P('2026-12-15'),
        target: P(null),
        question: P('Within decades of its founding, the Khalsa asserted dominance over the wider Sikh world — but it was one claimant among several. The Bandai Khalsa, Minas, Ram Raiyas, and Hindaliyas all advanced competing claims to Sikh authority. How did one prevail?'),
        argument: P('That the answer lies less in politics than in transmission. The Khalsa’s consolidation of what counted as “authentic Sikh teachings” — and the medium of katha through which that teaching circulated — was instrumental to its eventual dominance. Control of interpretation preceded and enabled control of the panth.'),
        method: P('Gurmukhi and Persian primary materials: works attributed to Bhai Mani Singh, hukamname, rahit-nama and sampardaic literature, alongside Persian and European accounts of the period. First goal: characterize the intellectual landscape and its specific conflicts. Second, more ambitious: a prosopography linking intellectual influences to the political figures of the period.'),
        deliverables: P('A paper and a presentation at the end of the fellowship term.')
      },
      milestones: ms.map(function (m) { return item({ due: m[0], text: m[1], done: false, suggested: true }); }),
      outline: outline.map(function (t, i) { return item({ title: t, status: '', words: null, target: null, notes: '', order: i + 1 }); }),
      sources: sources.map(function (s) { return item({ title: s[0], author: '', type: s[1], status: 'find', scope: 'paper', where: '', citation: '', notes: '', quotes: '' }); }),
      questions: questions.map(function (q) { return item({ text: q, status: 'open', notes: '' }); }),
      tasks: [],
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
    var rev = S.rev, body = { message: 'Update Sikh research tracker', content: A.b64encode(JSON.stringify(S.doc, null, 1) + '\n') };
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
    fill(root, h('p', { class: 'ms-empty', text: 'Loading your research tracker…' }));
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
      fill(root, h('div', { class: 'note note--err', text: 'Could not load the tracker: ' + e.message }));
    });
  }
  function setup(kind) {
    var c = A.cfg(), name = c.dataRepo.split('/')[1] || 'admin-data';
    var box = h('div', { class: 'ms-setup' }, h('h2', { text: 'Sikh research' }));
    if (kind === 'token') box.append(h('p', { text: 'Connect GitHub in Settings first. Your research tracker is saved to a private repository with the same token.' }),
      h('p', null, h('button', { class: 'btn btn--primary', type: 'button', text: 'Open Settings', onclick: A.goSettings })));
    if (kind === 'norepo') box.append(h('p', null, 'The tracker is kept in a private repository, ', h('b', { text: c.dataRepo }), ', which this token can’t reach yet.'),
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

  function renderMain(fresh) {
    R.sync = h('div', { class: 'ms-sync', role: 'status', 'aria-live': 'polite' });
    R.eyebrow = h('p', { class: 'eyebrow' }); R.title = h('h2');
    R.project = h('div', { class: 'rs-project' });
    R.sum = h('div', { class: 'ms-sum' });
    R.ms = h('div', { class: 'ms-box' }); R.tasks = h('div', { class: 'ms-box' });
    R.outline = h('div', { class: 'rs-outline' }); R.outTotal = h('span', { class: 'c' });
    R.srcFilters = h('div', { class: 'ms-filters rs-filters' }); R.src = h('div', { class: 'rs-sources' }); R.srcCount = h('span', { class: 'c' });
    R.log = h('div', { class: 'ms-box ms-notes' });
    R.logTa = h('textarea', { rows: 2, id: 'rs-newlog', placeholder: 'What did you read, find, decide or wonder about?', 'aria-label': 'New log entry' });
    S.att = S.att || AdminAttach.composer('research/attachments/sikh');   /* one per visit: a draft's files survive re-draws */
    S.att.bind(R.logTa);
    R.qs = h('div', { class: 'ms-box' });
    fill(root, h('div', { class: 'ms rs' },
      h('div', { class: 'ms-head' }, h('div', null, R.eyebrow, R.title),
        h('div', { class: 'ms-sync-wrap' }, R.sync, h('button', { class: 'btn btn--small', type: 'button', text: 'Reload', onclick: load }))),
      h('details', { class: 'ms-sec', open: fresh ? true : null },
        h('summary', null, h('h3', { text: 'The project' }), h('span', { class: 'c', text: 'Question, argument, sources, dates' })), R.project),
      R.sum,
      h('div', { class: 'ms-cols' }, R.ms, R.tasks),
      h('section', { class: 'rs-sec', 'aria-label': 'Paper outline' }, h('div', { class: 'ms-box-h' }, h('h3', { text: 'Paper outline' }), R.outTotal), R.outline),
      h('section', { class: 'rs-sec', 'aria-label': 'Sources' }, h('div', { class: 'ms-box-h' }, h('h3', { text: 'Sources' }), R.srcCount), R.srcFilters, R.src),
      h('div', { class: 'ms-cols' }, R.log, R.qs)));
    renderAll();
  }
  function renderAll() {
    if (!R.sum) return;
    renderSync(); renderHead(); renderProject(); renderSummary(); renderMilestones(); renderTasks(); renderOutline(); renderSrcFilters(); renderSources(); renderLog(); renderQuestions();
  }
  function renderHead() {
    R.eyebrow.textContent = [plan('program'), plan('mentor') ? 'Mentor: ' + plan('mentor') : ''].filter(Boolean).join(' · ');
    R.title.textContent = plan('title') || 'Sikh research';
  }

  function renderProject() {
    function area(k, lbl, rows) { return field(lbl, textIn(plan(k), lbl, function (v) { setPlan(k, v); if (k === 'title' || k === 'program' || k === 'mentor') renderHead(); }, { area: true, rows: rows || 3 })); }
    function one(k, lbl, type, after) { return field(lbl, textIn(plan(k), lbl, function (v) { setPlan(k, v); renderHead(); if (after) after(); }, { type: type })); }
    fill(R.project,
      h('div', { class: 'rs-grid2' }, area('title', 'Working title', 1), h('div', { class: 'rs-grid2' }, one('program', 'Fellowship or course'), one('mentor', 'Mentor'))),
      h('div', { class: 'rs-grid3' }, one('start', 'Term starts', 'date', renderSummary), one('end', 'Term ends', 'date', renderSummary), one('target', 'Word target for the paper', 'number', function () { renderSummary(); renderOutline(); })),
      area('question', 'Research question'), area('argument', 'Argument'), area('method', 'Sources and method'), area('deliverables', 'What you owe, and when', 2));
  }

  function renderSummary() {
    var start = plan('start'), end = plan('end'), t = today(), term;
    if (start && end) {
      var total = Math.max(1, daysUntil(end) - daysUntil(start)), gone = -daysUntil(start);
      var weeks = Math.ceil(total / 7);
      if (t < start) term = stat('Fellowship term', 'Starts in ' + daysUntil(start) + 'd', fmtDate(start) + ' – ' + fmtDate(end), 0);
      else if (t > end) term = stat('Fellowship term', 'Ended', fmtDate(start) + ' – ' + fmtDate(end), 100);
      else term = stat('Fellowship term', 'Week ' + (Math.floor(gone / 7) + 1) + ' of ' + weeks, daysUntil(end) + ' days left, ends ' + fmtDate(end), Math.round(100 * gone / total));
    } else term = stat('Fellowship term', '—', 'Set the term dates under The project');
    var ms = live(S.doc.milestones), done = ms.filter(function (m) { return m.done; }).length;
    var next = ms.filter(function (m) { return !m.done; }).sort(byDue)[0];
    var secs = live(S.doc.outline), words = secs.reduce(function (n, s) { return n + (Number(s.words) || 0); }, 0), target = Number(plan('target')) || 0;
    var drafted = secs.filter(function (s) { return s.status === 'drafted' || s.status === 'revised'; }).length;
    var src = live(S.doc.sources), read = src.filter(function (s) { return READ[s.status]; }).length, tofind = src.filter(function (s) { return s.status === 'find'; }).length;
    fill(R.sum,
      term,
      stat('Milestones', done + '/' + ms.length, next ? 'Next: ' + next.text + (next.due ? ' (' + leftLabel(daysUntil(next.due)) + ')' : '') : 'All done', ms.length ? Math.round(100 * done / ms.length) : 0),
      stat('Draft', words.toLocaleString() + (target ? ' / ' + target.toLocaleString() : '') + ' words', drafted + ' of ' + secs.length + ' sections drafted' + (target ? '' : ' · set a word target'), target ? Math.min(100, Math.round(100 * words / target)) : null),
      stat('Sources', read + '/' + src.length + ' read', tofind + ' still to find', src.length ? Math.round(100 * read / src.length) : 0));
    function stat(k, n, s, bar) {
      return h('div', { class: 'ms-stat' }, h('span', { class: 'k', text: k }), h('span', { class: 'n rs-n', text: n }), h('span', { class: 's', text: s }),
        bar != null ? h('div', { class: 'ms-bar', role: 'img', 'aria-label': bar + '%' }, h('i', { style: 'width:' + bar + '%' })) : null);
    }
  }
  function byDue(a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0; }

  function renderMilestones() {
    var ms = live(S.doc.milestones).sort(byDue);
    var text = h('input', { type: 'text', placeholder: 'Add a milestone', 'aria-label': 'New milestone', id: 'rs-newms' });
    var due = h('input', { type: 'date', 'aria-label': 'Milestone date' });
    function addMs() {
      var v = text.value.trim(); if (!v) { text.focus(); return; }
      S.doc.milestones.push(item({ text: v, due: due.value || '', done: false, updated: now() })); changed(); renderMilestones(); renderSummary();
      document.getElementById('rs-newms').focus();
    }
    text.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addMs(); } });
    fill(R.ms,
      h('div', { class: 'ms-box-h' }, h('h3', { text: 'Milestones' }), ms.some(function (m) { return m.suggested; }) ? h('span', { class: 'opt', text: 'Suggested plan: edit freely' }) : null),
      h('ul', { class: 'ms-tasks rs-ms' }, ms.map(function (m) {
        var cb = h('input', { type: 'checkbox', 'aria-label': 'Done: ' + m.text }); cb.checked = !!m.done;
        var li;
        cb.addEventListener('change', function () { m.done = cb.checked; touch(m); li.className = m.done ? 'done' : ''; renderSummary(); });
        var n = m.due ? daysUntil(m.due) : null;
        var t = textIn(m.text, 'Milestone', function (v) { m.text = v; touch(m); }, { area: true, rows: 1 });
        t.className = 'rs-inline';
        var d = textIn(m.due, 'Date for ' + m.text, function (v) { m.due = v; touch(m); renderSummary(); }, { type: 'date' });
        d.className = 'rs-date';
        li = h('li', { class: m.done ? 'done' : '' }, cb,
          h('div', null, t, h('span', { class: 'rs-due' }, d, n != null && !m.done ? h('span', { class: 'ms-days ' + (n < 0 || n <= 7 ? 'hot' : n <= 21 ? 'soon' : ''), text: leftLabel(n) }) : null)),
          delBtn('milestone', function () { m.deleted = true; touch(m); renderMilestones(); renderSummary(); }));
        return li;
      })),
      h('div', { class: 'ms-add' }, text, due, h('button', { class: 'btn', type: 'button', text: 'Add', onclick: addMs })));
  }

  function renderTasks() {
    var tasks = live(S.doc.tasks).sort(function (a, b) { return (a.done - b.done) || byDue(a, b); });
    var text = h('input', { type: 'text', placeholder: 'Add a task: email an archive, request a scan…', 'aria-label': 'New task', id: 'rs-newtask' });
    var due = h('input', { type: 'date', 'aria-label': 'Due date (optional)' });
    function addTask() {
      var v = text.value.trim(); if (!v) { text.focus(); return; }
      S.doc.tasks.push(item({ text: v, due: due.value || '', done: false, updated: now() })); changed(); renderTasks();
      document.getElementById('rs-newtask').focus();
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
      })) : h('p', { class: 'rs-hint', text: 'Small jobs go here: emails to archives, scans to request, books to recall.' }),
      h('div', { class: 'ms-add' }, text, due, h('button', { class: 'btn', type: 'button', text: 'Add', onclick: addTask })));
  }

  function renderOutline() {
    var secs = live(S.doc.outline).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var words = secs.reduce(function (n, s) { return n + (Number(s.words) || 0); }, 0), target = Number(plan('target')) || 0;
    R.outTotal.textContent = words.toLocaleString() + ' words' + (target ? ' of ' + target.toLocaleString() : '');
    function total() { R.outTotal.textContent = live(S.doc.outline).reduce(function (n, x) { return n + (Number(x.words) || 0); }, 0).toLocaleString() + ' words' + (target ? ' of ' + target.toLocaleString() : ''); }
    function move(i, d) {
      var a = secs[i], b = secs[i + d]; if (!b) return;
      var t = a.order; a.order = b.order; b.order = t; a.updated = b.updated = now(); changed(); renderOutline();
    }
    var rows = secs.map(function (s, i) {
      var pct = s.target ? Math.min(100, Math.round(100 * (Number(s.words) || 0) / s.target)) : null;
      var bar = h('div', { class: 'ms-bar' }, h('i', { style: 'width:' + (pct || 0) + '%' }));
      function paint() { var p = s.target ? Math.min(100, Math.round(100 * (Number(s.words) || 0) / s.target)) : 0; bar.firstChild.style.width = p + '%'; }
      var title = textIn(s.title, 'Section title', function (v) { s.title = v; touch(s); }, { area: true, rows: 1 }); title.className = 'rs-inline rs-strong';
      var st = sel(SEC_STATUS, s.status, 'Status of ' + s.title, function (v) { s.status = v; touch(s); st.className = 'sec-' + (v || 'none'); renderSummary(); });
      st.className = 'sec-' + (s.status || 'none');
      var w = textIn(s.words, 'Words written', function (v) { s.words = v; touch(s); paint(); renderSummary(); total(); }, { type: 'number', ph: '0' });
      var tx = sectionText(s, w, function () { paint(); renderSummary(); total(); });
      var tg = textIn(s.target, 'Target words', function (v) { s.target = v; touch(s); paint(); }, { type: 'number', ph: 'target' });
      var notes = textIn(s.notes, 'Notes for ' + s.title, function (v) { s.notes = v; touch(s); }, { area: true, rows: 1, ph: 'Notes, sources to use, points to make' });
      return h('div', { class: 'rs-sec-row' },
        h('span', { class: 'rs-num', text: String(i + 1) }),
        h('div', { class: 'rs-sec-main' }, title, notes, tx.button, tx.box),
        h('div', { class: 'rs-sec-side' }, st, h('div', { class: 'rs-words' }, w, h('span', { text: '/' }), tg), bar),
        h('div', { class: 'rs-sec-ctl' },
          h('button', { class: 'icon', type: 'button', 'aria-label': 'Move up', text: '↑', disabled: i === 0 ? true : null, onclick: function () { move(i, -1); } }),
          h('button', { class: 'icon', type: 'button', 'aria-label': 'Move down', text: '↓', disabled: i === secs.length - 1 ? true : null, onclick: function () { move(i, 1); } }),
          delBtn('section', function () { s.deleted = true; touch(s); renderOutline(); renderSummary(); })));
    });
    var nt = h('input', { type: 'text', placeholder: 'Add a section', 'aria-label': 'New section', id: 'rs-newsec' });
    function addSec() {
      var v = nt.value.trim(); if (!v) { nt.focus(); return; }
      var max = secs.reduce(function (m, s) { return Math.max(m, s.order || 0); }, 0);
      S.doc.outline.push(item({ title: v, status: '', words: null, target: null, notes: '', order: max + 1, updated: now() })); changed(); renderOutline(); renderSummary();
      document.getElementById('rs-newsec').focus();
    }
    nt.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addSec(); } });
    fill(R.outline, rows, h('div', { class: 'ms-add rs-add2' }, nt, h('button', { class: 'btn', type: 'button', text: 'Add section', onclick: addSec })));
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

  /* ----------------------------------------------------------- sources -- */
  function renderSrcFilters() {
    var f = S.f;
    var q = h('input', { type: 'search', placeholder: 'Search titles, authors, notes, quotes', 'aria-label': 'Search sources' }); q.value = f.q;
    q.addEventListener('input', function () { f.q = q.value; renderSources(); });
    function pick(list, key, aria, allLabel) {
      var s = h('select', { 'aria-label': aria }, h('option', { value: '', text: allLabel }), list.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      s.value = f[key]; s.addEventListener('change', function () { f[key] = s.value; renderSources(); });
      return s;
    }
    fill(R.srcFilters, h('div', { class: 'ms-frow' }, q, pick(SCOPE, 'scope', 'Scope', 'Paper and general'), pick(SRC_TYPE, 'type', 'Type', 'All types'), pick(SRC_STATUS, 'status', 'Status', 'Any status')));
  }
  function srcMatches(s) {
    var f = S.f, q = f.q.trim().toLowerCase();
    if (f.scope && s.scope !== f.scope) return false;
    if (f.type && s.type !== f.type) return false;
    if (f.status && s.status !== f.status) return false;
    if (q && [s.title, s.author, s.where, s.citation, s.notes, s.quotes].join(' ').toLowerCase().indexOf(q) < 0) return false;
    return true;
  }
  function renderSources() {
    var all = live(S.doc.sources), shown = all.filter(srcMatches);
    var read = all.filter(function (s) { return READ[s.status]; }).length;
    R.srcCount.textContent = all.length + ' sources · ' + read + ' read';
    var title = h('input', { type: 'text', placeholder: 'Add a source: a text, archive item, book or article', 'aria-label': 'New source', id: 'rs-newsrc' });
    var type = sel(SRC_TYPE, 'secondary', 'Type of new source', function () {});
    var scope = sel(SCOPE, 'paper', 'Scope of new source', function () {});
    function addSrc() {
      var v = title.value.trim(); if (!v) { title.focus(); return; }
      var s = item({ title: v, author: '', type: type.value, status: 'find', scope: scope.value, where: '', citation: '', notes: '', quotes: '', updated: now() });
      S.doc.sources.push(s); S.openSrc = s.id; changed(); renderSources(); renderSummary(); renderLog();
    }
    title.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addSrc(); } });
    fill(R.src,
      shown.length ? shown.map(srcRow) : h('div', { class: 'ms-empty', text: all.length ? 'No sources match these filters.' : 'No sources yet.' }),
      h('div', { class: 'ms-add rs-add3' }, title, type, scope, h('button', { class: 'btn', type: 'button', text: 'Add source', onclick: addSrc })));
  }
  function srcRow(s) {
    var d = h('details', { class: 'rs-src', open: S.openSrc === s.id ? true : null });
    d.addEventListener('toggle', function () { if (d.open) S.openSrc = s.id; });
    var pill = h('span', { class: 'rs-pill src-' + s.status, text: label(SRC_STATUS, s.status) });
    var head = h('span', { class: 'rs-src-t', text: s.title || 'Untitled source' });
    var meta = h('span', { class: 'rs-src-m', text: [s.author, label(SRC_TYPE, s.type), s.scope === 'general' ? 'General' : 'Paper'].filter(Boolean).join(' · ') });
    function repaint() {
      pill.className = 'rs-pill src-' + s.status; pill.textContent = label(SRC_STATUS, s.status);
      head.textContent = s.title || 'Untitled source';
      meta.textContent = [s.author, label(SRC_TYPE, s.type), s.scope === 'general' ? 'General' : 'Paper'].filter(Boolean).join(' · ');
    }
    function up(k) { return function (v) { s[k] = v; touch(s); repaint(); if (k === 'status') { renderSummary(); R.srcCount.textContent = live(S.doc.sources).length + ' sources · ' + live(S.doc.sources).filter(function (x) { return READ[x.status]; }).length + ' read'; } }; }
    d.append(h('summary', null, pill, h('span', { class: 'rs-src-h' }, head, meta)),
      h('div', { class: 'rs-src-body' },
        h('div', { class: 'rs-grid2' }, field('Title', textIn(s.title, 'Title', up('title'))), field('Author or attribution', textIn(s.author, 'Author', up('author')))),
        h('div', { class: 'rs-grid3' }, field('Type', sel(SRC_TYPE, s.type, 'Type', up('type'))), field('Status', sel(SRC_STATUS, s.status, 'Status', up('status'))), field('For', sel(SCOPE, s.scope, 'Scope', up('scope')))),
        h('div', { class: 'rs-grid2' }, field('Where to find it', textIn(s.where, 'Where to find it', up('where'), { ph: 'Library, archive, collection, link' })), field('Citation', textIn(s.citation, 'Citation', up('citation')))),
        field('Notes', textIn(s.notes, 'Notes', up('notes'), { area: true, rows: 3 })),
        field('Key passages and quotes', textIn(s.quotes, 'Key passages', up('quotes'), { area: true, rows: 3, ph: 'With folio or page numbers' })),
        h('div', { class: 'rs-src-foot' }, delBtn('source ' + s.title, function () { s.deleted = true; touch(s); renderSources(); renderSummary(); }))));
    return d;
  }

  /* -------------------------------------------------------- log, questions -- */
  function renderLog() {
    var srcs = live(S.doc.sources);
    var tag = sel(TAGS, 'note', 'Kind of entry', function () {}), scope = sel(SCOPE, 'paper', 'Scope of entry', function () {});
    var src = h('select', { 'aria-label': 'Related source (optional)' }, h('option', { value: '', text: 'No source' }), srcs.map(function (s) { return h('option', { value: s.id, text: s.title }); }));
    var ta = R.logTa;
    var entries = live(S.doc.log).filter(function (e) { return (!S.lf.tag || e.tag === S.lf.tag) && (!S.lf.scope || e.scope === S.lf.scope); })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var chips = h('div', { class: 'ms-tracks' }, [['', 'All']].concat(TAGS).map(function (t) {
      return h('button', { type: 'button', 'aria-pressed': S.lf.tag === t[0] ? 'true' : 'false', text: t[1], onclick: function () { S.lf.tag = t[0]; renderLog(); } });
    }));
    var byId = {}; srcs.forEach(function (s) { byId[s.id] = s; });
    fill(R.log,
      h('div', { class: 'ms-box-h' }, h('h3', { text: 'Research log' }), h('span', { class: 'opt', text: live(S.doc.log).length + ' entries' })),
      ta, S.att.el, h('div', { class: 'rs-logopts' }, tag, scope, src, AdminAttach.addButton('Add to log', S.att, ta, function (v, files) {
        S.doc.log.push(item({ date: now(), tag: tag.value, scope: scope.value, source: src.value || '', text: v, files: files, updated: now() })); changed(); renderLog();
      })),
      chips,
      entries.length ? h('ul', { class: 'ms-journal' }, entries.map(function (e) {
        var p = h('p', { text: e.text });
        var s = e.source && byId[e.source];
        return h('li', null,
          h('span', { class: 'd' },
            h('span', null, h('span', { class: 'rs-pill tag-' + e.tag, text: label(TAGS, e.tag) }), ' ',
              new Date(e.date).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
              e.scope === 'general' ? ' · general' : '', s ? ' · ' + s.title : ''),
            h('span', null,
              h('button', { class: 'ms-x', type: 'button', text: 'Edit', onclick: function () {
                var ed = h('textarea', { rows: 3, 'aria-label': 'Edit entry' }); ed.value = e.text;
                p.replaceWith(h('div', null, ed, h('div', { class: 'rs-row' },
                  h('button', { class: 'btn btn--small btn--primary', type: 'button', text: 'Save', onclick: function () { e.text = ed.value; touch(e); renderLog(); } }),
                  h('button', { class: 'btn btn--small', type: 'button', text: 'Cancel', onclick: renderLog }))));
                ed.focus();
              } }),
              delBtn('log entry', function () { e.deleted = true; touch(e); renderLog(); }))),
          p, AdminAttach.view(e.files));
      })) : h('p', { class: 'rs-hint', text: S.lf.tag ? 'No entries of this kind yet.' : 'Log readings, findings, ideas and mentor meetings here, for the paper or for your wider research.' }));
  }

  function renderQuestions() {
    var qs = live(S.doc.questions);
    var order = { open: 0, parked: 1, answered: 2 };
    qs.sort(function (a, b) { return order[a.status] - order[b.status]; });
    var nt = h('input', { type: 'text', placeholder: 'Add a question', 'aria-label': 'New question', id: 'rs-newq' });
    function addQ() {
      var v = nt.value.trim(); if (!v) { nt.focus(); return; }
      S.doc.questions.push(item({ text: v, status: 'open', notes: '', updated: now() })); changed(); renderQuestions();
      document.getElementById('rs-newq').focus();
    }
    nt.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addQ(); } });
    fill(R.qs,
      h('div', { class: 'ms-box-h' }, h('h3', { text: 'Open questions' }), h('span', { class: 'opt', text: qs.filter(function (q) { return q.status === 'open'; }).length + ' open' })),
      h('ul', { class: 'rs-qs' }, qs.map(function (q) {
        var st = sel(Q_STATUS, q.status, 'Status', function (v) { q.status = v; touch(q); li.className = 'q-' + v; });
        var t = textIn(q.text, 'Question', function (v) { q.text = v; touch(q); }, { area: true, rows: 1 }); t.className = 'rs-inline rs-strong';
        var n = textIn(q.notes, 'Notes on this question', function (v) { q.notes = v; touch(q); }, { area: true, rows: 1, ph: 'What you know so far' });
        var li = h('li', { class: 'q-' + q.status }, h('div', null, t, n), h('div', { class: 'rs-q-side' }, st, delBtn('question', function () { q.deleted = true; touch(q); renderQuestions(); })));
        return li;
      })),
      h('div', { class: 'ms-add rs-add2' }, nt, h('button', { class: 'btn', type: 'button', text: 'Add', onclick: addQ })));
  }

  A.register('sikh', function (panel) { root = panel; load(); });
  A.on('connect', function () { if (root) load(); });
})();
