// Administrasi BK untuk guru: rekap poin (dari Laporan kejadian), mutasi siswa, rencana anggaran BK.
(function () {
  "use strict";
  var URL_API = ((window.BK_CONFIG || {}).SCRIPT_URL || "").trim(), KEY = "bk_guru_sesi";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var sesi = null, tab = "poin", data = {}, kelasPoin = "", dimulai = false;
  var isi = $("ad-isi"), stEl = $("ad-status");
  function status(msg, type) { stEl.textContent = msg || ""; stEl.className = "form-status" + (type ? " " + type : ""); }
  function api(action, extra) {
    var body = { action: action, token: sesi.token };
    for (var k in extra || {}) body[k] = extra[k];
    return fetch(URL_API, { method: "POST", body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.auth === false) { try { sessionStorage.removeItem(KEY); } catch (e) {} location.reload(); throw new Error("auth"); } return d; });
  }
  var kartu = function (judul, html) { return '<section class="card-form" style="padding: 24px; gap: 16px"><h2 class="dash-h" style="font-size: 19px">' + judul + "</h2>" + html + "</section>"; };
  function tbl(kepala, baris, kosong) {
    if (!baris.length) return '<p class="ak-catatan">' + kosong + "</p>";
    return '<div class="table-wrap ak-tabel"><table><thead><tr>' + kepala.map(function (h) { var n = h.charAt(0) === "#"; return "<th" + (n ? ' class="num"' : "") + ' scope="col">' + esc(n ? h.slice(1) : h) + "</th>"; }).join("") + "</tr></thead><tbody>" + baris.join("") + "</tbody></table></div>";
  }
  var num = function (v) { return '<td class="num">' + v + "</td>"; };
  var rp = function (v) { return "Rp" + Math.round(v).toLocaleString("id-ID"); };
  var hariIni = function () { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  var tahunAjaran = function () { var d = new Date(), y = d.getFullYear(); return d.getMonth() >= 6 ? y + "/" + (y + 1) : (y - 1) + "/" + y; };
  var hapusBtn = function (jenis, id) { return '<button type="button" class="btn-mini ak-noprint" data-hapus="' + jenis + '" data-id="' + esc(id) + '" style="min-height: 32px; padding: 0 10px; font-size: 12px">Hapus</button>'; };

  function vPoin() {
    var d = data.poin;
    var pil = '<div class="field ak-noprint" style="max-width: 220px"><label for="ad-kelas">Kelas</label><select id="ad-kelas"><option value="">Semua kelas</option>' + d.kelas.map(function (k) { return "<option" + (k === kelasPoin ? " selected" : "") + ">" + esc(k) + "</option>"; }).join("") + "</select></div>";
    return kartu("Rekap poin pelanggaran", pil + tbl(["No", "Nama", "Kelas", "#Jumlah catatan", "#Total poin", "Rincian"], d.items.map(function (x, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(x.nama) + "</td><td>" + esc(x.kelas) + "</td>" + num(x.catatan.length) + num("<strong>" + x.total + "</strong>") + "<td><details><summary style=\"cursor: pointer; color: #1D3FAE; font-weight: 700\">Lihat</summary>" +
        x.catatan.map(function (c) { return '<p style="margin: 8px 0 0; font-size: 14px; line-height: 1.5">' + esc(c.tanggal) + " · <strong>" + c.poin + " poin</strong> · " + esc(c.kode) + '<br><span class="muted">' + esc(c.id) + " · " + esc(c.uraian) + "</span></p>"; }).join("") + "</details></td></tr>";
    }), "Belum ada laporan kejadian yang diberi poin" + (kelasPoin ? " di kelas ini." : ".")) +
      '<p class="ak-catatan">Poin berasal dari menu Laporan kejadian di dashboard: saat menulis laporan, pilih “Butir pelanggaran dan poin”. Jadi tidak ada pencatatan ganda. Daftar butir dan besar poinnya ada di tab <strong>KatalogPoin</strong> pada Sheet. Isi awalnya diambil dari contoh di Excel BK ALMaS, bukan tata tertib SMP Labschool Ciracas, jadi sesuaikan dulu sebelum dipakai. Batas poin untuk panggilan orang tua atau sanksi juga mengikuti tata tertib sekolah, karena itu tidak saya tetapkan di sini.</p>');
  }

  function vMutasi() {
    var d = data.mutasi;
    return kartu("Catat mutasi siswa", '<form id="form-mutasi" novalidate style="display: flex; flex-direction: column; gap: 16px"><div class="ak-g2">' +
      '<div class="field"><label for="mt-tanggal">Tanggal</label><input id="mt-tanggal" type="date" value="' + hariIni() + '" required></div>' +
      '<div class="field"><label for="mt-jenis">Jenis</label><select id="mt-jenis"><option>Masuk</option><option>Keluar</option></select></div>' +
      '<div class="field"><label for="mt-nama">Nama siswa</label><input id="mt-nama" type="text" maxlength="120" required></div>' +
      '<div class="field"><label for="mt-kelas">Kelas</label><input id="mt-kelas" type="text" maxlength="10" placeholder="mis. 8B" required></div>' +
      '<div class="field"><label for="mt-sekolah">Sekolah asal atau tujuan</label><input id="mt-sekolah" type="text" maxlength="200"></div>' +
      '<div class="field"><label for="mt-surat">Nomor surat (opsional)</label><input id="mt-surat" type="text" maxlength="120"></div>' +
      '<div class="field" style="grid-column: 1 / -1"><label for="mt-alasan">Alasan</label><textarea id="mt-alasan" rows="2" maxlength="500"></textarea></div></div>' +
      '<button type="submit" class="btn-solid" style="align-self: flex-start">Simpan mutasi</button></form>' +
      '<p class="ak-catatan">Catatan ini tidak mengubah daftar kelas. Setelah siswa masuk atau keluar, perbarui juga tab <strong>DataSiswa</strong> di Sheet supaya aktivasi akun dan pilihan nama di sosiometri ikut benar.</p>') +
      kartu("Riwayat mutasi", tbl(["Tanggal", "Jenis", "Nama", "Kelas", "Sekolah asal/tujuan", "Alasan", "Nomor surat", ""], d.items.map(function (x) {
        return "<tr><td>" + esc(x.tanggal) + "</td><td>" + '<span class="pill ' + (x.jenis === "Masuk" ? "pill-selesai" : "pill-c") + '">' + esc(x.jenis) + "</span></td><td>" + esc(x.nama) + "</td><td>" + esc(x.kelas) + "</td><td>" + (esc(x.sekolah) || "–") + "</td><td>" + (esc(x.alasan) || "–") + "</td><td>" + (esc(x.surat) || "–") + "</td><td>" + hapusBtn("Mutasi", x.id) + "</td></tr>";
      }), "Belum ada catatan mutasi."));
  }

  var taPilih = "";
  function vAnggaran() {
    var d = data.anggaran, th = {}; d.items.forEach(function (x) { th[x.tahun] = 1; });
    var daftarTa = Object.keys(th).sort().reverse();
    if (!taPilih || (!th[taPilih] && daftarTa.length)) taPilih = daftarTa[0] || tahunAjaran();
    var rows = d.items.filter(function (x) { return x.tahun === taPilih; }), total = rows.reduce(function (a, x) { return a + x.total; }, 0);
    return kartu("Tambah kebutuhan", '<form id="form-anggaran" novalidate style="display: flex; flex-direction: column; gap: 16px"><div class="ak-g2">' +
      '<div class="field"><label for="ag-tahun">Tahun ajaran</label><input id="ag-tahun" type="text" value="' + esc(taPilih) + '" placeholder="2026/2027" required></div>' +
      '<div class="field"><label for="ag-kebutuhan">Kebutuhan</label><input id="ag-kebutuhan" type="text" maxlength="200" placeholder="mis. Home visit" required></div>' +
      '<div class="field"><label for="ag-harga">Harga satuan (Rp)</label><input id="ag-harga" type="number" min="0" inputmode="numeric" required></div>' +
      '<div class="field"><label for="ag-jumlah">Jumlah</label><input id="ag-jumlah" type="number" min="1" inputmode="numeric" value="1" required></div>' +
      '<div class="field"><label for="ag-satuan">Satuan</label><input id="ag-satuan" type="text" maxlength="40" placeholder="mis. Paket, Buah, Kunjungan"></div>' +
      '<div class="field"><label for="ag-ket">Keterangan (opsional)</label><input id="ag-ket" type="text" maxlength="300"></div></div>' +
      '<button type="submit" class="btn-solid" style="align-self: flex-start">Tambah ke anggaran</button></form>') +
      kartu("Rencana anggaran BK " + esc(taPilih), (daftarTa.length > 1 ? '<div class="field ak-noprint" style="max-width: 220px"><label for="ad-ta">Tahun ajaran</label><select id="ad-ta">' + daftarTa.map(function (t) { return "<option" + (t === taPilih ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + "</select></div>" : "") +
        tbl(["No", "Kebutuhan", "#Harga satuan", "#Jumlah", "Satuan", "#Total", "Keterangan", ""], rows.map(function (x, i) {
          return "<tr><td>" + (i + 1) + "</td><td>" + esc(x.kebutuhan) + "</td>" + num(rp(x.harga)) + num(x.jumlah) + "<td>" + esc(x.satuan) + "</td>" + num(rp(x.total)) + "<td>" + (esc(x.ket) || "–") + "</td><td>" + hapusBtn("Anggaran", x.id) + "</td></tr>";
        }).concat(rows.length ? ['<tr><td colspan="5"><strong>Jumlah seluruhnya</strong></td><td class="num"><strong>' + rp(total) + '</strong></td><td colspan="2"></td></tr>'] : []), "Belum ada kebutuhan untuk tahun ajaran ini.") +
        (rows.length ? '<button type="button" class="btn-line ak-noprint" id="ad-cetak" style="align-self: flex-start">Cetak</button>' : ""));
  }

  function vPeta() {
    var t = [["Catatan konseling individu dan kelompok", "Dashboard → Jurnal harian (jenis Konseling individual / kelompok), dan Pemantauan untuk catatan perkembangan tiap sesi", "JurnalHarian, CatatanPerkembangan, Konseling"],
      ["Kunjungan rumah (home visit)", "Dashboard → Surat lain → Berita acara home visit, dan Jurnal harian jenis Home visit", "SuratLain, JurnalHarian"],
      ["Panggilan orang tua, surat perjanjian", "Dashboard → Surat lain dan Surat perjanjian", "SuratLain, SuratPerjanjian"],
      ["Poin pelanggaran", "Dashboard → Laporan kejadian (pilih butir pelanggaran), rekapnya di halaman ini", "LaporanKejadian, KatalogPoin"],
      ["Mutasi siswa", "Halaman ini → Mutasi siswa", "MutasiSiswa"],
      ["Taksasi dana", "Halaman ini → Anggaran BK", "AnggaranBK"],
      ["AKPD, DCM, sosiometri, data diri siswa", "Dashboard → Hasil angket", "AngketAKPD, AngketDCM, AngketSosiometri, LatarBelakangSiswa"],
      ["Penjurusan", "Belum dipasang. Rumus di Excel dibuat untuk pemilihan jurusan SMA dari nilai rapor. Untuk SMP, arah minat siswa sudah tersedia di Dashboard → Tes minat.", "–"]];
    return kartu("Di mana tiap bagian Excel BK ALMaS sekarang berada", tbl(["Bagian di Excel", "Tempatnya di web", "Tab di Sheet"], t.map(function (x) { return "<tr><td><strong>" + x[0] + "</strong></td><td>" + x[1] + "</td><td>" + x[2] + "</td></tr>"; }), ""));
  }

  function gambar() {
    document.querySelectorAll("#ad-tabs .rg-subtab").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false"); });
    isi.innerHTML = tab === "peta" ? vPeta() : !data[tab] ? "" : tab === "mutasi" ? vMutasi() : tab === "anggaran" ? vAnggaran() : vPoin();
  }
  function muat(pesan) {
    if (tab === "peta") { status(""); gambar(); return Promise.resolve(); }
    status("Memuat…");
    var p = tab === "poin" ? api("rekapPoin", { kelas: kelasPoin }) : tab === "mutasi" ? api("daftarMutasi") : api("daftarAnggaran"), t = tab;
    return p.then(function (d) {
      if (!d.ok) { status(d.error || "Data belum bisa dimuat.", "err"); return; }
      data[t] = d; status(pesan || "", pesan ? "ok" : ""); gambar();
    }).catch(function (e) { if (e.message !== "auth") status("Koneksi bermasalah. Coba muat ulang.", "err"); });
  }
  function kirim(form, action, payload, pesan) {
    var btn = form.querySelector("button[type=submit]"), bad = null;
    form.querySelectorAll("[required]").forEach(function (f) { var k = !String(f.value || "").trim(); f.setAttribute("aria-invalid", k ? "true" : "false"); if (k && !bad) bad = f; });
    if (bad) { status("Lengkapi kolom yang wajib diisi.", "err"); bad.focus(); return; }
    btn.disabled = true; status("Menyimpan…");
    api(action, { data: payload }).then(function (d) {
      btn.disabled = false;
      if (!d.ok) { status(d.error || "Belum tersimpan.", "err"); return; }
      return muat(pesan + " Nomor " + d.id + ".");
    }).catch(function (e) { btn.disabled = false; if (e.message !== "auth") status("Koneksi bermasalah, data belum tersimpan. Coba lagi.", "err"); });
  }
  var v = function (id) { return $(id).value.trim(); };
  isi.addEventListener("submit", function (e) {
    e.preventDefault();
    if (e.target.id === "form-mutasi") kirim(e.target, "simpanMutasi", { tanggal: v("mt-tanggal"), jenis: v("mt-jenis"), nama: v("mt-nama"), kelas: v("mt-kelas"), sekolah: v("mt-sekolah"), surat: v("mt-surat"), alasan: v("mt-alasan") }, "Mutasi tersimpan.");
    if (e.target.id === "form-anggaran") { taPilih = v("ag-tahun"); kirim(e.target, "simpanAnggaran", { tahun: v("ag-tahun"), kebutuhan: v("ag-kebutuhan"), harga: v("ag-harga"), jumlah: v("ag-jumlah"), satuan: v("ag-satuan"), ket: v("ag-ket") }, "Kebutuhan ditambahkan."); }
  });
  isi.addEventListener("change", function (e) {
    if (e.target.id === "ad-kelas") { kelasPoin = e.target.value; muat(); }
    if (e.target.id === "ad-ta") { taPilih = e.target.value; gambar(); }
  });
  isi.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.id === "ad-cetak") window.print();
    if (b.dataset.hapus) {
      if (b.dataset.yakin !== "1") { b.dataset.yakin = "1"; b.textContent = "Yakin hapus?"; setTimeout(function () { if (b.isConnected) { b.dataset.yakin = ""; b.textContent = "Hapus"; } }, 4000); return; }
      b.disabled = true;
      api("hapus" + b.dataset.hapus, { id: b.dataset.id }).then(function (d) { if (d.ok) muat("Baris dihapus."); else { b.disabled = false; status(d.error, "err"); } }).catch(function () { b.disabled = false; });
    }
  });
  $("ad-tabs").addEventListener("click", function (e) { var b = e.target.closest(".rg-subtab"); if (b) { tab = b.dataset.tab; gambar(); muat(); } });

  // Dibuka dari menu "Poin, mutasi, dana" di Ruang Guru BK (guru.html), setelah guru masuk.
  window.BK_PANEL = window.BK_PANEL || {};
  window.BK_PANEL.admin = function () {
    try { sesi = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { sesi = null; }
    if (!sesi || !sesi.token) return;
    if (!URL_API) { status("Halaman ini belum bisa dibuka.", "err"); return; }
    if (!dimulai) { dimulai = true; muat(); }
  };
  (window.BK_PANEL_RESET = window.BK_PANEL_RESET || []).push(function () { dimulai = false; data = {}; tab = "poin"; kelasPoin = ""; isi.innerHTML = ""; status(""); });
})();
