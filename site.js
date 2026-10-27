(function () {
  'use strict';
  var EDITOR_KEY = 'anguar-edit:' + (location.pathname.split('/').pop() || 'index.html');

  /* ---------- restore this page's saved edits (this browser only) ---------- */
  try {
    var saved = localStorage.getItem(EDITOR_KEY);
    if (saved) {
      var root = document.getElementById('app');
      if (root) root.innerHTML = saved;
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
    if (!v) { box.innerHTML = '<div class="media-empty">No video link yet</div>'; return; }
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
    '<button type="button" data-a="save" hidden>Download page</button>' +
    '<button type="button" data-a="reset" hidden>Undo all</button>' +
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
  mUrl.addEventListener('input', function () { mData = null; mErr.hidden = true; if (mKind === 'img' && mUrl.value.trim()) { mPrev.src = mUrl.value.trim(); mPrev.hidden = false; } });
  modal.querySelector('[data-cancel]').addEventListener('click', function () { if (mDone) mDone(false); closeModal(); });
  modal.addEventListener('click', function (e) { if (e.target === modal) { if (mDone) mDone(false); closeModal(); } });
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
    if (!val) { mErr.textContent = mKind === 'img' ? 'Paste a photo link or upload a photo first.' : 'Paste a video link or upload a clip first.'; mErr.hidden = false; return; }
    if (mKind === 'img') { mTarget.src = val; mTarget.removeAttribute('srcset'); mTarget.alt = mAlt.value; }
    else { mTarget.setAttribute('data-video', val); renderVideo(mTarget); }
    if (mDone) mDone(true);
    closeModal(); refreshGrids(); autosave();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('on')) { if (mDone) mDone(false); closeModal(); } });

  function cleanHTML() {
    var c = document.getElementById('app').cloneNode(true);
    c.querySelectorAll('[contenteditable]').forEach(function (el) { el.removeAttribute('contenteditable'); });
    c.querySelectorAll('.reveal-in').forEach(function (el) { el.classList.remove('reveal-in'); });
    c.querySelectorAll('[data-poi-ready]').forEach(function (el) { el.removeAttribute('data-poi-ready'); });
    c.querySelectorAll('.ed-only').forEach(function (el) { el.remove(); });
    c.querySelectorAll('.media-item[data-video] .media-frame').forEach(function (el) { el.innerHTML = ''; });
    c.querySelectorAll('[data-media-empty]').forEach(function (el) { el.style.display = ''; if (!el.getAttribute('style')) el.removeAttribute('style'); });
    c.querySelectorAll('ul > li[style*="display"]').forEach(function (el) { el.style.display = ''; if (!el.getAttribute('style')) el.removeAttribute('style'); });
    var m = c.querySelector('[data-mobile-menu]'); if (m) { m.style.opacity = ''; m.style.pointerEvents = ''; if (!m.getAttribute('style')) m.removeAttribute('style'); }
    return c.innerHTML;
  }
  function autosave() {
    if (!editing) return;
    try { localStorage.setItem(EDITOR_KEY, cleanHTML()); flash('Saved in this browser'); }
    catch (e) { flash('Too big to save here. Use Download page.'); }
  }

  function makeItem(kind) {
    var fig = document.createElement('figure');
    fig.className = 'media-item';
    if (kind === 'video') { fig.setAttribute('data-video', ''); fig.innerHTML = '<div class="media-frame"></div><figcaption>Video caption</figcaption>'; }
    else { fig.innerHTML = '<img src="" alt="" loading="lazy"><figcaption>Photo caption</figcaption>'; }
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
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('editing', on);
    bar.querySelector('[data-a="edit"]').textContent = on ? 'Done' : 'Edit page';
    bar.querySelector('[data-a="save"]').hidden = !on;
    bar.querySelector('[data-a="reset"]').hidden = !on;
    document.querySelectorAll('#app .reveal').forEach(function (el) { el.classList.add('reveal-in'); });
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
    if (on) { addGridButtons(); flash(HINT); }
    else {
      document.querySelectorAll('#app .ed-only').forEach(function (el) { el.remove(); });
      refreshGrids();
      editing = true; autosave(); editing = false;
    }
  }

  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var a = b.dataset.a;
    if (a === 'edit') setEditing(!editing);
    else if (a === 'save') download();
    else if (a === 'reset') {
      if (confirm('Undo every change on this page and go back to the version on the website?')) {
        try { localStorage.removeItem(EDITOR_KEY); } catch (err) {}
        location.href = location.pathname + '?edit';
      }
    }
  });

  document.addEventListener('click', function (e) {
    if (!editing || e.target.closest('#ed-bar') || e.target.closest('#ed-modal')) return;
    var add = e.target.closest('[data-add]');
    if (add) {
      var grid = add.parentElement.previousElementSibling;
      var item = makeItem(add.getAttribute('data-add'));
      grid.appendChild(item);
      var cap = item.querySelector('figcaption'); cap.setAttribute('contenteditable', 'true');
      if (item.hasAttribute('data-video')) renderVideo(item);
      addTools(item); refreshGrids();
      openModal(item.hasAttribute('data-video') ? 'video' : 'img', item.hasAttribute('data-video') ? item : item.querySelector('img'), function (ok) { if (!ok) { item.remove(); refreshGrids(); } });
      return;
    }
    var tool = e.target.closest('.ed-tools button');
    if (tool) {
      var it = tool.closest('.media-item'), t = tool.getAttribute('data-t');
      if (t === 'del') { if (confirm('Delete this item from the gallery?')) { it.remove(); refreshGrids(); autosave(); } }
      else if (t === 'left' && it.previousElementSibling) { it.parentNode.insertBefore(it, it.previousElementSibling); autosave(); }
      else if (t === 'right' && it.nextElementSibling) { it.parentNode.insertBefore(it.nextElementSibling, it); autosave(); }
      return;
    }
    var vid = e.target.closest('#app .media-item[data-video] .media-frame');
    if (vid) { e.preventDefault(); openModal('video', vid.closest('.media-item')); return; }
    var a = e.target.closest('#app a');
    if (a) {
      e.preventDefault();
      if (e.detail === 2) {
        var h = prompt('Link address for this button or link:', a.getAttribute('href'));
        if (h !== null) { a.setAttribute('href', h.trim()); autosave(); }
      }
    }
    var img = e.target.closest('#app img');
    if (img) { e.preventDefault(); openModal('img', img); }
  }, true);

  document.addEventListener('input', function (e) { if (editing && !e.target.closest('#ed-modal')) { clearTimeout(autosave.t); autosave.t = setTimeout(autosave, 700); } });
  document.addEventListener('paste', function (e) {
    if (!editing || e.target.closest('#ed-modal')) return; e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text'));
  });

  function download() {
    var html = '<!doctype html>\n' + document.documentElement.outerHTML;
    var doc = new DOMParser().parseFromString(html, 'text/html');
    doc.getElementById('app').innerHTML = cleanHTML();
    ['ed-bar', 'ed-modal'].forEach(function (id) { var x = doc.getElementById(id); if (x) x.remove(); });
    doc.body.classList.remove('editing');
    if (!doc.body.getAttribute('class')) doc.body.removeAttribute('class');
    doc.documentElement.style.overflow = '';
    if (!doc.documentElement.getAttribute('style')) doc.documentElement.removeAttribute('style');
    var out = '<!doctype html>\n' + doc.documentElement.outerHTML;
    var name = location.pathname.split('/').pop() || 'index.html';
    var url = URL.createObjectURL(new Blob([out], { type: 'text/html' }));
    var link = document.createElement('a'); link.href = url; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    flash('Downloaded ' + name + '. Now upload it to GitHub.');
  }

  setupReveal(); setupMenu(); setupPOI(); setupForms();
  renderAllVideos(); refreshGrids();
  if (isOwner && params.has('edit')) setEditing(true);
})();
