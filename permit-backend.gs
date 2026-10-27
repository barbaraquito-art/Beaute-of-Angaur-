/**
 * Angaur State — Visitor Permit backend (Google Apps Script)
 *
 * Stores permit applications in this Google Sheet (private to the State office),
 * returns a permit number (status Pending payment) and a private status link to the applicant, and lets
 * authorised staff approve or reject applications from the "Angaur Permits" menu.
 *
 * Only rows marked Approved by staff ever produce a permit card. Submitting an
 * application never approves it.
 *
 * Setup (once):
 *   1. Open the Google Sheet → Extensions → Apps Script, paste this file, Save.
 *   2. Run "setup" once (▶ Run) and accept the permissions.
 *   3. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 *   4. Copy the Web app URL and put it in permit-config.js on the website.
 */

var SHEET_NAME = 'Applications';
var OFFICE_EMAIL = '';            // optional: address that receives a note for every new application
var SITE_URL = 'https://barbaraquito-art.github.io/Beaute-of-Angaur-/';
var HEADERS = ['Submitted', 'Reference', 'Access key', 'Status', 'Permit No.', 'Decision date', 'Decision note',
  'Full name', 'Email', 'Phone', 'Nationality', 'Passport / ID no.', 'Arrival', 'Departure',
  'Number of visitors', 'Purpose of visit', 'Travel method', 'Accommodation', 'Notes'];
var STATUSES = ['Pending payment', 'Approved', 'Rejected'];
// Shown to applicants on their receipt email. Edit to change the office or contact names.
var PAYMENT_NOTE = 'Please visit the Medalaii Office in Koror and see Teresa or Barbara to pay for your permit. Bring your permit number.';

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#123d2a').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build();
  sh.getRange(2, 4, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  sh.hideColumns(3); // access keys stay out of sight
  PropertiesService.getScriptProperties().setProperty('NEXT_PERMIT', PropertiesService.getScriptProperties().getProperty('NEXT_PERMIT') || '1');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Angaur Permits')
    .addItem('Payment received: approve selected', 'approveSelected')
    .addItem('Reject selected application', 'rejectSelected')
    .addItem('Set up sheet', 'setup')
    .addToUi();
}

/* ---------- web app ---------- */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return json_({ ok: false, error: 'Rejected.' });              // honeypot
    var err = validate_(d);
    if (err) return json_({ ok: false, error: err });
    var sh = sheet_();
    var props = PropertiesService.getScriptProperties();
    var n = Number(props.getProperty('NEXT_PERMIT') || '1');
    props.setProperty('NEXT_PERMIT', String(n + 1));
    var permitNo = 'ASG-' + ('00000' + n).slice(-5);   // permit number, given straight away
    var ref = 'APP-' + Utilities.formatDate(new Date(), 'Pacific/Palau', 'yyMMdd') + '-' + randomCode_(5);
    var key = Utilities.getUuid().replace(/-/g, '');
    sh.appendRow([new Date(), ref, key, 'Pending payment', permitNo, '', '',
      clean_(d.fullName, 120), clean_(d.email, 160), clean_(d.phone, 40), clean_(d.nationality, 60), clean_(d.passport, 40),
      d.arrival, d.departure, Number(d.visitors) || 1, clean_(d.purpose, 60), clean_(d.travel, 40), clean_(d.accommodation, 120), clean_(d.notes, 800)]);
    var link = SITE_URL + 'permit-status.html?ref=' + encodeURIComponent(ref) + '&key=' + key;
    try {
      MailApp.sendEmail({
        to: d.email,
        subject: 'Angaur State visitor permit ' + permitNo + ' (pending payment)',
        htmlBody: '<p>Dear ' + esc_(d.fullName) + ',</p><p>Your application for an Angaur State visitor permit has been received.</p>' +
          '<p><b>Permit No.:</b> ' + permitNo + '<br><b>Reference No.:</b> ' + ref + '<br><b>Status:</b> Pending payment<br><b>Dates:</b> ' + d.arrival + ' to ' + d.departure + '</p>' +
          '<p><b>Next step:</b> ' + esc_(PAYMENT_NOTE) + '</p>' +
          '<p>Your permit card will appear here once payment is confirmed: <a href="' + link + '">' + link + '</a></p><p>Angaur State Government</p>'
      });
      if (OFFICE_EMAIL) MailApp.sendEmail(OFFICE_EMAIL, 'New permit application ' + permitNo + ' / ' + ref, d.fullName + ' — ' + d.arrival + ' to ' + d.departure + '\n' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
    } catch (mailErr) { /* the application is saved even if email fails */ }
    return json_({ ok: true, ref: ref, key: key, permitNo: permitNo });
  } catch (x) {
    return json_({ ok: false, error: 'The application could not be saved. Please try again.' });
  } finally {
    try { lock.releaseLock(); } catch (z) {}
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ ok: true });
  var row = find_(p.ref, p.key, p.email);
  if (!row) return json_({ ok: false, error: 'No application matches that reference and key.' });
  var v = row.values, status = (!v[3] || v[3] === 'Pending') ? 'Pending payment' : v[3];
  var out = {
    ok: true, ref: v[1], key: v[2], status: status, name: v[7], arrival: fmt_(v[12]), departure: fmt_(v[13]),
    visitors: v[14], submitted: fmt_(v[0]), permitNo: v[4] || v[1]
  };
  if (status === 'Approved') { out.decided = fmt_(v[5]); }
  if (status === 'Rejected') { out.note = v[6]; out.decided = fmt_(v[5]); }
  return json_(out);
}

