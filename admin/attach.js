/* Screenshots, photos, voice notes and PowerPoint decks for the notes in admin.html
   (Present › Sikh research log and Present › Death & dying notes).

   Attach picks images, audio files or PowerPoint decks (.ppt, .pptx; on a
   phone: the photo library, screenshots, voice memos, Files); Record records a voice note in the browser,
   which asks for the microphone the first time; a screenshot can also be
   pasted or dropped into the note box. Nothing uploads until the note is
   added. Then each file is committed to the PRIVATE data repository, e.g.
   research/attachments/dying/2026-09-24-k3x9ab.webp, and the note keeps a
   list of them. Images whose longest side is over 2400 px, or that are over
   1.5 MB, are re-saved smaller first. Reading a file back needs the token
   too, so the page fetches it and shows it from memory; decks can't be
   previewed in a browser, so they download when clicked. Deleting a note
   hides it; its files stay in the repository. */
(function () {
  'use strict';
  var A = window.AdminCore;
  if (!A) return;

  var MAX = 20 * 1024 * 1024, EDGE = 2400, SHRINK_OVER = 1.5 * 1024 * 1024;
  var EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic',
    'application/vnd.ms-powerpoint': '.ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'audio/webm': '.webm', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/x-wav': '.wav' };
  var DECK = { '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
  var ACCEPT = 'image/*,audio/*,.ppt,.pptx,' + DECK['.ppt'] + ',' + DECK['.pptx'];
  var loaded = {};   // path -> Promise of an object URL, so each file is fetched once per visit

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
    for (var i = 2; i < arguments.length; i++) if (arguments[i] != null) e.append(arguments[i]);
    return e;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + pad(s % 60); }
  function size(n) { return n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB'; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function uid() { return Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6); }
  function mime(t) { return (t || '').split(';')[0].trim().toLowerCase(); }
  function nameExt(n) { return ((/\.[a-z0-9]{2,4}$/i.exec(n || '') || [''])[0]).toLowerCase(); }
  /* image, audio or deck; phones sometimes send decks with no type, so the file name decides */
  function kindOf(f) {
    var t = mime(f.type);
    return /^image\//.test(t) ? 'image' : /^audio\//.test(t) ? 'audio' : (t === DECK['.ppt'] || t === DECK['.pptx'] || DECK[nameExt(f.name)]) ? 'deck' : '';
  }
  function ext(f) { return EXT[f.type] || ((/\.[a-z0-9]{2,4}$/i.exec(f.name || '') || [''])[0].toLowerCase()) || '.bin'; }
  function b64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(blob);
    });
  }
  function url(path) { return '/repos/' + A.cfg().dataRepo + '/contents/' + path.split('/').map(encodeURIComponent).join('/'); }

  /* Re-save big images smaller; keep the original if that does not help. */
  function shrink(file) {
    if (!/^image\/(png|jpeg|webp|bmp)$/.test(file.type) || !window.createImageBitmap) return Promise.resolve(file);
    return createImageBitmap(file).then(function (bmp) {
      var s = Math.min(1, EDGE / Math.max(bmp.width, bmp.height));
      if (s === 1 && file.size <= SHRINK_OVER) return file;
      var c = document.createElement('canvas');
      c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      function enc(t) { return new Promise(function (res) { c.toBlob(res, t, 0.9); }); }
      return enc('image/webp').then(function (b) { return b && b.type === 'image/webp' ? b : enc('image/jpeg'); })
        .then(function (b) { return b && b.size < file.size ? b : file; });
    }).catch(function () { return file; });
  }

  /* The attach / record controls for one note box. Pending files live here
     until upload() commits them, so they survive the list re-drawing. */
  function composer(dir) {
    var pending = [], done = [], rec = null, t0 = 0, tick = null;
    var queue = Promise.resolve();   /* files are prepared one at a time, so they keep the order they were picked in */
    var picker = h('input', { type: 'file', accept: ACCEPT, multiple: true, hidden: true, 'aria-label': 'Choose images, audio or PowerPoint files' });
    var attachBtn = h('button', { class: 'btn btn--small', type: 'button', text: 'Attach', title: 'Add screenshots, photos, audio or PowerPoint files', onclick: function () { picker.click(); } });
    var recBtn = h('button', { class: 'btn btn--small at-rec', type: 'button', text: 'Record', title: 'Record a voice note', onclick: toggleRec });
    var chips = h('div', { class: 'at-chips' }), msg = h('p', { class: 'at-msg', role: 'status', 'aria-live': 'polite' });
    var el = h('div', { class: 'at' },
      h('div', { class: 'at-bar' }, attachBtn, recBtn, h('span', { class: 'at-tip', text: 'or paste a screenshot into the box' }), picker), chips, msg);
    picker.addEventListener('change', function () { add(picker.files); picker.value = ''; });

    function say(t, err) { msg.textContent = t || ''; msg.className = 'at-msg' + (err ? ' err' : ''); }
    function add(list) {
      Array.prototype.forEach.call(list, function (f) {
        var kind = kindOf(f), t = kind === 'deck' ? (DECK[nameExt(f.name)] || mime(f.type)) : mime(f.type);
        if (!kind) { say((f.name || 'That file') + ' can’t be attached: use an image, an audio file or a PowerPoint (.ppt, .pptx).', true); return; }
        queue = queue.then(function () { return kind === 'image' ? shrink(f) : f; }).then(function (b) {
          if (b.size > MAX) { say((f.name || 'That file') + ' is ' + size(b.size) + '; the limit is ' + size(MAX) + '.' + (kind === 'deck' ? ' Put a link to the deck in the note instead.' : ''), true); return; }
          pending.push({ blob: b, type: (kind === 'deck' ? t : mime(b.type)) || t, kind: kind, name: kind === 'image' && (!f.name || /^image\.(png|jpe?g)$/i.test(f.name)) ? 'Screenshot' : f.name || (kind === 'image' ? 'Image' : 'Audio'), dur: null, src: URL.createObjectURL(b) });
          say(''); draw();
        }).catch(function (e) { say('Could not add ' + (f.name || 'that file') + ': ' + e.message, true); });
      });
    }
    function draw() {
      chips.replaceChildren.apply(chips, done.map(function (r) {
        return h('span', { class: 'at-chip up' }, h('span', { text: '✓ ' + r.name + ' uploaded' }));
      }).concat(pending.map(function (p) {
        return h('span', { class: 'at-chip' },
          p.kind === 'image' ? h('img', { src: p.src, alt: '' }) : p.kind === 'deck' ? h('span', { class: 'at-deck', text: ext(p).slice(1).toUpperCase() }) : h('audio', { src: p.src, controls: true, preload: 'metadata' }),
          h('span', { text: p.name + (p.dur ? ' · ' + mmss(p.dur) : '') + ' · ' + size(p.blob.size) }),
          h('button', { class: 'ms-x', type: 'button', text: '✕', 'aria-label': 'Remove ' + p.name, onclick: function () {
            pending = pending.filter(function (x) { return x !== p; }); URL.revokeObjectURL(p.src); draw();
          } }));
      })));
    }
    function paintRec() {
      recBtn.textContent = rec ? 'Stop · ' + mmss((Date.now() - t0) / 1000) : 'Record';
      recBtn.classList.toggle('on', !!rec);
      recBtn.setAttribute('aria-pressed', rec ? 'true' : 'false');
    }
    function toggleRec() {
      if (rec) { rec.stop(); return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { say('This browser can’t record audio here. Record in your phone’s voice memo app and attach the file instead.', true); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0];
        var chunks = [], r = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : { audioBitsPerSecond: 48000 });
        r.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        r.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          clearInterval(tick);
          var t = mime(r.mimeType || type) || 'audio/webm', b = new Blob(chunks, { type: t }), dur = (Date.now() - t0) / 1000;
          rec = null; paintRec();
          if (!b.size) { say('Nothing was recorded.', true); return; }
          if (b.size > MAX) { say('That recording is over ' + size(MAX) + '. Record shorter pieces.', true); return; }
          pending.push({ blob: b, type: t, kind: 'audio', name: 'Voice note', dur: Math.round(dur), src: URL.createObjectURL(b) });
          say(''); draw();
        };
        rec = r; t0 = Date.now(); r.start(1000);
        tick = setInterval(paintRec, 500); paintRec(); say('Recording… press Stop when you are done.');
      }).catch(function (e) {
        say(e && e.name === 'NotAllowedError' ? 'The microphone is blocked for this site. Allow it in the browser’s site settings, then press Record again.' : 'Could not start recording: ' + (e && e.message), true);
      });
    }
    function upload() {
      if (rec) { say('Stop the recording first, then add the note.', true); return Promise.reject(new Error('recording')); }
      var ready = queue;               /* wait for any image still being shrunk */
      function next() {
        if (!pending.length) return Promise.resolve();
        var p = pending[0], path = dir + '/' + today() + '-' + uid() + ext(p);
        say('Uploading ' + (done.length + 1) + ' of ' + (done.length + pending.length) + '…');
        return b64(p.blob).then(function (content) {
          return A.gh(url(path), { method: 'PUT', body: { message: 'Add ' + (p.kind === 'audio' ? 'a voice note' : p.kind === 'deck' ? 'slides' : 'an image') + ' to ' + dir, content: content } });
        }).then(function () {
          done.push({ path: path, type: p.type, kind: p.kind, name: p.name, size: p.blob.size, dur: p.dur, ext: ext(p) });
          loaded[path] = Promise.resolve(p.src);          // already in memory: show it without a download
          pending.shift(); draw(); return next();
        });
      }
      return ready.then(next).then(function () {
        var out = done; done = []; say(''); draw(); return out;
      }, function (e) {
        say('Upload failed (' + (e.status === 401 || e.status === 403 ? 'check the token can write to ' + A.cfg().dataRepo : e.message) + '). The note was not added; press the button again to retry.', true);
        draw(); throw e;
      });
    }
    /* paste or drop into the note box */
    function bind(ta) {
      ta.addEventListener('paste', function (e) {
        var items = (e.clipboardData && e.clipboardData.items) || [], imgs = [];
        for (var i = 0; i < items.length; i++) if (items[i].kind === 'file') { var f = items[i].getAsFile(); if (f && kindOf(f)) imgs.push(f); }
        if (!imgs.length) return;
        if (!e.clipboardData.getData('text/plain')) e.preventDefault();
        add(imgs);
      });
      ta.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { e.preventDefault(); ta.classList.add('at-drop'); } });
      ta.addEventListener('dragleave', function () { ta.classList.remove('at-drop'); });
      ta.addEventListener('drop', function (e) {
        ta.classList.remove('at-drop');
        if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); add(e.dataTransfer.files); }
      });
    }
    return { el: el, bind: bind, upload: upload, count: function () { return pending.length + done.length; } };
  }

  /* The note's Add button: uploads anything attached, then hands text and files to onadd. */
  function addButton(label, c, ta, onadd) {
    var b = h('button', { class: 'btn', type: 'button', text: label });
    b.addEventListener('click', function () {
      var v = ta.value.trim();
      if (!v && !c.count()) { ta.focus(); return; }
      b.disabled = true; if (c.count()) b.textContent = 'Uploading…';
      c.upload().then(function (files) { ta.value = ''; onadd(v, files); },
        function () { b.disabled = false; b.textContent = label; });
    });
    return b;
  }

  /* Show a note's files: images as thumbnails (click for full size), audio behind a play button, decks as a download. */
  function load(f) {
    if (!loaded[f.path]) {
      var c = A.cfg();
      loaded[f.path] = fetch('https://api.github.com' + url(f.path), { headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' } })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
        .then(function (b) { return URL.createObjectURL(new Blob([b], { type: f.type })); });
      loaded[f.path].catch(function () { delete loaded[f.path]; });
    }
    return loaded[f.path];
  }
  function view(files) {
    if (!files || !files.length) return null;
    return h.apply(null, ['div', { class: 'at-view' }].concat(files.map(function (f) {
      if (f.kind === 'image') {
        var img = h('img', { alt: f.name || 'Image' }), a = h('a', { class: 'at-img', href: '#', title: 'Open full size' }, img);
        a.addEventListener('click', function (e) { if (!a.dataset.ready) e.preventDefault(); });
        load(f).then(function (u) { img.src = u; a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.dataset.ready = '1'; },
          function (e) { a.replaceWith(h('span', { class: 'at-miss', text: 'Could not load ' + (f.name || 'image') + ' (' + e.message + ')' })); });
        return a;
      }
      if (f.kind === 'deck') {
        var d = h('button', { class: 'at-play at-file', type: 'button', title: 'Download' },
          h('span', { class: 'at-deck', text: (f.ext || '.pptx').slice(1).toUpperCase() }), ' ' + (f.name || 'Slides') + ' · ' + size(f.size || 0));
        d.addEventListener('click', function () {
          d.disabled = true;
          load(f).then(function (u) {
            var a = h('a', { href: u, download: f.name || 'slides' + (f.ext || '.pptx') }); document.body.append(a); a.click(); a.remove(); d.disabled = false;
          }, function (e) { d.disabled = false; d.title = 'Could not load (' + e.message + '), try again'; });
        });
        return d;
      }
      var b = h('button', { class: 'at-play', type: 'button', text: '▶ ' + (f.name || 'Audio') + (f.dur ? ' · ' + mmss(f.dur) : '') });
      b.addEventListener('click', function () {
        b.disabled = true; b.textContent = 'Loading…';
        load(f).then(function (u) { var au = h('audio', { controls: true, src: u }); b.replaceWith(au); au.play().catch(function () {}); },
          function (e) { b.disabled = false; b.textContent = '▶ Could not load (' + e.message + '), try again'; });
      });
      return b;
    })));
  }

  window.AdminAttach = { composer: composer, addButton: addButton, view: view };
})();
