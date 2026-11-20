// Portal wali kelas: masuk, kirim rujukan, pantau status & tanggapan guru BK.
(function () {
  "use strict";
  var URL_API = ((window.BK_CONFIG || {}).SCRIPT_URL || "").trim();
  var J = window.BK_JADWAL, esc = J.esc;
  var KEY = "bk_wali_sesi";
  var sesi = null;
  var $ = function (id) { return document.getElementById(id); };

  function simpanSesi(s) { sesi = s; try { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY); } catch (e) {} }
  function bacaSesi() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function status(el, msg, type) { el.textContent = msg || ""; el.className = "form-status" + (type ? " " + type : ""); }
  function sibuk(btn, on, teks) {
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = teks || "Memproses…"; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }
  function tandaiWajib(form) {
    var bad = null;
    form.querySelectorAll("[required]").forEach(function (f) {
      var kosong = !String(f.value || "").trim();
      f.setAttribute("aria-invalid", kosong ? "true" : "false");
      if (kosong && !bad) bad = f;
      f.addEventListener("input", function () { f.setAttribute("aria-invalid", "false"); }, { once: true });
      f.addEventListener("change", function () { f.setAttribute("aria-invalid", "false"); }, { once: true });
    });
    return bad;
  }
  function api(action, extra) {
    var body = { peran: "wali", action: action };
    if (sesi && sesi.token) body.token = sesi.token;
    for (var k in extra || {}) body[k] = extra[k];
    return fetch(URL_API, { method: "POST", body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.auth === false) { keluar(d.error); throw new Error("auth"); } return d; });
  }

  // Pilihan kelas rujukan: semua kelas dari tab DataSiswa, kelas perwalian terpilih otomatis.
  var daftarKelas = null;
  function urutKelas(a, b) { return (parseInt(a, 10) - parseInt(b, 10)) || (a < b ? -1 : a > b ? 1 : 0); }
  function isiKelasRujukan(kelasSaya) {
    var sel = $("r-kelas");
    function isi(list) {
      var semua = list.slice();
      if (kelasSaya && semua.indexOf(kelasSaya) < 0) semua.push(kelasSaya);
      semua.sort(urutKelas);
      var nilai = sel.value || kelasSaya;
      sel.innerHTML = '<option value="">Pilih kelas</option>' + semua.map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + "</option>"; }).join("");
      sel.value = nilai;
    }
    isi(daftarKelas || []);
    if (daftarKelas) return;
    fetch(URL_API, { method: "POST", body: JSON.stringify({ peran: "siswa", action: "infoAktivasi" }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok && (d.kelas || []).length) { daftarKelas = d.kelas; isi(daftarKelas); } })
      .catch(function () {});
  }

  /* ---------- Masuk & keluar ---------- */
  function tampilPortal(info) {
    sesi.nama = info.nama; sesi.kelas = info.kelas;
    simpanSesi(sesi);
    $("panel-masuk").hidden = true; $("panel-portal").hidden = false;
    $("nama-wali").textContent = info.nama;
    $("kelas-wali").textContent = info.kelas ? "Wali kelas " + info.kelas : "Wali kelas";
    isiKelasRujukan(info.kelas || "");
    $("dl-siswa-kelas").innerHTML = (info.siswa || []).map(function (n) { return '<option value="' + esc(n) + '">'; }).join("");
    $("r-nama-hint").textContent = (info.siswa || []).length ? "Ketik untuk memilih dari " + info.siswa.length + " siswa kelas " + info.kelas + "." : "Tulis nama lengkap siswa.";
    var al = $("r-alasan");
    if (al.options.length <= 1) (info.alasan || []).forEach(function (a) { var o = document.createElement("option"); o.textContent = a; al.appendChild(o); });
    var ug = $("r-urgensi");
    if (!ug.children.length) {
      ug.innerHTML = (info.urgensi || []).map(function (u, i) {
        return '<label class="seg-radio"><input type="radio" name="r-urgensi" value="' + esc(u) + '"' + (i ? "" : " checked") + "> " + esc(u) + "</label>";
      }).join("");
    }
    muatDaftar();
  }

  function keluar(pesan) {
    KELAS = null; $("kelas-isi").innerHTML = ""; $("poin-isi").innerHTML = ""; pilihTabWali("rujukan");
    if (sesi && sesi.token && !pesan) api("logout").catch(function () {});
    simpanSesi(null);
    $("panel-portal").hidden = true; $("panel-masuk").hidden = false;
    $("form-masuk").reset(); $("daftar-rujukan").innerHTML = "";
    status($("masuk-status"), pesan || "", pesan ? "err" : "");
    $("m-email").focus();
  }

  $("form-masuk").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("masuk-status"), btn = this.querySelector("button[type=submit]");
    if (tandaiWajib(this)) { status(st, "Isi email dan password.", "err"); return; }
    if (!URL_API) { status(st, "Layanan belum tersambung.", "err"); return; }
    sibuk(btn, true, "Masuk…"); status(st, "");
    api("login", { email: $("m-email").value, password: $("m-pass").value }).then(function (d) {
      if (!d.ok) { status(st, d.error || "Gagal masuk.", "err"); $("m-pass").value = ""; $("m-pass").focus(); return; }
      simpanSesi({ token: d.token });
      tampilPortal(d);
    }).catch(function () { status(st, "Koneksi bermasalah. Coba lagi.", "err"); }).finally(function () { sibuk(btn, false); });
  });
  $("btn-keluar").addEventListener("click", function () { keluar(); });

  /* ---------- Rujukan ---------- */
  $("r-urgensi").addEventListener("change", function () {
    var v = (document.querySelector("input[name=r-urgensi]:checked") || {}).value || "";
    $("r-darurat").hidden = !/^Darurat/.test(v);
  });

  $("form-rujukan").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("rujukan-status"), btn = f.querySelector("button[type=submit]");
    var bad = tandaiWajib(f);
    if (bad) { status(st, "Lengkapi nama siswa, kelas, alasan, dan hal yang Anda amati.", "err"); bad.focus(); return; }
    var data = { nama: $("r-nama").value.trim(), kelas: $("r-kelas").value.trim(), alasan: $("r-alasan").value,
      urgensi: (document.querySelector("input[name=r-urgensi]:checked") || {}).value || "Biasa",
      diamati: $("r-diamati").value, upaya: $("r-upaya").value, ortu: (document.querySelector("input[name=r-ortu]:checked") || {}).value };
    sibuk(btn, true, "Mengirim…"); status(st, "");
    api("kirimRujukan", { data: data }).then(function (d) {
      if (!d.ok) { status(st, d.error || "Gagal mengirim.", "err"); return; }
      ["r-nama", "r-diamati", "r-upaya"].forEach(function (id) { $(id).value = ""; });
      $("r-alasan").value = "";
      var ug = document.querySelector("input[name=r-urgensi]"); if (ug) ug.checked = true;
      $("r-darurat").hidden = true;
      status(st, "Rujukan untuk " + data.nama + " terkirim (" + d.kode + "). Guru BK sudah diberi tahu lewat email.", "ok");
      return muatDaftar();
    }).catch(function (err) { if (err.message !== "auth") status(st, "Belum terkirim karena koneksi. Coba lagi.", "err"); })
      .finally(function () { sibuk(btn, false); });
  });

  function muatDaftar() {
    var box = $("daftar-rujukan");
    box.innerHTML = '<p class="muted">Memuat…</p>';
    return api("daftarRujukan").then(function (d) {
      if (!d.ok) { box.innerHTML = '<p class="muted">' + esc(d.error) + "</p>"; return; }
      if (!d.items.length) {
        box.innerHTML = '<div class="kosong"><strong>Belum ada rujukan.</strong><span>Rujukan yang Anda kirim akan tampil di sini beserta status dan tanggapan guru BK.</span></div>';
        return;
      }
      box.innerHTML = '<ul class="daftar-ajuan">' + d.items.map(function (x) {
        var urg = /^Darurat/.test(x.urgensi) ? "pill-darurat" : /^Perlu/.test(x.urgensi) ? "pill-segera" : "";
        return "<li><div class=\"ajuan-kepala\"><div><h3>" + esc(x.nama) + " · " + esc(x.kelas) + "</h3><p>" + esc(x.alasan) + " · dikirim " + esc(J.tglPanjang(x.dikirim)) +
          '</p></div><span class="kode-kecil">' + esc(x.kode) + "</span></div>" +
          (urg ? '<p style="margin:0"><span class="pill ' + urg + '">' + esc(x.urgensi) + "</span></p>" : "") +
          J.langkah("rujukan", x.status) +
          J.kartuJadwal(x.status !== "Selesai" ? x.jadwal : null, "Siswa dijadwalkan bertemu guru BK") +
          J.pesan("Tanggapan guru BK" + (x.oleh ? " · " + x.oleh : ""), x.tanggapan) + "</li>";
      }).join("") + "</ul>";
    }).catch(function (err) { if (err.message !== "auth") box.innerHTML = '<p class="muted">Gagal memuat. Coba lagi.</p>'; });
  }
  $("btn-muat").addEventListener("click", muatDaftar);

  /* ---------- Tab: Rujukan · Daftar kelas · Poin kelas ---------- */
  var KELAS = null, tabWali = "rujukan";
  function pilihTabWali(t) {
    tabWali = t;
    ["rujukan", "kelas", "poin"].forEach(function (x) {
      var b = $("wt-" + x), aktif = x === t;
      b.setAttribute("aria-selected", aktif ? "true" : "false"); b.tabIndex = aktif ? 0 : -1;
      $("wp-" + x).hidden = !aktif;
    });
    if (t !== "rujukan" && !KELAS) muatKelas(); else if (t !== "rujukan") gambarKelas();
  }
  $("wali-tabs").addEventListener("click", function (e) { var b = e.target.closest("[data-wt]"); if (b) pilihTabWali(b.dataset.wt); });
  $("wali-tabs").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var L = ["rujukan", "kelas", "poin"], i = L.indexOf(tabWali), n = L[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3];
    pilihTabWali(n); $("wt-" + n).focus();
  });
  var cek = function (v, teks) { return '<span class="rg-cek' + (v ? " on" : "") + '">' + teks + "</span>"; };
  function muatKelas() {
    var a = $("kelas-isi"), b = $("poin-isi");
    a.innerHTML = b.innerHTML = '<p class="muted">Memuat…</p>';
    return api("kelasSaya").then(function (d) {
      if (!d.ok) { a.innerHTML = b.innerHTML = '<p class="form-status err">' + esc(d.error) + "</p>"; return; }
      KELAS = d; gambarKelas();
    }).catch(function (err) { if (err.message !== "auth") a.innerHTML = b.innerHTML = '<p class="form-status err">Gagal memuat. <button type="button" class="btn-mini" data-ulang-kelas="1">Coba lagi</button></p>'; });
  }
  function gambarKelas() {
    var d = KELAS, S = d.siswa, n = S.length;
    var hit = function (f) { return S.filter(f).length; };
    var aktif = hit(function (x) { return x.akun === "Aktif"; }), setuju = hit(function (x) { return x.setuju === "Setuju"; }),
      akpd = hit(function (x) { return x.akpd; }), dcm = hit(function (x) { return x.dcm; }), sosio = hit(function (x) { return x.sosio; });
    var belumAkun = S.filter(function (x) { return x.akun !== "Aktif"; }).map(function (x) { return x.nama; });
    var belumAngket = S.filter(function (x) { return x.akun === "Aktif" && !(x.akpd && x.dcm && x.sosio); }).map(function (x) { return x.nama; });
    var tiles = '<div class="rg-tiles">' + [[n, "siswa di kelas " + d.kelas], [aktif + "/" + n, "sudah aktivasi akun"], [setuju + "/" + n, "setuju ikut angket"], [akpd + "/" + n, "AKPD"], [dcm + "/" + n, "DCM"], [sosio + "/" + n, "Sosiometri"]]
      .map(function (t) { return '<div class="rg-tile"><b>' + t[0] + "</b><span>" + esc(t[1]) + "</span></div>"; }).join("") + "</div>";
    var ingat = (belumAkun.length ? '<p class="rg-warnbox"><b>Belum aktivasi akun (' + belumAkun.length + "):</b> " + belumAkun.map(esc).join(", ") + ".</p>" : "") +
      (belumAngket.length ? '<p class="rg-warnbox" style="margin-top: 10px"><b>Sudah punya akun, angket belum lengkap (' + belumAngket.length + "):</b> " + belumAngket.map(esc).join(", ") + ".</p>" : "");
    $("kelas-isi").innerHTML = '<section class="rg-card" style="margin-top: 4px">' + tiles + ingat +
      '<div class="table-wrap rg-tbl"><table><thead><tr><th scope="col">No</th><th scope="col">NIS</th><th scope="col">Nama</th><th scope="col">L/P</th><th scope="col">Akun portal</th><th scope="col">Persetujuan</th><th scope="col">Data diri</th><th scope="col">Angket</th></tr></thead><tbody>' +
      S.map(function (x, i) {
        var ak = x.akun === "Aktif" ? '<span class="pill ok">Aktif</span>' : x.akun === "Nonaktif" ? '<span class="pill warn">Nonaktif</span>' : '<span class="rg-redup">Belum aktivasi</span>';
        var st = x.setuju === "Setuju" ? '<span class="pill ok">Setuju</span>' : x.setuju ? '<span class="pill wait">' + esc(x.setuju) + "</span>" : '<span class="rg-redup">–</span>';
        return "<tr><td>" + (i + 1) + '</td><td class="mono">' + esc(x.nis) + "</td><td><b>" + esc(x.nama) + "</b></td><td>" + esc(x.jk) + "</td><td>" + ak + "</td><td>" + st + "</td><td>" + (x.latar ? '<span class="pill ok">Sudah</span>' : '<span class="rg-redup">Belum</span>') +
          '</td><td class="nowrap">' + cek(x.akpd, "AKPD") + cek(x.dcm, "DCM") + cek(x.sosio, "Sosio") + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="rg-note">Yang tampil hanya status sudah atau belum. Isi jawaban angket dan data diri siswa hanya dibaca guru BK. Siswa yang belum aktivasi bisa diarahkan ke Panduan Masuk Portal Siswa; bila nama atau NIS tidak cocok, kabari guru BK.</p>' +
      '<div class="tombol-baris"><button type="button" class="btn-mini" data-ulang-kelas="1">Muat ulang</button></div></section>';
    var P = d.poin;
    $("poin-isi").innerHTML = '<section class="rg-card" style="margin-top: 4px"><h3>Poin pelanggaran kelas ' + esc(d.kelas) + "</h3>" +
      (P.length ? '<ul class="poin-list">' + P.map(function (x) {
        return '<li><div class="poin-kepala"><b>' + esc(x.nama) + '</b><span class="pill wait">' + x.total + " poin · " + x.catatan.length + " catatan</span></div>" +
          x.catatan.map(function (c) { return '<p>' + esc(J.tglPanjang(c.tanggal)) + " · <b>" + c.poin + " poin</b> · " + esc(c.kode) + "</p>"; }).join("") + "</li>";
      }).join("") + "</ul>" : '<div class="kosong"><strong>Belum ada poin pelanggaran.</strong><span>Poin tercatat saat guru BK menulis laporan kejadian dengan butir pelanggaran.</span></div>') +
      '<p class="rg-note">Poin dicatat guru BK lewat laporan kejadian, mengikuti daftar butir tata tertib sekolah. Uraian kejadian dan catatan tindak lanjut tidak ditampilkan. Bila ada catatan yang keliru, sampaikan ke guru BK.</p>' +
      '<div class="tombol-baris"><button type="button" class="btn-mini" data-ulang-kelas="1">Muat ulang</button></div></section>';
  }
  ["kelas-isi", "poin-isi"].forEach(function (id) {
    $(id).addEventListener("click", function (e) { if (e.target.closest("[data-ulang-kelas]")) { KELAS = null; muatKelas(); } });
  });

  /* ---------- Ganti password ---------- */
  $("form-password").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("password-status"), btn = f.querySelector("button[type=submit]");
    if (tandaiWajib(f)) { status(st, "Isi semua kolom.", "err"); return; }
    if ($("pw-baru").value.length < 8) { status(st, "Password baru minimal 8 karakter.", "err"); $("pw-baru").focus(); return; }
    if ($("pw-baru").value !== $("pw-ulang").value) { status(st, "Ulangan password baru belum sama.", "err"); $("pw-ulang").focus(); return; }
    sibuk(btn, true, "Menyimpan…");
    api("gantiPassword", { lama: $("pw-lama").value, baru: $("pw-baru").value }).then(function (d) {
      if (!d.ok) { status(st, d.error, "err"); return; }
      f.reset(); status(st, "Password berhasil diganti.", "ok");
    }).catch(function (err) { if (err.message !== "auth") status(st, "Koneksi bermasalah. Coba lagi.", "err"); }).finally(function () { sibuk(btn, false); });
  });

  /* ---------- Mulai ---------- */
  var lama = bacaSesi();
  if (lama && lama.token && URL_API) {
    sesi = lama;
    api("cekSesi").then(function (d) { if (d.ok) tampilPortal(d); }).catch(function () {});
  }
})();
