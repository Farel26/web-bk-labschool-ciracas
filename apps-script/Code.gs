/**
 * Apps Script untuk Web BK SMP Labschool Ciracas.
 * Pasang di Google Sheet "Data Web BK Labschool Ciracas":
 *   Ekstensi > Apps Script > tempel file ini > Simpan
 *   Terapkan > Deployment baru > Jenis: Aplikasi web
 *     Jalankan sebagai: Saya
 *     Yang memiliki akses: Siapa saja
 * Salin URL yang berakhiran /exec ke assets/js/config.js (SCRIPT_URL).
 */

// Kolom yang ditulis untuk setiap formulir, urut sesuai header di sheet.
var FORMS = {
  Konseling:     ['nama', 'kelas', 'topik', 'waktu', 'cerita'],
  Curhat:        ['jenjang', 'topik', 'isi', 'ingin_dihubungi', 'kontak'],
  JanjiOrangTua: ['nama_ortu', 'nama_siswa', 'kelas', 'wa', 'keperluan', 'waktu']
};
var MAX_LEN = 3000;   // batas panjang isian per kolom
var TZ = 'Asia/Jakarta';

function doPost(e) {
  var p = (e && e.parameter) || {};
  // Bot sering mengisi kolom tersembunyi "website".
  if (p.website) return json_({ ok: true });

  var cols = FORMS[p.form];
  if (!cols) return json_({ ok: false, error: 'Formulir tidak dikenal' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(p.form);
    var row = [Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm')];
    cols.forEach(function (c) { row.push(clean_(p[c])); });
    row.push('Baru'); // kolom Status
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  notify_(p.form);
  return json_({ ok: true });
}

// Dipakai web untuk mengambil agenda & pengumuman: ?action=data
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');

  var agenda = ss.getSheetByName('Agenda').getDataRange().getValues().slice(1)
    .filter(function (r) { return r[0] && String(r[4]).trim().toUpperCase() === 'YA'; })
    .map(function (r) {
      return { mulai: ymd_(r[0]), selesai: r[1] ? ymd_(r[1]) : '', judul: String(r[2]), keterangan: String(r[3] || '') };
    })
    .filter(function (a) { return (a.selesai || a.mulai) >= today; })
    .sort(function (a, b) { return a.mulai < b.mulai ? -1 : 1; })
    .slice(0, 4);

  var info = ss.getSheetByName('Pengumuman').getDataRange().getValues().slice(1)
    .filter(function (r) { return r[0] && String(r[2]).trim().toUpperCase() === 'YA'; })[0];

  return json_({
    agenda: agenda,
    pengumuman: info ? { teks: String(info[0]), link: String(info[1] || '') } : null
  });
}

// Kirim email singkat ke pemilik sheet setiap ada isian baru (tanpa isi curhat).
function notify_(form) {
  try {
    var to = Session.getEffectiveUser().getEmail();
    var url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
    MailApp.sendEmail(to, '[Web BK] Isian baru: ' + form,
      'Ada isian baru di tab "' + form + '".\nBuka sheet: ' + url);
  } catch (err) { /* email opsional */ }
}

function clean_(v) {
  v = String(v == null ? '' : v).trim().slice(0, MAX_LEN);
  // Cegah isian dibaca sebagai rumus oleh Sheets.
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function ymd_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v).trim();
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
