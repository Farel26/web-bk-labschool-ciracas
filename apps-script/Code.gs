/**
 * Apps Script untuk Web BK SMP Labschool Ciracas.
 * Pasang di Google Sheet "Data Web BK Labschool Ciracas":
 *   Ekstensi > Apps Script > tempel file ini > Simpan
 *   Pertama kali : Terapkan > Deployment baru > Aplikasi web
 *                  (Jalankan sebagai: Saya, Yang memiliki akses: Siapa saja)
 *   Setelah update: Terapkan > Kelola deployment > edit (pensil)
 *                  > Versi: Versi baru > Terapkan   (URL tetap sama)
 */

var TZ = 'Asia/Jakarta';
var MAX_LEN = 3000;

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
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'cek') return json_(cek_(String(p.kode || '').trim().toUpperCase()));
  return json_(data_());
}

function data_() {
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
