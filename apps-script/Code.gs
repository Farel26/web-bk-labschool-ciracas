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
    'Kode': 'kode', 'Nama': 'nama', 'Kelas': 'kelas', 'Topik': 'topik',
    'Waktu yang diinginkan': 'waktu', 'Cerita singkat': 'cerita',
    'Harapan dari sesi': 'harapan', 'Sudah cerita ke': 'sudahCerita', 'Seberapa mengganggu (1-5)': 'ganggu',
    'Persetujuan asas konseling': 'setuju'
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
  LaporanPerundungan: 'Balasan untuk pelapor (tampil di web)',
  Konseling: 'Pesan untuk siswa (tampil di web)'
};
var CEK_JENIS = { Curhat: 'Curhat', LaporanPerundungan: 'Laporan perundungan', Konseling: 'Pengajuan konseling' };

/* ---------------- Tab & kolom untuk fitur portal ----------------
 * Tab baru dibuat otomatis, dan kolom yang belum ada ditambahkan di ujung kanan,
 * saat web pertama kali dipanggil setelah Code.gs diperbarui. Data lama tidak diubah.
 * Kolom pertama setiap tab penting: "Waktu masuk" untuk kotak masuk, "ID" untuk catatan bernomor.
 */
var SKEMA_VERSI = '2026-11-08-portal-3';
var RUJUKAN_TAB = 'RujukanWaliKelas';
var AKUN_WALI_TAB = 'AkunWaliKelas';
var AKUN_SISWA_TAB = 'AkunSiswa';
var TARGET_TAB = 'TargetSiswa';
var JURNAL_TAB = 'JurnalHarian';
var SKEMA = {
  Konseling: ['Kode', 'Akun siswa', 'Jadwal sesi', 'Jam sesi', 'Tempat sesi', 'Pesan untuk siswa (tampil di web)',
    'Harapan dari sesi', 'Sudah cerita ke', 'Seberapa mengganggu (1-5)', 'Persetujuan asas konseling', 'Bentuk sesi', 'Tautan sesi daring', 'Ditugaskan ke'],
  RujukanWaliKelas: ['Waktu masuk', 'Kode', 'Nama wali kelas', 'Akun wali kelas', 'Nama siswa', 'Kelas', 'Alasan rujukan',
    'Tingkat urgensi', 'Yang diamati', 'Upaya wali kelas', 'Sudah dibicarakan dengan orang tua?', 'Status',
    'Jadwal sesi', 'Jam sesi', 'Tempat sesi', 'Tanggapan untuk wali kelas (tampil di portal)', 'Catatan internal guru BK', 'Ditangani oleh',
    'Bentuk sesi', 'Ditugaskan ke'],
  AkunWaliKelas: ['Email', 'Nama', 'Kelas perwalian', 'Salt', 'Hash password', 'Aktif', 'Terakhir masuk', 'Dibuat oleh', 'Waktu dibuat'],
  AkunSiswa: ['ID', 'Nama', 'Kelas', 'Email', 'Salt', 'Hash PIN', 'Aktif', 'Waktu aktivasi', 'Terakhir masuk'],
  TargetSiswa: ['ID', 'Waktu input', 'Akun siswa', 'Nama', 'Kelas', 'Target', 'Bidang', 'Tenggat', 'Selesai', 'Waktu selesai'],
  JurnalHarian: ['ID', 'Waktu input', 'Tanggal', 'Jam', 'Jenis kegiatan', 'Sasaran', 'Uraian kegiatan', 'Hasil', 'Tindak lanjut', 'Diinput oleh'],
  CatatanPerkembangan: ['Sesi ke', 'Pendekatan/teknik', 'Pemahaman baru siswa', 'Perasaan siswa', 'Rencana tindakan siswa',
    'Pikiran otomatis', 'Pikiran alternatif', 'Skala kemajuan (1-5)'],
  CheckinEmosi: ['ID', 'Waktu input', 'Tanggal', 'Akun siswa', 'Nama', 'Kelas', 'Skor (1-5)', 'Perasaan', 'Catatan siswa',
    'Ingin ngobrol', 'Ditindaklanjuti oleh', 'Waktu tindak lanjut'],
  FormulirSiswa: ['ID', 'Waktu input', 'Judul', 'Keterangan', 'Link', 'Sasaran', 'Tenggat', 'Aktif', 'Dibuat oleh'],
  FormulirTerisi: ['ID formulir', 'Akun siswa', 'Nama', 'Kelas', 'Waktu'],
  HasilPsikotes: ['ID', 'Waktu input', 'Akun siswa', 'Nama siswa', 'Kelas', 'Jenis tes', 'Tanggal tes', 'Catatan untuk siswa',
    'Tampil untuk siswa', 'Nama file asli', 'Ukuran (KB)', 'Link file (khusus pengelola)', 'File ID (jangan diubah)', 'Diunggah oleh'],
  PesanChat: ['ID', 'Waktu', 'Akun siswa', 'Nama', 'Kelas', 'Dari', 'Nama pengirim', 'Isi', 'Dibaca']
};
var CHECKIN_TAB = 'CheckinEmosi', FORM_TAB = 'FormulirSiswa', FORM_ISI_TAB = 'FormulirTerisi', HASIL_TAB = 'HasilPsikotes', CHAT_TAB = 'PesanChat';

function pastikanSkema_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SKEMA_VERSI') === SKEMA_VERSI) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (props.getProperty('SKEMA_VERSI') === SKEMA_VERSI) return;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.keys(SKEMA).forEach(function (tab) {
      var sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
      var n = sh.getLastColumn();
      var ada = n ? sh.getRange(1, 1, 1, n).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
      var kurang = SKEMA[tab].filter(function (h) { return ada.indexOf(h) < 0; });
      if (kurang.length) sh.getRange(1, n + 1, 1, kurang.length).setValues([kurang]).setFontWeight('bold');
      if (!n) sh.setFrozenRows(1);
    });
    props.setProperty('SKEMA_VERSI', SKEMA_VERSI);
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Terima isian formulir ---------------- */
function doPost(e) {
  pastikanSkema_();
  // Permintaan dari dashboard guru BK, portal wali kelas, dan portal siswa dikirim sebagai JSON.
  // Ketiganya memakai sesi yang terpisah: token wali kelas/siswa tidak bisa membuka data guru BK.
  var raw = e && e.postData && e.postData.contents;
  if (raw && raw.charAt(0) === '{') {
    try {
      var q = JSON.parse(raw);
      if (q.peran === 'wali') return json_(waliApi_(q));
      if (q.peran === 'siswa') return json_(siswaApi_(q));
      return json_(guruApi_(q));
    }
    catch (err) { return json_({ ok: false, error: 'Permintaan tidak valid.' }); }
  }
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
  pastikanSkema_();
  var p = (e && e.parameter) || {};
  if (p.action === 'cek') return json_(cek_(String(p.kode || '').trim().toUpperCase()));
  if (p.action === 'kaldik') return json_(kaldik_());
  if (p.action === 'hasilMinat') return json_(riasecHasil_(String(p.kode || '').trim().toUpperCase()));
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
    var sh = ss.getSheetByName(tab);
    if (!sh) continue;
    var v = sh.getDataRange().getValues();
    var h = v[0].map(function (x) { return String(x).trim(); });
    var iKode = h.indexOf('Kode'), iStatus = h.indexOf('Status'), iBalas = h.indexOf(CEK[tab]), iWaktu = h.indexOf('Waktu masuk');
    if (iKode < 0) continue;
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][iKode]).trim().toUpperCase() === kode) {
        var out = {
          found: true,
          jenis: CEK_JENIS[tab],
          dikirim: v[r][iWaktu] instanceof Date ? Utilities.formatDate(v[r][iWaktu], TZ, 'd MMM yyyy') : String(v[r][iWaktu]),
          status: String(v[r][iStatus] || 'Baru'),
          balasan: iBalas >= 0 ? String(v[r][iBalas] || '') : ''
        };
        if (tab === 'Konseling') {
          var ambil = function (k) { var i = h.indexOf(k); return i < 0 ? '' : v[r][i]; };
          out.topik = String(ambil('Topik') || '');
          out.jadwal = { tanggal: tglKey_(ambil('Jadwal sesi')), jam: teks_(ambil('Jam sesi')), tempat: teks_(ambil('Tempat sesi')),
            bentuk: teks_(ambil('Bentuk sesi')) || 'Tatap muka', tautan: out.status === 'Dijadwalkan' ? teks_(ambil('Tautan sesi daring')) : '' };
        }
        return out;
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


/* ================= Dashboard guru BK (login) ================= */
// Akun ada di tab "AkunGuruBK": Username | Nama | Salt | Hash password | Aktif | Terakhir masuk.
// Password tidak pernah disimpan apa adanya, hanya hash-nya.
var AKUN_TAB = 'AkunGuruBK';
var CATATAN_TAB = 'CatatanPerkembangan';
var RIASEC_TAB = 'TesMinatKarier';         // tes minat karier RIASEC dari halaman tes-minat.html
var RIASEC_KUNCI = 'RIASECRACEISSRCEAIESIRACCIASERARISCERCISAE';
var RIASEC_URUT = ['R', 'I', 'A', 'S', 'E', 'C'];
var RIASEC_NAMA = { R: 'Realistis', I: 'Investigatif', A: 'Artistik', S: 'Sosial', E: 'Wirausaha', C: 'Konvensional' };   // catatan perkembangan kasus (dipakai juga di profil siswa)
var SESI_DETIK = 6 * 60 * 60;          // sesi login berlaku 6 jam
var MAKS_GAGAL = 5;                    // 5x salah password -> dikunci 15 menit
var KUNCI_DETIK = 15 * 60;

var KEJADIAN_KATEGORI = ['Pelanggaran ringan', 'Pelanggaran sedang', 'Pelanggaran berat', 'Konflik antarsiswa', 'Perundungan', 'Masalah pribadi/emosi', 'Masalah belajar', 'Lainnya'];

function guruApi_(q) {
  if (q.action === 'login') return login_(String(q.username || ''), String(q.password || ''));
  if (q.action === 'simpanRiasec') return riasecSimpan_(q.data || {});   // tes minat karier: publik, tanpa login
  var u = sesi_(q.token);
  if (!u) return { ok: false, auth: false, error: 'Sesi berakhir. Silakan masuk lagi.' };
  switch (q.action) {
    case 'logout': CacheService.getScriptCache().remove('tok_' + q.token); return { ok: true };
    case 'cekSesi': return { ok: true, nama: u.nama, username: u.username, kategori: KEJADIAN_KATEGORI };
    case 'simpanKejadian': return simpanKejadian_(u, q.data || {});
    case 'simpanPerjanjian': return simpanPerjanjian_(u, q.data || {});
    case 'simpanSurat': return simpanSurat_(u, q.data || {});
    case 'daftar': return daftar_(String(q.jenis || ''));
    case 'gantiPassword': return gantiPassword_(u, String(q.lama || ''), String(q.baru || ''));
    case 'profil': return profil_(String(q.nama || ''));
    case 'namaSiswa': return namaSiswa_();
    case 'inbox': return inbox_(String(q.jenis || ''), q.semua === true);
    case 'perbarui': return perbarui_(u, String(q.jenis || ''), String(q.ref || ''), q.data || {});
    case 'statistik': return statistik_(String(q.dari || ''), String(q.sampai || ''));
    case 'infoBackup': return infoBackup_();
    case 'unggahScan': return unggahScan_(u, q.data || {});
    case 'cariNomor': return cariNomor_(String(q.nomor || ''));
    case 'daftarNomor': return daftarNomor_();
    case 'pemantauan': return pemantauan_(q.semua === true);
    case 'tambahCatatan': return tambahCatatan_(u, q.data || {});
    case 'laporanBulanan': return laporanBulanan_(String(q.bulan || ''));
    case 'daftarMinat': return riasecDaftar_(String(q.kelas || ''));
    case 'daftarScan': return daftarScan_(String(q.cari || ''));
    case 'lihatScan': return lihatScan_(String(q.id || ''));
    case 'hapusScan': return hapusScan_(u, String(q.id || ''));
    case 'simpanJurnal': return simpanJurnal_(u, q.data || {});
    case 'daftarJurnal': return daftarJurnal_(String(q.dari || ''), String(q.sampai || ''));
    case 'hapusJurnal': return hapusJurnal_(String(q.id || ''));
    case 'daftarAkunWali': return daftarAkunWali_();
    case 'simpanAkunWali': return simpanAkunWali_(u, q.data || {});
    case 'resetAkunWali': return resetAkunWali_(String(q.email || ''));
    case 'aktifAkunWali': return aktifAkunWali_(String(q.email || ''), q.aktif === true);
    case 'daftarAkunSiswa': return daftarAkunSiswa_(String(q.cari || ''));
    case 'resetPinSiswa': return resetPinSiswa_(String(q.id || ''));
    case 'aktifAkunSiswa': return aktifAkunSiswa_(String(q.id || ''), q.aktif === true);
    case 'checkinRingkas': return checkinRingkas_();
    case 'tandaiCheckin': return tandaiCheckin_(u, String(q.akun || ''));
    case 'simpanFormulir': return simpanFormulir_(u, q.data || {});
    case 'daftarFormulir': return daftarFormulir_();
    case 'aktifFormulir': return aktifFormulir_(String(q.id || ''), q.aktif === true);
    case 'unggahHasil': return unggahHasil_(u, q.data || {});
    case 'daftarHasil': return daftarHasil_(String(q.cari || ''));
    case 'lihatHasil': return lihatHasil_(String(q.id || ''), null);
    case 'tampilHasil': return tampilHasil_(String(q.id || ''), q.tampil === true);
    case 'hapusHasil': return hapusHasil_(String(q.id || ''));
    case 'chatDaftar': return chatDaftar_();
    case 'chatAmbil': return chatAmbil_(String(q.akun || ''), Number(q.sejak) || 0, 'guru');
    case 'chatKirim': return chatKirim_(String(q.akun || ''), String(q.isi || ''), 'Guru BK', u.nama);
    case 'hapusDataSiswa': return hapusDataSiswa_(String(q.id || ''));
    case 'bersihkanAlumni': return bersihkanAlumni_(q.jalankan === true);
  }
  return { ok: false, error: 'Aksi tidak dikenal.' };
}

function hash_(salt, pw) {
  function hex(bytes) { return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
  var h = hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw, Utilities.Charset.UTF_8));
  for (var i = 0; i < 300; i++) h = hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  return h;
}

function akun_(username) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AKUN_TAB);
  var v = sh.getDataRange().getDisplayValues();
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][0]).trim().toLowerCase() === username) {
      return { row: r + 1, username: username, nama: v[r][1], salt: v[r][2], hash: v[r][3], aktif: String(v[r][4]).trim().toUpperCase() === 'YA', sh: sh };
    }
  }
  return null;
}

function login_(username, password) {
  username = username.trim().toLowerCase();
  var cache = CacheService.getScriptCache();
  var kFail = 'fail_' + username;
  var gagal = Number(cache.get(kFail) || 0);
  if (gagal >= MAKS_GAGAL) return { ok: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' };
  var a = username ? akun_(username) : null;
  if (!a || !a.aktif || !password || hash_(a.salt, password) !== a.hash) {
    cache.put(kFail, String(gagal + 1), KUNCI_DETIK);
    Utilities.sleep(600);
    return { ok: false, error: 'Username atau password salah.' };
  }
  cache.remove(kFail);
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('tok_' + token, JSON.stringify({ username: a.username, nama: a.nama }), SESI_DETIK);
  a.sh.getRange(a.row, 6).setValue(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'));
  return { ok: true, token: token, nama: a.nama, username: a.username, kategori: KEJADIAN_KATEGORI };
}

function sesi_(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(String(token))) return null;
  var s = CacheService.getScriptCache().get('tok_' + token);
  return s ? JSON.parse(s) : null;
}

function gantiPassword_(u, lama, baru) {
  var a = akun_(u.username);
  if (!a || hash_(a.salt, lama) !== a.hash) return { ok: false, error: 'Password lama salah.' };
  if (baru.length < 8) return { ok: false, error: 'Password baru minimal 8 karakter.' };
  var salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  a.sh.getRange(a.row, 3, 1, 2).setNumberFormat('@').setValues([[salt, hash_(salt, baru)]]);
  return { ok: true };
}

function nextId_(sh, prefix) {
  var today = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd');
  var n = 0, ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  ids.forEach(function (r) { if (String(r[0]).indexOf(prefix + '-' + today) === 0) n++; });
  return prefix + '-' + today + '-' + ('00' + (n + 1)).slice(-3);
}

function tulisBaris_(tab, nilai, prefix) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    nilai['ID'] = nextId_(sh, prefix || (tab === 'LaporanKejadian' ? 'KJ' : 'SP'));
    nilai['Waktu input'] = new Date();
    sh.appendRow(headers.map(function (h) { return nilai.hasOwnProperty(h) ? nilai[h] : ''; }));
    return nilai['ID'];
  } finally {
    lock.releaseLock();
  }
}

function wajib_(d, keys) {
  for (var i = 0; i < keys.length; i++) if (!String(d[keys[i]] || '').trim()) return keys[i];
  return '';
}