/* ---------- staff actions ---------- */

function approveSelected() { decide_('Approved'); }
function rejectSelected() { decide_('Rejected'); }

function decide_(status) {
  var ui = SpreadsheetApp.getUi();
  var sh = sheet_();
  var r = sh.getActiveRange().getRow();
  if (r < 2) { ui.alert('Select a cell in the application row first.'); return; }
  var v = sh.getRange(r, 1, 1, HEADERS.length).getValues()[0];
  if (!v[1]) { ui.alert('That row has no application.'); return; }
  var note = '';
  if (status === 'Rejected') {
    var resp = ui.prompt('Reason shown to the applicant (optional)', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return;
    note = resp.getResponseText();
  } else if (ui.alert('Payment received from ' + v[7] + ' (' + v[1] + ')? This issues their permit card.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var permitNo = v[4];
  if (status === 'Approved' && !permitNo) {
    var props = PropertiesService.getScriptProperties();
    var n = Number(props.getProperty('NEXT_PERMIT') || '1');
    permitNo = 'ASG-' + ('00000' + n).slice(-5);
    props.setProperty('NEXT_PERMIT', String(n + 1));
  }
  sh.getRange(r, 4, 1, 4).setValues([[status, permitNo || '', new Date(), note]]);
  var link = SITE_URL + 'permit-status.html?ref=' + encodeURIComponent(v[1]) + '&key=' + v[2];
  try {
    MailApp.sendEmail({
      to: v[8],
      subject: 'Angaur State visitor permit ' + (status === 'Approved' ? 'approved' : 'update') + ' — ' + v[1],
      htmlBody: status === 'Approved'
        ? '<p>Dear ' + esc_(v[7]) + ',</p><p>Your Angaur State visitor permit has been approved. Permit No. <b>' + permitNo + '</b>.</p><p>View and print your permit card: <a href="' + link + '">' + link + '</a></p><p>Angaur State Government</p>'
        : '<p>Dear ' + esc_(v[7]) + ',</p><p>Your application ' + v[1] + ' was not approved.' + (note ? ' Reason: ' + esc_(note) : '') + '</p><p>Please contact the Angaur State Government office for help.</p>'
    });
  } catch (mailErr) {}
  ui.alert(status === 'Approved' ? 'Approved. Permit No. ' + permitNo + '. The applicant has been emailed their link.' : 'Marked as rejected. The applicant has been emailed.');
}

/* ---------- helpers ---------- */

function sheet_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh) { setup(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME); }
  return sh;
}
function find_(ref, key, email) {
  ref = String(ref || '').trim().toUpperCase();
  email = String(email || '').trim().toLowerCase();
  if (!ref || (!key && !email)) return null;
  var sh = sheet_(), last = sh.getLastRow();
  if (last < 2) return null;
  var vals = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][1] !== ref && String(vals[i][4]).toUpperCase() !== ref) continue;
    if ((key && vals[i][2] === key) || (email && String(vals[i][8]).trim().toLowerCase() === email)) return { row: i + 2, values: vals[i] };
  }
  return null;
}
function validate_(d) {
  var req = ['fullName', 'email', 'phone', 'nationality', 'arrival', 'departure', 'visitors', 'purpose'];
  for (var i = 0; i < req.length; i++) if (!String(d[req[i]] || '').trim()) return 'Please fill in every required field.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return 'Please enter a valid email address.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.arrival) || !/^\d{4}-\d{2}-\d{2}$/.test(d.departure)) return 'Please enter valid dates.';
  if (d.departure < d.arrival) return 'Departure must be on or after arrival.';
  var n = Number(d.visitors); if (!(n >= 1 && n <= 50)) return 'Number of visitors must be between 1 and 50.';
  if (d.consent !== true) return 'Please confirm the declaration.';
  return '';
}
function clean_(s, max) { return String(s || '').replace(/[\u0000-\u001f]/g, ' ').replace(/^[=+\-@]/, "'$&").trim().slice(0, max); }
function esc_(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function fmt_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Pacific/Palau', 'yyyy-MM-dd') : String(v || ''); }
function randomCode_(n) { var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < n; i++) s += c.charAt(Math.floor(Math.random() * c.length)); return s; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
