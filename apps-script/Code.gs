/**
 * Apps Script untuk Web BK SMP Labschool Ciracas.
 * Pasang di Google Sheet "Data Web BK Labschool Ciracas":
 *   Ekstensi > Apps Script > tempel file ini > Simpan
 *   Pertama kali : Terapkan > Deployment baru > Aplikasi web
 *                  (Jalankan sebagai: Saya, Yang memiliki akses: Siapa saja)
 *   Setelah update: Terapkan > Kelola deployment > edit (pensil)
 *                  > Versi: Versi baru > Terapkan   (URL tetap sama)
 *
 * Kalender pendidikan (kaldik) disalin otomatis dari file kaldik sekolah
 * ke tab "Kaldik" setiap jam. Sekali saja: jalankan fungsi pasangPemicuKaldik
 * dari editor (Run) dan izinkan aksesnya. Butuh layanan lanjutan Drive API
 * (Services > + > Drive API).
 */

var TZ = 'Asia/Jakarta';
var MAX_LEN = 3000;
var KALDIK_FILE_ID = '1SRkVqbJFPiJTBWi4tItt7LEzRKZ28c4-';   // Kalender Pendidikan SMP Labscira (PUBLIC).xlsx
var KALDIK_TAB = 'Kaldik';

// Untuk setiap formulir: judul kolom di sheet -> nama isian dari web.
// Kolom yang tidak disebut di sini dibiarkan kosong (untuk diisi guru BK).
var FORMS = {
  Konseling: {
    'Nama': 'nama', 'Kelas': 'kelas', 'Topik': 'topik',
    'Waktu yang diinginkan': 'waktu', 'Cerita singkat': 'cerita'
  },
  Curhat: {
    'Kode': 'kode', 'Jenjang kelas (opsional)': 'jenjang', 'Topik': 'topik',
    'Isi curhat': 'isi', 'Ingin dihubungi guru BK?': 'ingin_dihubungi',
    'Nama/kontak (jika ingin dihubungi)': 'kontak'
  },
  LaporanPerundungan: {
    'Kode': 'kode', 'Pelapor sebagai': 'pelapor', 'Kelas pelapor (opsional)': 'kelas',
    'Jenis perundungan': 'jenis', 'Apa yang terjadi': 'kejadian', 'Tempat': 'tempat',
    'Kapan terjadi': 'kapan', 'Siapa yang terlibat': 'terlibat',
    'Masih berlangsung?': 'berlangsung', 'Nama/kontak pelapor (opsional)': 'kontak'
  },
  JanjiOrangTua: {
    'Nama orang tua/wali': 'nama_ortu', 'Nama siswa': 'nama_siswa', 'Kelas': 'kelas',
    'Nomor WhatsApp': 'wa', 'Keperluan': 'keperluan', 'Waktu yang diinginkan': 'waktu'
  },
  Survei: {
    'Kelas (opsional)': 'kelas', 'Layanan yang diterima': 'layanan',
    'Seberapa terbantu (1-5)': 'terbantu', 'Seberapa nyaman (1-5)': 'nyaman',
    'Mau datang lagi?': 'kembali', 'Saran': 'saran'
  }
};

// Tab yang bisa dicek balasannya lewat kode: kolom balasan yang boleh tampil di web.
var CEK = {
  Curhat: 'Balasan untuk siswa (tampil di web)',
  LaporanPerundungan: 'Balasan untuk pelapor (tampil di web)'
};

/* ---------------- Terima isian formulir ---------------- */
function doPost(e) {
  var p = (e && e.parameter) || {};
  if (p.website) return json_({ ok: true });          // jebakan bot
  var map = FORMS[p.form];
  if (!map) return json_({ ok: false, error: 'Formulir tidak dikenal' });

  if (map['Kode'] && !/^BK-[A-Z0-9]{6}$/.test(p.kode || '')) p.kode = newCode_();

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(p.form);
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var row = headers.map(function (h) {
      h = String(h).trim();
      if (h === 'Waktu masuk') return new Date();
      if (h === 'Status') return 'Baru';
      if (map[h]) {
        var v = clean_(p[map[h]]);
        return /\(1-5\)$/.test(h) && v !== '' ? Number(v) : v;
      }
      return '';
    });
    sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  notify_(p.form, p);
  return json_({ ok: true, kode: p.kode || '' });
}