function simpanKejadian_(u, d) {
  var kurang = wajib_(d, ['tanggal', 'nama', 'kelas', 'deskripsi', 'tindakLanjut']);
  if (kurang) return { ok: false, error: 'Kolom wajib belum diisi.' };
  var id = tulisBaris_('LaporanKejadian', {
    'Tanggal kejadian': clean_(d.tanggal), 'Nama siswa': clean_(d.nama), 'Kelas': clean_(d.kelas),
    'Kategori': KEJADIAN_KATEGORI.indexOf(d.kategori) >= 0 ? d.kategori : 'Lainnya',
    'Deskripsi kejadian': clean_(d.deskripsi), 'Tindak lanjut guru BK': clean_(d.tindakLanjut),
    'Status': ['Dalam pendampingan', 'Selesai', 'Dirujuk/alih tangan'].indexOf(d.status) >= 0 ? d.status : 'Dalam pendampingan',
    'Diinput oleh': u.nama, 'Pantau berikutnya': /^\d{4}-\d{2}-\d{2}$/.test(d.pantau || '') && d.status !== 'Selesai' ? d.pantau : ''
  });
  return { ok: true, id: id };
}

function simpanPerjanjian_(u, d) {
  var kurang = wajib_(d, ['tanggal', 'nama', 'kelas', 'poin']);
  if (kurang) return { ok: false, error: 'Kolom wajib belum diisi.' };
  if (d.setuju !== true) return { ok: false, error: 'Persetujuan siswa belum dicentang.' };
  var poin = String(d.poin).split(/\n+/).map(function (s) { return s.trim(); }).filter(String);
  var id = tulisBaris_('SuratPerjanjian', {
    'Tanggal perjanjian': clean_(d.tanggal), 'Nama siswa': clean_(d.nama), 'Kelas': clean_(d.kelas),
    'Nama orang tua/wali': clean_(d.ortu), 'Poin kesepakatan': clean_(poin.join('\n')),
    'Disetujui siswa': 'YA', 'Diinput oleh': u.nama
  });
  return { ok: true, id: id, guru: u.nama };
}

// 15 data terbaru untuk ditampilkan di dashboard (hanya untuk guru yang login).
function daftar_(jenis) {
  var tab = jenis === 'perjanjian' ? 'SuratPerjanjian' : jenis === 'surat' ? SURAT_TAB : 'LaporanKejadian';
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
  if (sh.getLastRow() < 2) return { ok: true, rows: [] };
  var v = sh.getDataRange().getDisplayValues();
  var h = v[0];
  var rows = v.slice(1).filter(function (r) { return r[0]; }).slice(-15).reverse().map(function (r) {
    var o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o;
  });
  var jumlahScan = scanPerNomor_();
  rows.forEach(function (o) { o._scan = jumlahScan[String(o['ID'] || '').toUpperCase()] || 0; });
  return { ok: true, rows: rows };
}

/* ---------------- Surat lain: panggilan, rujukan, home visit ---------------- */
var SURAT_TAB = 'SuratLain';
var SURAT_JENIS = {
  panggilan: { nama: 'Surat panggilan orang tua', prefix: 'PG',
    isian: [['hariTanggal', 'Hari/tanggal pertemuan'], ['waktu', 'Waktu'], ['tempat', 'Tempat'], ['keperluan', 'Keperluan']] },
  rujukan: { nama: 'Surat rujukan (alih tangan kasus)', prefix: 'RJ',
    isian: [['tujuan', 'Dirujuk kepada'], ['masalah', 'Permasalahan'], ['upaya', 'Upaya yang sudah dilakukan'], ['alasan', 'Alasan rujukan']] },
  homevisit: { nama: 'Berita acara home visit', prefix: 'HV',
    isian: [['alamat', 'Alamat yang dikunjungi'], ['ditemui', 'Pihak yang ditemui'], ['hasil', 'Hasil kunjungan'], ['kesepakatan', 'Kesepakatan/tindak lanjut']] }
};

function simpanSurat_(u, d) {
  var j = SURAT_JENIS[d.jenis];
  if (!j) return { ok: false, error: 'Jenis surat tidak dikenal.' };
  var kurang = wajib_(d, ['tanggal', 'nama', 'kelas'].concat(j.isian.map(function (f) { return f[0]; })));
  if (kurang) return { ok: false, error: 'Kolom wajib belum diisi.' };
  var rinci = { jenis: d.jenis }, baris = [];
  j.isian.forEach(function (f) { rinci[f[0]] = String(d[f[0]]).trim().slice(0, MAX_LEN); baris.push(f[1] + ': ' + rinci[f[0]]); });
  var id = tulisBaris_(SURAT_TAB, {
    'Jenis surat': j.nama, 'Tanggal surat': clean_(d.tanggal), 'Nama siswa': clean_(d.nama), 'Kelas': clean_(d.kelas),
    'Nama orang tua/wali': clean_(d.ortu), 'Rincian': clean_(baris.join('\n')), 'Diinput oleh': u.nama,
    'Data cetak (jangan diubah)': JSON.stringify(rinci)
  }, j.prefix);
  return { ok: true, id: id, guru: u.nama };
}

/* ---------------- Bantuan baca sheet ---------------- */
function tabel_(tab) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
  if (!sh || sh.getLastRow() < 2) return { h: [], rows: [], sh: sh };
  var v = sh.getDataRange().getValues();
  return { h: v[0].map(function (x) { return String(x).trim(); }), rows: v.slice(1), sh: sh };
}
function kol_(t, nama) { return t.h.indexOf(nama); }
function sel_(t, r, nama) { var i = t.h.indexOf(nama); return i < 0 ? '' : r[i]; }
function teks_(v) {
  if (isDate_(v)) return Utilities.formatDate(v, TZ, 'd MMM yyyy HH:mm');
  return String(v == null ? '' : v).replace(/^'/, '');
}
// Tanggal apa pun -> yyyy-MM-dd (untuk urut & filter).
function tglKey_(v) {
  if (isDate_(v)) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  var s = String(v || '').trim(), m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[0];
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}
function norm_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

/* ---------------- Profil siswa ---------------- */
// Satu nama -> semua catatan tentang siswa itu dari beberapa tab.
var PROFIL_SUMBER = [
  { tab: 'LaporanKejadian', jenis: 'Laporan kejadian', nama: 'Nama siswa', tgl: 'Tanggal kejadian', judul: 'Kategori',
    isi: ['Deskripsi kejadian', 'Tindak lanjut guru BK', 'Catatan tambahan'], status: 'Status', oleh: 'Diinput oleh' },
  { tab: 'SuratPerjanjian', jenis: 'Surat perjanjian', nama: 'Nama siswa', tgl: 'Tanggal perjanjian',
    isi: ['Poin kesepakatan', 'Nama orang tua/wali', 'Catatan tambahan'], oleh: 'Diinput oleh' },
  { tab: SURAT_TAB, jenisKol: 'Jenis surat', nama: 'Nama siswa', tgl: 'Tanggal surat', isi: ['Rincian', 'Nama orang tua/wali'], oleh: 'Diinput oleh' },
  { tab: 'Konseling', jenis: 'Permintaan konseling', nama: 'Nama', tgl: 'Waktu masuk', judul: 'Topik',
    isi: ['Cerita singkat', 'Catatan tindak lanjut'], status: 'Status', oleh: 'Ditangani oleh' },
  { tab: CATATAN_TAB, jenis: 'Catatan perkembangan', nama: 'Nama siswa', tgl: 'Tanggal', judul: 'Nomor kasus',
    isi: ['Catatan perkembangan', 'Rencana tindak lanjut', 'Pantau berikutnya'], status: 'Status kasus', oleh: 'Diinput oleh' },
  { tab: 'ArsipScan', jenisKol: 'Jenis dokumen', jenisAwal: 'Scan: ', nama: 'Nama siswa', tgl: 'Tanggal dokumen',
    isi: ['Nomor terkait', 'Keterangan'], oleh: 'Diunggah oleh' },
  { tab: RIASEC_TAB, jenis: 'Tes minat karier (RIASEC)', nama: 'Nama', tgl: 'Waktu masuk', judul: 'Kode minat',
    isi: ['Kode', 'R', 'I', 'A', 'S', 'E', 'C', 'Cita-cita', 'Rencana setelah SMP'] },
  { tab: 'JanjiOrangTua', jenis: 'Janji temu orang tua', nama: 'Nama siswa', tgl: 'Waktu masuk', judul: 'Keperluan',
    isi: ['Nama orang tua/wali', 'Catatan guru BK'], status: 'Status' },
  { tab: RUJUKAN_TAB, jenis: 'Rujukan wali kelas', nama: 'Nama siswa', tgl: 'Waktu masuk', judul: 'Alasan rujukan',
    isi: ['Nama wali kelas', 'Tingkat urgensi', 'Yang diamati', 'Upaya wali kelas', 'Tanggapan untuk wali kelas (tampil di portal)', 'Catatan internal guru BK'],
    status: 'Status', oleh: 'Ditangani oleh' },
  { tab: 'HasilPsikotes', jenis: 'Hasil psikotes', nama: 'Nama siswa', tgl: 'Tanggal tes', judul: 'Jenis tes',
    isi: ['Catatan untuk siswa', 'Tampil untuk siswa'], oleh: 'Diunggah oleh' }
];

function cocok_(nama, q) { var n = ' ' + norm_(nama) + ' '; return n.indexOf(' ' + q) >= 0; }

function profil_(cari) {
  var q = norm_(cari);
  if (q.length < 3) return { ok: false, error: 'Ketik minimal 3 huruf nama siswa.' };
  var items = [], siswa = {};
  PROFIL_SUMBER.forEach(function (s) {
    var t = tabel_(s.tab);
    t.rows.forEach(function (r) {
      var nama = String(sel_(t, r, s.nama) || '').trim();
      if (!nama || !cocok_(nama, q)) return;
      var kelas = String(sel_(t, r, 'Kelas') || '').trim();
      siswa[norm_(nama) + '|' + kelas.toUpperCase()] = { nama: nama, kelas: kelas };
      items.push({
        sumber: s.tab, jenis: s.jenisKol ? (s.jenisAwal || '') + String(sel_(t, r, s.jenisKol)) : s.jenis, id: teks_(sel_(t, r, 'ID')),
        tanggal: tglKey_(sel_(t, r, s.tgl)), nama: nama, kelas: kelas, judul: s.judul ? teks_(sel_(t, r, s.judul)) : '',
        status: s.status ? teks_(sel_(t, r, s.status)) : '', oleh: s.oleh ? teks_(sel_(t, r, s.oleh)) : '',
        isi: s.isi.map(function (k) { return { label: k, teks: teks_(sel_(t, r, k)) }; }).filter(function (x) { return x.teks; })
      });
    });
  });
  // Laporan perundungan tidak punya kolom nama; cari nama di kolom "Siapa yang terlibat".
  if (q.length >= 4) {
    var t = tabel_('LaporanPerundungan');
    t.rows.forEach(function (r) {
      if (!cocok_(sel_(t, r, 'Siapa yang terlibat'), q)) return;
      items.push({
        sumber: 'LaporanPerundungan', jenis: 'Disebut dalam laporan perundungan', id: teks_(sel_(t, r, 'Kode')),
        tanggal: tglKey_(sel_(t, r, 'Waktu masuk')), nama: '', kelas: '', judul: teks_(sel_(t, r, 'Jenis perundungan')),
        status: teks_(sel_(t, r, 'Status')), oleh: teks_(sel_(t, r, 'Ditangani oleh')),
        isi: ['Siapa yang terlibat', 'Apa yang terjadi', 'Tindak lanjut (internal)'].map(function (k) { return { label: k, teks: teks_(sel_(t, r, k)) }; })
          .filter(function (x) { return x.teks; })
      });
    });
  }
  items.sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0; });
  return { ok: true, siswa: Object.keys(siswa).map(function (k) { return siswa[k]; }), items: items.slice(0, 200) };
}

