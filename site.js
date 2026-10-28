(function () {
  'use strict';
  var PAGE = location.pathname.split('/').pop() || 'index.html';
  var EDITOR_KEY = 'anguar-draft:' + PAGE;
  function hash(s) { var x = 0x811c9dc5; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(16); }
  var appEl = document.getElementById('app');
  var BASE = appEl ? hash(appEl.innerHTML) : '';

  /* ---------- restore this page's draft (this browser only) ----------
     A draft is reused only if the published page has not changed since the
     draft was started, so an upload to GitHub always wins over an old draft. */
  try {
    localStorage.removeItem('anguar-edit:' + PAGE);
    var raw = localStorage.getItem(EDITOR_KEY);
    if (raw) {
      var draft = JSON.parse(raw);
      if (draft && draft.base === BASE && typeof draft.html === 'string') appEl.innerHTML = draft.html;
      else { localStorage.setItem('anguar-older:' + PAGE, raw); localStorage.removeItem(EDITOR_KEY); }
    }
  } catch (e) {}

  /* ---------- scroll reveal (same effect as the original) ---------- */
  function setupReveal() {
    var els = [].slice.call(document.querySelectorAll('.reveal:not(.reveal-in)'));
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('reveal-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('reveal-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- mobile menu ---------- */
  function setupMenu() {
    var openBtn = document.querySelector('button[aria-label="Open menu"]');
    var menu = document.querySelector('[data-mobile-menu]');
    if (!openBtn || !menu) return;
    var closeBtn = menu.querySelector('button[aria-label="Close menu"]');
    function set(open) {
      menu.style.opacity = open ? '1' : '';
      menu.style.pointerEvents = open ? 'auto' : '';
      openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.documentElement.style.overflow = open ? 'hidden' : '';
    }
    openBtn.addEventListener('click', function () { set(true); });
    if (closeBtn) closeBtn.addEventListener('click', function () { set(false); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  }

  /* ---------- Discover: category filter + large preview image ---------- */
  function setupPOI() {
    document.querySelectorAll('button[aria-pressed]').forEach(function (b) {
      if (b.dataset.poiReady) return;
      var row = b.parentElement;
      var list = row && row.parentElement && row.parentElement.querySelector('ul');
      if (!list) return;
      var buttons = [].slice.call(row.querySelectorAll('button[aria-pressed]'));
      var onCls = buttons[0].className;
      var offCls = (buttons[1] || buttons[0]).className;
      var section = row.closest('section');
      var big = section && section.querySelector('.hidden.md\\:block img, img[width="1000"]');
      var count = section && [].slice.call(section.querySelectorAll('p')).filter(function (p) { return /^Showing \d+ of \d+/.test(p.textContent.trim()); })[0];
      function apply(cat) {
        var items = [].slice.call(list.children), shown = 0, first = null;
        items.forEach(function (li) {
          var tag = li.querySelector('span:last-of-type');
          var ok = cat === 'All' || (tag && tag.textContent.trim().toLowerCase() === cat.toLowerCase());
          li.style.display = ok ? '' : 'none';
          if (ok) { shown++; if (!first) first = li; }
        });
        if (count) count.textContent = 'Showing ' + shown + ' of ' + items.length + ' points of interest.';
        if (first) preview(first);
      }
      function preview(li) {
        var im = li.querySelector('img');
        if (!big || !im) return;
        big.src = im.getAttribute('src').replace('w=200&h=200', 'w=1000&h=1300').replace('w=200&amp;h=200', 'w=1000&amp;h=1300');
        big.alt = im.alt;
      }
      buttons.forEach(function (btn) {
        btn.dataset.poiReady = '1';
        btn.addEventListener('click', function () {
          if (document.body.classList.contains('editing')) return;
          buttons.forEach(function (x) { x.className = offCls; x.setAttribute('aria-pressed', 'false'); });
          btn.className = onCls; btn.setAttribute('aria-pressed', 'true');
          apply(btn.textContent.trim());
        });
      });
      [].slice.call(list.children).forEach(function (li) {
        li.addEventListener('mouseenter', function () { preview(li); });
        li.addEventListener('click', function () { if (!document.body.classList.contains('editing')) preview(li); });
      });
    });
  }

  /* ---------- newsletter ---------- */
  function setupForms() {
    document.querySelectorAll('footer form').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var b = f.querySelector('button');
        if (b) { b.textContent = 'Thank you'; setTimeout(function () { b.textContent = 'Subscribe'; }, 2500); }
        f.reset();
      });
    });
  }

  /* ---------- photos and videos in media grids (Gallery) ---------- */
  function videoSource(u) {
    u = (u || '').trim(); if (!u) return null; var m;
    if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/))) return { type: 'frame', src: 'https://www.youtube.com/embed/' + m[1] };
    if ((m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/))) return { type: 'frame', src: 'https://drive.google.com/file/d/' + m[1] + '/preview' };
    if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return { type: 'frame', src: 'https://player.vimeo.com/video/' + m[1] };
    if (/facebook\.com|fb\.watch/.test(u)) return { type: 'frame', src: 'https://www.facebook.com/plugins/video.php?show_text=false&href=' + encodeURIComponent(u) };
    if (/^data:video\//.test(u) || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return { type: 'file', src: u };
    return { type: 'frame', src: u };
  }
  function renderVideo(fig) {
    var box = fig.querySelector('.media-frame'); if (!box) return;
    var v = videoSource(fig.getAttribute('data-video'));
    box.innerHTML = '';
    if (!v) { box.innerHTML = '<div class="media-empty">Video coming soon</div>'; return; }
    var el;
    if (v.type === 'file') { el = document.createElement('video'); el.controls = true; el.playsInline = true; el.preload = 'metadata'; }
    else { el = document.createElement('iframe'); el.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture'; el.allowFullscreen = true; el.loading = 'lazy'; el.title = (fig.querySelector('figcaption') || {}).textContent || 'Video'; }
    el.src = v.src; box.appendChild(el);
  }
  function refreshGrids() {
    document.querySelectorAll('#app [data-media-grid]').forEach(function (g) {
      var empty = g.parentElement.querySelector('[data-media-empty]');
      if (empty) empty.style.display = g.querySelector('.media-item') ? 'none' : '';
    });
  }
  function renderAllVideos() { document.querySelectorAll('#app .media-item[data-video]').forEach(renderVideo); }

  /* ---------- editor ---------- */
  var params = new URLSearchParams(location.search);
  var isOwner = false;
  try {
    if (params.has('edit')) localStorage.setItem('anguar-owner', '1');
    isOwner = localStorage.getItem('anguar-owner') === '1';
  } catch (e) { isOwner = params.has('edit'); }

  var editing = false;
  var bar = document.createElement('div');
  bar.id = 'ed-bar';
  bar.setAttribute('contenteditable', 'false');
  bar.innerHTML =
    '<a data-a="hub" href="editor.html">Editor</a>' +
    '<button type="button" data-a="edit">Edit page</button>' +
    '<button type="button" data-a="undo" hidden aria-label="Undo">↶ Undo</button>' +
    '<button type="button" data-a="redo" hidden aria-label="Redo">↷ Redo</button>' +
    '<button type="button" data-a="publish" hidden>Publish to website</button>' +
    '<button type="button" data-a="save" hidden>Download page</button>' +
    '<button type="button" data-a="reset" hidden>Start over</button>' +
    '<button type="button" data-a="older" hidden>Bring back my earlier changes</button>' +
    '<span data-msg></span>';
  if (isOwner) document.body.appendChild(bar);
  var msg = bar.querySelector('[data-msg]');
  var HINT = 'Tap text to type · tap a photo or video to change it';
  function flash(t) { msg.textContent = t; clearTimeout(flash.t); flash.t = setTimeout(function () { msg.textContent = editing ? HINT : ''; }, 2600); }

  /* modal for photos and videos */
  var modal = document.createElement('div');
  modal.id = 'ed-modal';
  modal.setAttribute('contenteditable', 'false');
  modal.innerHTML =
    '<div class="ed-sheet" role="dialog" aria-modal="true" aria-labelledby="ed-title">' +
    '<h3 id="ed-title">Change photo</h3><p class="ed-hint" data-hint></p>' +
    '<label for="ed-url" data-url-label>Photo link</label><input id="ed-url" type="url" placeholder="https://">' +
    '<button type="button" class="ed-upload" data-upload>Upload from this device</button>' +
    '<div data-alt-wrap><label for="ed-alt">Description for screen readers</label><input id="ed-alt" type="text"></div>' +
    '<img class="ed-preview" alt="" hidden><p class="ed-error" role="alert" hidden></p>' +
    '<div class="ed-row"><button type="button" data-cancel>Cancel</button><button type="button" class="ed-go" data-apply>Apply</button></div></div>';
  if (isOwner) document.body.appendChild(modal);
  var mUrl = modal.querySelector('#ed-url'), mAlt = modal.querySelector('#ed-alt'), mPrev = modal.querySelector('.ed-preview'), mErr = modal.querySelector('.ed-error');
  var mTarget = null, mKind = 'img', mData = null, mDone = null;

  function openModal(kind, target, done) {
    mKind = kind; mTarget = target; mData = null; mDone = done || null;
    var img = kind === 'img';
    modal.querySelector('#ed-title').textContent = img ? 'Change photo' : 'Change video';
    modal.querySelector('[data-hint]').textContent = img ? 'Paste a photo link, or upload a photo from this device.' : 'Paste a YouTube, Google Drive, Facebook or Vimeo link. Links keep your site fast. Uploads are for short clips under 20 MB.';
    modal.querySelector('[data-url-label]').textContent = img ? 'Photo link' : 'Video link';
    modal.querySelector('[data-upload]').textContent = img ? 'Upload photo from this device' : 'Upload a short clip from this device';
    modal.querySelector('[data-alt-wrap]').hidden = !img;
    var cur = img ? target.getAttribute('src') : target.getAttribute('data-video');
    mUrl.value = /^data:/.test(cur || '') ? '' : (cur || '');
    mUrl.placeholder = /^data:/.test(cur || '') ? 'Uploaded from a device' : 'https://';
    mAlt.value = img ? (target.alt || '') : '';
    if (img && cur) { mPrev.src = cur; mPrev.hidden = false; } else mPrev.hidden = true;
    mErr.hidden = true;
    modal.classList.add('on');
    setTimeout(function () { mUrl.focus(); }, 30);
  }
  function closeModal() { modal.classList.remove('on'); mTarget = null; mData = null; }
  function wireModal() {
    mUrl.addEventListener('input', function () { mData = null; mErr.hidden = true; if (mKind === 'img' && mUrl.value.trim()) { mPrev.src = mUrl.value.trim(); mPrev.hidden = false; } });
    modal.querySelector('[data-cancel]').addEventListener('click', function () { if (mDone) mDone(false); closeModal(); });
    modal.querySelector('[data-upload]').addEventListener('click', function () {
      var f = document.createElement('input'); f.type = 'file'; f.accept = mKind === 'img' ? 'image/*' : 'video/*';
      f.onchange = function () {
        var file = f.files[0]; if (!file) return;
        if (mKind === 'video') {
          if (file.size > 20 * 1024 * 1024) { mErr.textContent = 'That clip is over 20 MB. Put it on YouTube or Google Drive and paste the link instead.'; mErr.hidden = false; return; }
          var rv = new FileReader(); rv.onload = function () { mData = rv.result; mUrl.value = ''; mUrl.placeholder = file.name + ' is ready'; mErr.hidden = true; }; rv.readAsDataURL(file);
          return;
        }
        var r = new FileReader();
        r.onload = function () {
          var im = new Image();
          im.onload = function () {
            var max = 1800, s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
            var cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s);
            cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
            mData = cv.toDataURL('image/jpeg', 0.85); mUrl.value = ''; mUrl.placeholder = file.name + ' is ready'; mPrev.src = mData; mPrev.hidden = false; mErr.hidden = true;
          };
          im.src = r.result;
        };
        r.readAsDataURL(file);
      };
      f.click();
    });
    modal.querySelector('[data-apply]').addEventListener('click', function () {
      var val = mData || mUrl.value.trim();
      if (val) snapshot();
      if (!val) { mErr.textContent = mKind === 'img' ? 'Paste a photo link or upload a photo first.' : 'Paste a video link or upload a clip first.'; mErr.hidden = false; return; }
      if (mKind === 'img') {
        mTarget.src = val; mTarget.removeAttribute('srcset'); mTarget.alt = mAlt.value;
        if (mTarget.classList.contains('page-hero-img')) { var cr = mTarget.parentElement.querySelector('.page-hero-credit'); if (cr) cr.remove(); }
      }
      else { mTarget.setAttribute('data-video', val); renderVideo(mTarget); }
      if (mDone) mDone(true);
      closeModal(); refreshGrids(); autosave(); placeTools();
    });
  }
  wireModal();
  modal.addEventListener('click', function (e) { if (e.target === modal && !modal.dataset.mode) { if (mDone) mDone(false); closeModal(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('on') && !modal.dataset.mode) { if (mDone) mDone(false); closeModal(); } });

  function cleanHTML() {
    var c = document.getElementById('app').cloneNode(true);
    c.querySelectorAll('[contenteditable]').forEach(function (el) { el.removeAttribute('contenteditable'); });
    c.querySelectorAll('.reveal-in').forEach(function (el) { el.classList.remove('reveal-in'); });
    c.querySelectorAll('[data-poi-ready]').forEach(function (el) { el.removeAttribute('data-poi-ready'); });
    c.querySelectorAll('.ed-only').forEach(function (el) { el.remove(); });
    c.querySelectorAll('.ed-selected').forEach(function (el) { el.classList.remove('ed-selected'); if (!el.getAttribute('class')) el.removeAttribute('class'); });
    c.querySelectorAll('img[draggable]').forEach(function (el) { el.removeAttribute('draggable'); });
    c.querySelectorAll('.media-item[data-video] .media-frame').forEach(function (el) { el.innerHTML = ''; });
    c.querySelectorAll('[data-media-empty]').forEach(function (el) { el.style.display = ''; if (!el.getAttribute('style')) el.removeAttribute('style'); });
    c.querySelectorAll('ul > li[style*="display"]').forEach(function (el) { el.style.display = ''; if (!el.getAttribute('style')) el.removeAttribute('style'); });
    var m = c.querySelector('[data-mobile-menu]'); if (m) { m.style.opacity = ''; m.style.pointerEvents = ''; if (!m.getAttribute('style')) m.removeAttribute('style'); }
    return c.innerHTML;
  }
  function olderDraft() { try { var o = JSON.parse(localStorage.getItem('anguar-older:' + PAGE) || 'null'); return o && typeof o.html === 'string' ? o : null; } catch (e) { return null; } }
  function autosave() {
    if (!editing) return;
    try { localStorage.setItem(EDITOR_KEY, JSON.stringify({ base: BASE, html: cleanHTML() })); flash('Saved in this browser'); }
    catch (e) { flash('Too big to save here. Use Download page.'); }
  }

  var RICH_BODY = '<figcaption class="wh-body"><span class="wh-tag">News</span><span class="wh-date">Date</span><h3 class="wh-title">Event title</h3><p class="wh-place">Place or short description</p></figcaption>';
  function makeItem(kind, rich) {
    var fig = document.createElement('figure');
    fig.className = rich ? 'media-item wh-card' : 'media-item';
    if (kind === 'video') { fig.setAttribute('data-video', ''); fig.innerHTML = '<div class="media-frame"></div>' + (rich ? RICH_BODY : '<figcaption>Video caption</figcaption>'); }
    else { fig.innerHTML = '<img src="" alt="" loading="lazy">' + (rich ? RICH_BODY : '<figcaption>Photo caption</figcaption>'); }
    return fig;
  }
  function addTools(item) {
    if (item.querySelector(':scope > .ed-tools')) return;
    var t = document.createElement('div'); t.className = 'ed-tools ed-only'; t.setAttribute('contenteditable', 'false');
    t.innerHTML = '<button type="button" data-t="left" aria-label="Move earlier">‹</button><button type="button" data-t="right" aria-label="Move later">›</button><button type="button" data-t="del">Delete</button>';
    item.appendChild(t);
  }
  function addGridButtons() {
    document.querySelectorAll('#app [data-media-grid]').forEach(function (g) {
      g.querySelectorAll('.media-item').forEach(addTools);
      if (g.nextElementSibling && g.nextElementSibling.classList.contains('ed-add')) return;
      var row = document.createElement('div'); row.className = 'ed-add ed-only'; row.setAttribute('contenteditable', 'false');
      row.innerHTML = '<button type="button" data-add="img">+ Add photo</button><button type="button" data-add="video">+ Add video</button>';
      g.parentNode.insertBefore(row, g.nextSibling);
    });
  }

  var TEXT_SEL = 'h1,h2,h3,h4,p,li > a,span,label,figcaption,button:not([aria-label])';
  var MULTILINE = 'P,LI,FIGCAPTION';

  function applyEditable(on) {
    document.querySelectorAll('#app ' + TEXT_SEL.split(',').join(',#app ')).forEach(function (el) {
      if (el.closest('svg') || el.closest('.ed-only')) return;
      var hasText = [].some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
      if (!hasText) return;
      if (on) el.setAttribute('contenteditable', 'true'); else el.removeAttribute('contenteditable');
    });
    document.querySelectorAll('#app a').forEach(function (a) {
      var hasText = [].some.call(a.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
      if (!hasText) return;
      if (on) a.setAttribute('contenteditable', 'true'); else a.removeAttribute('contenteditable');
    });
    document.querySelectorAll('#app img').forEach(function (im) { im.draggable = !on; });
  }

  /* ---------- undo / redo ---------- */
  var past = [], future = [];
  function snapshot() {
    var s = cleanHTML();
    if (past.length && past[past.length - 1] === s) return;
    past.push(s); if (past.length > 60) past.shift();
    future = [];
    updateHistoryButtons();
  }
  function restore(html) {
    deselect();
    document.getElementById('app').innerHTML = html;
    document.querySelectorAll('#app .reveal').forEach(function (el) { el.classList.add('reveal-in'); });
    applyEditable(true); addGridButtons(); addHeroButtons(); renderAllVideos(); setupPOI(); refreshGrids();
    autosave();
  }
  function undo() { if (!past.length) { flash('Nothing to undo'); return; } future.push(cleanHTML()); restore(past.pop()); updateHistoryButtons(); flash('Undone'); }
  function redo() { if (!future.length) { flash('Nothing to redo'); return; } past.push(cleanHTML()); restore(future.pop()); updateHistoryButtons(); flash('Redone'); }
  function updateHistoryButtons() {
    bar.querySelector('[data-a="undo"]').disabled = !past.length;
    bar.querySelector('[data-a="redo"]').disabled = !future.length;
  }

  /* ---------- selected item toolbar: size and remove ---------- */
  var tools = document.createElement('div');
  tools.id = 'ed-sel';
  tools.setAttribute('contenteditable', 'false');
  tools.setAttribute('role', 'toolbar');
  tools.setAttribute('aria-label', 'Selected item');
  tools.innerHTML =
    '<span data-label></span>' +
    '<button type="button" data-s="smaller" aria-label="Make smaller">A−</button>' +
    '<button type="button" data-s="bigger" aria-label="Make bigger">A+</button>' +
    '<button type="button" data-s="reset" title="Back to original size">Original size</button>' +
    '<button type="button" data-s="parent" title="Select the box around this">Select box</button>' +
    '<button type="button" data-s="replace">Change photo</button>' +
    '<button type="button" data-s="remove" class="danger">Remove</button>' +
    '<button type="button" data-s="close" aria-label="Close">✕</button>';
  if (isOwner) document.body.appendChild(tools);
  var selected = null;
  var NAMES = { H1: 'Title', H2: 'Heading', H3: 'Heading', H4: 'Heading', P: 'Paragraph', A: 'Link or button', SPAN: 'Text', LI: 'List item', IMG: 'Photo', FIGURE: 'Gallery item', FIGCAPTION: 'Caption', BUTTON: 'Button', SECTION: 'Section', ARTICLE: 'Card', UL: 'List' };
  function labelFor(el) {
    if (el.tagName === 'DIV') return el.querySelector('img') && !el.querySelector('h1,h2,h3,p') ? 'Photo box' : 'Box';
    return NAMES[el.tagName] || 'Item';
  }
  function select(el) {
    if (!el || el === selected) { placeTools(); return; }
    deselect();
    selected = el; el.classList.add('ed-selected');
    var isImg = el.tagName === 'IMG';
    tools.querySelector('[data-label]').textContent = labelFor(el);
    tools.querySelector('[data-s="replace"]').hidden = !isImg;
    tools.querySelector('[data-s="smaller"]').textContent = isImg ? '−' : 'A−';
    tools.querySelector('[data-s="bigger"]').textContent = isImg ? '+' : 'A+';
    var p = el.parentElement;
    tools.querySelector('[data-s="parent"]').hidden = !p || p.id === 'app' || p.tagName === 'MAIN' || p.tagName === 'BODY';
    tools.classList.add('on'); placeTools();
  }
  function deselect() {
    if (selected) selected.classList.remove('ed-selected');
    selected = null; tools.classList.remove('on');
  }
  function placeTools() {
    if (!selected || !document.contains(selected)) { deselect(); return; }
    var r = selected.getBoundingClientRect();
    var h = tools.offsetHeight || 44, w = tools.offsetWidth || 300;
    var top = r.top - h - 8;
    if (top < 80) top = Math.min(window.innerHeight - h - 70, r.bottom + 8);
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
    tools.style.top = Math.max(8, top) + 'px'; tools.style.left = left + 'px';
  }
  window.addEventListener('scroll', function () { if (selected) placeTools(); }, { passive: true });
  window.addEventListener('resize', function () { if (selected) placeTools(); });

  var TEXT_STEPS = [0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];
  var IMG_STEPS = [25, 35, 50, 65, 80, 100];
  function resize(dir) {
    var el = selected; if (!el) return;
    snapshot();
    if (el.tagName === 'IMG') {
      var pos = getComputedStyle(el).position;
      if (pos === 'absolute' || pos === 'fixed') { flash('This photo fills its whole area, so it can only be changed, not resized.'); past.pop(); updateHistoryButtons(); return; }
      var cur = parseFloat(el.getAttribute('data-ed-w')) || 100;
      var i = IMG_STEPS.indexOf(cur); if (i < 0) i = IMG_STEPS.length - 1;
      i = Math.max(0, Math.min(IMG_STEPS.length - 1, i + dir));
      var v = IMG_STEPS[i];
      if (v === 100) { el.style.width = ''; el.style.marginInline = ''; el.removeAttribute('data-ed-w'); }
      else { el.style.width = v + '%'; el.style.marginInline = 'auto'; el.setAttribute('data-ed-w', v); }
      flash('Photo size ' + v + '%');
    } else {
      var f = parseFloat(el.getAttribute('data-ed-f')) || 1;
      var j = TEXT_STEPS.indexOf(f); if (j < 0) j = 3;
      j = Math.max(0, Math.min(TEXT_STEPS.length - 1, j + dir));
      var k = TEXT_STEPS[j];
      if (k === 1) { el.style.zoom = ''; el.removeAttribute('data-ed-f'); }
      else { el.style.zoom = String(k); el.setAttribute('data-ed-f', k); }
      flash('Text size ' + Math.round(k * 100) + '%');
    }
    if (!el.getAttribute('style')) el.removeAttribute('style');
    autosave(); placeTools();
  }
  function resetSize() {
    var el = selected; if (!el) return;
    snapshot();
    el.style.zoom = ''; el.style.width = ''; el.style.marginInline = '';
    ['data-ed-f', 'data-ed-w'].forEach(function (a) { el.removeAttribute(a); });
    if (!el.getAttribute('style')) el.removeAttribute('style');
    autosave(); placeTools(); flash('Back to original size');
  }
  function removeSelected() {
    var el = selected; if (!el) return;
    if (el.tagName === 'SECTION' || el.tagName === 'HEADER' || el.tagName === 'FOOTER') {
      if (!confirm('Remove this whole section? You can bring it back with Undo.')) return;
    }
    snapshot(); deselect(); el.remove(); refreshGrids(); autosave();
    flash('Removed. Tap Undo to bring it back.');
  }
  tools.addEventListener('mousedown', function (e) { e.preventDefault(); });
  tools.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !selected) return;
    var s = b.getAttribute('data-s');
    if (s === 'smaller') resize(-1);
    else if (s === 'bigger') resize(1);
    else if (s === 'reset') resetSize();
    else if (s === 'remove') removeSelected();
    else if (s === 'replace') openModal('img', selected);
    else if (s === 'close') deselect();
    else if (s === 'parent') {
      var p = selected.parentElement;
      while (p && p.id !== 'app' && p.children.length === 1 && p.parentElement && p.parentElement.id !== 'app' && p.tagName !== 'SECTION') p = p.parentElement;
      if (p && p.id !== 'app') select(p);
    }
  });

  /* The browser may show a copy of the page that is up to 10 minutes old. Before editing,
     make sure this is the newest version on the website, so publishing never puts back an old page. */
  function freshUrl() { return location.pathname + '?edit&fresh=' + Date.now(); }
  function checkFresh() {
    if (/[?&]fresh=/.test(location.search)) return;
    fetch(location.pathname + '?fresh=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : null; }).then(function (t) {
      if (!t || appHashOf(t) === BASE || !editing) return;
      flash('Loading the newest version of this page…');
      if (past.length) autosave();
      setTimeout(function () { location.replace(freshUrl()); }, 600);
    }).catch(function () {});
  }
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('editing', on);
    bar.querySelector('[data-a="edit"]').textContent = on ? 'Done' : 'Edit page';
    ['save', 'reset', 'undo', 'redo', 'publish'].forEach(function (k) { bar.querySelector('[data-a="' + k + '"]').hidden = !on; });
    document.querySelectorAll('#app .reveal').forEach(function (el) { el.classList.add('reveal-in'); });
    applyEditable(on);
    bar.querySelector('[data-a="older"]').hidden = !(on && olderDraft());
    if (on) { checkFresh(); addGridButtons(); addHeroButtons(); updateHistoryButtons(); flash(olderDraft() ? 'You have earlier changes that were not published. Click "Bring back my earlier changes" to put them back.' : HINT); }
    else {
      deselect();
      document.querySelectorAll('#app .ed-only').forEach(function (el) { el.remove(); });
      refreshGrids();
      editing = true; autosave(); editing = false;
    }
  }

  bar.addEventListener('mousedown', function (e) { if (e.target.closest('[data-a="undo"],[data-a="redo"]')) e.preventDefault(); });
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var a = b.dataset.a;
    if (a === 'edit') setEditing(!editing);
    else if (a === 'undo') undo();
    else if (a === 'redo') redo();
    else if (a === 'save') download();
    else if (a === 'publish') publish();
    else if (a === 'older') {
      var od = olderDraft(); if (!od) { b.hidden = true; return; }
      if (confirm('The website was updated after you made these changes. Put your earlier changes back on this page? (Undo takes them off again.)')) {
        snapshot(); restore(od.html);
        try { localStorage.removeItem('anguar-older:' + PAGE); } catch (err) {}
        b.hidden = true; flash('Earlier changes are back. Click Publish to website to make them live.');
      }
    }
    else if (a === 'reset') {
      if (confirm('Throw away every change on this page and go back to the version on the website?')) {
        try { localStorage.removeItem(EDITOR_KEY); } catch (err) {}
        location.href = location.pathname + '?edit';
      }
    }
  });

  document.addEventListener('click', function (e) {
    if (!editing || e.target.closest('#ed-bar') || e.target.closest('#ed-modal') || e.target.closest('#ed-sel')) return;
    var bgBtn = e.target.closest('[data-bgact]');
    if (bgBtn) { e.preventDefault(); bgAction(bgBtn); return; }
    var add = e.target.closest('[data-add]');
    if (add) {
      snapshot();
      var grid = add.parentElement.previousElementSibling;
      var rich = grid.hasAttribute('data-rich');
      var item = makeItem(add.getAttribute('data-add'), rich);
      grid.appendChild(item);
      if (rich) item.querySelectorAll('.wh-body span, .wh-body h3, .wh-body p').forEach(function (el) { el.setAttribute('contenteditable', 'true'); });
      else item.querySelector('figcaption').setAttribute('contenteditable', 'true');
      if (item.hasAttribute('data-video')) renderVideo(item);
      addTools(item); refreshGrids();
      openModal(item.hasAttribute('data-video') ? 'video' : 'img', item.hasAttribute('data-video') ? item : item.querySelector('img'), function (ok) { if (!ok) { item.remove(); past.pop(); updateHistoryButtons(); refreshGrids(); } });
      return;
    }
    var tool = e.target.closest('.ed-tools button');
    if (tool) {
      var it = tool.closest('.media-item'), t = tool.getAttribute('data-t');
      if (t === 'del') { snapshot(); deselect(); it.remove(); refreshGrids(); autosave(); flash('Removed. Tap Undo to bring it back.'); }
      else if (t === 'left' && it.previousElementSibling) { snapshot(); it.parentNode.insertBefore(it, it.previousElementSibling); autosave(); }
      else if (t === 'right' && it.nextElementSibling) { snapshot(); it.parentNode.insertBefore(it.nextElementSibling, it); autosave(); }
      return;
    }
    var vid = e.target.closest('#app .media-item[data-video] .media-frame');
    if (vid) { e.preventDefault(); select(vid.closest('.media-item')); openModal('video', vid.closest('.media-item')); return; }
    var a = e.target.closest('#app a');
    if (a) {
      e.preventDefault();
      if (e.detail === 2) {
        var h = prompt('Link address for this button or link:', a.getAttribute('href'));
        if (h !== null) { snapshot(); a.setAttribute('href', h.trim()); autosave(); }
      }
    }
    var img = e.target.closest('#app img');
    if (img) { e.preventDefault(); select(img); return; }
    var ce = e.target.closest('#app [contenteditable="true"]');
    if (ce) { select(ce); return; }
    var box = e.target.closest('#app section, #app article, #app li, #app figure');
    if (box) select(box); else deselect();
  }, true);

  /* one snapshot per editing burst, taken before the first change */
  var typingFor = null;
  document.addEventListener('beforeinput', function (e) {
    if (!editing || !e.target.closest || !e.target.closest('#app')) return;
    var host = e.target.closest('[contenteditable="true"]');
    if (host !== typingFor) { snapshot(); typingFor = host; }
  });
  document.addEventListener('focusout', function () { typingFor = null; });

  document.addEventListener('keydown', function (e) {
    if (!editing) return;
    var host = e.target.closest && e.target.closest('#app [contenteditable="true"]');
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
    if (!host) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !modal.classList.contains('on')) { e.preventDefault(); removeSelected(); }
      if (e.key === 'Escape') deselect();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (MULTILINE.indexOf(host.tagName) >= 0 && e.shiftKey) document.execCommand('insertLineBreak');
      else host.blur();
    }
    if (e.key === 'Escape') host.blur();
  });

  /* stop dragging pieces of the page into the text */
  ['dragstart', 'drop'].forEach(function (t) {
    document.addEventListener(t, function (e) { if (editing && e.target.closest && e.target.closest('#app')) e.preventDefault(); }, true);
  });

  document.addEventListener('input', function (e) { if (editing && !e.target.closest('#ed-modal')) { clearTimeout(autosave.t); autosave.t = setTimeout(autosave, 700); placeTools(); } });
  document.addEventListener('paste', function (e) {
    if (!editing || e.target.closest('#ed-modal')) return; e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\s*\n\s*/g, ' ');
    document.execCommand('insertText', false, text);
  });

  function download() {
    deselect();
    var out = buildPageHTML();
    var name = PAGE;
    var url = URL.createObjectURL(new Blob([out], { type: 'text/html' }));
    var link = document.createElement('a'); link.href = url; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    flash('Downloaded ' + name + ' (a backup copy).');
  }

  /* ---------- background photos: change the photo and how strongly it shows ---------- */
  var BG_LOOKS = [['clear', 'Clear'], ['', 'Normal'], ['strong', 'Faded'], ['none', 'No photo']];
  function bgParts(s) {
    if (s.classList.contains('page-hero')) return { img: s.querySelector(':scope > .page-hero-img'), shade: s.querySelector(':scope > .page-hero-shade') };
    var shade = null, img = null;
    s.querySelectorAll('div.absolute.inset-0').forEach(function (d) { if (!shade && /gradient/.test(d.getAttribute('style') || '')) shade = d; });
    if (!shade) return null;
    var box = shade.parentElement;
    for (var c = box.firstElementChild; c; c = c.nextElementSibling) {
      if (c === shade) break;
      var im = c.tagName === 'IMG' ? c : c.querySelector('img');
      if (im && /absolute/.test(c.className)) img = im;
    }
    return img ? { img: img, shade: shade } : null;
  }
  function addHeroButtons() {
    document.querySelectorAll('#app section').forEach(function (s) {
      if (s.querySelector('.ed-bg-panel')) return;
      var p = bgParts(s); if (!p || !p.img) return;
      p.img.setAttribute('data-bg-img', '');
      if (p.shade) { p.shade.setAttribute('data-bg-shade', ''); if (/rgba\(1,\s*41/.test(p.shade.getAttribute('style') || '')) s.setAttribute('data-bg-dark', ''); }
      var box = p.shade ? p.shade.parentElement : s;
      var panel = document.createElement('div');
      panel.className = 'ed-bg-panel ed-only'; panel.setAttribute('contenteditable', 'false');
      var html = '<button type="button" data-bgact="photo" class="ed-bg-main">Change background photo</button><span class="ed-bg-looks" role="group" aria-label="How the photo shows">';
      BG_LOOKS.forEach(function (l) { html += '<button type="button" data-bgact="look" data-look="' + l[0] + '">' + l[1] + '</button>'; });
      panel.innerHTML = html + '</span>';
      box.appendChild(panel);
      markLook(s);
    });
  }
  function markLook(s) {
    var cur = s.getAttribute('data-bg') || '';
    s.querySelectorAll('.ed-bg-panel [data-look]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-look') === cur ? 'true' : 'false'); });
  }
  function bgAction(btn) {
    var s = btn.closest('section'); if (!s) return;
    var img = s.querySelector('[data-bg-img]');
    if (btn.getAttribute('data-bgact') === 'photo') {
      if (img) { if (s.getAttribute('data-bg') === 'none') { snapshot(); s.removeAttribute('data-bg'); markLook(s); } select(img); openModal('img', img); }
      return;
    }
    var look = btn.getAttribute('data-look');
    if ((s.getAttribute('data-bg') || '') === look) return;
    snapshot();
    if (look) s.setAttribute('data-bg', look); else s.removeAttribute('data-bg');
    markLook(s); autosave();
    flash({ clear: 'Photo shows clearly', '': 'Photo back to normal', strong: 'Photo faded into the background', none: 'Photo hidden (it is kept, choose another look to bring it back)' }[look]);
  }

  /* ---------- the page as it should be saved ---------- */
  function buildPageHTML() {
    var html = '<!doctype html>\n' + document.documentElement.outerHTML;
    var doc = new DOMParser().parseFromString(html, 'text/html');
    doc.getElementById('app').innerHTML = cleanHTML();
    ['ed-bar', 'ed-modal', 'ed-sel'].forEach(function (id) { var x = doc.getElementById(id); if (x) x.remove(); });
    doc.body.classList.remove('editing');
    if (!doc.body.getAttribute('class')) doc.body.removeAttribute('class');
    doc.documentElement.style.overflow = '';
    if (!doc.documentElement.getAttribute('style')) doc.documentElement.removeAttribute('style');
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }

  /* ---------- publish straight to GitHub ---------- */
  var GH = { owner: 'barbaraquito-art', repo: 'Beaute-of-Angaur-', branch: 'main' };
  var TOKEN_KEY = 'anguar-gh-token';
  function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function api(path, opts) {
    opts = opts || {};
    var h = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Authorization': 'Bearer ' + token() };
    if (opts.body) h['Content-Type'] = 'application/json';
    return fetch('https://api.github.com/repos/' + GH.owner + '/' + GH.repo + path, { method: opts.method || 'GET', headers: h, body: opts.body, cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
          if (!r.ok) { var err = new Error((j && j.message) || ('GitHub error ' + r.status)); err.status = r.status; throw err; }
          return j;
        });
      });
  }
  function b64FromBytes(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function b64FromText(t) { return b64FromBytes(new TextEncoder().encode(t)); }
  function textFromB64(b) { var bin = atob(b.replace(/\s/g, '')); var u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }
  function friendly(err) {
    if (!err) return 'Something went wrong.';
    if (err.status === 401) return 'GitHub did not accept the access key. It may have expired. Connect again with a new key.';
    if (err.status === 403 || err.status === 404) return 'This access key cannot change the Beaute-of-Angaur- repository. Check it has "Contents: Read and write" for that repository.';
    if (err.status === 409) return 'The page changed on GitHub while publishing. Reload the page and try again.';
    if (err.status === 422) return 'GitHub rejected the file: ' + err.message;
    if (/Failed to fetch|NetworkError|Load failed/.test(err.message || '')) return 'Could not reach GitHub. Check your internet connection.';
    return err.message || 'Something went wrong.';
  }

  /* modal content helpers */
  var sheet = modal.querySelector('.ed-sheet');
  var savedSheet = sheet.innerHTML;
  function sheetHTML(h) { sheet.innerHTML = h; modal.dataset.mode = 'custom'; modal.classList.add('on'); }
  function restoreSheet() {
    modal.classList.remove('on'); delete modal.dataset.mode;
    sheet.innerHTML = savedSheet;
    mUrl = modal.querySelector('#ed-url'); mAlt = modal.querySelector('#ed-alt'); mPrev = modal.querySelector('.ed-preview'); mErr = modal.querySelector('.ed-error');
    wireModal();
  }

  function connectDialog(then) {
    sheetHTML(
      '<h3>Connect publishing</h3>' +
      '<p class="ed-hint">Publishing saves your changes straight to your live website. It needs a GitHub access key that only you hold. The key is stored on this device only, never in the website.</p>' +
      '<ol class="ed-steps"><li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → New access key</a> (signed in as ' + GH.owner + ').</li>' +
      '<li>Name it <b>Website editor</b> and choose an expiry date.</li>' +
      '<li>Under <b>Repository access</b>, choose <b>Only select repositories</b> → <b>' + GH.repo + '</b>.</li>' +
      '<li>Under <b>Permissions → Repository permissions</b>, set <b>Contents</b> to <b>Read and write</b>.</li>' +
      '<li>Click <b>Generate token</b>, copy it and paste it below.</li></ol>' +
      '<label for="ed-token">Access key</label><input id="ed-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…">' +
      '<p class="ed-error" role="alert" hidden></p>' +
      '<div class="ed-row"><button type="button" data-x="cancel">Cancel</button><button type="button" class="ed-go" data-x="save">Connect</button></div>');
    var inp = sheet.querySelector('#ed-token'), er = sheet.querySelector('.ed-error');
    setTimeout(function () { inp.focus(); }, 30);
    sheet.querySelector('[data-x=cancel]').onclick = restoreSheet;
    sheet.querySelector('[data-x=save]').onclick = function () {
      var t = inp.value.trim();
      if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) { er.textContent = 'That does not look like a GitHub access key. It starts with github_pat_.'; er.hidden = false; return; }
      var btn = this; btn.disabled = true; btn.textContent = 'Checking…'; er.hidden = true;
      try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {}
      api('').then(function (r) {
        if (!r || !r.permissions || !r.permissions.push) { var e2 = new Error('no push'); e2.status = 403; throw e2; }
        restoreSheet(); flash('Publishing connected'); if (then) then();
      }).catch(function (err) {
        try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
        er.textContent = friendly(err); er.hidden = false; btn.disabled = false; btn.textContent = 'Connect';
      });
    };
  }

  function dataUrlToBytes(u) {
    var m = u.match(/^data:([^;,]+)(;base64)?,(.*)$/); if (!m) return null;
    var bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    var bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { type: m[1], bytes: bytes };
  }
  function shortHash(bytes) { return crypto.subtle.digest('SHA-256', bytes).then(function (h) { return Array.from(new Uint8Array(h)).slice(0, 6).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }); }
  var EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

  /* move photos and clips uploaded from a device into the repository, so pages stay small */
  function uploadEmbeddedMedia(progress) {
    var jobs = [];
    document.querySelectorAll('#app img[src^="data:"]').forEach(function (im) { jobs.push({ el: im, attr: 'src', val: im.getAttribute('src'), dir: 'images/uploads/' }); });
    document.querySelectorAll('#app [data-video^="data:"]').forEach(function (v) { jobs.push({ el: v, attr: 'data-video', val: v.getAttribute('data-video'), dir: 'videos/uploads/' }); });
    var seq = Promise.resolve();
    jobs.forEach(function (j, i) {
      seq = seq.then(function () {
        var f = dataUrlToBytes(j.val); if (!f) return;
        progress('Uploading photo or video ' + (i + 1) + ' of ' + jobs.length + '…');
        return shortHash(f.bytes).then(function (h) {
          var path = j.dir + h + '.' + (EXT[f.type] || 'bin');
          return api('/contents/' + path + '?ref=' + GH.branch).then(function () { return path; }, function (err) {
            if (err.status !== 404) throw err;
            return api('/contents/' + path, { method: 'PUT', body: JSON.stringify({ message: 'Add ' + path + ' from website editor', content: b64FromBytes(f.bytes), branch: GH.branch }) }).then(function () { return path; });
          });
        }).then(function (path) {
          if (!path) return;
          j.el.setAttribute(j.attr, path);
          if (j.attr === 'data-video') renderVideo(j.el);
        });
      });
    });
    return seq.then(function () { return jobs.length; });
  }

  function appHashOf(html) {
    var d = new DOMParser().parseFromString(html, 'text/html');
    var a = d.getElementById('app');
    return a ? hash(a.innerHTML) : '';
  }

  var publishing = false;
  function publish() {
    if (publishing) return;
    if (!token()) { connectDialog(publish); return; }
    publishing = true;
    deselect();
    sheetHTML('<h3>Publishing ' + PAGE + '</h3><p class="ed-progress" role="status">Preparing…</p><p class="ed-error" role="alert" hidden></p><div class="ed-row" hidden><button type="button" class="ed-go" data-x="close">Close</button></div>');
    var prog = sheet.querySelector('.ed-progress'), er = sheet.querySelector('.ed-error'), row = sheet.querySelector('.ed-row');
    function say(t) { prog.textContent = t; }
    function fail(err) {
      publishing = false;
      say('Not published.'); er.textContent = friendly(err); er.hidden = false; row.hidden = false;
      sheet.querySelector('[data-x=close]').onclick = function () { if (err && err.status === 401) { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} } restoreSheet(); };
    }
    var remote;
    api('/contents/' + PAGE + '?ref=' + GH.branch).then(function (r) {
      remote = r;
      var remoteHtml = textFromB64(r.content);
      if (appHashOf(remoteHtml) !== BASE) {
        return new Promise(function (res, rej) {
          say('There is a newer version of this page on your website.');
          er.textContent = 'You are editing an older copy. Load the newer page first; your changes here are kept and you can bring them back with "Bring back my earlier changes". Replacing would undo the newer changes.'; er.hidden = false;
          row.hidden = false;
          row.innerHTML = '<button type="button" data-x="go">Replace it with mine</button><button type="button" class="ed-go" data-x="stop">Load the newer page (recommended)</button>';
          row.querySelector('[data-x=stop]').onclick = function () { publishing = false; if (past.length) autosave(); location.replace(freshUrl()); rej(null); };
          row.querySelector('[data-x=go]').onclick = function () { er.hidden = true; row.hidden = true; res(); };
        });
      }
    }).then(function () {
      return uploadEmbeddedMedia(say);
    }).then(function () {
      say('Saving ' + PAGE + ' to GitHub…');
      var html = buildPageHTML();
      return api('/contents/' + PAGE, { method: 'PUT', body: JSON.stringify({ message: 'Update ' + PAGE + ' from website editor', content: b64FromText(html), sha: remote.sha, branch: GH.branch }) })
        .then(function (res) { return { res: res, html: html }; });
    }).then(function (out) {
      var newBase = appHashOf(out.html);
      BASE = newBase;
      try { localStorage.removeItem(EDITOR_KEY); } catch (e) {}
      past = []; future = []; updateHistoryButtons();
      var commitUrl = out.res && out.res.commit && out.res.commit.html_url;
      say('Saved to GitHub. Waiting for the live website to update…');
      var tries = 0;
      (function poll() {
        tries++;
        fetch(location.pathname + '?live=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
          if (appHashOf(t) === newBase) {
            publishing = false;
            say('Published. Your change is live on the website now.');
            prog.insertAdjacentHTML('afterend', '<p class="ed-ok">✓ Live at <a href="' + location.pathname + '" target="_blank" rel="noopener">' + location.host + location.pathname + '</a>' + (commitUrl ? ' · <a href="' + commitUrl + '" target="_blank" rel="noopener">View on GitHub</a>' : '') + '</p>');
            row.hidden = false; row.innerHTML = '<button type="button" class="ed-go" data-x="close">Done</button>';
            row.querySelector('[data-x=close]').onclick = restoreSheet;
          } else if (tries < 36) setTimeout(poll, 5000);
          else {
            publishing = false;
            say('Saved to GitHub. The live website is taking longer than usual to update. It will show your change within a few minutes.');
            row.hidden = false; row.innerHTML = '<button type="button" class="ed-go" data-x="close">Done</button>';
            row.querySelector('[data-x=close]').onclick = restoreSheet;
          }
        }).catch(function () { if (tries < 36) setTimeout(poll, 5000); });
      })();
    }).catch(function (err) { if (err) fail(err); });
  }
  setupReveal(); setupMenu(); setupPOI(); setupForms();
  renderAllVideos(); refreshGrids();
  if (isOwner && params.has('edit')) setEditing(true);
})();
