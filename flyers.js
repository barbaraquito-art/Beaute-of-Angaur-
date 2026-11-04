/* Discover Angaur — 3D scattered flyer showcase. Progressive enhancement over the static gallery in #discover-flyers. */
(function () {
  'use strict';
  var root = document.getElementById('discover-flyers');
  if (!root) return;

  var SIDES = [
    { id: 'front', label: 'Front', small: 'images/flyers/angaur-flyer-front-440.webp', large: 'images/flyers/angaur-flyer-front-1100.webp',
      alt: 'Discover Angaur flyer, front: Angaur State Government seal, aerial photograph of Angaur island and the headline Discover Angaur, Palau’s Southernmost Hidden Paradise' },
    { id: 'back', label: 'Back', small: 'images/flyers/angaur-flyer-back-440.webp', large: 'images/flyers/angaur-flyer-back-1100.webp',
      alt: 'Discover Angaur flyer, back: Experience the Beauty of Angaur, five island highlights, Plan Your Visit with www.angaurstategov.com and a QR code' }
  ];
  var RATIO = 8.5 / 3.67;

  /* Final arrangements: x,y in -1..1 of the free space, r in degrees, k = stacking rank (higher sits on top) */
  var LAYOUTS = {
    wide: [
      [-1.00, 0.30, -13, 1], [-0.66, -0.55, 7, 3], [-0.33, 0.45, -5, 5], [0.00, -0.12, 2, 7],
      [0.33, 0.50, 6, 6], [0.66, -0.50, -7, 4], [1.00, 0.28, 12, 2]
    ],
    mid: [
      [-1.00, 0.25, -11, 1], [-0.60, -0.50, 7, 3], [-0.20, 0.35, -4, 5],
      [0.20, -0.30, 3, 6], [0.60, 0.45, 8, 4], [1.00, -0.20, -10, 2]
    ],
    small: [
      [-1.00, 0.35, -10, 1], [-0.52, -0.45, 6, 3], [0.00, 0.10, -2, 5], [0.52, -0.40, -6, 4], [1.00, 0.35, 10, 2]
    ]
  };

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var supports3d = window.CSS && CSS.supports && CSS.supports('transform-style', 'preserve-3d') && 'IntersectionObserver' in window;
  var animated = supports3d && !(reduce && reduce.matches);

  var stage = root.querySelector('[data-afs-stage]');
  var allBtn = root.querySelector('[data-afs-all]');
  var cards = [], layoutKey = '', played = false, playing = false;

  /* ---------- Lightbox ---------- */
  var modal, dialog, big, cap, tabs = [], current = 0, lastFocus = null;
  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'afs-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="afs-dialog" role="dialog" aria-modal="true" aria-label="Discover Angaur flyer" tabindex="-1">' +
        '<button type="button" class="afs-close" aria-label="Close preview">×</button>' +
        '<div class="afs-view">' +
          '<button type="button" class="afs-nav prev" aria-label="Previous side">‹</button>' +
          '<img class="afs-big" alt="" decoding="async" width="1100" height="2549">' +
          '<button type="button" class="afs-nav next" aria-label="Next side">›</button>' +
        '</div>' +
        '<div class="afs-meta"><span class="afs-cap">Discover Angaur</span></div>' +
        '<div class="afs-grid"><p class="afs-gtitle">Official Flyers<small>Discover Angaur · front and back</small></p></div>' +
      '</div>';
    document.body.appendChild(modal);
    dialog = modal.querySelector('.afs-dialog');
    big = modal.querySelector('.afs-big');
    cap = modal.querySelector('.afs-meta');
    var grid = modal.querySelector('.afs-grid');
    SIDES.forEach(function (s, i) {
      var t = document.createElement('button');
      t.type = 'button'; t.className = 'afs-tab'; t.textContent = s.label;
      t.addEventListener('click', function () { show(i); });
      cap.appendChild(t); tabs.push(t);
      var g = document.createElement('button');
      g.type = 'button'; g.className = 'afs-gitem';
      g.setAttribute('aria-label', 'View the ' + s.label.toLowerCase() + ' of the flyer');
      g.innerHTML = '<img src="' + s.small + '" alt="" width="440" height="1019" loading="lazy" decoding="async"><span>' + s.label + '</span>';
      g.addEventListener('click', function () { dialog.classList.remove('is-grid'); show(i); });
      grid.appendChild(g);
    });
    modal.querySelector('.afs-close').addEventListener('click', close);
    modal.querySelector('.prev').addEventListener('click', function () { show(current - 1); });
    modal.querySelector('.next').addEventListener('click', function () { show(current + 1); });
    modal.addEventListener('click', function (e) { if (e.target === modal || e.target === dialog || e.target.classList.contains('afs-view') || e.target.classList.contains('afs-grid')) close(); });
    big.addEventListener('load', function () { big.classList.add('is-ready'); });
    document.addEventListener('keydown', function (e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (!dialog.classList.contains('is-grid') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) show(current + (e.key === 'ArrowRight' ? 1 : -1));
      else if (e.key === 'Tab') trap(e);
    });
  }
  function trap(e) {
    var f = [].filter.call(dialog.querySelectorAll('button'), function (b) { return b.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function show(i) {
    current = (i + SIDES.length) % SIDES.length;
    var s = SIDES[current];
    big.classList.remove('is-ready');
    big.alt = s.alt;
    big.src = s.large;
    if (big.complete && big.naturalWidth) big.classList.add('is-ready');
    tabs.forEach(function (t, k) { t.setAttribute('aria-pressed', k === current ? 'true' : 'false'); });
  }
  function open(i, grid) {
    if (!modal) buildModal();
    lastFocus = document.activeElement;
    dialog.classList.toggle('is-grid', !!grid);
    if (!grid) show(i);
    modal.hidden = false;
    document.documentElement.classList.add('afs-lock');
    requestAnimationFrame(function () { modal.classList.add('is-open'); });
    var first = grid ? modal.querySelector('.afs-gitem') : modal.querySelector('.afs-close');
    setTimeout(function () { (first || dialog).focus(); }, 30);
  }
  function close() {
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('afs-lock');
    setTimeout(function () { modal.hidden = true; }, reduce && reduce.matches ? 0 : 280);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  /* Static gallery buttons open the lightbox too (links still work without JavaScript) */
  [].forEach.call(root.querySelectorAll('[data-afs-open]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); open(+a.getAttribute('data-afs-open')); });
  });
  if (allBtn) { allBtn.hidden = false; allBtn.addEventListener('click', function () { open(0, true); }); }

  if (!animated || !stage) return;

  /* ---------- 3D table ---------- */
  root.classList.add('afs-on');
  var table = document.createElement('div');
  table.className = 'afs-table';
  stage.appendChild(table);

  function pickLayout(w) { return w >= 900 ? 'wide' : w >= 560 ? 'mid' : 'small'; }

  function geometry() {
    var W = stage.clientWidth;
    var key = pickLayout(W);
    var n = LAYOUTS[key].length;
    var cw = Math.round(Math.max(96, Math.min(196, W / (key === 'wide' ? 5.2 : key === 'mid' ? 4.4 : 3.0))));
    var f = key === 'small' ? 1.42 : 1.5;
    /* keep the whole arrangement inside one screen height */
    var maxH = Math.max(340, Math.round((window.innerHeight || 800) * 0.66));
    if (cw * RATIO * f > maxH) cw = Math.max(90, Math.floor(maxH / (RATIO * f)));
    var ch = cw * RATIO;
    var H = Math.round(ch * f);
    return { W: W, H: H, cw: cw, ch: ch, key: key, n: n };
  }

  function targets(g) {
    return LAYOUTS[g.key].map(function (p) {
      var rad = Math.abs(p[2]) * Math.PI / 180;
      var bw = g.cw * Math.cos(rad) + g.ch * Math.sin(rad);
      var bh = g.cw * Math.sin(rad) + g.ch * Math.cos(rad);
      var pad = 1.14;
      var fx = Math.max(0, g.W / 2 - (bw * pad) / 2 - 6);
      var fy = Math.max(0, g.H / 2 - (bh * pad) / 2 - 6);
      return { x: Math.round(p[0] * fx), y: Math.round(p[1] * fy), r: p[2], z: p[3] * 0.8 };
    });
  }

  function tf(x, y, z, r, s) {
    return 'translate3d(calc(-50% + ' + x + 'px), calc(-50% + ' + y + 'px), ' + z + 'px) rotate(' + r + 'deg) scale(' + (s || 1) + ')';
  }

  function setVars(c, t) {
    c.style.setProperty('--x', t.x + 'px');
    c.style.setProperty('--y', t.y + 'px');
    c.style.setProperty('--r0', t.r + 'deg');
    c.style.setProperty('--z0', t.z + 'px');
  }

  function stackPose(i, n) {
    var jitter = [-2.5, 1.5, -1, 2, -1.8, 0.8, -0.4];
    return { x: (i % 2 ? 2 : -2), y: -i * 1.2, r: jitter[i % jitter.length], z: 2 + i * 1.6 };
  }

  function build() {
    var g = geometry();
    stage.style.setProperty('--afs-h', g.H + 'px');
    stage.style.setProperty('--afs-w', g.cw + 'px');
    if (g.key === layoutKey) { if (played) targets(g).forEach(function (t, i) { setVars(cards[i], t); }); return; }
    layoutKey = g.key;
    table.innerHTML = '';
    cards = [];
    var tg = targets(g);
    /* centre card shows the front; neighbours alternate */
    var centre = tg.reduce(function (b, t, i) { return Math.abs(t.x) < Math.abs(tg[b].x) ? i : b; }, 0);
    tg.forEach(function (t, i) {
      var side = Math.abs(i - centre) % 2 ? 1 : 0;
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'afs-card';
      c.setAttribute('aria-label', 'Open the ' + SIDES[side].label.toLowerCase() + ' of the Discover Angaur flyer');
      c.innerHTML = '<img src="' + SIDES[side].small + '" alt="" width="440" height="1019" loading="lazy" decoding="async" draggable="false">';
      c.addEventListener('click', function () { open(side); });
      c.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' && !playing) c.classList.add('is-lift'); });
      c.addEventListener('pointerleave', function () { c.classList.remove('is-lift'); });
      if (played) setVars(c, t); else setVars(c, stackPose(i, tg.length));
      table.appendChild(c);
      cards.push(c);
    });
  }

  function play() {
    if (played) return;
    played = true; playing = true;
    var g = geometry(), tg = targets(g), n = cards.length;
    /* outermost flyers leave the stack first, the centre flyer settles last */
    var order = tg.map(function (t, i) { return i; }).sort(function (a, b) { return Math.abs(tg[b].x) - Math.abs(tg[a].x); });
    var done = 0;
    order.forEach(function (i, k) {
      var c = cards[i], t = tg[i], s = stackPose(i, n);
      var topZ = 30 + (n - k) * 2;
      var a = c.animate([
        { transform: tf(s.x, s.y, s.z, s.r), offset: 0 },
        { transform: tf(s.x + t.x * 0.08, s.y - 18, topZ + 70, s.r + t.r * 0.3, 1.03), offset: 0.22 },
        { transform: tf(t.x * 0.86, t.y * 0.86 - 10, topZ + 34, t.r * 0.92, 1.02), offset: 0.7 },
        { transform: tf(t.x, t.y, t.z, t.r), offset: 1 }
      ], { duration: 1150, delay: 260 + k * 170, easing: 'cubic-bezier(.33,.0,.2,1)', fill: 'both' });
      c.style.zIndex = 0;
      a.onfinish = function () {
        c.style.transition = 'none';
        setVars(c, t);
        a.cancel();
        c.offsetWidth; /* commit */
        c.style.transition = '';
        if (++done === n) playing = false;
      };
    });
  }

  build();
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); play(); } });
  }, { threshold: 0.35 });
  io.observe(stage);

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (!playing) build(); }, 150); });
  if (reduce && reduce.addEventListener) reduce.addEventListener('change', function (e) { if (e.matches) { root.classList.remove('afs-on'); } });
})();