// Daftar siswa resmi (tab DataSiswa) + nama lain yang pernah tercatat. Nama kapital semua dirapikan.
var SISWA_TAB = 'DataSiswa';
function rapiNama_(n) {
  n = String(n || '').replace(/\s+/g, ' ').trim();
  if (n && n === n.toUpperCase()) n = n.toLowerCase().replace(/(^|[\s.-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
  return n;
}
function namaSiswa_() {
  var map = {}, out = [];
  var t = tabel_(SISWA_TAB);
  t.rows.forEach(function (r) {
    var n = rapiNama_(r[0]), k = String(r[1] || '').trim().toUpperCase();
    if (!n) return;
    var key = norm_(n);
    if (!map[key]) { map[key] = { nama: n, kelas: k, resmi: true }; out.push(map[key]); }
  });
  PROFIL_SUMBER.forEach(function (s) {
    var tb = tabel_(s.tab), i = kol_(tb, s.nama), ik = kol_(tb, 'Kelas');
    if (i < 0) return;
    tb.rows.forEach(function (r) {
      var n = String(r[i] || '').trim(), key = norm_(n);
      if (n && !map[key]) { map[key] = { nama: n, kelas: ik >= 0 ? String(r[ik] || '').trim() : '', resmi: false }; out.push(map[key]); }
    });
  });
  out.sort(function (a, b) { return a.nama.localeCompare(b.nama); });
  return { ok: true, siswa: out.slice(0, 3000), nama: out.map(function (x) { return x.nama; }).slice(0, 3000) };
}

/* ---------------- Kotak masuk: curhat, laporan, konseling, janji ---------------- */
var INBOX = {
  curhat: { tab: 'Curhat', status: ['Baru', 'Dibaca', 'Dibalas', 'Selesai'], judul: 'Topik',
    balas: 'Balasan untuk siswa (tampil di web)', catatan: 'Catatan internal guru BK',
    tampil: ['Kode', 'Jenjang kelas (opsional)', 'Topik', 'Isi curhat', 'Ingin dihubungi guru BK?', 'Nama/kontak (jika ingin dihubungi)'] },
  laporan: { tab: 'LaporanPerundungan', status: ['Baru', 'Ditangani', 'Selesai'], judul: 'Jenis perundungan',
    balas: 'Balasan untuk pelapor (tampil di web)', catatan: 'Tindak lanjut (internal)', oleh: 'Ditangani oleh',
    tampil: ['Kode', 'Pelapor sebagai', 'Kelas pelapor (opsional)', 'Jenis perundungan', 'Apa yang terjadi', 'Tempat', 'Kapan terjadi', 'Siapa yang terlibat', 'Masih berlangsung?', 'Nama/kontak pelapor (opsional)'] },
  konseling: { tab: 'Konseling', status: ['Baru', 'Dijadwalkan', 'Selesai', 'Dibatalkan'], judul: 'Topik',
    balas: 'Pesan untuk siswa (tampil di web)', catatan: 'Catatan tindak lanjut', oleh: 'Ditangani oleh', jadwal: true, daring: true, tugas: true,
    namaKol: 'Nama', tampil: ['Kode', 'Nama', 'Kelas', 'Topik', 'Waktu yang diinginkan', 'Cerita singkat',
      'Seberapa mengganggu (1-5)', 'Harapan dari sesi', 'Sudah cerita ke', 'Persetujuan asas konseling'] },
  rujukan: { tab: RUJUKAN_TAB, status: ['Baru', 'Diterima', 'Dijadwalkan', 'Dalam pendampingan', 'Selesai'], judul: ['Nama siswa', 'Alasan rujukan'],
    balas: 'Tanggapan untuk wali kelas (tampil di portal)', catatan: 'Catatan internal guru BK', oleh: 'Ditangani oleh', jadwal: true, tugas: true,
    namaKol: 'Nama siswa', urgensi: 'Tingkat urgensi',
    tampil: ['Kode', 'Nama siswa', 'Kelas', 'Alasan rujukan', 'Tingkat urgensi', 'Yang diamati', 'Upaya wali kelas', 'Sudah dibicarakan dengan orang tua?', 'Nama wali kelas'] },
  janji: { tab: 'JanjiOrangTua', status: ['Baru', 'Dijadwalkan', 'Selesai'], judul: 'Keperluan',
    catatan: 'Catatan guru BK',
    tampil: ['Nama orang tua/wali', 'Nama siswa', 'Kelas', 'Nomor WhatsApp', 'Keperluan', 'Waktu yang diinginkan'] }
};
function judulInbox_(t, row, c) {
  return [].concat(c.judul).map(function (k) { return teks_(sel_(t, row, k)); }).filter(String).join(' · ');
}

function stamp_(v) { return isDate_(v) ? String(v.getTime()) : String(v); }

function hitungBaru_() {
  var out = {};
  Object.keys(INBOX).forEach(function (k) {
    var t = tabel_(INBOX[k].tab), i = kol_(t, 'Status');
    out[k] = t.rows.filter(function (r) { return r[0] !== '' && (i < 0 || !String(r[i]).trim() || String(r[i]).trim() === 'Baru'); }).length;
  });
  return out;
}

function inbox_(jenis, semua) {
  var c = INBOX[jenis];
  if (!c) return { ok: false, error: 'Kotak masuk tidak dikenal.' };
  var t = tabel_(c.tab), iS = kol_(t, 'Status'), list = [];
  for (var r = t.rows.length - 1; r >= 0 && list.length < 60; r--) {
    var row = t.rows[r];
    if (row[0] === '') continue;
    var st = iS >= 0 ? String(row[iS] || '').trim() || 'Baru' : 'Baru';
    if (!semua && st === 'Selesai') continue;
    var item = {
      ref: (r + 2) + '|' + stamp_(row[0]), waktu: teks_(row[0]), status: st, judul: judulInbox_(t, row, c),
      isi: c.tampil.map(function (k) { return { label: k, teks: teks_(sel_(t, row, k)) }; }).filter(function (x) { return x.teks; }),
      balasan: c.balas ? teks_(sel_(t, row, c.balas)) : null, catatan: teks_(sel_(t, row, c.catatan)),
      oleh: c.oleh ? teks_(sel_(t, row, c.oleh)) : '', kode: teks_(sel_(t, row, 'Kode'))
    };
    if (c.jadwal) item.jadwal = { tanggal: tglKey_(sel_(t, row, 'Jadwal sesi')), jam: teks_(sel_(t, row, 'Jam sesi')), tempat: teks_(sel_(t, row, 'Tempat sesi')),
      bentuk: teks_(sel_(t, row, 'Bentuk sesi')) || 'Tatap muka', tautan: c.daring ? teks_(sel_(t, row, 'Tautan sesi daring')) : '' };
    if (c.tugas) item.tugas = teks_(sel_(t, row, 'Ditugaskan ke'));
    if (c.namaKol) { item.nama = teks_(sel_(t, row, c.namaKol)); item.kelas = teks_(sel_(t, row, 'Kelas')); }
    if (c.urgensi) item.urgensi = teks_(sel_(t, row, c.urgensi));
    if (jenis === 'konseling') item.akunSiswa = !!teks_(sel_(t, row, 'Akun siswa'));
    list.push(item);
  }
  return { ok: true, items: list, pilihanStatus: c.status, adaBalasan: !!c.balas, adaJadwal: !!c.jadwal, adaDaring: !!c.daring,
    adaTugas: !!c.tugas, guru: c.tugas ? namaGuru_() : [], baru: hitungBaru_() };
}

function perbarui_(u, jenis, ref, d) {
  var c = INBOX[jenis];
  if (!c) return { ok: false, error: 'Kotak masuk tidak dikenal.' };
  if (c.status.indexOf(d.status) < 0) return { ok: false, error: 'Status tidak valid.' };
  if (d.jadwal && d.jadwal.bentuk === 'Daring' && d.jadwal.tautan && !/^https:\/\/\S+$/.test(String(d.jadwal.tautan).trim()))
    return { ok: false, error: 'Tautan sesi daring harus diawali https://' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var t = tabel_(c.tab), p = ref.split('|'), r = Number(p[0]) - 2;
    // Baris bisa bergeser kalau ada yang dihapus: pastikan cocok lewat waktu masuk.
    if (!t.rows[r] || stamp_(t.rows[r][0]) !== p[1]) {
      r = -1;
      for (var i = 0; i < t.rows.length; i++) if (stamp_(t.rows[i][0]) === p[1]) { r = i; break; }
      if (r < 0) return { ok: false, error: 'Data tidak ditemukan. Muat ulang kotak masuk.' };
    }
    var row = r + 2;
    function tulis(kolom, nilai, teks) {
      var i = kol_(t, kolom); if (i < 0) return;
      var sel = t.sh.getRange(row, i + 1);
      if (teks) sel.setNumberFormat('@');
      sel.setValue(nilai);
    }
    tulis('Status', d.status);
    if (c.balas && d.balasan != null) tulis(c.balas, clean_(d.balasan));
    if (d.catatan != null) tulis(c.catatan, clean_(d.catatan));
    var rowLama = t.rows[row - 2], statusLama = teks_(sel_(t, rowLama, 'Status')), jadwalLama = tglKey_(sel_(t, rowLama, 'Jadwal sesi')) + teks_(sel_(t, rowLama, 'Jam sesi')) + teks_(sel_(t, rowLama, 'Tempat sesi'));
    var jadwalBaru = jadwalLama;
    if (c.jadwal && d.jadwal) {
      var tg = String(d.jadwal.tanggal || '');
      tulis('Jadwal sesi', /^\d{4}-\d{2}-\d{2}$/.test(tg) ? tg : '', true);
      tulis('Jam sesi', clean_(String(d.jadwal.jam || '').slice(0, 60)), true);
      tulis('Tempat sesi', clean_(String(d.jadwal.tempat || '').slice(0, 120)), true);
      tulis('Bentuk sesi', d.jadwal.bentuk === 'Daring' ? 'Daring' : 'Tatap muka', true);
      if (c.daring) {
        var link = String(d.jadwal.tautan || '').trim();
        tulis('Tautan sesi daring', d.jadwal.bentuk === 'Daring' ? link.slice(0, 300) : '', true);
      }
      jadwalBaru = (/^\d{4}-\d{2}-\d{2}$/.test(tg) ? tg : '') + clean_(String(d.jadwal.jam || '').slice(0, 60)) + clean_(String(d.jadwal.tempat || '').slice(0, 120));
    }
    if (c.tugas && d.tugas != null) tulis('Ditugaskan ke', namaGuru_().indexOf(d.tugas) >= 0 ? d.tugas : '', true);
    if (c.oleh) tulis(c.oleh, u.nama);
    if (d.status !== statusLama || jadwalBaru !== jadwalLama) kabariPerubahan_(jenis, t, rowLama, d.status);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Statistik ---------------- */
function awalTahunAjaran_() {
  var now = new Date(), y = now.getFullYear(), m = now.getMonth();
  return (m >= 6 ? y : y - 1) + '-07-01';
}

function statistik_(dari, sampai) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dari)) dari = awalTahunAjaran_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sampai)) sampai = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  function dalam(k) { return k && k >= dari && k <= sampai; }
  var SUMBER = [
    ['Konseling', 'Konseling individu (permintaan web)', 'Waktu masuk'],
    ['Curhat', 'Curhat anonim', 'Waktu masuk'],
    ['LaporanPerundungan', 'Laporan perundungan', 'Waktu masuk'],
    ['JanjiOrangTua', 'Janji temu orang tua', 'Waktu masuk'],
    [RUJUKAN_TAB, 'Rujukan wali kelas', 'Waktu masuk'],
    ['LaporanKejadian', 'Laporan kejadian', 'Tanggal kejadian'],
    ['SuratPerjanjian', 'Surat perjanjian', 'Tanggal perjanjian'],
    [SURAT_TAB, '', 'Tanggal surat'],
    [CATATAN_TAB, 'Catatan perkembangan kasus', 'Tanggal'],
    [RIASEC_TAB, 'Tes minat karier', 'Waktu masuk'],
    ['Survei', 'Survei kepuasan', 'Waktu masuk']
  ];
  var layanan = {}, urutan = [], bulan = {};
  function tambah(label, key) {
    if (!(label in layanan)) { layanan[label] = 0; urutan.push(label); }
    layanan[label]++;
    var b = key.slice(0, 7); bulan[b] = (bulan[b] || 0) + 1;
  }
  SUMBER.forEach(function (s) {
    var t = tabel_(s[0]);
    if (s[1]) { layanan[s[1]] = 0; urutan.push(s[1]); }
    t.rows.forEach(function (r) {
      var k = tglKey_(sel_(t, r, s[2]));
      if (!dalam(k)) return;
      tambah(s[1] || String(sel_(t, r, 'Jenis surat') || 'Surat lain'), k);
    });
  });

  var kej = tabel_('LaporanKejadian'), kategori = {}, tingkat = {}, statusKej = {};
  KEJADIAN_KATEGORI.forEach(function (k) { kategori[k] = 0; });
  kej.rows.forEach(function (r) {
    if (!dalam(tglKey_(sel_(kej, r, 'Tanggal kejadian')))) return;
    var k = String(sel_(kej, r, 'Kategori') || 'Lainnya'); kategori[k] = (kategori[k] || 0) + 1;
    var m = String(sel_(kej, r, 'Kelas')).match(/[789]/); var tk = m ? 'Kelas ' + m[0] : 'Tidak diketahui';
    tingkat[tk] = (tingkat[tk] || 0) + 1;
    var st = String(sel_(kej, r, 'Status') || '-'); statusKej[st] = (statusKej[st] || 0) + 1;
  });

  var lap = tabel_('LaporanPerundungan'), jenisLap = {};
  lap.rows.forEach(function (r) {
    if (!dalam(tglKey_(sel_(lap, r, 'Waktu masuk')))) return;
    String(sel_(lap, r, 'Jenis perundungan') || 'Tidak disebut').split(/\s*,\s*/).forEach(function (j) { if (j) jenisLap[j] = (jenisLap[j] || 0) + 1; });
  });

  var sv = tabel_('Survei'), n = 0, t1 = 0, t2 = 0, ya = 0;
  sv.rows.forEach(function (r) {
    if (!dalam(tglKey_(sel_(sv, r, 'Waktu masuk')))) return;
    n++; t1 += Number(sel_(sv, r, 'Seberapa terbantu (1-5)')) || 0; t2 += Number(sel_(sv, r, 'Seberapa nyaman (1-5)')) || 0;
    if (String(sel_(sv, r, 'Mau datang lagi?')).trim() === 'Ya') ya++;
  });

  var tm = tabel_(RIASEC_TAB), dominan = {};
  RIASEC_URUT.forEach(function (k) { dominan[RIASEC_NAMA[k]] = 0; });
  tm.rows.forEach(function (r) {
    if (!dalam(tglKey_(sel_(tm, r, 'Waktu masuk')))) return;
    var k = String(sel_(tm, r, 'Kode minat') || '').charAt(0);
    if (RIASEC_NAMA[k]) dominan[RIASEC_NAMA[k]]++;
  });

  // Kegiatan jurnal harian dihitung terpisah agar tidak dobel dengan layanan di atas.
  var jr = tabel_(JURNAL_TAB), jurnal = {};
  JURNAL_JENIS.forEach(function (k) { jurnal[k] = 0; });
  jr.rows.forEach(function (r) {
    if (!r[0] || !dalam(tglKey_(sel_(jr, r, 'Tanggal')))) return;
    var k = String(sel_(jr, r, 'Jenis kegiatan') || 'Lainnya'); jurnal[k] = (jurnal[k] || 0) + 1;
  });

  function arr(o, urut) { return (urut || Object.keys(o)).map(function (k) { return { label: k, n: o[k] || 0 }; }); }
  var bulanArr = Object.keys(bulan).sort().map(function (k) { return { label: k, n: bulan[k] }; });
  return {
    ok: true, dari: dari, sampai: sampai,
    layanan: arr(layanan, urutan), perBulan: bulanArr,
    kategori: arr(kategori).sort(function (a, b) { return b.n - a.n; }),
    tingkat: arr(tingkat).sort(function (a, b) { return a.label < b.label ? -1 : 1; }),
    statusKejadian: arr(statusKej), jenisPerundungan: arr(jenisLap).sort(function (a, b) { return b.n - a.n; }),
    survei: { n: n, terbantu: n ? Math.round(t1 / n * 10) / 10 : 0, nyaman: n ? Math.round(t2 / n * 10) / 10 : 0, kembaliPersen: n ? Math.round(ya / n * 100) : 0 },
    minat: arr(dominan),
    jurnal: arr(jurnal),
    baru: hitungBaru_()
  };
}

/* ---------------- Folder Drive ---------------- */
// Semua folder web (backup, arsip scan) dibuat di folder yang sama dengan sheet ini,
// yaitu "BK SMP LABSCIRA > WEB BK (website)", supaya tidak tercecer.
function subfolder_(nama) {
  var parents = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId()).getParents();
  var induk = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var it = induk.getFoldersByName(nama);
  return it.hasNext() ? it.next() : induk.createFolder(nama);
}

/* ---------------- Backup otomatis ---------------- */
// Salinan seluruh sheet ke folder "Backup Data Web BK" (di sebelah sheet ini), setiap Minggu malam.
// 8 salinan terbaru disimpan; yang lebih lama dipindah ke Sampah.
var BACKUP_FOLDER = 'Backup Data Web BK';
var BACKUP_SIMPAN = 8;

function backupMingguan() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var folder = subfolder_(BACKUP_FOLDER);
  var waktu = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HHmm');
  var nama = 'Backup ' + ss.getName() + ' ' + waktu;
  DriveApp.getFileById(ss.getId()).makeCopy(nama, folder);
  var files = [], fi = folder.getFiles();
  while (fi.hasNext()) { var f = fi.next(); if (f.getName().indexOf('Backup ') === 0) files.push(f); }
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(BACKUP_SIMPAN).forEach(function (f) { f.setTrashed(true); });
  var props = PropertiesService.getScriptProperties();
  props.setProperty('BACKUP_TERAKHIR', Utilities.formatDate(new Date(), TZ, 'd MMM yyyy HH:mm'));
  props.setProperty('BACKUP_JUMLAH', String(Math.min(files.length, BACKUP_SIMPAN)));
  return nama;
}

// Jalankan SEKALI dari editor: memasang pemicu mingguan lalu membuat backup pertama.
function pasangPemicuBackup() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'backupMingguan') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('backupMingguan').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(21).create();
  return backupMingguan();
}

function infoBackup_() {
  var p = PropertiesService.getScriptProperties();
  return { ok: true, terakhir: p.getProperty('BACKUP_TERAKHIR') || '', jumlah: Number(p.getProperty('BACKUP_JUMLAH') || 0) };
}

/* ---------------- Catatan perkembangan & pemantauan kasus ---------------- */
// Setiap laporan kejadian (KJ-) bisa diberi catatan perkembangan bertanggal dan jadwal pantau berikutnya.
var STATUS_KASUS = ['Dalam pendampingan', 'Dirujuk/alih tangan', 'Selesai'];

function hariIni_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function tambahHari_(ymd, n) {
  var p = ymd.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function pemantauan_(semua) {
  var kej = tabel_('LaporanKejadian'), cat = tabel_(CATATAN_TAB), riwayat = {};
  cat.rows.forEach(function (r) {
    var no = String(sel_(cat, r, 'Nomor kasus') || '').toUpperCase();
    if (!no) return;
    (riwayat[no] = riwayat[no] || []).push({
      id: teks_(sel_(cat, r, 'ID')), tanggal: tglKey_(sel_(cat, r, 'Tanggal')), catatan: teks_(sel_(cat, r, 'Catatan perkembangan')),
      rencana: teks_(sel_(cat, r, 'Rencana tindak lanjut')), status: teks_(sel_(cat, r, 'Status kasus')), oleh: teks_(sel_(cat, r, 'Diinput oleh')),
      sesi: teks_(sel_(cat, r, 'Sesi ke')), teknik: teks_(sel_(cat, r, 'Pendekatan/teknik')),
      paham: teks_(sel_(cat, r, 'Pemahaman baru siswa')), rasa: teks_(sel_(cat, r, 'Perasaan siswa')), tindakan: teks_(sel_(cat, r, 'Rencana tindakan siswa')),
      pikiran: teks_(sel_(cat, r, 'Pikiran otomatis')), alternatif: teks_(sel_(cat, r, 'Pikiran alternatif')),
      kemajuan: teks_(sel_(cat, r, 'Skala kemajuan (1-5)'))
    });
  });
  var today = hariIni_(), minggu = tambahHari_(today, 7), items = [], terlambat = 0, segera = 0, aktif = 0;
  kej.rows.forEach(function (r) {
    var no = String(r[0] || '').trim().toUpperCase();
    if (!no) return;
    var st = String(sel_(kej, r, 'Status') || 'Dalam pendampingan');
    var pantau = tglKey_(sel_(kej, r, 'Pantau berikutnya'));
    if (st !== 'Selesai') {
      aktif++;
      if (pantau && pantau < today) terlambat++;
      else if (pantau && pantau <= minggu) segera++;
    }
    if (!semua && st === 'Selesai') return;
    items.push({
      nomor: no, tanggal: tglKey_(sel_(kej, r, 'Tanggal kejadian')), nama: teks_(sel_(kej, r, 'Nama siswa')), kelas: teks_(sel_(kej, r, 'Kelas')),
      kategori: teks_(sel_(kej, r, 'Kategori')), status: st, pantau: st === 'Selesai' ? '' : pantau,
      deskripsi: teks_(sel_(kej, r, 'Deskripsi kejadian')), tindak: teks_(sel_(kej, r, 'Tindak lanjut guru BK')),
      oleh: teks_(sel_(kej, r, 'Diinput oleh')),
      riwayat: (riwayat[no] || []).sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; })
    });
  });
  // Yang paling mendesak di atas: terlambat, lalu tanggal pantau terdekat, lalu yang belum dijadwalkan.
  items.sort(function (a, b) {
    var pa = a.pantau || '9999', pb = b.pantau || '9999';
    if (a.status === 'Selesai' && b.status !== 'Selesai') return 1;
    if (b.status === 'Selesai' && a.status !== 'Selesai') return -1;
    return pa < pb ? -1 : pa > pb ? 1 : (a.tanggal < b.tanggal ? 1 : -1);
  });
  return { ok: true, items: items.slice(0, 150), hariIni: today, terlambat: terlambat, segera: segera, aktif: aktif, pilihanStatus: STATUS_KASUS, pilihanTeknik: TEKNIK_KONSELING };
}

// Pendekatan yang bisa dipilih saat menulis catatan sesi. "Pikiran otomatis/alternatif" dipakai untuk CBT dan REBT.
var TEKNIK_KONSELING = ['Konseling Kognitif-Perilaku (CBT)', 'Rational Emotive Behavior Therapy (REBT)', 'Konseling Singkat Berfokus Solusi (SFBC)',
  'Konseling Berpusat pada Pribadi', 'Konseling Behavioral', 'Konseling Realita', 'Mediasi', 'Lainnya'];

