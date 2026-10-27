(function () {
  'use strict';
  var API = (window.ANGAUR_PERMIT_API || '').trim();
  var RECENT = 'anguar-permit-recent';
  var $ = function (s, r) { return (r || document).querySelector(s); };

  function show(el, on) { if (el) el.hidden = !on; }
  function text(el, t) { if (el) el.textContent = t; }
  function remember(ref, key) {
    try {
      var list = JSON.parse(localStorage.getItem(RECENT) || '[]').filter(function (x) { return x.ref !== ref; });
      list.unshift({ ref: ref, key: key, at: Date.now() });
      localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 5)));
    } catch (e) {}
  }
  function statusUrl(ref, key) { return 'permit-status.html?ref=' + encodeURIComponent(ref) + '&key=' + encodeURIComponent(key); }
  function prettyDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '';
    var p = iso.split('-');
    return p[1] + '/' + p[2] + '/' + p[0];
  }

  /* ================= application form ================= */
  var form = $('#permit-form');
  if (form) {
    var notReady = $('#pf-not-ready'), submitBtn = $('#pf-submit'), formErr = $('#pf-form-error');
    if (!API) { show(notReady, true); submitBtn.disabled = true; }
    var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    var todayIso = today.toISOString().slice(0, 10);
    form.arrival.min = todayIso; form.departure.min = todayIso;
    try {
      var qs = new URLSearchParams(location.search);
      if (qs.get('arrival')) form.arrival.value = qs.get('arrival');
      if (qs.get('departure')) form.departure.value = qs.get('departure');
    } catch (e) {}
    form.arrival.addEventListener('change', function () { form.departure.min = form.arrival.value || todayIso; });

    var rules = {
      fullName: function (v) { return v.trim().length >= 3 ? '' : 'Enter your full name as it appears on your passport.'; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address, for example name@example.com.'; },
      phone: function (v) { return v.replace(/[^\d]/g, '').length >= 6 ? '' : 'Enter a phone number with country code.'; },
      nationality: function (v) { return v.trim() ? '' : 'Enter your nationality.'; },
      arrival: function (v) { return !v ? 'Choose your arrival date.' : (v < todayIso ? 'Arrival cannot be in the past.' : ''); },
      departure: function (v) { return !v ? 'Choose your departure date.' : (form.arrival.value && v < form.arrival.value ? 'Departure must be on or after arrival.' : ''); },
      visitors: function (v) { var n = Number(v); return n >= 1 && n <= 50 && Math.floor(n) === n ? '' : 'Enter a number from 1 to 50.'; },
      purpose: function (v) { return v ? '' : 'Choose the purpose of your visit.'; }
    };
    function check(name) {
      var el = form.elements[name], wrap = el.closest('.pf-field'), msg = rules[name](el.value);
      wrap.classList.toggle('bad', !!msg);
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      text(wrap.querySelector('.pf-err'), msg);
      return !msg;
    }
    Object.keys(rules).forEach(function (n) {
      var el = form.elements[n];
      el.addEventListener('blur', function () { if (el.value) check(n); });
      el.addEventListener('input', function () { if (el.closest('.pf-field').classList.contains('bad')) check(n); });
    });
    var consent = form.elements.consent;
    consent.addEventListener('change', function () { if (consent.checked) show($('#pf-consent-err'), false); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      show(formErr, false);
      var ok = true, first = null;
      Object.keys(rules).forEach(function (n) { if (!check(n)) { ok = false; first = first || form.elements[n]; } });
      if (!consent.checked) { ok = false; show($('#pf-consent-err'), true); first = first || consent; }
      if (!ok) { first.focus(); return; }
      if (!API) { show(notReady, true); return; }
      var data = {
        fullName: form.fullName.value.trim(), email: form.email.value.trim(), phone: form.phone.value.trim(),
        nationality: form.nationality.value.trim(), arrival: form.arrival.value, departure: form.departure.value,
        visitors: Number(form.visitors.value), purpose: form.purpose.value, travel: form.travel.value,
        accommodation: form.accommodation.value.trim(), notes: form.notes.value.trim(), consent: true,
        website: form.website.value
      };
      submitBtn.disabled = true; text(submitBtn, 'Sending…');
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.error) || 'The application could not be saved.');
          remember(res.ref, res.key);
          location.href = statusUrl(res.ref, res.key) + '&new=1';
        })
        .catch(function (err) {
          text(formErr, (err && err.message && !/Failed to fetch|NetworkError|Load failed/.test(err.message) ? err.message : 'We could not reach the permit office. Check your connection and try again.'));
          show(formErr, true); formErr.focus();
          submitBtn.disabled = false; text(submitBtn, 'Submit application');
        });
    });
  }

  /* ================= status, receipt and permit card ================= */
  var statusRoot = $('#permit-status');
  if (statusRoot) {
    var qs2 = new URLSearchParams(location.search);
    var ref = (qs2.get('ref') || '').trim(), key = (qs2.get('key') || '').trim();
    var lookup = $('#ps-lookup'), loading = $('#ps-loading'), errBox = $('#ps-error');
    var receipt = $('#ps-receipt'), cardWrap = $('#ps-card'), rejected = $('#ps-rejected'), notReady2 = $('#ps-not-ready');

    function load(params) {
      if (!API) { show(notReady2, true); show(lookup, false); return; }
      show(loading, true); show(errBox, false); show(lookup, false);
      [receipt, cardWrap, rejected].forEach(function (x) { show(x, false); });
      fetch(API + (API.indexOf('?') >= 0 ? '&' : '?') + params, { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          show(loading, false);
          if (!d || !d.ok) throw new Error((d && d.error) || 'No application found.');
          if (d.key) { remember(d.ref, d.key); history.replaceState(null, '', statusUrl(d.ref, d.key)); }
          render(d);
        })
        .catch(function (err) {
          show(loading, false); show(lookup, true);
          text(errBox, err && err.message && !/Failed to fetch|NetworkError|Load failed/.test(err.message) ? err.message : 'We could not reach the permit office. Please try again.');
          show(errBox, true);
        });
    }
    function fill(scope, d) {
      scope.querySelectorAll('[data-f]').forEach(function (el) {
        var k = el.getAttribute('data-f'), v = d[k];
        if (k === 'arrival' || k === 'departure' || k === 'submitted' || k === 'decided') v = prettyDate(v);
        el.textContent = v == null || v === '' ? '—' : v;
      });
    }
    function render(d) {
      if (d.status === 'Approved' && d.permitNo) {
        fill(cardWrap, d); show(cardWrap, true); document.body.classList.add('print-card');
        var qr = $('#pc-qr');
        if (qr && window.QRCode) {
          qr.innerHTML = '';
          new window.QRCode(qr, { text: location.href.split('&new=')[0], width: 256, height: 256, correctLevel: window.QRCode.CorrectLevel.M });
        }
        document.title = 'Visitor Permit ' + d.permitNo + ' — Angaur State';
      } else if (d.status === 'Rejected') {
        fill(rejected, d); show(rejected, true);
      } else {
        fill(receipt, d); show(receipt, true);
        show($('#ps-new'), qs2.get('new') === '1');
      }
    }

    var lf = $('#ps-lookup-form');
    if (lf) lf.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = lf.ref.value.trim().toUpperCase(), em = lf.email.value.trim();
      var bad = !r || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
      show($('#ps-lookup-err'), bad);
      if (!bad) load('ref=' + encodeURIComponent(r) + '&email=' + encodeURIComponent(em));
    });
    document.querySelectorAll('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
    var recentBox = $('#ps-recent');
    try {
      var recent = JSON.parse(localStorage.getItem(RECENT) || '[]');
      if (recentBox && recent.length && !ref) {
        recentBox.innerHTML = '';
        recent.forEach(function (x) {
          var a = document.createElement('a'); a.href = statusUrl(x.ref, x.key); a.textContent = x.ref; a.className = 'pf-btn ghost';
          recentBox.appendChild(a);
        });
        show(recentBox.parentElement, true);
      }
    } catch (e) {}

    if (ref && key) load('ref=' + encodeURIComponent(ref) + '&key=' + encodeURIComponent(key));
    else { show(lookup, true); if (!API) show(notReady2, true); }
  }
})();