/* ---------------- Data untuk web ----------------
 *  ?action=data              -> agenda & pengumuman
 *  ?action=cek&kode=BK-XXXXXX -> status & balasan curhat/laporan
 *  ?action=kaldik             -> kalender pendidikan per bulan
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'cek') return json_(cek_(String(p.kode || '').trim().toUpperCase()));
  if (p.action === 'kaldik') return json_(kaldik_());
  return json_(data_());
}

function data_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');

  var bk = ss.getSheetByName('Agenda').getDataRange().getValues().slice(1)
    .filter(function (r) { return r[0] && String(r[4]).trim().toUpperCase() === 'YA'; })
    .map(function (r) {
      return { mulai: ymd_(r[0]), selesai: r[1] ? ymd_(r[1]) : ymd_(r[0]), judul: String(r[2]), keterangan: String(r[3] || '') };
    });
  var sekolah = kaldikRows_()
    .filter(function (k) { return k.jenis === 'Kegiatan' && k.mulai; })
    .map(function (k) { return { mulai: k.mulai, selesai: k.selesai || k.mulai, judul: k.judul.replace(/^Perkiraan\s+/i, ''), keterangan: /^Perkiraan/i.test(k.judul) ? 'Perkiraan' : '' }; });
  var agenda = bk.concat(sekolah)
    .filter(function (a) { return (a.selesai || a.mulai) >= today; })
    .sort(function (a, b) { return a.mulai < b.mulai ? -1 : 1; });
  var seen = {};
  agenda = agenda.filter(function (a) { var k = a.judul.toLowerCase(); if (seen[k]) return false; seen[k] = true; return true; }).slice(0, 4);

  var info = ss.getSheetByName('Pengumuman').getDataRange().getValues().slice(1)
    .filter(function (r) { return r[0] && String(r[2]).trim().toUpperCase() === 'YA'; })[0];

  return { agenda: agenda, pengumuman: info ? { teks: String(info[0]), link: String(info[1] || '') } : null };
}

function cek_(kode) {
  if (!/^BK-[A-Z0-9]{6}$/.test(kode)) return { found: false };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var tab in CEK) {
    var v = ss.getSheetByName(tab).getDataRange().getValues();
    var h = v[0].map(function (x) { return String(x).trim(); });
    var iKode = h.indexOf('Kode'), iStatus = h.indexOf('Status'), iBalas = h.indexOf(CEK[tab]), iWaktu = h.indexOf('Waktu masuk');
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][iKode]).trim().toUpperCase() === kode) {
        return {
          found: true,
          jenis: tab === 'Curhat' ? 'Curhat' : 'Laporan perundungan',
          dikirim: v[r][iWaktu] instanceof Date ? Utilities.formatDate(v[r][iWaktu], TZ, 'd MMM yyyy') : String(v[r][iWaktu]),
          status: String(v[r][iStatus] || 'Baru'),
          balasan: String(v[r][iBalas] || '')
        };
      }
    }
  }
  return { found: false };
}


/* ---------------- Kalender pendidikan ---------------- */
// Salin kaldik dari file xlsx sekolah ke tab "Kaldik". Dipanggil pemicu tiap jam.
function syncKaldik() {
  var file = DriveApp.getFileById(KALDIK_FILE_ID);
  var props = PropertiesService.getScriptProperties();
  var stamp = String(file.getLastUpdated().getTime());
  if (props.getProperty('KALDIK_STAMP') === stamp) return 'tidak berubah';

  var tmp = Drive.Files.create({ name: 'tmp-kaldik-web-bk', mimeType: 'application/vnd.google-apps.spreadsheet' }, file.getBlob());
  try {
    var src = SpreadsheetApp.openById(tmp.id);
    var sh = src.getSheetByName('Public') || src.getSheets()[0];
    var months = parseKaldik_(sh.getDataRange().getValues());
    var rows = [];
    months.forEach(function (b) {
      b.kegiatan.forEach(function (k) { rows.push([b.bulan, b.key, b.hbe, b.mingguEfektif, 'Kegiatan', k.tgl, k.judul, k.mulai, k.selesai]); });
      b.libur.forEach(function (k) { rows.push([b.bulan, b.key, b.hbe, b.mingguEfektif, 'Libur', k.tgl, k.nama, k.mulai, k.selesai]); });
      if (!b.kegiatan.length && !b.libur.length) rows.push([b.bulan, b.key, b.hbe, b.mingguEfektif, '', '', '', '', '']);
    });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var out = ss.getSheetByName(KALDIK_TAB) || ss.insertSheet(KALDIK_TAB);
    out.clearContents();
    out.getRange(1, 1, 1, 9).setValues([['Bulan', 'Kunci', 'HBE', 'Minggu efektif', 'Jenis', 'Tanggal', 'Kegiatan', 'Mulai', 'Selesai']]);
    if (rows.length) out.getRange(2, 1, rows.length, 9).setNumberFormat('@').setValues(rows.map(function (r) { return r.map(String); }));
    props.setProperty('KALDIK_STAMP', stamp);
    props.setProperty('KALDIK_SYNC', Utilities.formatDate(new Date(), TZ, 'd MMM yyyy HH:mm'));
    return rows.length + ' baris';
  } finally {
    DriveApp.getFileById(tmp.id).setTrashed(true);
  }
}