function tambahCatatan_(u, d) {
  var nomor = String(d.nomor || '').trim().toUpperCase();
  if (wajib_(d, ['nomor', 'tanggal', 'catatan'])) return { ok: false, error: 'Isi tanggal dan catatan perkembangan.' };
  if (STATUS_KASUS.indexOf(d.status) < 0) return { ok: false, error: 'Status tidak valid.' };
  var pantau = /^\d{4}-\d{2}-\d{2}$/.test(d.pantau || '') && d.status !== 'Selesai' ? d.pantau : '';
  var kej = tabel_('LaporanKejadian'), r = -1;
  for (var i = 0; i < kej.rows.length; i++) if (String(kej.rows[i][0]).trim().toUpperCase() === nomor) { r = i; break; }
  if (r < 0) return { ok: false, error: 'Laporan ' + nomor + ' tidak ditemukan.' };
  var row = kej.rows[r];
  // Nomor sesi: dari isian guru, atau otomatis (jumlah catatan sebelumnya + 1).
  var sesi = Math.round(Number(d.sesi));
  if (!(sesi >= 1 && sesi <= 99)) {
    var cat = tabel_(CATATAN_TAB), n = 0;
    cat.rows.forEach(function (x) { if (String(sel_(cat, x, 'Nomor kasus')).trim().toUpperCase() === nomor) n++; });
    sesi = n + 1;
  }
  var maju = Math.round(Number(d.kemajuan));
  var id = tulisBaris_(CATATAN_TAB, {
    'Nomor kasus': nomor, 'Tanggal': clean_(d.tanggal), 'Nama siswa': String(sel_(kej, row, 'Nama siswa')), 'Kelas': String(sel_(kej, row, 'Kelas')),
    'Catatan perkembangan': clean_(d.catatan), 'Rencana tindak lanjut': clean_(d.rencana), 'Pantau berikutnya': pantau,
    'Status kasus': d.status, 'Diinput oleh': u.nama,
    'Sesi ke': sesi, 'Pendekatan/teknik': TEKNIK_KONSELING.indexOf(d.teknik) >= 0 ? d.teknik : '',
    'Pemahaman baru siswa': clean_(d.paham), 'Perasaan siswa': clean_(d.rasa), 'Rencana tindakan siswa': clean_(d.tindakan),
    'Pikiran otomatis': clean_(d.pikiran), 'Pikiran alternatif': clean_(d.alternatif),
    'Skala kemajuan (1-5)': maju >= 1 && maju <= 5 ? maju : ''
  }, 'CP');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var t = tabel_('LaporanKejadian'), rr = -1;
    for (var j = 0; j < t.rows.length; j++) if (String(t.rows[j][0]).trim().toUpperCase() === nomor) { rr = j; break; }
    if (rr >= 0) {
      var iS = kol_(t, 'Status'), iP = kol_(t, 'Pantau berikutnya');
      if (iS >= 0) t.sh.getRange(rr + 2, iS + 1).setValue(d.status);
      if (iP >= 0) t.sh.getRange(rr + 2, iP + 1).setNumberFormat('@').setValue(pantau);
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: true, id: id };
}

// Email pengingat setiap Senin pagi ke pemilik sheet: kasus yang jadwal pantaunya lewat atau minggu ini.
// Isi email hanya nomor kasus, kelas, kategori, dan inisial siswa.
function inisial_(n) {
  return String(n || '').trim().split(/\s+/).filter(String).map(function (w) { return w.charAt(0).toUpperCase() + '.'; }).join(' ');
}
function pengingatPemantauan() {
  var p = pemantauan_(false), batas = tambahHari_(p.hariIni, 7);
  var due = p.items.filter(function (x) { return x.pantau && x.pantau <= batas; });
  if (!due.length) return 'tidak ada';
  var baris = due.map(function (x) {
    return (x.pantau < p.hariIni ? '[TERLAMBAT] ' : '') + x.pantau + '  ' + x.nomor + '  ' + inisial_(x.nama) + ' (' + x.kelas + ')  ' + x.kategori;
  });
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), '[Web BK] ' + due.length + ' kasus perlu dipantau minggu ini',
    'Kasus yang jadwal pemantauannya sudah lewat atau jatuh dalam 7 hari ke depan:\n\n' + baris.join('\n') +
    '\n\nBuka dashboard guru BK > Pemantauan untuk menulis catatan perkembangan:\nhttps://farel26.github.io/web-bk-labschool-ciracas/guru.html');
  return due.length + ' kasus';
}
// Jalankan SEKALI dari editor: memasang pengingat setiap Senin pukul 06.00.
function pasangPemicuPengingat() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'pengingatPemantauan') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('pengingatPemantauan').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create();
  return 'terpasang';
}

/* ---------------- Laporan bulanan ---------------- */
function laporanBulanan_(bulan) {
  if (!/^\d{4}-\d{2}$/.test(bulan)) bulan = Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
  var p = bulan.split('-'), akhir = new Date(Number(p[0]), Number(p[1]), 0).getDate();
  var dari = bulan + '-01', sampai = bulan + '-' + ('0' + akhir).slice(-2);
  var st = statistik_(dari, sampai);
  var kej = tabel_('LaporanKejadian'), kasus = [];
  kej.rows.forEach(function (r) {
    var tg = tglKey_(sel_(kej, r, 'Tanggal kejadian'));
    if (!r[0] || tg < dari || tg > sampai) return;
    kasus.push({ nomor: teks_(r[0]), tanggal: tg, nama: teks_(sel_(kej, r, 'Nama siswa')), kelas: teks_(sel_(kej, r, 'Kelas')),
                 kategori: teks_(sel_(kej, r, 'Kategori')), status: teks_(sel_(kej, r, 'Status')) });
  });
  kasus.sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });
  var pm = pemantauan_(false);
  return { ok: true, bulan: bulan, dari: dari, sampai: sampai, statistik: st, kasus: kasus,
           kasusAktif: pm.aktif, terlambat: pm.terlambat };
}

/* ---------------- Tes minat karier (RIASEC) ---------------- */
// Skor dihitung ulang di server dari 42 jawaban (1 = Ya), jadi tidak bisa dimanipulasi dari browser.
function riasecSkor_(jawaban) {
  var skor = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  for (var i = 0; i < 42; i++) if (jawaban.charAt(i) === '1') skor[RIASEC_KUNCI.charAt(i)]++;
  var urut = RIASEC_URUT.slice().sort(function (a, b) { return skor[b] - skor[a] || RIASEC_URUT.indexOf(a) - RIASEC_URUT.indexOf(b); });
  return { skor: skor, kode: urut.slice(0, 3).join(''), seri: skor[urut[2]] === skor[urut[3]] };
}

function riasecSimpan_(d) {
  if (d.website) return { ok: true };                                  // jebakan bot
  var kode = String(d.kode || '').toUpperCase();
  if (!/^RM-[A-Z0-9]{6}$/.test(kode)) return { ok: false, error: 'Kode tidak valid. Muat ulang halaman lalu coba lagi.' };
  if (d.setuju !== true) return { ok: false, error: 'Persetujuan belum diberikan.' };
  if (wajib_(d, ['nama', 'kelas', 'jk', 'usia'])) return { ok: false, error: 'Identitas belum lengkap.' };
  if (['Laki-laki', 'Perempuan'].indexOf(d.jk) < 0) return { ok: false, error: 'Jenis kelamin tidak valid.' };
  var usia = Number(d.usia);
  if (!(usia >= 9 && usia <= 20)) return { ok: false, error: 'Usia tidak valid.' };
  var jw = String(d.jawaban || '');
  if (!/^[01]{42}$/.test(jw)) return { ok: false, error: 'Jawaban belum lengkap.' };
  var h = riasecSkor_(jw);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var t = tabel_(RIASEC_TAB);
    if (kol_(t, 'Kode') >= 0 && t.rows.some(function (r) { return String(sel_(t, r, 'Kode')).toUpperCase() === kode; })) return { ok: true, kode: kode, skor: h.skor, kodeMinat: h.kode, seri: h.seri, ulang: true };
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RIASEC_TAB);
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim(); });
    var nilai = {
      'Waktu masuk': new Date(), 'Kode': kode, 'Nama': clean_(rapiNama_(d.nama)), 'Kelas': clean_(String(d.kelas).toUpperCase()),
      'Nomor absen': clean_(d.absen), 'Jenis kelamin': d.jk, 'Usia': usia, 'Cita-cita': clean_(d.cita), 'Rencana setelah SMP': clean_(d.rencana),
      'Persetujuan': 'YA', 'Kode minat': h.kode, 'Skor seri': h.seri ? 'YA' : '', 'Jawaban (1=Ya)': "'" + jw
    };
    RIASEC_URUT.forEach(function (k) { nilai[k] = h.skor[k]; });
    sh.appendRow(headers.map(function (x) { return nilai.hasOwnProperty(x) ? nilai[x] : ''; }));
  } finally {
    lock.releaseLock();
  }
  return { ok: true, kode: kode, skor: h.skor, kodeMinat: h.kode, seri: h.seri };
}

// Untuk membuka kembali hasil dengan kode RM-XXXXXX (tanpa login).
function riasecHasil_(kode) {
  if (!/^RM-[A-Z0-9]{6}$/.test(kode)) return { found: false };
  var t = tabel_(RIASEC_TAB);
  for (var r = t.rows.length - 1; r >= 0; r--) {
    var row = t.rows[r];
    if (String(sel_(t, row, 'Kode')).toUpperCase() !== kode) continue;
    var skor = {};
    RIASEC_URUT.forEach(function (k) { skor[k] = Number(sel_(t, row, k)) || 0; });
    var h = riasecSkor_(String(sel_(t, row, 'Jawaban (1=Ya)')).replace(/^'/, ''));
    return { found: true, kode: kode, nama: teks_(sel_(t, row, 'Nama')), kelas: teks_(sel_(t, row, 'Kelas')),
             tanggal: tglKey_(sel_(t, row, 'Waktu masuk')), skor: skor, kodeMinat: String(sel_(t, row, 'Kode minat')), seri: h.seri };
  }
  return { found: false };
}

function riasecDaftar_(kelas) {
  var t = tabel_(RIASEC_TAB), out = [], kelasAda = {};
  for (var r = t.rows.length - 1; r >= 0; r--) {
    var row = t.rows[r];
    if (!row[0]) continue;
    var k = String(sel_(t, row, 'Kelas') || '').toUpperCase();
    kelasAda[k] = true;
    if (kelas && k !== kelas.toUpperCase()) continue;
    var skor = {};
    RIASEC_URUT.forEach(function (x) { skor[x] = Number(sel_(t, row, x)) || 0; });
    if (out.length < 400) out.push({ kode: teks_(sel_(t, row, 'Kode')), tanggal: tglKey_(sel_(t, row, 'Waktu masuk')), nama: teks_(sel_(t, row, 'Nama')),
      kelas: k, jk: teks_(sel_(t, row, 'Jenis kelamin')), usia: teks_(sel_(t, row, 'Usia')), cita: teks_(sel_(t, row, 'Cita-cita')),
      rencana: teks_(sel_(t, row, 'Rencana setelah SMP')), kodeMinat: teks_(sel_(t, row, 'Kode minat')), seri: teks_(sel_(t, row, 'Skor seri')) === 'YA', skor: skor });
  }
  return { ok: true, items: out, kelas: Object.keys(kelasAda).filter(String).sort() };
}

/* ---------------- Arsip scan dokumen ---------------- */
// File hasil scan/foto disimpan di folder "Arsip Scan Web BK" (di sebelah sheet ini).
// Guru BK membukanya lewat dashboard (lihatScan) atau langsung dari folder Drive BK.
var SCAN_TAB = 'ArsipScan';
var SCAN_FOLDER = 'Arsip Scan Web BK';
var SCAN_MAKS = 10 * 1024 * 1024;
var SCAN_JENIS = ['Surat perjanjian', 'Laporan kejadian', 'Surat panggilan orang tua', 'Surat rujukan', 'Berita acara home visit', 'Lainnya'];
var SCAN_MIME = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function folderScan_() { return subfolder_(SCAN_FOLDER); }

function scanPerNomor_() {
  var t = tabel_(SCAN_TAB), i = kol_(t, 'Nomor terkait'), out = {};
  if (i < 0) return out;
  t.rows.forEach(function (r) { var k = String(r[i] || '').trim().toUpperCase(); if (k) out[k] = (out[k] || 0) + 1; });
  return out;
}

// Nomor unik (KJ-/SP-/PG-/RJ-/HV-...) -> jenis, nama, kelas, tanggal dari tab asalnya.
var NOMOR_SUMBER = [
  { tab: 'LaporanKejadian', jenis: 'Laporan kejadian', tgl: 'Tanggal kejadian' },
  { tab: 'SuratPerjanjian', jenis: 'Surat perjanjian', tgl: 'Tanggal perjanjian' },
  { tab: SURAT_TAB, jenisKol: 'Jenis surat', tgl: 'Tanggal surat' }
];
var JENIS_SURAT_SCAN = { 'Surat rujukan (alih tangan kasus)': 'Surat rujukan' };

function cariNomor_(nomor) {
  nomor = String(nomor || '').trim().toUpperCase();
  if (!/^[A-Z]{2}-\d{8}-\d{3}$/.test(nomor)) return { ok: false, error: 'Format nomor seperti SP-20261029-001.' };
  for (var i = 0; i < NOMOR_SUMBER.length; i++) {
    var s = NOMOR_SUMBER[i], t = tabel_(s.tab);
    for (var r = 0; r < t.rows.length; r++) {
      if (String(t.rows[r][0]).trim().toUpperCase() !== nomor) continue;
      var row = t.rows[r], jenis = s.jenisKol ? String(sel_(t, row, s.jenisKol)) : s.jenis;
      return { ok: true, nomor: nomor, jenis: JENIS_SURAT_SCAN[jenis] || jenis, nama: teks_(sel_(t, row, 'Nama siswa')),
               kelas: teks_(sel_(t, row, 'Kelas')), tanggal: tglKey_(sel_(t, row, s.tgl)), scan: scanPerNomor_()[nomor] || 0 };
    }
  }
  return { ok: false, error: 'Nomor ' + nomor + ' tidak ditemukan. Periksa lagi nomor di surat atau laporan.' };
}

// Semua nomor dokumen (terbaru dulu) untuk pilihan dropdown di menu Arsip scan.
function daftarNomor_() {
  var scan = scanPerNomor_(), out = [];
  NOMOR_SUMBER.forEach(function (s) {
    var t = tabel_(s.tab);
    t.rows.forEach(function (row) {
      var nomor = String(row[0] || '').trim().toUpperCase();
      if (!nomor) return;
      var jenis = s.jenisKol ? String(sel_(t, row, s.jenisKol)) : s.jenis;
      var w = sel_(t, row, 'Waktu input');
      out.push({ nomor: nomor, jenis: JENIS_SURAT_SCAN[jenis] || jenis, nama: teks_(sel_(t, row, 'Nama siswa')),
                 kelas: teks_(sel_(t, row, 'Kelas')), tanggal: tglKey_(sel_(t, row, s.tgl)),
                 urut: isDate_(w) ? w.getTime() : 0, scan: scan[nomor] || 0 });
    });
  });
  out.sort(function (a, b) { return b.urut - a.urut || (a.nomor < b.nomor ? 1 : -1); });
  return { ok: true, items: out.slice(0, 500) };
}

function unggahScan_(u, d) {
  var rec = cariNomor_(d.nomor);
  if (!rec.ok) return rec;
  d.jenis = SCAN_JENIS.indexOf(rec.jenis) >= 0 ? rec.jenis : 'Lainnya';
  d.nama = rec.nama; d.kelas = rec.kelas; d.tanggal = rec.tanggal; d.nomor = rec.nomor;
  var f = d.file || {}, ext = SCAN_MIME[f.type];
  if (!ext) return { ok: false, error: 'Format file harus PDF, JPG, PNG, atau WEBP.' };
  var bytes;
  try { bytes = Utilities.base64Decode(String(f.data || '')); } catch (err) { return { ok: false, error: 'File rusak. Coba pilih ulang.' }; }
  if (!bytes.length) return { ok: false, error: 'File kosong.' };
  if (bytes.length > SCAN_MAKS) return { ok: false, error: 'Ukuran file maksimal 10 MB.' };
  var nomor = d.nomor;
  var file = folderScan_().createFile(Utilities.newBlob(bytes, f.type, 'upload.' + ext));
  var id = tulisBaris_(SCAN_TAB, {
    'Jenis dokumen': d.jenis, 'Nomor terkait': nomor, 'Tanggal dokumen': clean_(d.tanggal),
    'Nama siswa': clean_(d.nama), 'Kelas': clean_(d.kelas), 'Keterangan': clean_(d.keterangan),
    'Nama file asli': clean_(String(f.name || '').slice(0, 150)), 'Ukuran (KB)': Math.round(bytes.length / 1024),
    'Link file (khusus pengelola)': file.getUrl(), 'File ID (jangan diubah)': file.getId(), 'Diunggah oleh': u.nama
  }, 'SC');
  var aman = function (s) { return String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60); };
  file.setName([nomor, aman(d.nama), aman(d.kelas), aman(d.jenis), id].join(' - ') + '.' + ext);
  file.setDescription('Diunggah lewat dashboard guru BK oleh ' + u.nama + (nomor ? ' · terkait ' + nomor : ''));
  return { ok: true, id: id };
}

function barisScan_(t, r) {
  return {
    id: teks_(sel_(t, r, 'ID')), jenis: teks_(sel_(t, r, 'Jenis dokumen')), nomor: teks_(sel_(t, r, 'Nomor terkait')),
    tanggal: tglKey_(sel_(t, r, 'Tanggal dokumen')), nama: teks_(sel_(t, r, 'Nama siswa')), kelas: teks_(sel_(t, r, 'Kelas')),
    keterangan: teks_(sel_(t, r, 'Keterangan')), ukuran: Number(sel_(t, r, 'Ukuran (KB)')) || 0,
    ext: String(teks_(sel_(t, r, 'Nama file asli'))).split('.').pop().toLowerCase(),
    oleh: teks_(sel_(t, r, 'Diunggah oleh')), waktu: teks_(sel_(t, r, 'Waktu input'))
  };
}

// Tanpa kata kunci: 30 terbaru. Dengan kata kunci: cocokkan nama siswa atau nomor terkait.
function daftarScan_(cari) {
  var t = tabel_(SCAN_TAB), q = norm_(cari), nomor = String(cari || '').trim().toUpperCase(), out = [];
  for (var r = t.rows.length - 1; r >= 0 && out.length < 60; r--) {
    var row = t.rows[r];
    if (!row[0]) continue;
    if (q && !cocok_(sel_(t, row, 'Nama siswa'), q) && String(sel_(t, row, 'Nomor terkait')).toUpperCase() !== nomor && String(row[0]).toUpperCase() !== nomor) continue;
    out.push(barisScan_(t, row));
    if (!q && out.length >= 30) break;
  }
  return { ok: true, items: out, jenis: SCAN_JENIS };
}

function cariScan_(id) {
  var t = tabel_(SCAN_TAB);
  for (var r = 0; r < t.rows.length; r++) if (String(t.rows[r][0]).toUpperCase() === id.toUpperCase()) return { t: t, r: r };
  return null;
}

function lihatScan_(id) {
  var s = cariScan_(id);
  if (!s) return { ok: false, error: 'Dokumen tidak ditemukan.' };
  var fid = String(sel_(s.t, s.t.rows[s.r], 'File ID (jangan diubah)'));
  try {
    var f = DriveApp.getFileById(fid);
    if (f.isTrashed()) return { ok: false, error: 'File sudah dihapus dari Drive.' };
    var b = f.getBlob();
    return { ok: true, nama: f.getName(), mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
  } catch (err) {
    return { ok: false, error: 'File tidak dapat dibuka. Mungkin sudah dipindah atau dihapus dari Drive.' };
  }
}

// File dipindah ke Sampah Drive (masih bisa dipulihkan 30 hari), barisnya dihapus.
function hapusScan_(u, id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var s = cariScan_(id);
    if (!s) return { ok: false, error: 'Dokumen tidak ditemukan.' };
    var fid = String(sel_(s.t, s.t.rows[s.r], 'File ID (jangan diubah)'));
    try { DriveApp.getFileById(fid).setTrashed(true); } catch (err) {}
    s.t.sh.deleteRow(s.r + 2);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ================= Jurnal harian guru BK ================= */
var JURNAL_JENIS = ['Layanan klasikal', 'Bimbingan kelompok', 'Konseling individual', 'Konseling kelompok', 'Konsultasi orang tua',
  'Konsultasi guru/wali kelas', 'Mediasi', 'Home visit', 'Asesmen/tes', 'Koordinasi/rapat', 'Administrasi BK', 'Lainnya'];

function simpanJurnal_(u, d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.tanggal || ''))) return { ok: false, error: 'Isi tanggal kegiatan.' };
  if (wajib_(d, ['uraian'])) return { ok: false, error: 'Isi uraian kegiatan.' };
  var id = tulisBaris_(JURNAL_TAB, {
    'Tanggal': d.tanggal, 'Jam': clean_(String(d.jam || '').slice(0, 40)),
    'Jenis kegiatan': JURNAL_JENIS.indexOf(d.jenis) >= 0 ? d.jenis : 'Lainnya',
    'Sasaran': clean_(String(d.sasaran || '').slice(0, 200)), 'Uraian kegiatan': clean_(d.uraian),
    'Hasil': clean_(d.hasil), 'Tindak lanjut': clean_(d.tindak), 'Diinput oleh': u.nama
  }, 'JH');
  return { ok: true, id: id };
}

