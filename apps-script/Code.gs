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
  // Permintaan dari dashboard guru BK dikirim sebagai JSON.
  var raw = e && e.postData && e.postData.contents;
  if (raw && raw.charAt(0) === '{') {
    try { return json_(guruApi_(JSON.parse(raw))); }
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
    isi: ['Nama orang tua/wali', 'Catatan guru BK'], status: 'Status' }
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
  konseling: { tab: 'Konseling', status: ['Baru', 'Dijadwalkan', 'Selesai'], judul: 'Topik',
    catatan: 'Catatan tindak lanjut', oleh: 'Ditangani oleh',
    tampil: ['Nama', 'Kelas', 'Topik', 'Waktu yang diinginkan', 'Cerita singkat'] },
  janji: { tab: 'JanjiOrangTua', status: ['Baru', 'Dijadwalkan', 'Selesai'], judul: 'Keperluan',
    catatan: 'Catatan guru BK',
    tampil: ['Nama orang tua/wali', 'Nama siswa', 'Kelas', 'Nomor WhatsApp', 'Keperluan', 'Waktu yang diinginkan'] }
};

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
    list.push({
      ref: (r + 2) + '|' + stamp_(row[0]), waktu: teks_(row[0]), status: st, judul: teks_(sel_(t, row, c.judul)),
      isi: c.tampil.map(function (k) { return { label: k, teks: teks_(sel_(t, row, k)) }; }).filter(function (x) { return x.teks; }),
      balasan: c.balas ? teks_(sel_(t, row, c.balas)) : null, catatan: teks_(sel_(t, row, c.catatan)),
      oleh: c.oleh ? teks_(sel_(t, row, c.oleh)) : ''
    });
  }
  return { ok: true, items: list, pilihanStatus: c.status, adaBalasan: !!c.balas, baru: hitungBaru_() };
}

function perbarui_(u, jenis, ref, d) {
  var c = INBOX[jenis];
  if (!c) return { ok: false, error: 'Kotak masuk tidak dikenal.' };
  if (c.status.indexOf(d.status) < 0) return { ok: false, error: 'Status tidak valid.' };
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
    function tulis(kolom, nilai) { var i = kol_(t, kolom); if (i >= 0) t.sh.getRange(row, i + 1).setValue(nilai); }
    tulis('Status', d.status);
    if (c.balas && d.balasan != null) tulis(c.balas, clean_(d.balasan));
    if (d.catatan != null) tulis(c.catatan, clean_(d.catatan));
    if (c.oleh) tulis(c.oleh, u.nama);
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
      rencana: teks_(sel_(cat, r, 'Rencana tindak lanjut')), status: teks_(sel_(cat, r, 'Status kasus')), oleh: teks_(sel_(cat, r, 'Diinput oleh'))
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
  return { ok: true, items: items.slice(0, 150), hariIni: today, terlambat: terlambat, segera: segera, aktif: aktif, pilihanStatus: STATUS_KASUS };
}

function tambahCatatan_(u, d) {
  var nomor = String(d.nomor || '').trim().toUpperCase();
  if (wajib_(d, ['nomor', 'tanggal', 'catatan'])) return { ok: false, error: 'Isi tanggal dan catatan perkembangan.' };
  if (STATUS_KASUS.indexOf(d.status) < 0) return { ok: false, error: 'Status tidak valid.' };
  var pantau = /^\d{4}-\d{2}-\d{2}$/.test(d.pantau || '') && d.status !== 'Selesai' ? d.pantau : '';
  var kej = tabel_('LaporanKejadian'), r = -1;
  for (var i = 0; i < kej.rows.length; i++) if (String(kej.rows[i][0]).trim().toUpperCase() === nomor) { r = i; break; }
  if (r < 0) return { ok: false, error: 'Laporan ' + nomor + ' tidak ditemukan.' };
  var row = kej.rows[r];
  var id = tulisBaris_(CATATAN_TAB, {
    'Nomor kasus': nomor, 'Tanggal': clean_(d.tanggal), 'Nama siswa': String(sel_(kej, row, 'Nama siswa')), 'Kelas': String(sel_(kej, row, 'Kelas')),
    'Catatan perkembangan': clean_(d.catatan), 'Rencana tindak lanjut': clean_(d.rencana), 'Pantau berikutnya': pantau,
    'Status kasus': d.status, 'Diinput oleh': u.nama
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