// Jalankan SEKALI dari editor: memasang pemicu tiap jam lalu menyalin kaldik pertama kali.
function pasangPemicuKaldik() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'syncKaldik') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('syncKaldik').timeBased().everyHours(1).create();
  PropertiesService.getScriptProperties().deleteProperty('KALDIK_STAMP');
  return syncKaldik();
}

function kaldikRows_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(KALDIK_TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 9).getDisplayValues().map(function (r) {
    return { bulan: r[0], key: Number(r[1]), hbe: r[2], mingguEfektif: r[3], jenis: r[4], tgl: r[5], judul: r[6], mulai: r[7], selesai: r[8] };
  });
}

function kaldik_() {
  var map = {}, list = [];
  kaldikRows_().forEach(function (r) {
    var b = map[r.key];
    if (!b) { b = map[r.key] = { bulan: r.bulan, key: r.key, hbe: r.hbe, mingguEfektif: r.mingguEfektif, kegiatan: [], libur: [] }; list.push(b); }
    if (r.jenis === 'Kegiatan') b.kegiatan.push({ tgl: r.tgl, judul: r.judul, mulai: r.mulai, selesai: r.selesai });
    if (r.jenis === 'Libur') b.libur.push({ tgl: r.tgl, nama: r.judul, mulai: r.mulai, selesai: r.selesai });
  });
  list.sort(function (a, b) { return a.key - b.key; });
  return {
    bulan: list,
    diperbarui: PropertiesService.getScriptProperties().getProperty('KALDIK_SYNC') || '',
    sumber: 'https://docs.google.com/spreadsheets/d/' + KALDIK_FILE_ID + '/edit'
  };
}

/* ---------------- Parser kalender pendidikan ---------------- */
var BULAN_ID = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
var BULAN_SINGKAT = ['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];
var HARI = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];

function isDate_(v) { return Object.prototype.toString.call(v) === '[object Date]'; }

// Sel tanggal bisa berupa angka, teks ("14-18", "28 - 1 Okt") atau tanggal
// yang salah terbaca Excel ("10-11" menjadi 10 Nov). Ubah semuanya ke teks.
function tglText_(v) {
  if (isDate_(v)) return v.getDate() + ' - ' + (v.getMonth() + 1);
  if (typeof v === 'number') return String(Math.round(v));
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}
function txt_(v) { return String(v == null ? '' : v).replace(/\s*\n\s*-?\s*/g, '; ').replace(/^[-;\s]+/, '').replace(/\s+/g, ' ').trim(); }

// Hitung tanggal mulai & selesai (yyyy-mm-dd) dari teks tanggal dalam bulan tertentu.
// Contoh: "14-18", "28 - 1 Okt", "28 Sep - 2 Okt", "26 - 9 Juli".
function bulanDari_(s) {
  s = (s || '').toLowerCase();
  for (var i = 0; i < 12; i++) if (s.indexOf(BULAN_SINGKAT[i]) === 0) return i;
  return -1;
}
function rentang_(t, year, month) {
  if (/pekan/i.test(t)) return null;
  var m = t.match(/^(\d{1,2})\s*([A-Za-z]+)?\s*(?:[-\u2013]\s*(\d{1,2})\s*([A-Za-z]+)?)?/);
  if (!m) return null;
  var d1 = Number(m[1]), d2 = m[3] ? Number(m[3]) : d1;
  if (d1 < 1 || d1 > 31 || d2 < 1 || d2 > 31) return null;
  var m1 = bulanDari_(m[2]), m2 = bulanDari_(m[4]);
  if (m1 < 0) m1 = month;
  if (m2 < 0) m2 = m[3] ? (d2 < d1 && m1 === month ? month + 1 : m1) : m1;
  function fix(mi) {
    var y = year;
    if (mi > 11) { mi -= 12; y++; }
    else if (mi - month > 6) y--;
    else if (month - mi > 6) y++;
    return [y, mi];
  }
  function f(a, d) { return a[0] + '-' + ('0' + (a[1] + 1)).slice(-2) + '-' + ('0' + d).slice(-2); }
  return { mulai: f(fix(m1), d1), selesai: f(fix(m2), d2) };
}