function daftarJurnal_(dari, sampai) {
  var t = tabel_(JURNAL_TAB), out = [];
  t.rows.forEach(function (r) {
    if (!r[0]) return;
    var tg = tglKey_(sel_(t, r, 'Tanggal'));
    if ((dari && tg < dari) || (sampai && tg > sampai)) return;
    out.push({ id: teks_(r[0]), tanggal: tg, jam: teks_(sel_(t, r, 'Jam')), jenis: teks_(sel_(t, r, 'Jenis kegiatan')),
      sasaran: teks_(sel_(t, r, 'Sasaran')), uraian: teks_(sel_(t, r, 'Uraian kegiatan')), hasil: teks_(sel_(t, r, 'Hasil')),
      tindak: teks_(sel_(t, r, 'Tindak lanjut')), oleh: teks_(sel_(t, r, 'Diinput oleh')) });
  });
  out.sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : (a.jam < b.jam ? -1 : a.jam > b.jam ? 1 : (a.id < b.id ? -1 : 1)); });
  return { ok: true, items: out.slice(-500), jenis: JURNAL_JENIS };
}

function hapusJurnal_(id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var t = tabel_(JURNAL_TAB);
    for (var r = 0; r < t.rows.length; r++) {
      if (String(t.rows[r][0]).toUpperCase() === id.toUpperCase()) { t.sh.deleteRow(r + 2); return { ok: true }; }
    }
    return { ok: false, error: 'Catatan jurnal tidak ditemukan.' };
  } finally {
    lock.releaseLock();
  }
}

/* ================= Akun wali kelas & siswa (bantuan bersama) ================= */
var SESI_PORTAL_DETIK = 6 * 60 * 60;

function cariBaris_(tab, kolom, nilai) {
  var t = tabel_(tab), i = kol_(t, kolom), v = String(nilai || '').trim().toLowerCase();
  if (i < 0 || !v) return null;
  for (var r = 0; r < t.rows.length; r++) {
    if (String(t.rows[r][i]).trim().toLowerCase() === v) return { t: t, r: r, baris: r + 2, row: t.rows[r] };
  }
  return null;
}
function tulisSel_(t, baris, kolom, nilai) {
  var i = kol_(t, kolom); if (i < 0) return;
  t.sh.getRange(baris, i + 1).setNumberFormat('@').setValue(nilai);
}
function tulisBarisKolom_(tab, nilai) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  sh.appendRow(headers.map(function (h) { return nilai.hasOwnProperty(h) ? nilai[h] : ''; }));
}
function emailValid_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120; }
function acak_(abc, n) {
  var s = '', b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random(), Utilities.Charset.UTF_8);
  for (var i = 0; i < n; i++) s += abc.charAt(((b[i] + 256) % 256) % abc.length);
  return s;
}
function saltBaru_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 16); }
function tokenBaru_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }
function sesiPortal_(awalan, token) {
  if (!token || !/^[a-f0-9]{64}$/.test(String(token))) return null;
  var s = CacheService.getScriptCache().get(awalan + token);
  return s ? JSON.parse(s) : null;
}
// Batas percobaan: 5x gagal -> tunggu 15 menit.
function terkunci_(kunci) { return Number(CacheService.getScriptCache().get(kunci) || 0) >= MAKS_GAGAL; }
function catatGagal_(kunci) {
  var c = CacheService.getScriptCache();
  c.put(kunci, String(Number(c.get(kunci) || 0) + 1), KUNCI_DETIK);
  Utilities.sleep(600);
}

// Kelas ditulis bermacam-macam ("7A", "VII A", "7 - A"): samakan dulu sebelum dibandingkan.
function normKelas_(k) {
  var s = String(k || '').toUpperCase().replace(/\bIX\b/, '9').replace(/\bVIII\b/, '8').replace(/\bVII\b/, '7');
  return s.replace(/[^A-Z0-9]/g, '');
}

// Daftar siswa resmi dari tab DataSiswa (kolom A nama, kolom B kelas; kolom berjudul NIS/NISN dipakai bila ada).
function dataSiswa_() {
  var t = tabel_(SISWA_TAB), iNis = -1, iIzin = -1;
  t.h.forEach(function (h, i) { if (iNis < 0 && /^NIS\b/i.test(h)) iNis = i; if (iIzin < 0 && /izin orang ?tua/i.test(h)) iIzin = i; });
  return t.rows.filter(function (r) { return String(r[0] || '').trim(); }).map(function (r) {
    return { nama: rapiNama_(r[0]), kelas: String(r[1] || '').trim().toUpperCase(), nis: iNis >= 0 ? String(r[iNis] || '').trim() : '',
      izin: iIzin < 0 ? null : /^(ya|y|sudah|setuju|1|true)$/i.test(String(r[iIzin]).trim()) };
  });
}
// Opsional: bila tab DataSiswa punya kolom "Izin orang tua", akun portal siswa hanya bisa dipakai bila isinya YA
// (UU 27/2022 Pasal 25). Tanpa kolom itu, semua siswa di DataSiswa bisa mengaktifkan akun.
function izinTercatat_(daftar) { return daftar.some(function (s) { return s.izin !== null; }); }

/* ================= Portal wali kelas ================= */
// Akun dibuat guru BK di dashboard (menu Akun). Wali kelas hanya melihat rujukan miliknya sendiri,
// status, jadwal, dan tanggapan guru BK. Catatan internal guru BK tidak pernah dikirim ke portal ini.
var RUJUKAN_ALASAN = ['Kehadiran/sering terlambat', 'Prestasi belajar menurun', 'Perilaku di kelas', 'Masalah pertemanan/konflik',
  'Dugaan perundungan', 'Perubahan emosi/sikap', 'Masalah keluarga', 'Karier/studi lanjut', 'Lainnya'];
var RUJUKAN_URGENSI = ['Biasa', 'Perlu segera (minggu ini)', 'Darurat (keselamatan siswa)'];

function waliApi_(q) {
  if (q.action === 'login') return loginWali_(String(q.email || ''), String(q.password || ''));
  var u = sesiPortal_('twk_', q.token);
  if (u) {   // akun yang dinonaktifkan guru BK langsung tidak bisa dipakai
    var a = cariBaris_(AKUN_WALI_TAB, 'Email', u.email);
    if (!a || String(sel_(a.t, a.row, 'Aktif')).trim().toUpperCase() !== 'YA') { CacheService.getScriptCache().remove('twk_' + q.token); u = null; }
    else u.kelas = teks_(sel_(a.t, a.row, 'Kelas perwalian'));
  }
  if (!u) return { ok: false, auth: false, error: 'Sesi berakhir. Silakan masuk lagi.' };
  switch (q.action) {
    case 'logout': CacheService.getScriptCache().remove('twk_' + q.token); return { ok: true };
    case 'cekSesi': return infoWali_(u);
    case 'kirimRujukan': return kirimRujukan_(u, q.data || {});
    case 'daftarRujukan': return daftarRujukan_(u);
    case 'gantiPassword': return gantiPasswordWali_(u, String(q.lama || ''), String(q.baru || ''));
  }
  return { ok: false, error: 'Aksi tidak dikenal.' };
}

function infoWali_(u) {
  var k = normKelas_(u.kelas);
  var siswa = k ? dataSiswa_().filter(function (s) { return normKelas_(s.kelas) === k; }).map(function (s) { return s.nama; }) : [];
  return { ok: true, nama: u.nama, email: u.email, kelas: u.kelas, siswa: siswa, alasan: RUJUKAN_ALASAN, urgensi: RUJUKAN_URGENSI };
}

function loginWali_(email, pw) {
  email = email.trim().toLowerCase();
  var kunci = 'failw_' + email;
  if (terkunci_(kunci)) return { ok: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' };
  var a = email ? cariBaris_(AKUN_WALI_TAB, 'Email', email) : null;
  var aktif = a && String(sel_(a.t, a.row, 'Aktif')).trim().toUpperCase() === 'YA';
  if (!a || !aktif || !pw || hash_(String(sel_(a.t, a.row, 'Salt')), pw) !== String(sel_(a.t, a.row, 'Hash password'))) {
    catatGagal_(kunci);
    return { ok: false, error: 'Email atau password salah.' };
  }
  CacheService.getScriptCache().remove(kunci);
  var u = { email: email, nama: teks_(sel_(a.t, a.row, 'Nama')), kelas: teks_(sel_(a.t, a.row, 'Kelas perwalian')) };
  var token = tokenBaru_();
  CacheService.getScriptCache().put('twk_' + token, JSON.stringify(u), SESI_PORTAL_DETIK);
  tulisSel_(a.t, a.baris, 'Terakhir masuk', Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'));
  var info = infoWali_(u);
  info.token = token;
  return info;
}

function gantiPasswordWali_(u, lama, baru) {
  var a = cariBaris_(AKUN_WALI_TAB, 'Email', u.email);
  if (!a || hash_(String(sel_(a.t, a.row, 'Salt')), lama) !== String(sel_(a.t, a.row, 'Hash password'))) return { ok: false, error: 'Password lama salah.' };
  if (baru.length < 8) return { ok: false, error: 'Password baru minimal 8 karakter.' };
  var salt = saltBaru_();
  tulisSel_(a.t, a.baris, 'Salt', salt);
  tulisSel_(a.t, a.baris, 'Hash password', hash_(salt, baru));
  return { ok: true };
}

function kirimRujukan_(u, d) {
  if (wajib_(d, ['nama', 'kelas', 'alasan', 'urgensi', 'diamati'])) return { ok: false, error: 'Lengkapi kolom yang wajib diisi.' };
  if (RUJUKAN_ALASAN.indexOf(d.alasan) < 0 || RUJUKAN_URGENSI.indexOf(d.urgensi) < 0) return { ok: false, error: 'Pilihan tidak valid.' };
  var kode = 'RW-' + acak_('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    tulisBarisKolom_(RUJUKAN_TAB, {
      'Waktu masuk': new Date(), 'Kode': kode, 'Nama wali kelas': u.nama, 'Akun wali kelas': u.email,
      'Nama siswa': clean_(rapiNama_(d.nama)), 'Kelas': clean_(String(d.kelas).toUpperCase().slice(0, 20)),
      'Alasan rujukan': d.alasan, 'Tingkat urgensi': d.urgensi, 'Yang diamati': clean_(d.diamati),
      'Upaya wali kelas': clean_(d.upaya), 'Sudah dibicarakan dengan orang tua?': d.ortu === 'Sudah' ? 'Sudah' : 'Belum', 'Status': 'Baru'
    });
  } finally {
    lock.releaseLock();
  }
  try {
    var darurat = d.urgensi !== 'Biasa';
    // Email hanya berisi kelas, alasan, dan urgensi. Nama siswa dan rinciannya dibaca di dashboard.
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
      (darurat ? '[PENTING] ' : '[Web BK] ') + 'Rujukan wali kelas ' + kode + ' (' + d.urgensi + ')',
      'Ada rujukan baru dari wali kelas ' + u.nama + '.\n\nKelas    : ' + String(d.kelas).toUpperCase() + '\nAlasan   : ' + d.alasan +
      '\nUrgensi  : ' + d.urgensi + '\n\nBuka dashboard guru BK > Kotak masuk > Rujukan wali kelas:\nhttps://farel26.github.io/web-bk-labschool-ciracas/guru.html');
  } catch (err) { /* email opsional */ }
  return { ok: true, kode: kode };
}

function daftarRujukan_(u) {
  var t = tabel_(RUJUKAN_TAB), out = [];
  for (var r = t.rows.length - 1; r >= 0 && out.length < 100; r--) {
    var row = t.rows[r];
    if (!row[0] || String(sel_(t, row, 'Akun wali kelas')).trim().toLowerCase() !== u.email) continue;
    out.push({
      kode: teks_(sel_(t, row, 'Kode')), dikirim: tglKey_(row[0]), nama: teks_(sel_(t, row, 'Nama siswa')), kelas: teks_(sel_(t, row, 'Kelas')),
      alasan: teks_(sel_(t, row, 'Alasan rujukan')), urgensi: teks_(sel_(t, row, 'Tingkat urgensi')),
      status: teks_(sel_(t, row, 'Status')) || 'Baru',
      jadwal: { tanggal: tglKey_(sel_(t, row, 'Jadwal sesi')), jam: teks_(sel_(t, row, 'Jam sesi')), tempat: teks_(sel_(t, row, 'Tempat sesi')),
        bentuk: teks_(sel_(t, row, 'Bentuk sesi')) || 'Tatap muka' },
      tanggapan: teks_(sel_(t, row, 'Tanggapan untuk wali kelas (tampil di portal)')), oleh: teks_(sel_(t, row, 'Ditangani oleh'))
    });
  }
  return { ok: true, items: out };
}

/* ---------- Pengelolaan akun wali kelas (oleh guru BK) ---------- */
function passwordSementara_() { return acak_('abcdefghjkmnpqrstuvwxyz23456789', 4) + '-' + acak_('abcdefghjkmnpqrstuvwxyz23456789', 4) + '-' + acak_('23456789', 2); }

function daftarAkunWali_() {
  var t = tabel_(AKUN_WALI_TAB);
  return { ok: true, items: t.rows.filter(function (r) { return String(r[0] || '').trim(); }).map(function (r) {
    return { email: teks_(r[0]).toLowerCase(), nama: teks_(sel_(t, r, 'Nama')), kelas: teks_(sel_(t, r, 'Kelas perwalian')),
      aktif: teks_(sel_(t, r, 'Aktif')).toUpperCase() === 'YA', terakhir: teks_(sel_(t, r, 'Terakhir masuk')) };
  }).sort(function (a, b) { return normKelas_(a.kelas) < normKelas_(b.kelas) ? -1 : 1; }) };
}

