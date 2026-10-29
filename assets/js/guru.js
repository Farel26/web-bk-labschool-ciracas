(function () {
  "use strict";
  var URL_API = ((window.BK_CONFIG || {}).SCRIPT_URL || "").trim();
  var KEY = "bk_guru_sesi";
  var sesi = null;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var tglPanjang = function (iso) {
    var p = String(iso || "").split("-");
    return p.length === 3 ? +p[2] + " " + BULAN[+p[1] - 1] + " " + p[0] : iso;
  };
  var hariIni = function () {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  };

  function simpanSesi(s) { sesi = s; try { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY); } catch (e) {} }
  function bacaSesi() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; } }

  function api(action, extra) {
    var body = { action: action };
    if (sesi && sesi.token) body.token = sesi.token;
    for (var k in extra || {}) body[k] = extra[k];
    return fetch(URL_API, { method: "POST", body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.auth === false) { keluar(d.error); throw new Error("auth"); }
        return d;
      });
  }

  function status(el, msg, type) { el.textContent = msg || ""; el.className = "form-status" + (type ? " " + type : ""); }

  function tandaiWajib(form) {
    var bad = null;
    form.querySelectorAll("[required]").forEach(function (f) {
      var kosong = f.type === "checkbox" ? !f.checked : !String(f.value || "").trim();
      f.setAttribute("aria-invalid", kosong ? "true" : "false");
      if (kosong && !bad) bad = f;
      f.addEventListener("input", function () { f.setAttribute("aria-invalid", "false"); }, { once: true });
      f.addEventListener("change", function () { f.setAttribute("aria-invalid", "false"); }, { once: true });
    });
    return bad;
  }

  function sibuk(btn, on, teks) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = teks || "Memproses…"; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  /* ---------- Tampilan ---------- */
  function tampilDashboard() {
    $("panel-login").hidden = true;
    $("panel-dash").hidden = false;
    $("nama-guru").textContent = sesi.nama;
    var sel = $("k-kategori");
    if (sel.options.length <= 1 && sesi.kategori) {
      sesi.kategori.forEach(function (k) { var o = document.createElement("option"); o.textContent = k; sel.appendChild(o); });
    }
    ["k-tanggal", "p-tanggal"].forEach(function (id) { if (!$(id).value) $(id).value = hariIni(); });
    pilihTab("kejadian");
  }

  function keluar(pesan) {
    if (sesi && sesi.token && !pesan) api("logout").catch(function () {});
    simpanSesi(null);
    $("panel-dash").hidden = true;
    $("panel-login").hidden = false;
    $("form-login").reset();
    status($("login-status"), pesan || "", pesan ? "err" : "");
    $("l-user").focus();
  }

  function pilihTab(nama) {
    document.querySelectorAll(".dash-tab").forEach(function (b) {
      var on = b.dataset.tab === nama;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll(".dash-panel").forEach(function (p) { p.hidden = p.id !== "tab-" + nama; });
    if (nama === "riwayat") muatRiwayat();
  }

  /* ---------- Login ---------- */
  $("form-login").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("login-status"), btn = this.querySelector("button[type=submit]");
    if (tandaiWajib(this)) { status(st, "Isi username dan password.", "err"); return; }
    if (!URL_API) { status(st, "Layanan belum tersambung.", "err"); return; }
    sibuk(btn, true, "Masuk…"); status(st, "");
    api("login", { username: $("l-user").value, password: $("l-pass").value })
      .then(function (d) {
        if (!d.ok) { status(st, d.error || "Gagal masuk.", "err"); $("l-pass").value = ""; $("l-pass").focus(); return; }
        simpanSesi({ token: d.token, nama: d.nama, username: d.username, kategori: d.kategori });
        tampilDashboard();
      })
      .catch(function () { status(st, "Koneksi bermasalah. Coba lagi.", "err"); })
      .finally(function () { sibuk(btn, false); });
  });

  $("btn-keluar").addEventListener("click", function () { keluar(); });

  document.querySelectorAll(".dash-tab").forEach(function (b, i, all) {
    b.addEventListener("click", function () { pilihTab(b.dataset.tab); });
    b.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var n = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
      n.focus(); pilihTab(n.dataset.tab);
    });
  });

  /* ---------- Laporan kejadian ---------- */
  $("form-kejadian").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("kejadian-status"), btn = f.querySelector("button[type=submit]");
    var bad = tandaiWajib(f);
    if (bad) { status(st, "Lengkapi kolom yang wajib diisi.", "err"); bad.focus(); return; }
    sibuk(btn, true, "Menyimpan…"); status(st, "");
    api("simpanKejadian", { data: {
      tanggal: $("k-tanggal").value, nama: $("k-nama").value, kelas: $("k-kelas").value, kategori: $("k-kategori").value,
      deskripsi: $("k-deskripsi").value, tindakLanjut: $("k-tindak").value, status: $("k-status").value } })
      .then(function (d) {
        if (!d.ok) { status(st, d.error || "Gagal menyimpan.", "err"); return; }
        f.reset(); $("k-tanggal").value = hariIni();
        status(st, "Tersimpan dengan nomor " + d.id + ".", "ok");
      })
      .catch(function (err) { if (err.message !== "auth") status(st, "Gagal menyimpan karena koneksi. Data belum terkirim, coba lagi.", "err"); })
      .finally(function () { sibuk(btn, false); });
  });

  /* ---------- Surat perjanjian ---------- */
  function isiSurat(d) {
    $("s-nama").textContent = d.nama;
    $("s-kelas").textContent = d.kelas;
    $("s-id").textContent = d.id ? "No. " + d.id : "";
    $("s-tanggal").textContent = "Jakarta, " + tglPanjang(d.tanggal);
    $("s-poin").innerHTML = String(d.poin).split(/\n+/).map(function (s) { return s.trim(); }).filter(String)
      .map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    $("s-ttd-siswa").textContent = d.nama;
    $("s-ttd-ortu").textContent = d.ortu || "(..................................)";
    $("s-ttd-guru").textContent = d.guru || (sesi && sesi.nama) || "";
  }
  function cetak() { document.body.classList.add("mode-cetak"); window.print(); }
  window.addEventListener("afterprint", function () { document.body.classList.remove("mode-cetak"); });

  $("form-perjanjian").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("perjanjian-status"), btn = f.querySelector("button[type=submit]");
    var bad = tandaiWajib(f);
    if (bad) { status(st, bad.type === "checkbox" ? "Centang persetujuan siswa terlebih dahulu." : "Lengkapi kolom yang wajib diisi.", "err"); bad.focus(); return; }
    var data = { tanggal: $("p-tanggal").value, nama: $("p-nama").value, kelas: $("p-kelas").value, ortu: $("p-ortu").value,
      poin: $("p-poin").value, setuju: $("p-setuju").checked };
    sibuk(btn, true, "Menyimpan…"); status(st, "");
    api("simpanPerjanjian", { data: data })
      .then(function (d) {
        if (!d.ok) { status(st, d.error || "Gagal menyimpan.", "err"); return; }
        data.id = d.id; data.guru = d.guru;
        isiSurat(data);
        f.reset(); $("p-tanggal").value = hariIni();
        status(st, "Tersimpan dengan nomor " + d.id + ".", "ok");
        $("btn-cetak-baru").hidden = false;
      })
      .catch(function (err) { if (err.message !== "auth") status(st, "Gagal menyimpan karena koneksi. Data belum terkirim, coba lagi.", "err"); })
      .finally(function () { sibuk(btn, false); });
  });
  $("btn-cetak-baru").addEventListener("click", cetak);

  /* ---------- Riwayat ---------- */
  var dataRiwayat = { kejadian: [], perjanjian: [] };
  function muatRiwayat() {
    ["kejadian", "perjanjian"].forEach(function (j) {
      var box = $("riwayat-" + j);
      box.innerHTML = '<p class="muted">Memuat…</p>';
      api("daftar", { jenis: j }).then(function (d) {
        dataRiwayat[j] = d.rows || [];
        if (!dataRiwayat[j].length) { box.innerHTML = '<p class="muted">Belum ada data.</p>'; return; }
        var head = j === "kejadian"
          ? "<tr><th scope=col>Tanggal</th><th scope=col>Siswa</th><th scope=col>Kategori</th><th scope=col>Status</th><th scope=col>Oleh</th></tr>"
          : "<tr><th scope=col>Tanggal</th><th scope=col>Siswa</th><th scope=col>Poin</th><th scope=col>Oleh</th><th scope=col><span class=sr-only>Aksi</span></th></tr>";
        box.innerHTML = '<div class="table-wrap"><table><thead>' + head + "</thead><tbody>" + dataRiwayat[j].map(function (r, i) {
          return j === "kejadian"
            ? "<tr><td>" + esc(r["Tanggal kejadian"]) + "</td><td>" + esc(r["Nama siswa"]) + " (" + esc(r["Kelas"]) + ")</td><td>" + esc(r["Kategori"]) + "</td><td>" + esc(r["Status"]) + "</td><td>" + esc(r["Diinput oleh"]) + "</td></tr>"
            : "<tr><td>" + esc(r["Tanggal perjanjian"]) + "</td><td>" + esc(r["Nama siswa"]) + " (" + esc(r["Kelas"]) + ")</td><td>" + esc(String(r["Poin kesepakatan"]).split("\n").length) + " poin</td><td>" + esc(r["Diinput oleh"]) + '</td><td><button type="button" class="btn-mini" data-i="' + i + '">Cetak</button></td></tr>';
        }).join("") + "</tbody></table></div>";
      }).catch(function (err) { if (err.message !== "auth") box.innerHTML = '<p class="muted">Gagal memuat. Coba lagi.</p>'; });
    });
  }
  $("riwayat-perjanjian").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-i]"); if (!b) return;
    var r = dataRiwayat.perjanjian[+b.dataset.i];
    isiSurat({ id: r["ID"], nama: r["Nama siswa"], kelas: r["Kelas"], tanggal: r["Tanggal perjanjian"], poin: r["Poin kesepakatan"], ortu: r["Nama orang tua/wali"], guru: r["Diinput oleh"] });
    cetak();
  });
  $("btn-muat-ulang").addEventListener("click", muatRiwayat);

  /* ---------- Ganti password ---------- */
  $("form-password").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("password-status"), btn = f.querySelector("button[type=submit]");
    if (tandaiWajib(f)) { status(st, "Isi semua kolom.", "err"); return; }
    if ($("pw-baru").value.length < 8) { status(st, "Password baru minimal 8 karakter.", "err"); $("pw-baru").focus(); return; }
    if ($("pw-baru").value !== $("pw-ulang").value) { status(st, "Konfirmasi password tidak sama.", "err"); $("pw-ulang").focus(); return; }
    sibuk(btn, true, "Menyimpan…");
    api("gantiPassword", { lama: $("pw-lama").value, baru: $("pw-baru").value })
      .then(function (d) { if (!d.ok) { status(st, d.error, "err"); return; } f.reset(); status(st, "Password berhasil diganti.", "ok"); })
      .catch(function (err) { if (err.message !== "auth") status(st, "Koneksi bermasalah.", "err"); })
      .finally(function () { sibuk(btn, false); });
  });

  /* ---------- Mulai ---------- */
  var lama = bacaSesi();
  if (lama && lama.token && URL_API) {
    sesi = lama;
    api("cekSesi").then(function (d) { if (d.ok) { sesi.kategori = d.kategori; tampilDashboard(); } }).catch(function () {});
  }
})();