function parseKaldik_(g) {
  var months = [];
  [1, 11].forEach(function (o) {
    for (var r = 0; r < g.length; r++) {
      var head = txt_(g[r][o]).toUpperCase();
      var mm = head.match(/^([A-Z]+)\s+(\d{4})$/);
      if (!mm || BULAN_ID.indexOf(mm[1]) < 0 || txt_(g[r][o + 7]).toUpperCase() !== 'TANGGAL') continue;
      var month = BULAN_ID.indexOf(mm[1]), year = Number(mm[2]);
      var prev = g[r - 1] || [];
      var b = { bulan: mm[1].charAt(0) + mm[1].slice(1).toLowerCase() + ' ' + year, key: year * 100 + month + 1,
                hbe: txt_(prev[o]).replace(/^HBE:\s*/i, ''), mingguEfektif: txt_(prev[o + 8]).replace(/^Minggu Efektif:\s*/i, ''),
                kegiatan: [], libur: [] };
      for (var k = r + 1; k < g.length; k++) {
        var row = g[k] || [];
        if (/^HBE:/i.test(txt_(row[o])) || (k > r + 1 && /^[A-Z]+\s+\d{4}$/.test(txt_(row[o]).toUpperCase()) && BULAN_ID.indexOf(txt_(row[o]).toUpperCase().split(/\s+/)[0]) >= 0)) break;
        var t = tglText_(row[o + 7]), keg = txt_(row[o + 8]);
        if (keg && t.toUpperCase() !== 'TANGGAL' && keg.toUpperCase() !== 'KEGIATAN') {
          var rg = rentang_(t, year, month);
          b.kegiatan.push({ tgl: t, judul: keg, mulai: rg ? rg.mulai : '', selesai: rg ? rg.selesai : '' });
        }
        var a = row[o], nm = row[o + 1];
        if ((typeof a === 'number' || isDate_(a) || /^\d/.test(txt_(a))) && typeof nm === 'string' && nm.trim().length > 3 &&
            HARI.indexOf(nm.trim().toLowerCase()) < 0) {
          var tl = tglText_(a), rl = rentang_(tl, year, month);
          b.libur.push({ tgl: tl, nama: txt_(nm), mulai: rl ? rl.mulai : '', selesai: rl ? rl.selesai : '' });
        }
      }
      b.kegiatan.sort(function (x, y) { return (x.mulai || '9') < (y.mulai || '9') ? -1 : 1; });
      b.libur.sort(function (x, y) { return (x.mulai || '9') < (y.mulai || '9') ? -1 : 1; });
      months.push(b);
    }
  });
  months.sort(function (x, y) { return x.key - y.key; });
  return months;
}

/* ---------------- Email pemberitahuan ---------------- */
function notify_(form, p) {
  try {
    var to = Session.getEffectiveUser().getEmail();
    var url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
    if (form === 'LaporanPerundungan') {
      MailApp.sendEmail(to,
        '[PENTING] Laporan perundungan baru ' + (p.kode || ''),
        'Ada laporan perundungan baru di web BK.\n\n' +
        'Pelapor sebagai : ' + (p.pelapor || '-') + '\n' +
        'Jenis           : ' + (p.jenis || '-') + '\n' +
        'Masih berlangsung: ' + (p.berlangsung || '-') + '\n\n' +
        'Detail lengkap ada di tab "LaporanPerundungan". Mohon ditindaklanjuti hari ini sesuai SOP TPPK.\n' + url);
    } else if (form !== 'Survei') {
      MailApp.sendEmail(to, '[Web BK] Isian baru: ' + form,
        'Ada isian baru di tab "' + form + '".\nBuka sheet: ' + url);
    }
  } catch (err) { /* email opsional */ }
}

/* ---------------- Bantuan ---------------- */
function newCode_() {
  var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = 'BK-';
  for (var i = 0; i < 6; i++) s += abc.charAt(Math.floor(Math.random() * abc.length));
  return s;
}

function clean_(v) {
  v = String(v == null ? '' : v).trim().slice(0, MAX_LEN);
  return /^[=+\-@]/.test(v) ? "'" + v : v;   // cegah isian dibaca sebagai rumus
}

function ymd_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v).trim();
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