function simpanAkunWali_(u, d) {
  var email = String(d.email || '').trim().toLowerCase();
  if (!emailValid_(email)) return { ok: false, error: 'Email tidak valid.' };
  if (wajib_(d, ['nama', 'kelas'])) return { ok: false, error: 'Isi nama dan kelas perwalian.' };
  var nama = clean_(String(d.nama).slice(0, 100)), kelas = clean_(String(d.kelas).toUpperCase().slice(0, 20));
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var a = cariBaris_(AKUN_WALI_TAB, 'Email', email);
    if (a) {   // akun sudah ada: perbarui nama & kelas saja, password tetap
      tulisSel_(a.t, a.baris, 'Nama', nama);
      tulisSel_(a.t, a.baris, 'Kelas perwalian', kelas);
      return { ok: true, baru: false };
    }
    var pw = passwordSementara_(), salt = saltBaru_();
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AKUN_WALI_TAB);
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    var nilai = { 'Email': email, 'Nama': nama, 'Kelas perwalian': kelas, 'Salt': salt, 'Hash password': hash_(salt, pw), 'Aktif': 'YA',
      'Dibuat oleh': u.nama, 'Waktu dibuat': Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') };
    var baris = sh.getLastRow() + 1;
    sh.getRange(baris, 1, 1, headers.length).setNumberFormat('@').setValues([headers.map(function (h) { return nilai.hasOwnProperty(h) ? nilai[h] : ''; })]);
    return { ok: true, baru: true, password: pw };
  } finally {
    lock.releaseLock();
  }
}

function resetAkunWali_(email) {
  var a = cariBaris_(AKUN_WALI_TAB, 'Email', email);
  if (!a) return { ok: false, error: 'Akun tidak ditemukan.' };
  var pw = passwordSementara_(), salt = saltBaru_();
  tulisSel_(a.t, a.baris, 'Salt', salt);
  tulisSel_(a.t, a.baris, 'Hash password', hash_(salt, pw));
  tulisSel_(a.t, a.baris, 'Aktif', 'YA');
  CacheService.getScriptCache().remove('failw_' + email.trim().toLowerCase());
  return { ok: true, password: pw };
}

function aktifAkunWali_(email, aktif) {
  var a = cariBaris_(AKUN_WALI_TAB, 'Email', email);
  if (!a) return { ok: false, error: 'Akun tidak ditemukan.' };
  tulisSel_(a.t, a.baris, 'Aktif', aktif ? 'YA' : 'TIDAK');
  return { ok: true };
}

/* ================= Portal siswa ================= */
// Siswa mengaktifkan akun sendiri: nama lengkap + kelas harus cocok dengan tab DataSiswa
// (ditambah NIS bila tab itu punya kolom NIS). Satu nama hanya bisa diaktifkan satu kali.
// Masuk dengan email + PIN 6 angka. PIN disimpan sebagai hash, sama seperti password guru.
var TARGET_BIDANG = ['Belajar', 'Pribadi', 'Sosial', 'Karier'];
var TARGET_MAKS = 40;

function siswaApi_(q) {
  if (q.action === 'infoAktivasi') { var ds = dataSiswa_(); return { ok: true, perluNis: ds.some(function (s) { return !!s.nis; }), dibuka: ds.length > 0 }; }
  if (q.action === 'aktivasi') return aktivasiSiswa_(q.data || {});
  if (q.action === 'login') return loginSiswa_(String(q.email || ''), String(q.pin || ''));
  var u = sesiPortal_('tsk_', q.token);
  if (u && !akunSiswaAktif_('ID', u.id)) { CacheService.getScriptCache().remove('tsk_' + q.token); u = null; }   // akun dinonaktifkan guru BK
  if (!u) return { ok: false, auth: false, error: 'Sesi berakhir. Silakan masuk lagi.' };
  switch (q.action) {
    case 'logout': CacheService.getScriptCache().remove('tsk_' + q.token); return { ok: true };
    case 'cekSesi': return { ok: true, nama: u.nama, kelas: u.kelas };
    case 'ringkasan': return ringkasanSiswa_(u);
    case 'ajukanKonseling': return ajukanKonselingSiswa_(u, q.data || {});
    case 'simpanTarget': return simpanTarget_(u, q.data || {});
    case 'tandaiTarget': return ubahTarget_(u, String(q.id || ''), q.selesai === true ? 'selesai' : 'buka');
    case 'hapusTarget': return ubahTarget_(u, String(q.id || ''), 'hapus');
    case 'gantiPin': return gantiPin_(u, String(q.lama || ''), String(q.baru || ''));
    case 'checkin': return checkinSiswa_(u, q.data || {});
    case 'tandaiFormulir': return tandaiFormulir_(u, String(q.id || ''), q.selesai === true);
    case 'lihatHasil': return lihatHasil_(String(q.id || ''), u);
    case 'chatAmbil': return chatAmbil_(u.id, Number(q.sejak) || 0, 'siswa');
    case 'chatKirim': return chatKirimSiswa_(u, String(q.isi || ''));
  }
  return { ok: false, error: 'Aksi tidak dikenal.' };
}

function aktivasiSiswa_(d) {
  if (d.website) return { ok: false, error: 'Permintaan tidak valid.' };     // jebakan bot
  var nama = String(d.nama || '').replace(/\s+/g, ' ').trim(), kelas = normKelas_(d.kelas);
  var email = String(d.email || '').trim().toLowerCase(), pin = String(d.pin || '');
  if (norm_(nama).length < 3 || !kelas) return { ok: false, error: 'Isi nama lengkap dan kelas.' };
  if (!emailValid_(email)) return { ok: false, error: 'Email tidak valid.' };
  if (!/^\d{6}$/.test(pin)) return { ok: false, error: 'PIN harus 6 angka.' };
  if (/^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321') return { ok: false, error: 'PIN terlalu mudah ditebak. Pilih 6 angka lain.' };
  if (d.setuju !== true) return { ok: false, error: 'Centang persetujuan terlebih dahulu.' };
  var kunci = 'faila_' + norm_(nama);
  if (terkunci_(kunci)) return { ok: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit, atau minta bantuan guru BK.' };

  var daftar = dataSiswa_();
  if (!daftar.length) return { ok: false, error: 'Aktivasi belum dibuka. Tanyakan ke guru BK.' };
  var cocok = daftar.filter(function (s) { return norm_(s.nama) === norm_(nama) && normKelas_(s.kelas) === kelas; });
  if (cocok.length !== 1) {
    catatGagal_(kunci);
    return { ok: false, error: 'Nama dan kelas belum cocok dengan data sekolah. Tulis nama lengkap persis seperti di kartu pelajar, lalu periksa kelasnya.' };
  }
  var s = cocok[0];
  if (s.nis && String(d.nis || '').replace(/\D/g, '') !== s.nis.replace(/\D/g, '')) {
    catatGagal_(kunci);
    return { ok: false, error: 'NIS belum cocok dengan data sekolah. Lihat NIS di kartu pelajar atau rapor.' };
  }
  if (s.izin === false) return { ok: false, error: 'Izin orang tuamu untuk portal siswa belum tercatat. Minta surat persetujuan orang tua ke guru BK, lalu coba lagi setelah dikembalikan.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var t = tabel_(AKUN_SISWA_TAB), sudah = false, emailDipakai = false;
    t.rows.forEach(function (r) {
      if (!r[0] || String(sel_(t, r, 'Aktif')).toUpperCase() === 'TIDAK') return;
      if (norm_(sel_(t, r, 'Nama')) === norm_(s.nama) && normKelas_(sel_(t, r, 'Kelas')) === normKelas_(s.kelas)) sudah = true;
      if (String(sel_(t, r, 'Email')).trim().toLowerCase() === email) emailDipakai = true;
    });
    if (sudah) return { ok: false, error: 'Akun untuk nama ini sudah aktif. Silakan masuk. Kalau kamu belum pernah mengaktifkannya, segera beri tahu guru BK.' };
    if (emailDipakai) return { ok: false, error: 'Email ini sudah dipakai akun lain. Gunakan email lain.' };
    var salt = saltBaru_();
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AKUN_SISWA_TAB);
    var id = nextId_(sh, 'SW');
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    var nilai = { 'ID': id, 'Nama': s.nama, 'Kelas': s.kelas, 'Email': email, 'Salt': salt, 'Hash PIN': hash_(salt, pin), 'Aktif': 'YA',
      'Waktu aktivasi': Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') };
    var baris = sh.getLastRow() + 1;
    sh.getRange(baris, 1, 1, headers.length).setNumberFormat('@').setValues([headers.map(function (h) { return nilai.hasOwnProperty(h) ? nilai[h] : ''; })]);
  } finally {
    lock.releaseLock();
  }
  CacheService.getScriptCache().remove(kunci);
  return { ok: true, nama: s.nama, kelas: s.kelas };
}

function loginSiswa_(email, pin) {
  email = email.trim().toLowerCase();
  var kunci = 'fails_' + email;
  if (terkunci_(kunci)) return { ok: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' };
  var a = email ? akunSiswaAktif_('Email', email) : null;
  if (!a || !pin || hash_(String(sel_(a.t, a.row, 'Salt')), pin) !== String(sel_(a.t, a.row, 'Hash PIN'))) {
    catatGagal_(kunci);
    return { ok: false, error: 'Email atau PIN salah.' };
  }
  CacheService.getScriptCache().remove(kunci);
  var u = { id: teks_(sel_(a.t, a.row, 'ID')), nama: teks_(sel_(a.t, a.row, 'Nama')), kelas: teks_(sel_(a.t, a.row, 'Kelas')) };
  var semua = dataSiswa_(), sama = semua.filter(function (s) { return norm_(s.nama) === norm_(u.nama); });
  // Persetujuan orang tua dicabut (kolom Izin orang tua bukan YA) atau siswa sudah tidak terdaftar: akun tidak bisa dipakai.
  if (izinTercatat_(semua) && !sama.some(function (s) { return s.izin === true; }))
    return { ok: false, error: 'Akunmu sedang tidak aktif karena izin orang tua belum atau tidak lagi tercatat. Hubungi guru BK.' };
  // Naik kelas: ikuti kelas terbaru di DataSiswa bila namanya hanya satu.
  if (sama.length === 1 && sama[0].kelas && normKelas_(sama[0].kelas) !== normKelas_(u.kelas)) {
    u.kelas = sama[0].kelas;
    tulisSel_(a.t, a.baris, 'Kelas', u.kelas);
  }
  var token = tokenBaru_();
  CacheService.getScriptCache().put('tsk_' + token, JSON.stringify(u), SESI_PORTAL_DETIK);
  tulisSel_(a.t, a.baris, 'Terakhir masuk', Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'));
  return { ok: true, token: token, nama: u.nama, kelas: u.kelas };
}

function gantiPin_(u, lama, baru) {
  var a = cariBaris_(AKUN_SISWA_TAB, 'ID', u.id);
  if (!a || hash_(String(sel_(a.t, a.row, 'Salt')), lama) !== String(sel_(a.t, a.row, 'Hash PIN'))) return { ok: false, error: 'PIN lama salah.' };
  if (!/^\d{6}$/.test(baru)) return { ok: false, error: 'PIN baru harus 6 angka.' };
  if (/^(\d)\1{5}$/.test(baru) || baru === '123456' || baru === '654321') return { ok: false, error: 'PIN terlalu mudah ditebak. Pilih 6 angka lain.' };
  var salt = saltBaru_();
  tulisSel_(a.t, a.baris, 'Salt', salt);
  tulisSel_(a.t, a.baris, 'Hash PIN', hash_(salt, baru));
  return { ok: true };
}

function ringkasanSiswa_(u) {
  var k = tabel_('Konseling'), pengajuan = [];
  for (var r = k.rows.length - 1; r >= 0 && pengajuan.length < 30; r--) {
    var row = k.rows[r];
    if (!row[0] || String(sel_(k, row, 'Akun siswa')).trim() !== u.id) continue;
    pengajuan.push({ kode: teks_(sel_(k, row, 'Kode')), dikirim: tglKey_(row[0]), topik: teks_(sel_(k, row, 'Topik')),
      waktu: teks_(sel_(k, row, 'Waktu yang diinginkan')), status: teks_(sel_(k, row, 'Status')) || 'Baru',
      jadwal: { tanggal: tglKey_(sel_(k, row, 'Jadwal sesi')), jam: teks_(sel_(k, row, 'Jam sesi')), tempat: teks_(sel_(k, row, 'Tempat sesi')),
        bentuk: teks_(sel_(k, row, 'Bentuk sesi')) || 'Tatap muka', tautan: teks_(sel_(k, row, 'Tautan sesi daring')) },
      pesan: teks_(sel_(k, row, 'Pesan untuk siswa (tampil di web)')) });
  }
  var t = tabel_(TARGET_TAB), target = [];
  t.rows.forEach(function (row) {
    if (!row[0] || String(sel_(t, row, 'Akun siswa')).trim() !== u.id) return;
    target.push({ id: teks_(row[0]), target: teks_(sel_(t, row, 'Target')), bidang: teks_(sel_(t, row, 'Bidang')),
      tenggat: tglKey_(sel_(t, row, 'Tenggat')), selesai: teks_(sel_(t, row, 'Selesai')).toUpperCase() === 'YA' });
  });
  // Hasil tes minat dicocokkan lewat nama yang ditulis siswa saat mengerjakan tes.
  // Bila ada siswa lain dengan nama persis sama, kelasnya juga harus sama.
  var tm = tabel_(RIASEC_TAB), tes = [];
  var kembar = dataSiswa_().filter(function (s) { return norm_(s.nama) === norm_(u.nama); }).length > 1;
  tm.rows.forEach(function (row) {
    if (!row[0] || norm_(sel_(tm, row, 'Nama')) !== norm_(u.nama)) return;
    if (kembar && normKelas_(sel_(tm, row, 'Kelas')) !== normKelas_(u.kelas)) return;
    tes.push({ kode: teks_(sel_(tm, row, 'Kode')), tanggal: tglKey_(sel_(tm, row, 'Waktu masuk')), kodeMinat: teks_(sel_(tm, row, 'Kode minat')) });
  });
  tes.reverse();
  return { ok: true, nama: u.nama, kelas: u.kelas, pengajuan: pengajuan, target: target, tes: tes.slice(0, 5), bidang: TARGET_BIDANG,
    checkin: checkinSiswaRiwayat_(u), hariIni: hariIni_(), formulir: formulirUntuk_(u), hasil: hasilUntuk_(u, kembar),
    chatBaru: chatBelumDibaca_(u.id, 'Guru BK'), perasaan: PERASAAN };
}

function ajukanKonselingSiswa_(u, d) {
  var topik = ['Pribadi', 'Sosial / pertemanan', 'Belajar', 'Karier / pilih sekolah', 'Lainnya'];
  var waktu = ['Istirahat pertama', 'Istirahat kedua', '1 jam setelah pulang sekolah'];
  if (topik.indexOf(d.topik) < 0 || waktu.indexOf(d.waktu) < 0) return { ok: false, error: 'Pilih topik dan waktu.' };
  if (d.setuju !== true) return { ok: false, error: 'Baca dan centang kesepakatan konseling terlebih dahulu.' };
  var ganggu = Math.round(Number(d.ganggu));
  var kode = newCode_();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    tulisBarisKolom_('Konseling', { 'Waktu masuk': new Date(), 'Kode': kode, 'Akun siswa': u.id, 'Nama': u.nama, 'Kelas': u.kelas,
      'Topik': d.topik, 'Waktu yang diinginkan': d.waktu, 'Cerita singkat': clean_(d.cerita), 'Status': 'Baru',
      'Harapan dari sesi': clean_(String(d.harapan || '').slice(0, 500)), 'Sudah cerita ke': clean_(String(d.sudahCerita || '').slice(0, 200)),
      'Seberapa mengganggu (1-5)': ganggu >= 1 && ganggu <= 5 ? ganggu : '', 'Persetujuan asas konseling': 'YA ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') });
  } finally {
    lock.releaseLock();
  }
  notify_('Konseling', {});
  return { ok: true, kode: kode };
}

function simpanTarget_(u, d) {
  var teks = String(d.target || '').trim();
  if (!teks) return { ok: false, error: 'Tulis targetmu dulu.' };
  if (d.tenggat && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.tenggat))) return { ok: false, error: 'Tanggal tidak valid.' };
  var t = tabel_(TARGET_TAB), aktif = 0;
  t.rows.forEach(function (r) { if (r[0] && String(sel_(t, r, 'Akun siswa')) === u.id && String(sel_(t, r, 'Selesai')).toUpperCase() !== 'YA') aktif++; });
  if (aktif >= TARGET_MAKS) return { ok: false, error: 'Targetmu sudah ' + TARGET_MAKS + '. Selesaikan atau hapus beberapa dulu.' };
  var id = tulisBaris_(TARGET_TAB, { 'Akun siswa': u.id, 'Nama': u.nama, 'Kelas': u.kelas, 'Target': clean_(teks.slice(0, 200)),
    'Bidang': TARGET_BIDANG.indexOf(d.bidang) >= 0 ? d.bidang : 'Belajar', 'Tenggat': String(d.tenggat || ''), 'Selesai': '' }, 'TG');
  return { ok: true, id: id };
}

