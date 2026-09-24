/* UK master's tab for admin.html.

   Both files live in the PRIVATE data repository (Settings → Private data
   repository), never in the public site:
     masters/programs.json  reference list of programs, deadlines and funding (read-only here)
     masters/progress.json  your statuses, stars, ticked steps, notes, tasks and journal

   Every change is saved to progress.json about two seconds after you stop,
   and also kept on this device, so nothing is lost if you are offline. If
   another device saved in the meantime, the two versions are merged item by
   item, keeping whichever edit is newer. */
(function () {
  'use strict';
  var A = window.AdminCore;
  if (!A) return;

  var REF = 'masters/programs.json', PROG = 'masters/progress.json', CACHE = 'adm.masters.cache';
  var STATUS = [['', 'Not started'], ['researching', 'Researching'], ['preparing', 'Preparing'], ['submitted', 'Submitted'],
                ['interview', 'Interview'], ['waitlist', 'Waitlisted'], ['offer', 'Offer'], ['accepted', 'Accepted'],
                ['rejected', 'Rejected'], ['declined', 'Declined'], ['skip', 'Not applying']];
  var STATUS_LABEL = {}; STATUS.forEach(function (s) { STATUS_LABEL[s[0]] = s[1]; });
  var ACTIVE = { researching: 1, preparing: 1, submitted: 1, interview: 1, waitlist: 1 };
  var APPLIED = { submitted: 1, interview: 1, waitlist: 1, offer: 1, accepted: 1, rejected: 1, declined: 1 };
  var FUND_STATUS = [['', 'Not started'], ['preparing', 'Preparing'], ['applied', 'Applied'], ['awarded', 'Awarded'], ['declined', 'Not awarded'], ['skip', 'Not applying']];
  var FIT = { strong: 'Strong fit', good: 'Good fit', stretch: 'Stretch' };

  var S = {
    ref: null, prog: null, sha: null, repoOk: false,
    pending: false, saving: false, rev: 0, err: '', savedAt: null, timer: null,
    f: { q: '', uni: '', fit: '', track: '', plan: false, star: false, st: '' },
    allUp: false
  };
  var root, R = {};                                   /* R: containers that re-render */

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
  function repo() { return A.cfg().dataRepo; }
  function uniTag(u) { return (S.ref.uniShort || {})[u] || u; }
  function short(n) { return n.replace(/^(MSc|MPhil|MRes|MSt|MA) in /, '$1 ').replace(/^Master of Public Health \(MPH\)/, 'MPH'); }
  function fmtDate(iso) { try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return iso; } }
  function leftLabel(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? Math.abs(n) + 'd ago' : n + ' days'; }
  function urgency(n) { return n <= 7 ? 'hot' : n <= 30 ? 'soon' : ''; }

  /* ---------------------------------------------------------- progress -- */
  function emptyProgress() { return { version: 1, updated: null, programs: {}, todos: {}, funding: {}, tasks: [], journal: [] }; }
  function normal(p) {
    var e = emptyProgress();
    p = p || {};
    Object.keys(e).forEach(function (k) { if (p[k] == null) p[k] = e[k]; });
    return p;
  }
  function newer(a, b) { if (!a) return b; if (!b) return a; return (b.updated || '') > (a.updated || '') ? b : a; }
  function merge(a, b) {
    a = normal(a); b = normal(b);
    var out = emptyProgress();
    ['programs', 'todos', 'funding'].forEach(function (k) {
      var keys = {}; Object.keys(a[k]).concat(Object.keys(b[k])).forEach(function (x) { keys[x] = 1; });
      Object.keys(keys).forEach(function (x) { out[k][x] = newer(a[k][x], b[k][x]); });
    });
    ['tasks', 'journal'].forEach(function (k) {
      var by = {}, order = [];
      a[k].concat(b[k]).forEach(function (it) { if (!by[it.id]) order.push(it.id); by[it.id] = newer(by[it.id], it); });
      out[k] = order.map(function (id) { return by[id]; });
    });
    out.updated = (a.updated || '') > (b.updated || '') ? a.updated : b.updated;
    return out;
  }
  function pp(id) { return S.prog.programs[id] || {}; }
  function ppw(id) { return (S.prog.programs[id] = S.prog.programs[id] || {}); }
  function status(p) { return pp(p.id).status || ''; }
  function starred(p) { return !!pp(p.id).star; }
  function inPlan(p) { var x = pp(p.id); return x.plan === undefined ? !!p.plan : !!x.plan; }
  function tracked(p) { return status(p) !== 'skip' && (inPlan(p) || starred(p) || !!ACTIVE[status(p)]); }
  function stepCounts(p) {
    var x = pp(p.id), mine = (x.tasks || []).filter(function (t) { return !t.deleted; });
    var done = (x.done || []).filter(function (i) { return i < p.steps.length; }).length + mine.filter(function (t) { return t.done; }).length;
    return { done: done, total: p.steps.length + mine.length };
  }
  function dates(p) {
    var out = [];
    p.aim.forEach(function (a) { out.push({ a: a, k: 'Aim for' }); });
    p.extra.forEach(function (a) { out.push({ a: a, k: 'Also' }); });
    p.last.forEach(function (a) { out.push({ a: a, k: 'Last date' }); });
    return out;
  }
  function nextDate(p) {
    var t = today();
    return dates(p).filter(function (x) { return x.a.d && x.a.d >= t; }).sort(function (x, y) { return x.a.d < y.a.d ? -1 : 1; })[0] || null;
  }

  /* -------------------------------------------------------------- sync -- */
  function cacheSave() {
    try { localStorage.setItem(CACHE, JSON.stringify({ repo: repo(), prog: S.prog, pending: S.pending })); } catch (e) {}
  }
  function cacheLoad() {
    try { var c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && c.repo === repo() ? c : null; } catch (e) { return null; }
  }
  function changed() {
    S.prog.updated = now(); S.pending = true; S.rev++; S.err = '';
    cacheSave(); renderSync();
    clearTimeout(S.timer); S.timer = setTimeout(push, 2000);
  }
  function touch(obj) { obj.updated = now(); changed(); }

  function getFile(path) {
    return A.gh('/repos/' + repo() + '/contents/' + path).then(function (f) { return { text: A.b64decode(f.content), sha: f.sha }; });
  }
  function putFile(path, text, sha, message) {
    var body = { message: message, content: A.b64encode(text) };
    if (sha) body.sha = sha;
    return A.gh('/repos/' + repo() + '/contents/' + path, { method: 'PUT', body: body });
  }
  function push(retry) {
    if (!S.pending || !S.repoOk) return;
    if (S.saving) { clearTimeout(S.timer); S.timer = setTimeout(push, 1000); return; }
    S.saving = true; renderSync();
    var rev = S.rev;
    putFile(PROG, JSON.stringify(S.prog, null, 1) + '\n', S.sha, 'Update master’s progress')
      .then(function (res) {
        S.sha = res.content.sha; S.saving = false; S.savedAt = new Date();
        if (S.rev === rev) S.pending = false; else { clearTimeout(S.timer); S.timer = setTimeout(push, 800); }
        cacheSave(); renderSync();
      })
      .catch(function (e) {
        S.saving = false;
        if ((e.status === 409 || e.status === 422) && !retry) {       /* another device saved first: merge and retry */
          return getFile(PROG).then(function (f) {
            S.prog = merge(S.prog, JSON.parse(f.text)); S.sha = f.sha; S.rev++;
            R.cards = {}; cacheSave(); renderAll(); push(true);
          }).catch(function (e2) { S.err = e2.message; renderSync(); });
        }
        S.err = e.status === 401 || e.status === 403 ? 'GitHub refused the save. Check the token can write to ' + repo() + '.' : e.message;
        renderSync();
      });
  }
  window.addEventListener('beforeunload', function (e) { if (S.pending) { push(); e.preventDefault(); e.returnValue = ''; } });

  /* -------------------------------------------------------------- load -- */
  function load() {
    fill(root, h('p', { class: 'ms-empty', text: 'Loading your master’s tracker…' }));
    if (!A.cfg().token) return setup('token');
    A.gh('/repos/' + repo()).then(function (r) {
      if (!r.private) return setup('public');
      S.repoOk = !!(r.permissions && r.permissions.push);
      return getFile(REF).then(function (ref) {
        S.ref = JSON.parse(ref.text);
        return getFile(PROG).then(function (f) { return f; }, function (e) { if (e.status === 404) return null; throw e; });
      }, function (e) { if (e.status === 404) { setup('nofile'); return 'stop'; } throw e; }).then(function (f) {
        if (f === 'stop') return;
        S.prog = normal(f ? JSON.parse(f.text) : null); S.sha = f ? f.sha : null;
        var c = cacheLoad();
        if (c && c.pending && c.prog) { S.prog = merge(S.prog, c.prog); S.pending = true; S.rev++; clearTimeout(S.timer); S.timer = setTimeout(push, 1500); }
        renderMain();
      });
    }).catch(function (e) {
      if (e.status === 404) return setup('norepo');
      fill(root, h('div', { class: 'note note--err', text: 'Could not load the tracker: ' + e.message }));
    });
  }

  function setup(kind) {
    var c = A.cfg();
    var box = h('div', { class: 'ms-setup' }, h('h2', { text: 'UK master’s tracker' }));
    if (kind === 'token') {
      box.append(h('p', { text: 'Connect GitHub in Settings first. Your progress is saved to a private repository with the same token.' }),
        h('p', null, h('button', { class: 'btn btn--primary', type: 'button', text: 'Open Settings', onclick: A.goSettings })));
    } else if (kind === 'norepo') {
      box.append(h('p', null, 'Your progress is kept in a private repository, ', h('b', { text: c.dataRepo }), ', which this token can’t reach yet.'),
        h('ol', null,
          h('li', null, h('a', { href: 'https://github.com/new?name=' + encodeURIComponent(c.dataRepo.split('/')[1] || 'admin-data') + '&visibility=private', target: '_blank', rel: 'noopener', text: 'Create a repository' }), ' named ', h('b', { text: c.dataRepo.split('/')[1] || 'admin-data' }), '. Choose ', h('b', { text: 'Private' }), '.'),
          h('li', null, h('a', { href: 'https://github.com/settings/personal-access-tokens', target: '_blank', rel: 'noopener', text: 'Edit your token' }), ': under Repository access, add the new repository. Contents must be Read and write.'),
          h('li', null, 'Come back and press Reload.')),
        h('p', null, h('button', { class: 'btn btn--primary', type: 'button', text: 'Reload', onclick: load })));
    } else if (kind === 'public') {
      box.append(h('div', { class: 'note note--err' }, h('b', { text: c.dataRepo }), ' is public, so your notes would be visible to anyone. Make it private on GitHub (Settings → General → Danger zone → Change visibility), then reload.'),
        h('p', null, h('button', { class: 'btn btn--primary', type: 'button', text: 'Reload', onclick: load })));
    } else if (kind === 'nofile') {
      var input = h('input', { type: 'file', accept: 'application/json,.json', id: 'ms-file' });
      var msg = h('div');
      input.addEventListener('change', function () {
        var file = input.files[0]; if (!file) return;
        file.text().then(function (t) {
          var d = JSON.parse(t);
          if (!d.programs || !d.programs.length) throw new Error('That file has no programs in it.');
          fill(msg, h('div', { class: 'note', text: 'Uploading ' + d.programs.length + ' programs…' }));
          return putFile(REF, t, null, 'Add UK master’s program list');
        }).then(function () { load(); })
          .catch(function (e) { fill(msg, h('div', { class: 'note note--err', text: 'Could not add the file: ' + e.message })); });
      });
      box.append(h('p', null, 'The private repository ', h('b', { text: c.dataRepo }), ' is ready. Add the program list once and the tracker will open.'),
        h('label', { class: 'f', for: 'ms-file' }, h('span', { text: 'Program list (masters-programs.json)' }), input), msg);
    }
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

  function renderMain() {
    var P = S.ref.programs;
    R.sync = h('div', { class: 'ms-sync', role: 'status', 'aria-live': 'polite' });
    R.sum = h('div', { class: 'ms-sum' });
    R.up = h('div', { class: 'ms-box' });
    R.todo = h('div', { class: 'ms-box' });
    R.journal = h('div', { class: 'ms-box ms-notes' });
    R.waves = h('ol', { class: 'ms-waves' });
    R.list = h('div', { class: 'ms-list' });
    R.count = h('span', { class: 'count', 'aria-live': 'polite' });
    R.fund = h('div', { class: 'ms-fund' });
    R.cards = {};

    var unis = {}; P.forEach(function (p) { unis[p.uni] = (unis[p.uni] || 0) + 1; });
    fill(root, h('div', { class: 'ms' },
      h('div', { class: 'ms-head' },
        h('div', null, h('p', { class: 'eyebrow', text: S.ref.eyebrow || '' }), h('h2', { text: S.ref.title || 'UK master’s options' })),
        h('div', { class: 'ms-sync-wrap' }, R.sync, ' ', h('button', { class: 'btn btn--small', type: 'button', text: 'Reload', onclick: load }))),
      R.sum,
      h('div', { class: 'ms-cols' }, R.up, R.todo),
      R.journal,
      h('details', { class: 'ms-sec', open: true },
        h('summary', null, h('h3', { text: 'Deadlines, in order' }), h('span', { class: 'c', text: 'Each program under the date to aim for' })),
        R.waves),
      h('section', { 'aria-label': 'Programs' },
        h('div', { class: 'ms-head', style: 'margin-bottom:.4rem' }, h('h3', { text: 'Every program' })),
        filters(unis),
        R.list),
      h('details', { class: 'ms-sec' }, h('summary', null, h('h3', { text: 'Funding' }), h('span', { class: 'c', text: S.ref.funding.length + ' sources' })), R.fund),
      reference()));
    renderAll();
  }
  function renderAll() { if (!R.sum) return; renderSync(); renderSummary(); renderUp(); renderTodo(); renderJournal(); renderWaves(); renderList(); renderFund(); }

  function renderSummary() {
    var P = S.ref.programs, t = P.filter(tracked);
    var plan = P.filter(inPlan).length, star = P.filter(starred).length;
    var applied = P.filter(function (p) { return APPLIED[status(p)]; });
    var interviews = P.filter(function (p) { return status(p) === 'interview'; }).length;
    var offers = P.filter(function (p) { return status(p) === 'offer' || status(p) === 'accepted'; }).length;
    var next = t.map(function (p) { return { p: p, n: nextDate(p) }; }).filter(function (x) { return x.n; })
      .sort(function (x, y) { return x.n.a.d < y.n.a.d ? -1 : 1; })[0];
    var sd = 0, st = 0; t.forEach(function (p) { var c = stepCounts(p); sd += c.done; st += c.total; });
    var pct = st ? Math.round(100 * sd / st) : 0;
    fill(R.sum, 
      stat('Shortlist', String(t.length), plan + ' in your plan · ' + star + ' starred'),
      stat('Applied', String(applied.length), interviews + (interviews === 1 ? ' interview' : ' interviews') + ' · ' + offers + (offers === 1 ? ' offer' : ' offers')),
      next ? stat('Next deadline', leftLabel(daysUntil(next.n.a.d)), uniTag(next.p.uni) + ' ' + short(next.p.name) + ', ' + next.n.a.w)
           : stat('Next deadline', '—', 'Star programs or add them to your plan'),
      stat('Steps done', sd + '/' + st, pct + '% of the steps on your shortlist', pct));
    function stat(k, n, s, bar) {
      return h('div', { class: 'ms-stat' }, h('span', { class: 'k', text: k }), h('span', { class: 'n', text: n }), h('span', { class: 's', text: s }),
        bar != null ? h('div', { class: 'ms-bar', role: 'img', 'aria-label': bar + '% done' }, h('i', { style: 'width:' + bar + '%' })) : null);
    }
  }

  function renderUp() {
    var P = S.ref.programs, t = today();
    var pool = S.allUp ? P.filter(function (p) { return status(p) !== 'skip'; }) : P.filter(tracked);
    var rows = [];
    pool.forEach(function (p) { dates(p).forEach(function (x) { if (x.a.d && x.a.d >= t) rows.push({ p: p, x: x }); }); });
    rows.sort(function (a, b) { return a.x.a.d < b.x.a.d ? -1 : a.x.a.d > b.x.a.d ? 1 : 0; });
    var cb = h('input', { type: 'checkbox', id: 'ms-allup' }); cb.checked = S.allUp;
    cb.addEventListener('change', function () { S.allUp = cb.checked; renderUp(); });
    fill(R.up, 
      h('div', { class: 'ms-box-h' }, h('h3', { text: 'Coming up' }), h('label', { class: 'opt', for: 'ms-allup' }, cb, 'All programs')),
      rows.length ? h('ol', { class: 'ms-up' }, rows.slice(0, 10).map(function (r) {
        var n = daysUntil(r.x.a.d);
        return h('li', null,
          h('span', { class: 'ms-days ' + urgency(n), text: leftLabel(n) }),
          h('a', { href: '#masters', text: uniTag(r.p.uni) + ' · ' + short(r.p.name), onclick: function (e) { e.preventDefault(); goCard(r.p.id); } }),
          h('span', { class: 'm', text: r.x.k + ': ' + r.x.a.w + (r.x.a.c === 'e' ? ' (est.)' : '') + (status(r.p) ? ' · ' + STATUS_LABEL[status(r.p)] : '') }));
      })) : h('p', { class: 's', style: 'margin:0;color:var(--soft)', text: S.allUp ? 'No upcoming dates.' : 'Star a program or add it to your plan and its dates show up here.' }));
  }

  function renderTodo() {
    var items = [];
    (S.ref.todos || []).forEach(function (t) {
      var st = S.prog.todos[t.id] || {};
      items.push({ kind: 'ref', id: t.id, when: t.when, due: t.due, hot: t.hot, what: t.what, sub: t.sub, done: !!st.done });
    });
    S.prog.tasks.filter(function (t) { return !t.deleted; }).forEach(function (t) {
      items.push({ kind: 'mine', id: t.id, when: t.due ? fmtDate(t.due) : '', due: t.due || '9999', hot: t.due && daysUntil(t.due) <= 7, what: t.text, done: !!t.done });
    });
    items.sort(function (a, b) { return (a.done - b.done) || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0); });
    var text = h('input', { type: 'text', id: 'ms-newtask', placeholder: 'Add a task', 'aria-label': 'New task' });
    var due = h('input', { type: 'date', 'aria-label': 'Due date (optional)' });
    function addTask() {
      var v = text.value.trim(); if (!v) { text.focus(); return; }
      S.prog.tasks.push({ id: uid(), text: v, due: due.value || '', done: false, updated: now() });
      changed(); renderTodo(); document.getElementById('ms-newtask').focus();
    }
    text.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addTask(); } });
    var openEl = h('span', { class: 'opt', text: items.filter(function (i) { return !i.done; }).length + ' open' });
    fill(R.todo, 
      h('div', { class: 'ms-box-h' }, h('h3', { text: 'To do' }), openEl),
      h('ul', { class: 'ms-tasks' }, items.map(function (it) {
        var cb = h('input', { type: 'checkbox', 'aria-label': 'Done: ' + it.what }); cb.checked = it.done;
        cb.addEventListener('change', function () {
          if (it.kind === 'ref') { var o = S.prog.todos[it.id] = S.prog.todos[it.id] || {}; o.done = cb.checked; touch(o); }
          else { var t = S.prog.tasks.filter(function (x) { return x.id === it.id; })[0]; t.done = cb.checked; touch(t); }
          it.done = cb.checked; li.className = it.done ? 'done' : '';       /* stays in place until the list is next redrawn */
          openEl.textContent = items.filter(function (i) { return !i.done; }).length + ' open';
        });
        var li = h('li', { class: it.done ? 'done' : '' }, cb,
          h('div', null, it.when ? h('span', { class: 'when' + (it.hot && !it.done ? ' hot' : ''), text: it.when }) : null,
            h('span', { class: 'what', text: it.what }), it.sub ? h('span', { class: 'sub', text: it.sub }) : null),
          it.kind === 'mine' ? h('button', { class: 'ms-x', type: 'button', title: 'Delete task', 'aria-label': 'Delete task: ' + it.what, text: '✕', onclick: function () {
            var t = S.prog.tasks.filter(function (x) { return x.id === it.id; })[0]; t.deleted = true; touch(t); renderTodo();
          } }) : h('span'));
        return li;
      })),
      h('div', { class: 'ms-add' }, text, due, h('button', { class: 'btn', type: 'button', text: 'Add', onclick: addTask })));
  }

  function renderJournal() {
    var ta = h('textarea', { id: 'ms-newnote', rows: 2, placeholder: 'Write a note: a call with a supervisor, a thought on a course, anything', 'aria-label': 'New note' });
    var list = S.prog.journal.filter(function (j) { return !j.deleted; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    fill(R.journal, 
      h('div', { class: 'ms-box-h' }, h('h3', { text: 'Notes' }), h('span', { class: 'opt', text: list.length ? list.length + (list.length === 1 ? ' note' : ' notes') : '' })),
      ta,
      h('div', null, h('button', { class: 'btn', type: 'button', text: 'Add note', onclick: function () {
        var v = ta.value.trim(); if (!v) { ta.focus(); return; }
        S.prog.journal.push({ id: uid(), date: now(), text: v, updated: now() }); changed(); renderJournal();
      } })),
      list.length ? h('ul', { class: 'ms-journal' }, list.map(function (j) {
        var p = h('p', { text: j.text });
        var li = h('li', null,
          h('span', { class: 'd' }, h('span', { text: new Date(j.date).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }),
            h('span', null,
              h('button', { class: 'ms-x', type: 'button', text: 'Edit', onclick: function () {
                var ed = h('textarea', { rows: 3, 'aria-label': 'Edit note' }); ed.value = j.text;
                p.replaceWith(h('div', null, ed, h('div', { style: 'display:flex;gap:.4rem;margin-top:.4rem' },
                  h('button', { class: 'btn btn--small btn--primary', type: 'button', text: 'Save', onclick: function () { j.text = ed.value; touch(j); renderJournal(); } }),
                  h('button', { class: 'btn btn--small', type: 'button', text: 'Cancel', onclick: renderJournal }))));
                ed.focus();
              } }),
              h('button', { class: 'ms-x', type: 'button', text: 'Delete', onclick: function (e) {
                var b = e.currentTarget;
                if (b.dataset.arm) { j.deleted = true; touch(j); renderJournal(); return; }
                b.dataset.arm = '1'; b.textContent = 'Delete?';
                setTimeout(function () { if (b.isConnected) { delete b.dataset.arm; b.textContent = 'Delete'; } }, 4000);
              } }))),
          p);
        return li;
      })) : null);
  }

  function renderWaves() {
    var groups = {}, t = today();
    S.ref.programs.forEach(function (p) {
      var a = p.aim[0], key = a.d, head = a.w.replace(/^~/, ''), sub = '';
      if (a.d < '2026-11-01') { key = '2026-10'; head = 'October 2026'; sub = 'Open now or opening this month. Rolling admissions, so apply early'; }
      else if (a.d === '2027-01-20') { head = 'Early 2027'; sub = 'Rolling admissions with no early deadline'; }
      var g = groups[key] = groups[key] || { key: key, head: head, sub: sub, est: true, items: [] };
      g.items.push(p);
      if (a.c === 'c' && key !== '2026-10' && key !== '2027-01-20') g.est = false;
    });
    var notes = S.ref.waveNotes || {};
    fill(R.waves, Object.keys(groups).sort().map(function (k) {
      var g = groups[k], exact = /^\d{4}-\d\d-\d\d$/.test(k) && !g.est, past = exact && k < t;
      var n = exact && !past ? daysUntil(k) : null;
      return h('li', { class: 'ms-wave' + (past ? ' past' : '') },
        h('div', { class: 'wd' }, h('b', { text: g.head }), h('span', { text: (n != null ? leftLabel(n) : '') + (g.est && k !== '2026-10' && k !== '2027-01-20' ? ' est.' : '') })),
        h('div', null,
          h('div', { class: 'wt', text: (g.sub || notes[k] || '') + ' · ' + g.items.length + (g.items.length === 1 ? ' program' : ' programs') }),
          h('div', { class: 'ms-chips' }, g.items.map(function (p) {
            var s = status(p);
            return h('a', { class: 'ms-chip' + (p.aim[0].c === 'e' ? ' est' : '') + (s === 'skip' ? ' skip' : ''), href: '#masters', title: FIT[p.realism] + (s ? ' · ' + STATUS_LABEL[s] : ''),
              onclick: function (e) { e.preventDefault(); goCard(p.id); } },
              h('span', { class: 'ms-dot ' + (s ? 'st-' + s : 'fit-' + p.realism), style: s ? '' : 'background:var(--f)', 'aria-hidden': 'true' }),
              starred(p) ? '★' : null,
              h('span', { class: 'u', text: uniTag(p.uni) }), h('span', { text: short(p.name) }));
          }))));
    }));
  }

  /* ----------------------------------------------------- program list -- */
  function filters(unis) {
    var f = S.f;
    var q = h('input', { type: 'search', placeholder: 'Search programs, people, topics, your notes', 'aria-label': 'Search programs' });
    q.addEventListener('input', function () { f.q = q.value; renderList(); });
    var uni = h('select', { 'aria-label': 'University' }, h('option', { value: '', text: 'All universities' }),
      S.ref.uniOrder.filter(function (u) { return unis[u]; }).map(function (u) { return h('option', { value: u, text: uniTag(u) + ' (' + unis[u] + ')' }); }));
    uni.addEventListener('change', function () { f.uni = uni.value; renderList(); });
    var st = h('select', { 'aria-label': 'Your status' }, h('option', { value: '', text: 'Any status' }), h('option', { value: 'active', text: 'In progress' }),
      STATUS.map(function (s) { return h('option', { value: s[0] || 'none', text: s[1] }); }));
    st.addEventListener('change', function () { f.st = st.value; renderList(); });
    function toggle(label, key) {
      var cb = h('input', { type: 'checkbox' });
      cb.addEventListener('change', function () { f[key] = cb.checked; renderList(); });
      return h('label', { class: 't' }, cb, label);
    }
    function seg(opts, key, cls, label) {
      var box = h('div', { class: cls, role: 'group', 'aria-label': label });
      opts.forEach(function (o) {
        box.append(h('button', { type: 'button', 'aria-pressed': o[0] === '' ? 'true' : 'false', 'data-v': o[0], text: o[1], onclick: function (e) {
          [].forEach.call(box.children, function (b) { b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'); });
          f[key] = o[0]; renderList();
        } }));
      });
      return box;
    }
    var P = S.ref.programs;
    R.filterEls = { q: q, uni: uni, st: st };
    R.fitSeg = seg([['', 'Any fit'], ['strong', 'Strong'], ['good', 'Good'], ['stretch', 'Stretch']], 'fit', 'ms-seg', 'Fit');
    R.trackSeg = seg([['', 'All subjects']].concat(S.ref.tracks.map(function (t) { return [t, t + ' · ' + P.filter(function (p) { return p.track === t; }).length]; })), 'track', 'ms-tracks', 'Subject');
    R.planCb = toggle('In my plan', 'plan'); R.starCb = toggle('★ Starred', 'star');
    return h('div', { class: 'ms-filters' },
      h('div', { class: 'ms-frow' }, q, uni, st, R.fitSeg, R.planCb, R.starCb, R.count),
      R.trackSeg);
  }
  function resetFilters() {
    S.f = { q: '', uni: '', fit: '', track: '', plan: false, star: false, st: '' };
    R.filterEls.q.value = ''; R.filterEls.uni.value = ''; R.filterEls.st.value = '';
    R.planCb.querySelector('input').checked = false; R.starCb.querySelector('input').checked = false;
    [R.fitSeg, R.trackSeg].forEach(function (g) { [].forEach.call(g.children, function (b) { b.setAttribute('aria-pressed', b.dataset.v === '' ? 'true' : 'false'); }); });
  }
  function matches(p) {
    var f = S.f, s = status(p), q = f.q.trim().toLowerCase();
    if (f.uni && p.uni !== f.uni) return false;
    if (f.fit && p.realism !== f.fit) return false;
    if (f.track && p.track !== f.track) return false;
    if (f.plan && !inPlan(p)) return false;
    if (f.star && !starred(p)) return false;
    if (f.st === 'active' && !ACTIVE[s]) return false;
    if (f.st === 'none' && s) return false;
    if (f.st && f.st !== 'active' && f.st !== 'none' && s !== f.st) return false;
    if (q) {
      var hay = [p.name, p.uni, S.ref.uniFull[p.uni], p.track, p.fit, p.people, p.req, p.steps.join(' '), pp(p.id).notes || ''].join(' ').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }
  function renderList() {
    var P = S.ref.programs, shown = P.filter(matches);
    R.count.textContent = 'Showing ' + shown.length + ' of ' + P.length;
    if (!shown.length) { fill(R.list, h('div', { class: 'ms-empty', text: 'No programs match these filters.' })); return; }
    var groups = [];
    S.ref.uniOrder.forEach(function (u) {
      var ps = shown.filter(function (p) { return p.uni === u; });
      if (!ps.length) return;
      ps.sort(function (a, b) { return (starred(b) - starred(a)) || (a.aim[0].d < b.aim[0].d ? -1 : a.aim[0].d > b.aim[0].d ? 1 : a.name.localeCompare(b.name)); });
      groups.push(h('div', { class: 'ms-uni' },
        h('div', { class: 'ms-unihead' }, h('h3', { text: S.ref.uniFull[u] || u }), h('span', { text: ps.length + (ps.length === 1 ? ' program' : ' programs') })),
        h('div', { class: 'ms-cards' }, ps.map(function (p) { return R.cards[p.id] || (R.cards[p.id] = card(p)); }))));
    });
    fill(R.list, groups);
  }
  function goCard(id) {
    var p = S.ref.programs.filter(function (x) { return x.id === id; })[0];
    if (!matches(p)) { resetFilters(); renderList(); }
    var c = R.cards[id]; if (!c) return;
    c.scrollIntoView({ behavior: 'smooth', block: 'start' });
    c.classList.add('flash'); setTimeout(function () { c.classList.remove('flash'); }, 1800);
  }
  function refreshAfter(p) { renderSummary(); renderUp(); renderWaves(); }

  function card(p) {
    var x = function () { return ppw(p.id); };
    var c = h('article', { class: 'ms-card', id: 'ms-p-' + p.id });
    var progEl = h('div', { class: 'ms-prog' });
    function paintProgress() {
      var k = stepCounts(p), pct = k.total ? Math.round(100 * k.done / k.total) : 0;
      fill(progEl, h('div', { class: 'ms-bar', role: 'img', 'aria-label': k.done + ' of ' + k.total + ' steps done' }, h('i', { style: 'width:' + pct + '%' })),
        h('span', { text: k.done + ' of ' + k.total + ' steps' }));
      c.classList.toggle('is-skip', status(p) === 'skip');
    }
    var star = h('button', { class: 'ms-star', type: 'button', 'aria-pressed': starred(p) ? 'true' : 'false', title: 'Star', 'aria-label': 'Star ' + p.name, text: '★', onclick: function () {
      var o = x(); o.star = !o.star; touch(o); star.setAttribute('aria-pressed', o.star ? 'true' : 'false'); refreshAfter(p);
    } });
    var sel = h('select', { 'aria-label': 'Status for ' + p.name }, STATUS.map(function (s) { return h('option', { value: s[0], text: s[1] }); }));
    sel.value = status(p);
    sel.className = status(p) ? 'st-' + status(p) : '';
    sel.addEventListener('change', function () { var o = x(); o.status = sel.value; touch(o); sel.className = sel.value ? 'st-' + sel.value : ''; paintProgress(); refreshAfter(p); });
    var plan = h('button', { class: 'ms-plan', type: 'button', 'aria-pressed': inPlan(p) ? 'true' : 'false', text: 'In my plan', onclick: function () {
      var o = x(); o.plan = !inPlan(p); touch(o); plan.setAttribute('aria-pressed', o.plan ? 'true' : 'false'); refreshAfter(p);
    } });

    var dl = h('div', { class: 'ms-dates' }, dates(p).map(function (d) {
      var n = d.a.d && d.a.d >= today() ? daysUntil(d.a.d) : null;
      return h('div', { class: 'ms-drow' }, h('span', { class: 'k', text: d.k }),
        h('span', null, h('b', { text: d.a.c === 'e' ? d.a.w.replace(/^~/, '') : d.a.w }), d.a.time ? ' ' + d.a.time : null,
          d.a.c === 'e' ? h('span', { class: 'est', text: 'est.' }) : null,
          n != null ? h('span', { class: 'left ' + urgency(n), text: leftLabel(n) }) : null,
          h('span', { class: 'lb', text: d.a.t })));
    }));

    var stepsUl = h('ul');
    function paintSteps() {
      var o = pp(p.id), done = o.done || [];
      var rows = p.steps.map(function (s, i) {
        var cb = h('input', { type: 'checkbox', 'aria-label': 'Done: ' + s }); cb.checked = done.indexOf(i) >= 0;
        cb.addEventListener('change', function () {
          var w = x(); w.done = (w.done || []).filter(function (j) { return j !== i; }); if (cb.checked) w.done.push(i);
          touch(w); paintSteps(); paintProgress(); renderSummary();
        });
        return h('li', { class: cb.checked ? 'done' : '' }, cb, h('span', { text: s }), h('span'));
      });
      (o.tasks || []).filter(function (t) { return !t.deleted; }).forEach(function (t) {
        var cb = h('input', { type: 'checkbox', 'aria-label': 'Done: ' + t.text }); cb.checked = !!t.done;
        cb.addEventListener('change', function () { t.done = cb.checked; x().updated = now(); changed(); paintSteps(); paintProgress(); renderSummary(); });
        rows.push(h('li', { class: 'mine' + (t.done ? ' done' : '') }, cb, h('span', { text: t.text }),
          h('button', { class: 'ms-x', type: 'button', 'aria-label': 'Delete step: ' + t.text, text: '✕', onclick: function () { t.deleted = true; x().updated = now(); changed(); paintSteps(); paintProgress(); renderSummary(); } })));
      });
      fill(stepsUl, rows);
    }
    var newStep = h('input', { type: 'text', placeholder: 'Add your own step', 'aria-label': 'Add a step for ' + p.name });
    function addStep() {
      var v = newStep.value.trim(); if (!v) return;
      var w = x(); w.tasks = w.tasks || []; w.tasks.push({ id: uid(), text: v, done: false });
      newStep.value = ''; touch(w); paintSteps(); paintProgress(); renderSummary();
    }
    newStep.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addStep(); } });

    var notes = h('textarea', { rows: 2, placeholder: 'Your notes on this program', 'aria-label': 'Notes for ' + p.name });
    notes.value = pp(p.id).notes || '';
    notes.addEventListener('input', function () { var w = x(); w.notes = notes.value; touch(w); });

    c.append(
      h('div', { class: 'ms-ptop' }, h('span', { text: uniTag(p.uni) }), h('span', { text: '·' }), h('span', { text: p.track })),
      h('h3', null, h('a', { href: p.src[0], target: '_blank', rel: 'noopener', text: p.name })),
      h('div', { class: 'ms-track' }, star, sel, plan),
      progEl,
      h('div', { style: 'display:flex;flex-wrap:wrap;gap:.4rem .8rem;align-items:center' },
        h('span', { class: 'ms-fit fit-' + p.realism, text: FIT[p.realism] }), p.type ? h('span', { class: 'ms-pill', text: p.type }) : null),
      h('dl', { class: 'ms-facts' },
        h('div', null, h('dt', { text: 'Length' }), h('dd', { text: p.length })),
        h('div', null, h('dt', { text: 'Runs' }), h('dd', { text: p.runs })),
        h('div', null, h('dt', { text: 'Application fee' }), h('dd', { text: p.fee })),
        h('div', null, h('dt', { text: 'Tuition (international)' }), h('dd', { text: p.tuition }))),
      dl,
      h('p', { class: 'ms-fittext' }, p.fit, h('span', { text: p.why })),
      h('div', { class: 'ms-steps' }, h('h4', { text: 'Steps' }), stepsUl,
        h('div', { class: 'ms-add' }, newStep, h('button', { class: 'btn btn--small', type: 'button', text: 'Add', onclick: addStep }))),
      notes,
      h('details', null, h('summary', { text: 'Requirements, contacts and sources' }),
        h('div', { class: 'body' },
          h('p', null, h('b', { text: 'What to submit and entry bar. ' }), p.req),
          p.dec ? h('p', null, h('b', { text: 'Decisions. ' }), p.dec) : null,
          p.people ? h('p', null, h('b', { text: 'People to contact. ' }), p.people) : null,
          h('div', { class: 'srcs' }, h('b', { text: 'Sources' }), p.src.map(function (u) { return h('a', { href: u, target: '_blank', rel: 'noopener', text: u.replace(/^https?:\/\/(www\.)?/, '') }); })))));
    paintSteps(); paintProgress();
    return c;
  }

  /* ------------------------------------------------------ funding, ref -- */
  function renderFund() {
    fill(R.fund, S.ref.funding.map(function (f) {
      var o = S.prog.funding[f.id] || {};
      var sel = h('select', { 'aria-label': 'Status for ' + f.name }, FUND_STATUS.map(function (s) { return h('option', { value: s[0], text: s[1] }); }));
      sel.value = o.status || '';
      sel.addEventListener('change', function () { var w = S.prog.funding[f.id] = S.prog.funding[f.id] || {}; w.status = sel.value; touch(w); });
      var ta = h('textarea', { rows: 1, placeholder: 'Notes', 'aria-label': 'Notes for ' + f.name }); ta.value = o.notes || '';
      ta.addEventListener('input', function () { var w = S.prog.funding[f.id] = S.prog.funding[f.id] || {}; w.notes = ta.value; touch(w); });
      return h('div', { class: 'ms-fcard' }, h('h4', { text: f.name }), h('span', { class: 'amt', text: f.amount }), h('span', { class: 'when', text: f.when }),
        h('p', { text: f.note }), h('a', { href: f.src, target: '_blank', rel: 'noopener', text: 'Source' }), sel, ta);
    }));
  }
  function reference() {
    var r = S.ref;
    return h('details', { class: 'ms-sec' },
      h('summary', null, h('h3', { text: 'How this list was built, and what was ruled out' })),
      h('div', { class: 'ms-ref' },
        h('ul', { class: 'rules' }, (r.rules || []).map(function (t) { return h('li', { text: t }); })),
        h('table', { 'aria-label': 'Application limits and fees' }, h('tbody', null, (r.caps || []).map(function (c) { return h('tr', null, h('td', { text: c[0] }), h('td', { text: c[1] })); }))),
        h('h3', { text: 'Checked and ruled out' }),
        h('div', { class: 'ms-excl' }, (r.excluded || []).map(function (g) {
          return h('div', null, h('h4', { text: g.uni }), h('ul', null, g.items.map(function (it) { return h('li', null, h('span', { text: it[0] }), h('span', { text: it[1] })); })));
        })),
        h('div', { class: 'ms-foot' }, (r.footer || []).map(function (t) { return h('p', { text: t }); }))));
  }

  A.register('masters', function (panel) { root = panel; load(); });
  A.on('connect', function () { if (root) load(); });
})();
