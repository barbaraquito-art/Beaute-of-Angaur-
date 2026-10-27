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

  /* ---------- editor ---------- */
  var editing = false;
  var bar = document.createElement('div');
  bar.id = 'ed-bar';
  bar.setAttribute('contenteditable', 'false');
  bar.innerHTML =
    '<button type="button" data-a="edit">Edit page</button>' +
    '<button type="button" data-a="save" hidden>Download page</button>' +
    '<button type="button" data-a="reset" hidden>Undo all</button>' +
    '<span data-msg></span>';
  document.body.appendChild(bar);
  var msg = bar.querySelector('[data-msg]');
  function flash(t) { msg.textContent = t; clearTimeout(flash.t); flash.t = setTimeout(function () { msg.textContent = editing ? 'Tap text to type · tap a photo to change it' : ''; }, 2500); }

  function cleanHTML() {
    var c = document.getElementById('app').cloneNode(true);
    c.querySelectorAll('[contenteditable]').forEach(function (el) { el.removeAttribute('contenteditable'); });
    c.querySelectorAll('.reveal-in').forEach(function (el) { el.classList.remove('reveal-in'); });
    c.querySelectorAll('[data-poi-ready]').forEach(function (el) { el.removeAttribute('data-poi-ready'); });
    c.querySelectorAll('ul > li[style*="display"]').forEach(function (el) { el.style.display = ''; if (!el.getAttribute('style')) el.removeAttribute('style'); });
    var m = c.querySelector('[data-mobile-menu]'); if (m) { m.style.opacity = ''; m.style.pointerEvents = ''; if (!m.getAttribute('style')) m.removeAttribute('style'); }
    return c.innerHTML;
  }
  function autosave() { try { localStorage.setItem(EDITOR_KEY, cleanHTML()); flash('Saved in this browser'); } catch (e) { flash('Use Download page to keep changes'); } }

  var TEXT_SEL = 'h1,h2,h3,h4,p,li > a,span,label,figcaption,button:not([aria-label])';
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('editing', on);
    bar.querySelector('[data-a="edit"]').textContent = on ? 'Done' : 'Edit page';
    bar.querySelector('[data-a="save"]').hidden = !on;
    bar.querySelector('[data-a="reset"]').hidden = !on;
    document.querySelectorAll('#app .reveal').forEach(function (el) { el.classList.add('reveal-in'); });
    document.querySelectorAll('#app ' + TEXT_SEL.split(',').join(',#app ')).forEach(function (el) {
      if (el.closest('svg')) return;
      var hasText = [].some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
      if (!hasText) return;
      if (on) el.setAttribute('contenteditable', 'true'); else el.removeAttribute('contenteditable');
    });
    document.querySelectorAll('#app a').forEach(function (a) {
      var hasText = [].some.call(a.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
      if (!hasText) return;
      if (on) a.setAttribute('contenteditable', 'true'); else a.removeAttribute('contenteditable');
    });
    if (on) flash('Tap text to type · tap a photo to change it'); else autosave();
  }

  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var a = b.dataset.a;
    if (a === 'edit') setEditing(!editing);
    else if (a === 'save') download();
    else if (a === 'reset') {
      if (confirm('Undo every change on this page and go back to the version on the website?')) {
        try { localStorage.removeItem(EDITOR_KEY); } catch (err) {}
        location.reload();
      }
    }
  });

  document.addEventListener('click', function (e) {
    if (!editing || e.target.closest('#ed-bar')) return;
    var a = e.target.closest('#app a');
    if (a) {
      e.preventDefault();
      if (e.detail === 2) {
        var h = prompt('Link address for this button or link:', a.getAttribute('href'));
        if (h !== null) { a.setAttribute('href', h.trim()); autosave(); }
      }
    }
    var img = e.target.closest('#app img');
    if (img) {
      e.preventDefault();
      var choice = prompt('Paste a link to a new photo.\nOr leave this empty and press OK to choose a photo from your device.', '');
      if (choice === null) return;
      if (choice.trim()) { img.src = choice.trim(); img.removeAttribute('srcset'); autosave(); return; }
      var f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
      f.onchange = function () {
        var file = f.files[0]; if (!file) return;
        var r = new FileReader();
        r.onload = function () {
          var im = new Image();
          im.onload = function () {
            var max = 1800, s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
            var cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * s); cv.height = Math.round(im.naturalHeight * s);
            cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
            img.src = cv.toDataURL('image/jpeg', 0.85); img.removeAttribute('srcset'); autosave();
          };
          im.src = r.result;
        };
        r.readAsDataURL(file);
      };
      f.click();
    }
  }, true);

  document.addEventListener('input', function () { if (editing) { clearTimeout(autosave.t); autosave.t = setTimeout(autosave, 700); } });
  document.addEventListener('paste', function (e) {
    if (!editing) return; e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text'));
  });

  function download() {
    var html = '<!doctype html>\n' + document.documentElement.outerHTML;
    var doc = new DOMParser().parseFromString(html, 'text/html');
    doc.getElementById('app').innerHTML = cleanHTML();
    var b = doc.getElementById('ed-bar'); if (b) b.remove();
    doc.body.classList.remove('editing');
    doc.documentElement.style.overflow = '';
    if (!doc.documentElement.getAttribute('style')) doc.documentElement.removeAttribute('style');
    var out = '<!doctype html>\n' + doc.documentElement.outerHTML;
    var name = location.pathname.split('/').pop() || 'index.html';
    var url = URL.createObjectURL(new Blob([out], { type: 'text/html' }));
    var link = document.createElement('a'); link.href = url; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    flash('Downloaded ' + name);
  }

  setupReveal(); setupMenu(); setupPOI(); setupForms();
})();