function ubahTarget_(u, id, aksi) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var t = tabel_(TARGET_TAB);
    for (var r = 0; r < t.rows.length; r++) {
      var row = t.rows[r];
      if (String(row[0]).toUpperCase() !== id.toUpperCase()) continue;
      if (String(sel_(t, row, 'Akun siswa')) !== u.id) return { ok: false, error: 'Target tidak ditemukan.' };
      if (aksi === 'hapus') { t.sh.deleteRow(r + 2); return { ok: true }; }
      tulisSel_(t, r + 2, 'Selesai', aksi === 'selesai' ? 'YA' : '');
      tulisSel_(t, r + 2, 'Waktu selesai', aksi === 'selesai' ? Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') : '');
      return { ok: true };
    }
    return { ok: false, error: 'Target tidak ditemukan.' };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Pengelolaan akun siswa (oleh guru BK) ---------- */
function daftarAkunSiswa_(cari) {
  var t = tabel_(AKUN_SISWA_TAB), q = norm_(cari), out = [], total = 0;
  t.rows.forEach(function (r) {
    if (!r[0]) return;
    total++;
    if (q && !cocok_(sel_(t, r, 'Nama'), q) && normKelas_(sel_(t, r, 'Kelas')) !== normKelas_(cari)) return;
    out.push({ id: teks_(r[0]), nama: teks_(sel_(t, r, 'Nama')), kelas: teks_(sel_(t, r, 'Kelas')), email: teks_(sel_(t, r, 'Email')),
      aktif: teks_(sel_(t, r, 'Aktif')).toUpperCase() === 'YA', aktivasi: teks_(sel_(t, r, 'Waktu aktivasi')), terakhir: teks_(sel_(t, r, 'Terakhir masuk')) });
  });
  out.sort(function (a, b) { return a.kelas === b.kelas ? a.nama.localeCompare(b.nama) : (normKelas_(a.kelas) < normKelas_(b.kelas) ? -1 : 1); });
  return { ok: true, items: out.slice(0, 200), total: total };
}

function resetPinSiswa_(id) {
  var a = cariBaris_(AKUN_SISWA_TAB, 'ID', id);
  if (!a) return { ok: false, error: 'Akun tidak ditemukan.' };
  var pin;
  do { pin = acak_('0123456789', 6); } while (/^(\d)\1{5}$/.test(pin));
  var salt = saltBaru_();
  tulisSel_(a.t, a.baris, 'Salt', salt);
  tulisSel_(a.t, a.baris, 'Hash PIN', hash_(salt, pin));
  CacheService.getScriptCache().remove('fails_' + String(sel_(a.t, a.row, 'Email')).trim().toLowerCase());
  return { ok: true, pin: pin, aktif: String(sel_(a.t, a.row, 'Aktif')).trim().toUpperCase() === 'YA' };
}

function aktifAkunSiswa_(id, aktif) {
  var a = cariBaris_(AKUN_SISWA_TAB, 'ID', id);
  if (!a) return { ok: false, error: 'Akun tidak ditemukan.' };
  if (aktif && bentrokSiswa_(a)) return { ok: false, error: 'Siswa ini (atau emailnya) sudah punya akun lain yang aktif. Nonaktifkan akun itu dulu.' };
  tulisSel_(a.t, a.baris, 'Aktif', aktif ? 'YA' : 'TIDAK');
  return { ok: true };
}

// Akun aktif dengan nilai kolom tertentu (akun lama yang dinonaktifkan dilewati).
function akunSiswaAktif_(kolom, nilai) {
  var t = tabel_(AKUN_SISWA_TAB), i = kol_(t, kolom), v = String(nilai || '').trim().toLowerCase();
  if (i < 0 || !v) return null;
  for (var r = 0; r < t.rows.length; r++) {
    var row = t.rows[r];
    if (String(row[i]).trim().toLowerCase() === v && String(sel_(t, row, 'Aktif')).trim().toUpperCase() === 'YA') return { t: t, r: r, baris: r + 2, row: row };
  }
  return null;
}
// Apakah ada akun AKTIF lain dengan nama+kelas atau email yang sama.
function bentrokSiswa_(a) {
  var nama = norm_(sel_(a.t, a.row, 'Nama')), kelas = normKelas_(sel_(a.t, a.row, 'Kelas')), email = String(sel_(a.t, a.row, 'Email')).trim().toLowerCase();
  return a.t.rows.some(function (r, i) {
    if (i === a.r || String(sel_(a.t, r, 'Aktif')).trim().toUpperCase() !== 'YA') return false;
    return (norm_(sel_(a.t, r, 'Nama')) === nama && normKelas_(sel_(a.t, r, 'Kelas')) === kelas) || String(sel_(a.t, r, 'Email')).trim().toLowerCase() === email;
  });
}

/* ================= Check-in emosi harian ================= */
// Siswa memilih suasana hati 1-5 sekali sehari (boleh diubah di hari yang sama).
// Guru BK melihat siswa yang perlu diperhatikan: skor 1-2 hari ini, minta ngobrol, atau 3 check-in terakhir rendah.
var PERASAAN = ['Senang', 'Tenang', 'Bersemangat', 'Lelah', 'Bosan', 'Cemas', 'Sedih', 'Marah', 'Bingung', 'Kesepian'];
var SKOR_LABEL = { 1: 'Sangat berat', 2: 'Kurang baik', 3: 'Biasa saja', 4: 'Baik', 5: 'Sangat baik' };

function checkinSiswa_(u, d) {
  var skor = Math.round(Number(d.skor));
  if (!(skor >= 1 && skor <= 5)) return { ok: false, error: 'Pilih suasana hatimu dulu.' };
  var rasa = [].concat(d.perasaan || []).filter(function (p) { return PERASAAN.indexOf(p) >= 0; }).slice(0, 4).join(', ');
  var ngobrol = d.ngobrol === true ? 'YA' : '';
  var today = hariIni_(), baru = true, sebelumnya = '';
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var t = tabel_(CHECKIN_TAB);
    for (var r = t.rows.length - 1; r >= 0; r--) {
      var row = t.rows[r];
      if (String(sel_(t, row, 'Akun siswa')) !== u.id || tglKey_(sel_(t, row, 'Tanggal')) !== today) continue;
      sebelumnya = String(sel_(t, row, 'Ingin ngobrol'));
      tulisSel_(t, r + 2, 'Skor (1-5)', skor);
      tulisSel_(t, r + 2, 'Perasaan', rasa);
      tulisSel_(t, r + 2, 'Catatan siswa', clean_(String(d.catatan || '').slice(0, 300)));
      tulisSel_(t, r + 2, 'Ingin ngobrol', ngobrol);
      if (skor <= 2 || ngobrol) { tulisSel_(t, r + 2, 'Ditindaklanjuti oleh', ''); tulisSel_(t, r + 2, 'Waktu tindak lanjut', ''); }
      baru = false;
      break;
    }
  } finally {
    lock.releaseLock();
  }
  if (baru) tulisBaris_(CHECKIN_TAB, { 'Tanggal': today, 'Akun siswa': u.id, 'Nama': u.nama, 'Kelas': u.kelas, 'Skor (1-5)': skor,
    'Perasaan': rasa, 'Catatan siswa': clean_(String(d.catatan || '').slice(0, 300)), 'Ingin ngobrol': ngobrol }, 'CE');
  // Email ke guru BK hanya untuk yang paling perlu, berisi inisial dan kelas saja.
  if ((skor === 1 || ngobrol) && !(sebelumnya === 'YA' && ngobrol)) {
    try {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), '[Web BK] Check-in emosi perlu perhatian (' + u.kelas + ')',
        'Siswa ' + inisial_(u.nama) + ' (' + u.kelas + ') ' + (skor === 1 ? 'memilih suasana hati "Sangat berat"' : 'memilih skor ' + skor) +
        (ngobrol ? ' dan ingin ngobrol dengan guru BK' : '') + ' hari ini.\n\nBuka dashboard guru BK > Check-in emosi:\nhttps://farel26.github.io/web-bk-labschool-ciracas/guru.html');
    } catch (err) { /* email opsional */ }
  }
  return { ok: true, riwayat: checkinSiswaRiwayat_(u) };
}

function checkinSiswaRiwayat_(u) {
  var t = tabel_(CHECKIN_TAB), batas = tambahHari_(hariIni_(), -13), out = [];
  t.rows.forEach(function (row) {
    if (String(sel_(t, row, 'Akun siswa')) !== u.id) return;
    var tg = tglKey_(sel_(t, row, 'Tanggal'));
    if (tg < batas) return;
    out.push({ tanggal: tg, skor: Number(sel_(t, row, 'Skor (1-5)')) || 0, perasaan: teks_(sel_(t, row, 'Perasaan')),
      catatan: teks_(sel_(t, row, 'Catatan siswa')), ngobrol: teks_(sel_(t, row, 'Ingin ngobrol')) === 'YA' });
  });
  return out.sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });
}

function checkinRingkas_() {
  var t = tabel_(CHECKIN_TAB), today = hariIni_(), batas = tambahHari_(today, -13), per = {}, kelas = {}, hariIniN = 0;
  t.rows.forEach(function (row, i) {
    if (!row[0]) return;
    var tg = tglKey_(sel_(t, row, 'Tanggal'));
    if (tg < batas) return;
    var akun = String(sel_(t, row, 'Akun siswa')), skor = Number(sel_(t, row, 'Skor (1-5)')) || 0, k = teks_(sel_(t, row, 'Kelas'));
    var s = per[akun] = per[akun] || { akun: akun, nama: teks_(sel_(t, row, 'Nama')), kelas: k, isi: [] };
    s.isi.push({ tanggal: tg, skor: skor, perasaan: teks_(sel_(t, row, 'Perasaan')), catatan: teks_(sel_(t, row, 'Catatan siswa')),
      ngobrol: teks_(sel_(t, row, 'Ingin ngobrol')) === 'YA', tindak: teks_(sel_(t, row, 'Ditindaklanjuti oleh')) });
    if (tg === today) hariIniN++;
    if (tg >= tambahHari_(today, -6)) { var kk = kelas[k] = kelas[k] || { kelas: k, n: 0, total: 0, rendah: 0 }; kk.n++; kk.total += skor; if (skor <= 2) kk.rendah++; }
  });
  var perhatian = [];
  Object.keys(per).forEach(function (a) {
    var s = per[a];
    s.isi.sort(function (x, y) { return x.tanggal < y.tanggal ? -1 : 1; });
    var akhir = s.isi[s.isi.length - 1], tiga = s.isi.slice(-3), alasan = [];
    var belum = s.isi.filter(function (x) { return !x.tindak && (x.skor <= 2 || x.ngobrol); });
    if (!belum.length) return;   // sudah ditindaklanjuti semua
    if (akhir.tanggal === today && akhir.skor <= 2) alasan.push('Hari ini: ' + SKOR_LABEL[akhir.skor].toLowerCase());
    if (belum.some(function (x) { return x.ngobrol; })) alasan.push('Ingin ngobrol dengan guru BK');
    if (tiga.length === 3 && tiga.every(function (x) { return x.skor <= 2; })) alasan.push('3 check-in terakhir rendah');
    if (!alasan.length) alasan.push('Skor rendah dalam 2 minggu terakhir');
    perhatian.push({ akun: s.akun, nama: s.nama, kelas: s.kelas, alasan: alasan, isi: s.isi.slice(-7), terakhir: akhir.tanggal,
      skorTerakhir: akhir.skor, darurat: belum.some(function (x) { return x.skor === 1; }) });
  });
  perhatian.sort(function (a, b) { return (b.darurat - a.darurat) || (a.terakhir < b.terakhir ? 1 : -1); });
  var perKelas = Object.keys(kelas).map(function (k) { var x = kelas[k]; return { kelas: k, n: x.n, rata: Math.round(x.total / x.n * 10) / 10, rendah: x.rendah }; })
    .sort(function (a, b) { return normKelas_(a.kelas) < normKelas_(b.kelas) ? -1 : 1; });
  return { ok: true, hariIni: hariIniN, perhatian: perhatian, perKelas: perKelas, label: SKOR_LABEL };
}

function tandaiCheckin_(u, akun) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var t = tabel_(CHECKIN_TAB), n = 0, waktu = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    t.rows.forEach(function (row, i) {
      if (String(sel_(t, row, 'Akun siswa')) !== akun || teks_(sel_(t, row, 'Ditindaklanjuti oleh'))) return;
      tulisSel_(t, i + 2, 'Ditindaklanjuti oleh', u.nama); tulisSel_(t, i + 2, 'Waktu tindak lanjut', waktu); n++;
    });
    return { ok: true, n: n };
  } finally {
    lock.releaseLock();
  }
}

/* ================= Pembagian formulir (Google Form, angket, asesmen) ================= */
// Sasaran: "Semua", "Kelas 7"/"Kelas 8"/"Kelas 9", atau kelas tertentu seperti "7A". Boleh beberapa, dipisah koma.
// "Sudah mengisi" ditandai siswa sendiri di portal; jawaban aslinya tetap di Google Form.
function cocokSasaran_(sasaran, kelas) {
  var k = normKelas_(kelas);
  return String(sasaran || '').split(/\s*,\s*/).some(function (s) {
    s = String(s).trim(); if (!s) return false;
    if (/^semua/i.test(s)) return true;
    var m = s.match(/^kelas\s*([789])$/i) || s.match(/^([789])$/);
    if (m) return k.charAt(0) === m[1];
    return normKelas_(s) === k;
  });
}

function simpanFormulir_(u, d) {
  if (wajib_(d, ['judul', 'link', 'sasaran'])) return { ok: false, error: 'Isi judul, tautan, dan sasaran.' };
  var link = String(d.link).trim();
  if (!/^https:\/\/[^\s]+$/.test(link)) return { ok: false, error: 'Tautan harus diawali https://' };
  if (d.tenggat && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.tenggat))) return { ok: false, error: 'Tanggal tenggat tidak valid.' };
  var id = tulisBaris_(FORM_TAB, { 'Judul': clean_(String(d.judul).slice(0, 150)), 'Keterangan': clean_(String(d.keterangan || '').slice(0, 500)),
    'Link': link.slice(0, 500), 'Sasaran': clean_(String(d.sasaran).slice(0, 200)), 'Tenggat': String(d.tenggat || ''), 'Aktif': 'YA', 'Dibuat oleh': u.nama }, 'FM');
  return { ok: true, id: id };
}

function formulirTerisi_() {
  var t = tabel_(FORM_ISI_TAB), out = {};
  t.rows.forEach(function (r) {
    var id = String(r[0] || '').toUpperCase(); if (!id) return;
    (out[id] = out[id] || []).push({ akun: String(sel_(t, r, 'Akun siswa')), nama: teks_(sel_(t, r, 'Nama')), kelas: teks_(sel_(t, r, 'Kelas')), waktu: teks_(sel_(t, r, 'Waktu')) });
  });
  return out;
}

function daftarFormulir_() {
  var t = tabel_(FORM_TAB), isi = formulirTerisi_(), siswa = dataSiswa_(), out = [];
  for (var r = t.rows.length - 1; r >= 0; r--) {
    var row = t.rows[r]; if (!row[0]) continue;
    var id = teks_(row[0]), sas = teks_(sel_(t, row, 'Sasaran'));
    out.push({ id: id, judul: teks_(sel_(t, row, 'Judul')), keterangan: teks_(sel_(t, row, 'Keterangan')), link: teks_(sel_(t, row, 'Link')),
      sasaran: sas, tenggat: tglKey_(sel_(t, row, 'Tenggat')), aktif: teks_(sel_(t, row, 'Aktif')).toUpperCase() === 'YA', oleh: teks_(sel_(t, row, 'Dibuat oleh')),
      target: siswa.filter(function (s) { return cocokSasaran_(sas, s.kelas); }).length,
      terisi: (isi[id.toUpperCase()] || []).sort(function (a, b) { return a.kelas === b.kelas ? a.nama.localeCompare(b.nama) : (a.kelas < b.kelas ? -1 : 1); }) });
  }
  return { ok: true, items: out.slice(0, 100) };
}

function aktifFormulir_(id, aktif) {
  var a = cariBaris_(FORM_TAB, 'ID', id);
  if (!a) return { ok: false, error: 'Formulir tidak ditemukan.' };
  tulisSel_(a.t, a.baris, 'Aktif', aktif ? 'YA' : 'TIDAK');
  return { ok: true };
}

function formulirUntuk_(u) {
  var t = tabel_(FORM_TAB), isi = formulirTerisi_(), out = [];
  t.rows.forEach(function (row) {
    if (!row[0] || teks_(sel_(t, row, 'Aktif')).toUpperCase() !== 'YA' || !cocokSasaran_(sel_(t, row, 'Sasaran'), u.kelas)) return;
    var id = teks_(row[0]);
    out.push({ id: id, judul: teks_(sel_(t, row, 'Judul')), keterangan: teks_(sel_(t, row, 'Keterangan')), link: teks_(sel_(t, row, 'Link')),
      tenggat: tglKey_(sel_(t, row, 'Tenggat')), selesai: (isi[id.toUpperCase()] || []).some(function (x) { return x.akun === u.id; }) });
  });
  return out.reverse();
}

function tandaiFormulir_(u, id, selesai) {
  if (!formulirUntuk_(u).some(function (f) { return f.id.toUpperCase() === id.toUpperCase(); })) return { ok: false, error: 'Formulir tidak ditemukan.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var t = tabel_(FORM_ISI_TAB);
    for (var r = t.rows.length - 1; r >= 0; r--) {
      if (String(t.rows[r][0]).toUpperCase() === id.toUpperCase() && String(sel_(t, t.rows[r], 'Akun siswa')) === u.id) {
        if (!selesai) t.sh.deleteRow(r + 2);
        return { ok: true };
      }
    }
    if (selesai) tulisBarisKolom_(FORM_ISI_TAB, { 'ID formulir': id.toUpperCase(), 'Akun siswa': u.id, 'Nama': u.nama, 'Kelas': u.kelas,
      'Waktu': Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') });
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ================= Hasil psikotes ================= */
// File hasil disimpan di folder Drive "Hasil Psikotes Web BK" (di sebelah sheet ini).
// Siswa hanya melihat hasil yang namanya cocok dengan akunnya DAN ditandai "Tampil untuk siswa".
var HASIL_FOLDER = 'Hasil Psikotes Web BK';
var HASIL_JENIS = ['Psikotes', 'Brain Assessment', 'Tes minat dan bakat', 'Lainnya'];

function unggahHasil_(u, d) {
  if (wajib_(d, ['nama', 'kelas'])) return { ok: false, error: 'Isi nama dan kelas siswa.' };
  var f = d.file || {}, ext = SCAN_MIME[f.type];
  if (!ext) return { ok: false, error: 'Format file harus PDF, JPG, PNG, atau WEBP.' };
  var bytes;
  try { bytes = Utilities.base64Decode(String(f.data || '')); } catch (err) { return { ok: false, error: 'File rusak. Coba pilih ulang.' }; }
  if (!bytes.length) return { ok: false, error: 'File kosong.' };
  if (bytes.length > SCAN_MAKS) return { ok: false, error: 'Ukuran file maksimal 10 MB.' };
  var nama = rapiNama_(d.nama), kelas = String(d.kelas).toUpperCase().trim().slice(0, 20);
  var jenis = HASIL_JENIS.indexOf(d.jenis) >= 0 ? d.jenis : 'Psikotes';
  var akun = akunSiswaAktif_('Nama', nama);
  var file = subfolder_(HASIL_FOLDER).createFile(Utilities.newBlob(bytes, f.type, 'upload.' + ext));
  var id = tulisBaris_(HASIL_TAB, {
    'Akun siswa': akun && normKelas_(sel_(akun.t, akun.row, 'Kelas')) === normKelas_(kelas) ? teks_(sel_(akun.t, akun.row, 'ID')) : '',
    'Nama siswa': clean_(nama), 'Kelas': clean_(kelas), 'Jenis tes': jenis,
    'Tanggal tes': /^\d{4}-\d{2}-\d{2}$/.test(String(d.tanggal || '')) ? d.tanggal : '', 'Catatan untuk siswa': clean_(String(d.catatan || '').slice(0, 500)),
    'Tampil untuk siswa': d.tampil === false ? 'TIDAK' : 'YA', 'Nama file asli': clean_(String(f.name || '').slice(0, 150)),
    'Ukuran (KB)': Math.round(bytes.length / 1024), 'Link file (khusus pengelola)': file.getUrl(), 'File ID (jangan diubah)': file.getId(), 'Diunggah oleh': u.nama
  }, 'HP');
  var aman = function (s) { return String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60); };
  file.setName([id, aman(nama), aman(kelas), aman(jenis)].join(' - ') + '.' + ext);
  return { ok: true, id: id };
}

function barisHasil_(t, r) {
  return { id: teks_(r[0]), nama: teks_(sel_(t, r, 'Nama siswa')), kelas: teks_(sel_(t, r, 'Kelas')), jenis: teks_(sel_(t, r, 'Jenis tes')),
    tanggal: tglKey_(sel_(t, r, 'Tanggal tes')), catatan: teks_(sel_(t, r, 'Catatan untuk siswa')),
    tampil: teks_(sel_(t, r, 'Tampil untuk siswa')).toUpperCase() !== 'TIDAK', ukuran: Number(sel_(t, r, 'Ukuran (KB)')) || 0,
    oleh: teks_(sel_(t, r, 'Diunggah oleh')), akun: teks_(sel_(t, r, 'Akun siswa')) };
}

function daftarHasil_(cari) {
  var t = tabel_(HASIL_TAB), q = norm_(cari), out = [];
  for (var r = t.rows.length - 1; r >= 0 && out.length < 200; r--) {
    var row = t.rows[r]; if (!row[0]) continue;
    if (q && !cocok_(sel_(t, row, 'Nama siswa'), q) && normKelas_(sel_(t, row, 'Kelas')) !== normKelas_(cari)) continue;
    out.push(barisHasil_(t, row));
  }
  return { ok: true, items: out, jenis: HASIL_JENIS };
}

// Untuk siswa: cocok lewat akun, atau lewat nama (+ kelas bila ada nama kembar).
function hasilMilik_(t, row, u, kembar) {
  var akun = teks_(sel_(t, row, 'Akun siswa'));
  if (akun) return akun === u.id;
  if (norm_(sel_(t, row, 'Nama siswa')) !== norm_(u.nama)) return false;
  return !kembar || normKelas_(sel_(t, row, 'Kelas')) === normKelas_(u.kelas);
}
function hasilUntuk_(u, kembar) {
  var t = tabel_(HASIL_TAB), out = [];
  t.rows.forEach(function (row) {
    if (!row[0] || teks_(sel_(t, row, 'Tampil untuk siswa')).toUpperCase() === 'TIDAK' || !hasilMilik_(t, row, u, kembar)) return;
    var x = barisHasil_(t, row);
    out.push({ id: x.id, jenis: x.jenis, tanggal: x.tanggal, catatan: x.catatan });
  });
  return out.reverse();
}

function lihatHasil_(id, u) {
  var a = cariBaris_(HASIL_TAB, 'ID', id);
  if (!a) return { ok: false, error: 'Hasil tidak ditemukan.' };
  if (u) {   // siswa: hanya miliknya sendiri yang ditampilkan
    var kembar = dataSiswa_().filter(function (s) { return norm_(s.nama) === norm_(u.nama); }).length > 1;
    if (teks_(sel_(a.t, a.row, 'Tampil untuk siswa')).toUpperCase() === 'TIDAK' || !hasilMilik_(a.t, a.row, u, kembar)) return { ok: false, error: 'Hasil tidak ditemukan.' };
  }
  try {
    var f = DriveApp.getFileById(String(sel_(a.t, a.row, 'File ID (jangan diubah)')));
    if (f.isTrashed()) return { ok: false, error: 'File sudah dihapus dari Drive.' };
    var b = f.getBlob();
    return { ok: true, nama: f.getName(), mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
  } catch (err) {
    return { ok: false, error: 'File tidak dapat dibuka. Hubungi guru BK.' };
  }
}

function tampilHasil_(id, tampil) {
  var a = cariBaris_(HASIL_TAB, 'ID', id);
  if (!a) return { ok: false, error: 'Hasil tidak ditemukan.' };
  tulisSel_(a.t, a.baris, 'Tampil untuk siswa', tampil ? 'YA' : 'TIDAK');
  return { ok: true };
}

function hapusHasil_(id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var a = cariBaris_(HASIL_TAB, 'ID', id);
    if (!a) return { ok: false, error: 'Hasil tidak ditemukan.' };
    try { DriveApp.getFileById(String(sel_(a.t, a.row, 'File ID (jangan diubah)'))).setTrashed(true); } catch (err) {}
    a.t.sh.deleteRow(a.baris);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ================= Chat siswa - guru BK ================= */
// Pesan disimpan di tab PesanChat. Browser menanyakan pesan baru secara berkala (bukan real-time sungguhan),
// jadi balasan muncul dalam beberapa detik selama halaman terbuka.
var CHAT_MAKS = 1000, CHAT_BACA = 3000;

function chatBaris_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHAT_TAB);
  if (!sh || sh.getLastRow() < 2) return { h: [], rows: [], awal: 2, sh: sh };
  var n = sh.getLastColumn(), h = sh.getRange(1, 1, 1, n).getValues()[0].map(function (x) { return String(x).trim(); });
  var awal = Math.max(2, sh.getLastRow() - CHAT_BACA + 1);   // cukup baca pesan terbaru
  return { h: h, rows: sh.getRange(awal, 1, sh.getLastRow() - awal + 1, n).getValues(), awal: awal, sh: sh };
}
function waktuMs_(v) { return isDate_(v) ? v.getTime() : (new Date(v)).getTime() || 0; }

function chatBelumDibaca_(akun, dari) {
  var t = chatBaris_(), n = 0;
  t.rows.forEach(function (r) { if (String(sel_(t, r, 'Akun siswa')) === akun && sel_(t, r, 'Dari') === dari && !sel_(t, r, 'Dibaca')) n++; });
  return n;
}

function chatAmbil_(akun, sejak, peran) {
  if (!akun) return { ok: false, error: 'Percakapan tidak dikenal.' };
  var t = chatBaris_(), out = [], lawan = peran === 'guru' ? 'Siswa' : 'Guru BK', tandai = [];
  t.rows.forEach(function (r, i) {
    if (String(sel_(t, r, 'Akun siswa')) !== akun) return;
    var ms = waktuMs_(sel_(t, r, 'Waktu'));
    if (sel_(t, r, 'Dari') === lawan && !sel_(t, r, 'Dibaca')) tandai.push(t.awal + i);
    if (ms <= sejak) return;
    out.push({ id: teks_(r[0]), waktu: ms, dari: teks_(sel_(t, r, 'Dari')), pengirim: teks_(sel_(t, r, 'Nama pengirim')), isi: teks_(sel_(t, r, 'Isi')) });
  });
  if (tandai.length) {
    var iB = kol_(t, 'Dibaca');
    tandai.forEach(function (row) { t.sh.getRange(row, iB + 1).setValue('YA'); });
  }
  return { ok: true, pesan: out.slice(-200), sekarang: Date.now() };
}

function chatKirim_(akun, isi, dari, pengirim) {
  isi = String(isi || '').trim();
  if (!isi) return { ok: false, error: 'Pesan kosong.' };
  if (isi.length > CHAT_MAKS) return { ok: false, error: 'Pesan terlalu panjang (maksimal ' + CHAT_MAKS + ' karakter).' };
  var a = akunSiswaAktif_('ID', akun);
  if (!a) return { ok: false, error: 'Akun siswa tidak ditemukan atau nonaktif.' };
  var waktu = new Date();
  tulisBaris_(CHAT_TAB, { 'Waktu': waktu, 'Akun siswa': akun, 'Nama': teks_(sel_(a.t, a.row, 'Nama')), 'Kelas': teks_(sel_(a.t, a.row, 'Kelas')),
    'Dari': dari, 'Nama pengirim': pengirim, 'Isi': clean_(isi), 'Dibaca': '' }, 'PC');
  return { ok: true, waktu: waktu.getTime() };
}

function chatKirimSiswa_(u, isi) {
  var c = CacheService.getScriptCache(), k = 'chatn_' + u.id, n = Number(c.get(k) || 0);
  if (n >= 20) return { ok: false, error: 'Kamu sudah mengirim banyak pesan. Tunggu balasan guru BK dulu, ya.' };
  var adaBelum = chatBelumDibaca_(u.id, 'Siswa') > 0;
  var hasil = chatKirim_(u.id, isi, 'Siswa', u.nama);
  if (!hasil.ok) return hasil;
  c.put(k, String(n + 1), 10 * 60);
  if (!adaBelum) {   // satu email per rangkaian pesan, berisi inisial & kelas saja
    try {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), '[Web BK] Pesan baru dari siswa (' + u.kelas + ')',
        'Siswa ' + inisial_(u.nama) + ' (' + u.kelas + ') mengirim pesan lewat portal siswa.\n\nBalas di dashboard guru BK > Chat siswa:\nhttps://farel26.github.io/web-bk-labschool-ciracas/guru.html');
    } catch (err) { /* email opsional */ }
  }
  return hasil;
}

function chatDaftar_() {
  var t = chatBaris_(), per = {};
  t.rows.forEach(function (r) {
    var akun = String(sel_(t, r, 'Akun siswa')); if (!akun) return;
    var c = per[akun] = per[akun] || { akun: akun, nama: '', kelas: '', terakhir: 0, cuplikan: '', dari: '', belum: 0 };
    var ms = waktuMs_(sel_(t, r, 'Waktu'));
    c.nama = teks_(sel_(t, r, 'Nama')); c.kelas = teks_(sel_(t, r, 'Kelas'));
    if (ms >= c.terakhir) { c.terakhir = ms; c.cuplikan = teks_(sel_(t, r, 'Isi')).slice(0, 90); c.dari = teks_(sel_(t, r, 'Dari')); }
    if (sel_(t, r, 'Dari') === 'Siswa' && !sel_(t, r, 'Dibaca')) c.belum++;
  });
  var list = Object.keys(per).map(function (k) { return per[k]; }).sort(function (a, b) { return b.terakhir - a.terakhir; });
  return { ok: true, items: list.slice(0, 100), belum: list.reduce(function (s, c) { return s + c.belum; }, 0) };
}

/* ================= Disposisi, kabar perubahan, hapus data ================= */
function namaGuru_() {
  var t = tabel_(AKUN_TAB);
  return t.rows.filter(function (r) { return String(r[0] || '').trim() && String(sel_(t, r, 'Aktif')).trim().toUpperCase() === 'YA'; })
    .map(function (r) { return teks_(sel_(t, r, 'Nama')); }).filter(String);
}

// Saat status atau jadwal berubah: kabari siswa (bila pengajuan dari akun portal) atau wali kelas.
// Isi email sengaja umum, tanpa nama, topik, atau isi cerita, karena email bisa dibaca anggota keluarga lain.
function kabariPerubahan_(jenis, t, row, status) {
  try {
    var web = 'https://farel26.github.io/web-bk-labschool-ciracas/';
    if (jenis === 'konseling') {
      var akun = String(sel_(t, row, 'Akun siswa') || '');
      var a = akun && akunSiswaAktif_('ID', akun);
      if (!a) return;
      var email = String(sel_(a.t, a.row, 'Email')).trim();
      if (!emailValid_(email)) return;
      MailApp.sendEmail(email, 'Ada kabar dari guru BK untuk pengajuanmu',
        'Halo,\n\nGuru BK SMP Labschool Ciracas memperbarui pengajuan konselingmu (status: ' + status + ').\n' +
        'Masuk ke Portal Siswa untuk melihat jadwal dan pesannya:\n' + web + 'siswa.html\n\nEmail ini dikirim otomatis. Jangan balas email ini; gunakan chat di Portal Siswa.');
    } else if (jenis === 'rujukan') {
      var ew = String(sel_(t, row, 'Akun wali kelas') || '').trim();
      if (!emailValid_(ew)) return;
      MailApp.sendEmail(ew, '[Web BK] Rujukan ' + teks_(sel_(t, row, 'Kode')) + ': ' + status,
        'Guru BK memperbarui rujukan ' + teks_(sel_(t, row, 'Kode')) + ' (status: ' + status + ').\n' +
        'Lihat jadwal dan tanggapan di Portal Wali Kelas:\n' + web + 'wali.html');
    }
  } catch (err) { /* email opsional */ }
}

// Hak subjek data (UU 27/2022 Pasal 8 dan 43): hapus akun portal beserta data yang dibuat lewat portal.
// Catatan layanan BK (pengajuan, laporan, catatan sesi) tetap disimpan sebagai arsip BK, hanya diputus dari akun.
function hapusDataSiswa_(id) {
  if (!id) return { ok: false, error: 'Akun tidak dikenal.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var hasil = {};
    [[AKUN_SISWA_TAB, 'ID'], [TARGET_TAB, 'Akun siswa'], [CHECKIN_TAB, 'Akun siswa'], [CHAT_TAB, 'Akun siswa'], [FORM_ISI_TAB, 'Akun siswa']].forEach(function (x) {
      var t = tabel_(x[0]), i = kol_(t, x[1]), n = 0;
      if (i < 0) return;
      for (var r = t.rows.length - 1; r >= 0; r--) {
        if (String(t.rows[r][i]).trim() === id) { t.sh.deleteRow(r + 2); n++; }
      }
      hasil[x[0]] = n;
    });
    ['Konseling', HASIL_TAB].forEach(function (tab) {
      var t = tabel_(tab), i = kol_(t, 'Akun siswa');
      if (i < 0) return;
      t.rows.forEach(function (r, k) { if (String(r[i]).trim() === id) t.sh.getRange(k + 2, i + 1).setValue(''); });
    });
    if (!hasil[AKUN_SISWA_TAB]) return { ok: false, error: 'Akun tidak ditemukan.' };
    return { ok: true, terhapus: hasil };
  } finally {
    lock.releaseLock();
  }
}

// Akun siswa yang namanya sudah tidak ada di DataSiswa (lulus/pindah). jalankan=false hanya menghitung.
function bersihkanAlumni_(jalankan) {
  var ada = {};
  dataSiswa_().forEach(function (s) { ada[norm_(s.nama)] = 1; });
  var t = tabel_(AKUN_SISWA_TAB), daftar = [];
  t.rows.forEach(function (r) { if (r[0] && !ada[norm_(sel_(t, r, 'Nama'))]) daftar.push({ id: teks_(r[0]), nama: teks_(sel_(t, r, 'Nama')), kelas: teks_(sel_(t, r, 'Kelas')) }); });
  if (!jalankan) return { ok: true, items: daftar };
  daftar.forEach(function (x) { hapusDataSiswa_(x.id); });
  return { ok: true, items: daftar, dihapus: daftar.length };
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
        'Detail lengkap ada di tab "LaporanPerundungan". Mohon ditindaklanjuti hari ini sesuai alur penanganan sekolah.\n' + url);
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
