(function () {
  "use strict";
  var URL_API = ((window.BK_CONFIG || {}).SCRIPT_URL || "").trim();
  var KEY = "bk_guru_sesi";
  var sesi = null;
  var WAKASEK = "Drs. Dedi Hadi Rizki";

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
  var bulanLabel = function (ym) { var p = String(ym).split("-"); return p.length === 2 ? BULAN[+p[1] - 1].slice(0, 3) + " " + p[0] : ym; };
  var isoLokal = function (d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  };
  var hariIni = function () { return isoLokal(new Date()); };

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
  var gagalKoneksi = function (el, teks) {
    return function (err) { if (err.message !== "auth") status(el, teks || "Koneksi bermasalah. Coba lagi.", "err"); };
  };

  function status(el, msg, type) { el.textContent = msg || ""; el.className = "form-status" + (type ? " " + type : ""); }

  function tandaiWajib(form) {
    var bad = null;
    form.querySelectorAll("[required]").forEach(function (f) {
      if (f.offsetParent === null && f.type !== "checkbox") return;
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

  /* ---------- Tampilan umum ---------- */
  function tampilDashboard() {
    $("panel-login").hidden = true;
    $("panel-dash").hidden = false;
    $("nama-guru").textContent = sesi.nama;
    var sel = $("k-kategori");
    if (sel.options.length <= 1 && sesi.kategori) {
      sesi.kategori.forEach(function (k) { var o = document.createElement("option"); o.textContent = k; sel.appendChild(o); });
    }
    ["k-tanggal", "p-tanggal", "sl-tanggal"].forEach(function (id) { if (!$(id).value) $(id).value = hariIni(); });
    pilihTab("inbox");
    muatNamaSiswa();
  }

  function keluar(pesan) {
    if (sesi && sesi.token && !pesan) api("logout").catch(function () {});
    simpanSesi(null);
    $("panel-dash").hidden = true;
    $("panel-login").hidden = false;
    $("form-login").reset();
    $("inbox-list").innerHTML = ""; $("profil-hasil").innerHTML = ""; $("statistik-isi").innerHTML = "";
    status($("login-status"), pesan || "", pesan ? "err" : "");
    $("l-user").focus();
  }

  var dimuat = {};
  function pilihTab(nama) {
    document.querySelectorAll(".dash-tab").forEach(function (b) {
      var on = b.dataset.tab === nama;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll(".dash-panel").forEach(function (p) { p.hidden = p.id !== "tab-" + nama; });
    if (nama === "inbox") muatInbox();
    if (nama === "riwayat") muatRiwayat();
    if (nama === "statistik" && !dimuat.statistik) muatStatistik();
    if (nama === "akun") muatBackup();
    if (nama === "scan" && !dimuat.scan) muatScan();
    if (nama === "scan" && !dimuat.nomor) muatNomor();
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

  function muatNamaSiswa() {
    api("namaSiswa").then(function (d) {
      if (!d.ok) return;
      $("dl-siswa").innerHTML = d.nama.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("");
    }).catch(function () {});
  }

  /* ---------- Kotak masuk ---------- */
  var INBOX_LABEL = {
    curhat: { balas: "Balasan untuk siswa", catatan: "Catatan internal (tidak tampil di web)" },
    laporan: { balas: "Balasan untuk pelapor", catatan: "Tindak lanjut (internal, tidak tampil di web)" },
    konseling: { catatan: "Catatan tindak lanjut" },
    janji: { catatan: "Catatan guru BK" }
  };
  var inboxJenis = "curhat", inboxData = [];

  function setBadge(baru) {
    if (!baru) return;
    var total = 0;
    Object.keys(baru).forEach(function (k) {
      total += baru[k];
      var b = $("b-" + k); if (!b) return;
      b.hidden = !baru[k]; b.textContent = baru[k]; b.setAttribute("aria-label", baru[k] + " baru");
    });
    var t = $("badge-inbox"); t.hidden = !total; t.textContent = total; t.setAttribute("aria-label", total + " belum ditangani");
  }

  function muatInbox() {
    var box = $("inbox-list");
    box.innerHTML = '<p class="muted">Memuat…</p>';
    api("inbox", { jenis: inboxJenis, semua: $("inbox-semua").checked }).then(function (d) {
      if (!d.ok) { box.innerHTML = '<p class="muted">' + esc(d.error) + "</p>"; return; }
      setBadge(d.baru);
      inboxData = d.items;
      if (!d.items.length) {
        box.innerHTML = '<div class="kosong"><strong>Tidak ada yang perlu ditangani.</strong><span>Semua isian di sini sudah berstatus Selesai. Centang "Tampilkan juga yang sudah selesai" untuk melihat arsipnya.</span></div>';
        return;
      }
      var L = INBOX_LABEL[inboxJenis];
      box.innerHTML = d.items.map(function (it, i) {
        var opsi = d.pilihanStatus.map(function (s) { return "<option" + (s === it.status ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("");
        return '<details class="inbox-item"' + (it.status === "Baru" ? ' data-baru="1"' : "") + ">" +
          "<summary><span class=\"pill pill-" + esc(it.status.toLowerCase()) + '">' + esc(it.status) + "</span>" +
          '<span class="inbox-judul">' + esc(it.judul || "(tanpa judul)") + '</span><span class="inbox-waktu">' + esc(it.waktu) + "</span></summary>" +
          '<dl class="isian">' + it.isi.map(function (x) { return "<dt>" + esc(x.label) + "</dt><dd>" + esc(x.teks) + "</dd>"; }).join("") +
          (it.oleh ? "<dt>Ditangani oleh</dt><dd>" + esc(it.oleh) + "</dd>" : "") + "</dl>" +
          '<form class="inbox-form" data-i="' + i + '" novalidate>' +
          '<div class="field"><label for="ib-st-' + i + '">Status</label><select id="ib-st-' + i + '">' + opsi + "</select></div>" +
          (d.adaBalasan ? '<div class="field"><label for="ib-bl-' + i + '">' + L.balas + '</label><textarea id="ib-bl-' + i + '" rows="4">' + esc(it.balasan) + '</textarea><span class="hint">Tampil di halaman Cek Balasan untuk pemegang kode ' + esc((it.isi[0] || {}).teks || "") + ". Jangan tulis nama siswa lain.</span></div>" : "") +
          '<div class="field"><label for="ib-ct-' + i + '">' + L.catatan + '</label><textarea id="ib-ct-' + i + '" rows="3">' + esc(it.catatan) + "</textarea></div>" +
          '<div class="tombol-baris"><button type="submit" class="btn-solid">Simpan</button></div>' +
          '<p class="form-status" role="status" aria-live="polite"></p></form></details>';
      }).join("");
    }).catch(function (err) { if (err.message !== "auth") box.innerHTML = '<p class="muted">Gagal memuat. Coba lagi.</p>'; });
  }

  document.querySelectorAll(".seg-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".seg-btn").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      inboxJenis = b.dataset.jenis; muatInbox();
    });
  });
  $("inbox-semua").addEventListener("change", muatInbox);
  $("inbox-muat").addEventListener("click", muatInbox);

  $("inbox-list").addEventListener("submit", function (e) {
    var f = e.target.closest(".inbox-form"); if (!f) return;
    e.preventDefault();
    var i = +f.dataset.i, it = inboxData[i], st = f.querySelector(".form-status"), btn = f.querySelector("button[type=submit]");
    var data = { status: $("ib-st-" + i).value, catatan: $("ib-ct-" + i).value };
    if ($("ib-bl-" + i)) data.balasan = $("ib-bl-" + i).value;
    if (inboxJenis === "curhat" && data.balasan && data.balasan.trim() && data.status === "Baru") { data.status = "Dibalas"; $("ib-st-" + i).value = "Dibalas"; }
    sibuk(btn, true, "Menyimpan…"); status(st, "");
    api("perbarui", { jenis: inboxJenis, ref: it.ref, data: data }).then(function (d) {
      if (!d.ok) { status(st, d.error || "Gagal menyimpan.", "err"); return; }
      status(st, "Tersimpan.", "ok");
      var pill = f.closest("details").querySelector(".pill");
      pill.textContent = data.status; pill.className = "pill pill-" + data.status.toLowerCase();
      f.closest("details").removeAttribute("data-baru");
    }).catch(gagalKoneksi(st, "Gagal menyimpan karena koneksi. Coba lagi.")).finally(function () { sibuk(btn, false); });
  });

  /* ---------- Profil siswa ---------- */
  $("cari-nama").addEventListener("input", function () { this.setAttribute("aria-invalid", "false"); });
  $("form-profil").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("profil-status"), btn = this.querySelector("button[type=submit]"), q = $("cari-nama").value.trim();
    if (q.length < 3) { status(st, "Ketik minimal 3 huruf nama siswa.", "err"); $("cari-nama").setAttribute("aria-invalid", "true"); $("cari-nama").focus(); return; }
    sibuk(btn, true, "Mencari…"); status(st, "");
    api("profil", { nama: q }).then(function (d) {
      if (!d.ok) { status(st, d.error, "err"); return; }
      tampilProfil(q, d);
    }).catch(gagalKoneksi(st)).finally(function () { sibuk(btn, false); });
  });

  function tampilProfil(q, d) {
    var box = $("profil-hasil");
    if (!d.items.length) {
      box.innerHTML = '<div class="kosong"><strong>Belum ada catatan untuk "' + esc(q) + '".</strong><span>Periksa ejaan nama, atau coba nama depan saja.</span></div>';
      return;
    }
    var hitung = {};
    d.items.forEach(function (it) { hitung[it.jenis] = (hitung[it.jenis] || 0) + 1; });
    var siswa = d.siswa.length
      ? d.siswa.map(function (s) { return '<span class="chip">' + esc(s.nama) + (s.kelas ? " · " + esc(s.kelas) : "") + "</span>"; }).join("")
      : "";
    box.innerHTML =
      '<div class="profil-ringkas">' +
      (d.siswa.length > 1 ? '<p class="muted" style="margin:0 0 8px">Ditemukan beberapa siswa dengan nama mirip. Periksa nama dan kelas di setiap catatan.</p>' : "") +
      '<div class="chips">' + siswa + "</div>" +
      '<ul class="hitung">' + Object.keys(hitung).map(function (k) { return "<li><strong>" + hitung[k] + "</strong> " + esc(k.toLowerCase()) + "</li>"; }).join("") + "</ul></div>" +
      '<ol class="timeline">' + d.items.map(function (it) {
        return "<li><div class=\"tl-head\"><span class=\"tl-tgl\">" + esc(it.tanggal ? tglPanjang(it.tanggal) : "-") + "</span>" +
          '<span class="tl-jenis">' + esc(it.jenis) + "</span>" + (it.id ? '<span class="tl-id">' + esc(it.id) + "</span>" : "") + "</div>" +
          '<p class="tl-sub">' + [it.nama && it.nama + (it.kelas ? " (" + it.kelas + ")" : ""), it.judul, it.status && "Status: " + it.status, it.oleh && "oleh " + it.oleh]
            .filter(Boolean).map(esc).join(" · ") + "</p>" +
          '<dl class="isian">' + it.isi.map(function (x) { return "<dt>" + esc(x.label) + "</dt><dd>" + esc(x.teks) + "</dd>"; }).join("") + "</dl>" +
          (it.sumber === "ArsipScan" ? '<button type="button" class="btn-mini" data-lihat="' + esc(it.id) + '" style="margin-top:10px">Lihat scan</button>' : "") + "</li>";
      }).join("") + "</ol>";
  }

  $("profil-hasil").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-lihat]"); if (b) lihatScan(b.dataset.lihat, b);
  });

  /* ---------- Laporan kejadian ---------- */
  $("form-kejadian").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("kejadian-status"), btn = f.querySelector("button[type=submit]");
    var bad = tandaiWajib(f);
    if (bad) { status(st, "Lengkapi kolom yang wajib diisi.", "err"); bad.focus(); return; }
    var lampiran = ambilFile("k-scan");
    sibuk(btn, true, "Menyimpan…"); status(st, "");
    api("simpanKejadian", { data: {
      tanggal: $("k-tanggal").value, nama: $("k-nama").value, kelas: $("k-kelas").value, kategori: $("k-kategori").value,
      deskripsi: $("k-deskripsi").value, tindakLanjut: $("k-tindak").value, status: $("k-status").value } })
      .then(function (d) {
        if (!d.ok) { status(st, d.error || "Gagal menyimpan.", "err"); return; }
        f.reset(); $("k-tanggal").value = hariIni(); dimuat.statistik = false;
        status(st, "Tersimpan dengan nomor " + d.id + ".", "ok");
        return lampirkan(d.id, lampiran, st);
      })
      .catch(gagalKoneksi(st, "Gagal menyimpan karena koneksi. Data belum terkirim, coba lagi."))
      .finally(function () { sibuk(btn, false); });
  });

  /* ---------- Cetak surat ---------- */
  var p = function (s) { return "<p>" + esc(s) + "</p>"; };
  var blok = function (s) { return '<p class="pre">' + esc(s) + "</p>"; };
  var ttd = function (jabatan, nama) { return "<div><span>" + jabatan + '</span><span class="garis">' + esc(nama || "(..................................)") + "</span></div>"; };
  var identitas = function (rows) {
    return '<table class="surat-identitas">' + rows.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>: " + esc(r[1]) + "</td></tr>"; }).join("") + "</table>";
  };
  var judul = function (t, id) { return '<h2 class="surat-judul">' + esc(t) + '</h2><p class="surat-no">' + (id ? "No. " + esc(id) : "") + "</p>"; };
  var tempatTgl = function (iso) { return '<p class="surat-tgl">Jakarta, ' + esc(tglPanjang(iso)) + "</p>"; };
  var mengetahui = "Mengetahui,<br>Wakil Kepala Sekolah Bidang Kesiswaan";

  var TEMPLATE = {
    perjanjian: function (d) {
      return judul("SURAT PERJANJIAN SISWA", d.id) + p("Yang bertanda tangan di bawah ini:") +
        identitas([["Nama", d.nama], ["Kelas", d.kelas]]) +
        p("dengan kesadaran sendiri dan tanpa paksaan dari pihak mana pun, menyatakan bersedia untuk:") +
        "<ol>" + String(d.poin).split(/\n+/).map(function (s) { return s.trim(); }).filter(String).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" +
        p("Apabila saya tidak menepati perjanjian ini, saya bersedia mengikuti pembinaan lanjutan sesuai tata tertib SMP Labschool Ciracas.") +
        tempatTgl(d.tanggal) + '<div class="ttd">' + ttd("Siswa,", d.nama) + ttd("Orang tua/wali,", d.ortu) + ttd("Guru BK,", d.guru) + ttd(mengetahui, WAKASEK) + "</div>";
    },
    panggilan: function (d) {
      return judul("SURAT PANGGILAN ORANG TUA/WALI", d.id) +
        p("Kepada Yth.") + p((/^(bapak|ibu|bpk|pak|bu)\b/i.test(d.ortu || "") ? d.ortu : "Bapak/Ibu " + (d.ortu || "orang tua/wali")) + ", orang tua/wali dari " + d.nama + " (kelas " + d.kelas + ")") + p("di tempat") +
        p("Dengan hormat,") + p("Kami mengharapkan kehadiran Bapak/Ibu di sekolah untuk bertemu dengan guru Bimbingan dan Konseling pada:") +
        identitas([["Hari/tanggal", d.hariTanggal], ["Waktu", d.waktu], ["Tempat", d.tempat], ["Keperluan", d.keperluan]]) +
        p("Mengingat pentingnya pertemuan ini, kami mohon Bapak/Ibu dapat hadir tepat waktu. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.") +
        tempatTgl(d.tanggal) + '<div class="ttd">' + ttd(mengetahui, WAKASEK) + ttd("Guru BK,", d.guru) + "</div>";
    },
    rujukan: function (d) {
      return judul("SURAT RUJUKAN (ALIH TANGAN KASUS)", d.id) +
        p("Kepada Yth.") + p(d.tujuan) + p("di tempat") + p("Dengan hormat,") +
        p("Bersama ini kami merujuk siswa berikut untuk mendapatkan penanganan lebih lanjut:") +
        identitas([["Nama", d.nama], ["Kelas", d.kelas], ["Orang tua/wali", d.ortu || "-"]]) +
        "<h3>Permasalahan</h3>" + blok(d.masalah) + "<h3>Upaya yang sudah dilakukan sekolah</h3>" + blok(d.upaya) + "<h3>Alasan rujukan</h3>" + blok(d.alasan) +
        p("Informasi dalam surat ini bersifat rahasia dan hanya digunakan untuk kepentingan penanganan siswa. Kami mohon hasil penanganan dapat dikomunikasikan kembali kepada guru BK. Atas kerja samanya kami ucapkan terima kasih.") +
        tempatTgl(d.tanggal) + '<div class="ttd">' + ttd("Mengetahui,<br>Kepala SMP Labschool Ciracas", "") + ttd("Guru BK,", d.guru) + "</div>";
    },
    homevisit: function (d) {
      return judul("BERITA ACARA KUNJUNGAN RUMAH (HOME VISIT)", d.id) +
        p("Pada tanggal " + tglPanjang(d.tanggal) + ", guru Bimbingan dan Konseling SMP Labschool Ciracas telah melakukan kunjungan rumah dengan keterangan sebagai berikut:") +
        identitas([["Nama siswa", d.nama], ["Kelas", d.kelas], ["Alamat", d.alamat], ["Pihak yang ditemui", d.ditemui]]) +
        "<h3>Hasil kunjungan</h3>" + blok(d.hasil) + "<h3>Kesepakatan/tindak lanjut</h3>" + blok(d.kesepakatan) +
        p("Demikian berita acara ini dibuat dengan sebenar-benarnya untuk dipergunakan sebagaimana mestinya.") +
        tempatTgl(d.tanggal) + '<div class="ttd">' + ttd("Orang tua/wali,", d.ortu || d.ditemui) + ttd("Guru BK,", d.guru) + ttd(mengetahui, WAKASEK) + "</div>";
    }
  };

  function siapkanSurat(jenis, d) { $("surat-isi").innerHTML = TEMPLATE[jenis](d); }
  function cetak() { document.body.classList.add("mode-cetak"); window.print(); }
  window.addEventListener("afterprint", function () { document.body.classList.remove("mode-cetak", "mode-cetak-stat"); });

  /* ---------- Surat perjanjian ---------- */
  var suratTerakhir = null;
  $("form-perjanjian").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("perjanjian-status"), btn = f.querySelector("button[type=submit]");
    var bad = tandaiWajib(f);
    if (bad) { status(st, bad.type === "checkbox" ? "Centang persetujuan siswa terlebih dahulu." : "Lengkapi kolom yang wajib diisi.", "err"); bad.focus(); return; }
    var data = { tanggal: $("p-tanggal").value, nama: $("p-nama").value, kelas: $("p-kelas").value, ortu: $("p-ortu").value,
      poin: $("p-poin").value, setuju: $("p-setuju").checked };
    var lampiran = ambilFile("p-scan");
    sibuk(btn, true, "Menyimpan…"); status(st, "");
    api("simpanPerjanjian", { data: data })
      .then(function (d) {
        if (!d.ok) { status(st, d.error || "Gagal menyimpan.", "err"); return; }
        data.id = d.id; data.guru = d.guru; suratTerakhir = ["perjanjian", data];
        f.reset(); $("p-tanggal").value = hariIni(); dimuat.statistik = false;
        status(st, "Tersimpan dengan nomor " + d.id + ".", "ok");
        $("btn-cetak-baru").hidden = false; $("btn-scan-perjanjian").hidden = false;
        return lampirkan(d.id, lampiran, st);
      })
      .catch(gagalKoneksi(st, "Gagal menyimpan karena koneksi. Data belum terkirim, coba lagi."))
      .finally(function () { sibuk(btn, false); });
  });
  $("btn-cetak-baru").addEventListener("click", function () { siapkanSurat("perjanjian", suratTerakhir[1]); cetak(); });
  $("btn-scan-perjanjian").addEventListener("click", function () {
    keScan(suratTerakhir[1].id);
  });

  /* ---------- Surat lain ---------- */
  var SURAT = {
    panggilan: { tanggal: "Tanggal surat", ortuWajib: false, isian: [
      ["hariTanggal", "Hari/tanggal pertemuan", "input", "mis. Senin, 9 November 2026"], ["waktu", "Waktu", "input", "mis. 09.00 WIB"],
      ["tempat", "Tempat", "input", "mis. Ruang BK SMP Labschool Ciracas"], ["keperluan", "Keperluan", "textarea", "Tulis secara umum, mis. membicarakan perkembangan belajar dan kehadiran ananda."]] },
    rujukan: { tanggal: "Tanggal surat", ortuWajib: false, isian: [
      ["tujuan", "Dirujuk kepada", "input", "mis. Psikolog Puskesmas Kecamatan Ciracas"], ["masalah", "Permasalahan", "textarea", ""],
      ["upaya", "Upaya yang sudah dilakukan sekolah", "textarea", ""], ["alasan", "Alasan rujukan", "textarea", "mis. di luar kewenangan dan keahlian guru BK."]] },
    homevisit: { tanggal: "Tanggal kunjungan", ortuWajib: false, isian: [
      ["alamat", "Alamat yang dikunjungi", "input", ""], ["ditemui", "Pihak yang ditemui", "input", "mis. Ibu kandung (Ibu Sari)"],
      ["hasil", "Hasil kunjungan", "textarea", ""], ["kesepakatan", "Kesepakatan/tindak lanjut", "textarea", ""]] }
  };
  function jenisSurat() { return (document.querySelector("input[name=sl-jenis]:checked") || {}).value || "panggilan"; }
  function gambarIsianSurat() {
    var j = SURAT[jenisSurat()], simpan = {};
    $("sl-isian").querySelectorAll("[data-k]").forEach(function (el) { simpan[el.dataset.k] = el.value; });
    $("sl-tanggal-label").textContent = j.tanggal;
    $("sl-isian").innerHTML = j.isian.map(function (f) {
      var id = "sl-" + f[0];
      var input = f[2] === "textarea"
        ? '<textarea id="' + id + '" data-k="' + f[0] + '" rows="4" required></textarea>'
        : '<input id="' + id + '" data-k="' + f[0] + '" type="text" required>';
      return '<div class="field"><label for="' + id + '">' + esc(f[1]) + "</label>" + input + (f[3] ? '<span class="hint">' + esc(f[3]) + "</span>" : "") + "</div>";
    }).join("");
    $("sl-isian").querySelectorAll("[data-k]").forEach(function (el) { if (simpan[el.dataset.k]) el.value = simpan[el.dataset.k]; });
  }
  document.querySelectorAll("input[name=sl-jenis]").forEach(function (r) {
    r.addEventListener("change", function () { gambarIsianSurat(); $("btn-cetak-surat").hidden = true; $("btn-scan-surat").hidden = true; status($("surat-status"), ""); });
  });
  gambarIsianSurat();

  var suratLainTerakhir = null;
  $("form-surat").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("surat-status"), btn = f.querySelector("button[type=submit]");
    var bad = tandaiWajib(f);
    if (bad) { status(st, "Lengkapi kolom yang wajib diisi.", "err"); bad.focus(); return; }
    var data = { jenis: jenisSurat(), tanggal: $("sl-tanggal").value, nama: $("sl-nama").value, kelas: $("sl-kelas").value, ortu: $("sl-ortu").value };
    $("sl-isian").querySelectorAll("[data-k]").forEach(function (el) { data[el.dataset.k] = el.value; });
    var lampiran = ambilFile("sl-scan");
    sibuk(btn, true, "Menyimpan…"); status(st, "");
    api("simpanSurat", { data: data }).then(function (d) {
      if (!d.ok) { status(st, d.error || "Gagal menyimpan.", "err"); return; }
      data.id = d.id; data.guru = d.guru; suratLainTerakhir = data; dimuat.statistik = false;
      ["sl-nama", "sl-kelas", "sl-ortu", "sl-scan"].forEach(function (id) { $(id).value = ""; });
      $("sl-isian").querySelectorAll("[data-k]").forEach(function (el) { el.value = ""; });
      status(st, "Tersimpan dengan nomor " + d.id + ".", "ok");
      $("btn-cetak-surat").hidden = false; $("btn-scan-surat").hidden = false;
      return lampirkan(d.id, lampiran, st);
    }).catch(gagalKoneksi(st, "Gagal menyimpan karena koneksi. Data belum terkirim, coba lagi.")).finally(function () { sibuk(btn, false); });
  });
  $("btn-cetak-surat").addEventListener("click", function () { siapkanSurat(suratLainTerakhir.jenis, suratLainTerakhir); cetak(); });
  $("btn-scan-surat").addEventListener("click", function () {
    keScan(suratLainTerakhir.id);
  });

  /* ---------- Arsip scan ---------- */
  // Setiap scan disambungkan ke satu nomor dokumen (KJ-/SP-/PG-/RJ-/HV-...).
  // Beberapa foto digabung menjadi satu PDF sebelum diunggah.
  var MAKS_FILE = 10 * 1024 * 1024;
  var POLA_NOMOR = /^[A-Z]{2}-\d{8}-\d{3}$/;
  var dataScan = [];

  function ambilFile(id) { return Array.prototype.slice.call(($(id) || {}).files || []); }

  function keScan(nomor) {
    dimuat.nomor = false;
    pilihTab("scan");
    status($("scan-status"), "");
    muatNomor(nomor).then(function () { $("sc-file").focus(); });
  }

  function bacaBase64(blob) {
    return new Promise(function (ok, gagal) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(",")[1] || ""); };
      r.onerror = function () { gagal(new Error("baca")); };
      r.readAsDataURL(blob);
    });
  }

  // Foto dari HP biasanya besar: perkecil ke sisi terpanjang 2000 px, format JPG.
  function perkecilFoto(file) {
    return new Promise(function (ok, gagal) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var skala = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * skala); c.height = Math.round(img.naturalHeight * skala);
        var g = c.getContext("2d"); g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok({ blob: b, w: c.width, h: c.height }) : gagal(new Error("foto")); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); gagal(new Error("foto")); };
      img.src = url;
    });
  }

  var jsPdfSiap = null;
  function muatJsPdf() {
    if (window.jspdf) return Promise.resolve();
    if (jsPdfSiap) return jsPdfSiap;
    jsPdfSiap = new Promise(function (ok, gagal) {
      var sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      sc.onload = function () { ok(); };
      sc.onerror = function () { jsPdfSiap = null; gagal(new Error("Penggabung PDF gagal dimuat. Periksa koneksi lalu coba lagi.")); };
      document.head.appendChild(sc);
    });
    return jsPdfSiap;
  }

  // Semua foto -> satu PDF (satu foto per halaman A4). File PDF tetap apa adanya.
  function siapkanBerkas(files) {
    var foto = files.filter(function (f) { return /^image\//.test(f.type); });
    var pdf = files.filter(function (f) { return f.type === "application/pdf"; });
    var lain = files.filter(function (f) { return foto.indexOf(f) < 0 && pdf.indexOf(f) < 0; });
    if (lain.length) return Promise.reject(new Error(lain[0].name + " bukan PDF atau foto."));
    var besar = pdf.filter(function (f) { return f.size > MAKS_FILE; });
    if (besar.length) return Promise.reject(new Error(besar[0].name + " lebih dari 10 MB. Scan ulang dengan resolusi lebih rendah."));
    var hasil = pdf.map(function (f) { return bacaBase64(f).then(function (b64) { return { name: f.name, type: "application/pdf", data: b64 }; }); });
    if (foto.length === 1 && !pdf.length) {
      hasil.push(perkecilFoto(foto[0]).then(function (x) { return bacaBase64(x.blob); })
        .then(function (b64) { return { name: foto[0].name.replace(/\.[^.]+$/, "") + ".jpg", type: "image/jpeg", data: b64 }; }));
    } else if (foto.length) {
      hasil.push(muatJsPdf().then(function () {
        return Promise.all(foto.map(perkecilFoto));
      }).then(function (hal) {
        var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true });
        return hal.reduce(function (p, x, i) {
          return p.then(function () { return bacaBase64(x.blob); }).then(function (b64) {
            if (i) doc.addPage();
            var W = 210, H = 297, m = 8, sk = Math.min((W - 2 * m) / x.w, (H - 2 * m) / x.h);
            var w = x.w * sk, h = x.h * sk;
            doc.addImage("data:image/jpeg;base64," + b64, "JPEG", (W - w) / 2, (H - h) / 2, w, h);
          });
        }, Promise.resolve()).then(function () {
          var blob = doc.output("blob");
          if (blob.size > MAKS_FILE) throw new Error("Gabungan foto lebih dari 10 MB. Kurangi jumlah foto lalu coba lagi.");
          return bacaBase64(blob).then(function (b64) { return { name: "gabungan " + foto.length + " halaman.pdf", type: "application/pdf", data: b64 }; });
        });
      }));
    }
    return Promise.all(hasil).catch(function (err) {
      throw /foto/.test(err.message) && err.message.length < 8 ? new Error("Ada foto yang tidak bisa dibaca. Simpan sebagai JPG lalu coba lagi.") : err;
    });
  }

  // Unggah berkas untuk satu nomor. Dipakai form Arsip scan dan lampiran di setiap form.
  function unggahUntuk(nomor, files, keterangan, st) {
    if (!files.length) return Promise.resolve([]);
    status(st, "Menyiapkan file…", "");
    return siapkanBerkas(files).then(function (berkas) {
      var ids = [];
      return berkas.reduce(function (p, b, i) {
        return p.then(function () {
          status(st, berkas.length > 1 ? "Mengunggah " + (i + 1) + " dari " + berkas.length + "…" : "Mengunggah scan…", "");
          return api("unggahScan", { data: { nomor: nomor, keterangan: keterangan || "", file: b } });
        }).then(function (d) { if (!d.ok) throw new Error(d.error || "Gagal mengunggah."); ids.push(d.id); });
      }, Promise.resolve()).then(function () { dimuat.scan = false; return ids; });
    });
  }

  // Setelah laporan/surat tersimpan: lampirkan scan ke nomornya (jika ada file).
  function lampirkan(nomor, files, st) {
    dimuat.nomor = false;
    if (!files.length) return;
    return unggahUntuk(nomor, files, "", st).then(function () {
      status(st, "Tersimpan dengan nomor " + nomor + ", scan terlampir.", "ok");
    }).catch(function (err) {
      if (err.message === "auth") throw err;
      status(st, "Tersimpan dengan nomor " + nomor + ", tetapi scan gagal diunggah (" + (err.message === "Failed to fetch" ? "koneksi terputus" : err.message) + "). Unggah ulang lewat menu Arsip scan dengan nomor ini.", "err");
    });
  }

  // Dropdown nomor dokumen: dikelompokkan per jenis, terbaru di atas.
  var dataNomor = [], janjiNomor = null;
  var URUT_JENIS = ["Laporan kejadian", "Surat perjanjian", "Surat panggilan orang tua", "Surat rujukan", "Berita acara home visit"];
  function muatNomor(pilih) {
    var sel = $("sc-nomor"), lama = pilih || sel.value;
    if (dimuat.nomor && janjiNomor) return janjiNomor.then(function () { if (lama) { sel.value = lama; infoNomor(); } });
    sel.innerHTML = '<option value="">Memuat daftar nomor…</option>';
    janjiNomor = api("daftarNomor").then(function (d) {
      dataNomor = (d && d.items) || [];
      dimuat.nomor = true;
      if (!dataNomor.length) { sel.innerHTML = '<option value="">Belum ada laporan atau surat</option>'; infoNomor(); return; }
      var grup = {};
      dataNomor.forEach(function (x) { (grup[x.jenis] = grup[x.jenis] || []).push(x); });
      var urut = URUT_JENIS.filter(function (j) { return grup[j]; }).concat(Object.keys(grup).filter(function (j) { return URUT_JENIS.indexOf(j) < 0; }));
      sel.innerHTML = '<option value="">Pilih nomor dokumen</option>' + urut.map(function (j) {
        return '<optgroup label="' + esc(j) + '">' + grup[j].map(function (x) {
          return '<option value="' + esc(x.nomor) + '">' + esc(x.nomor + " · " + x.nama + " (" + x.kelas + ")" + (x.scan ? " · ✓ " + x.scan + " scan" : "")) + "</option>";
        }).join("") + "</optgroup>";
      }).join("");
      if (lama) sel.value = lama;
      infoNomor();
    }).catch(function (err) {
      dimuat.nomor = false;
      if (err.message !== "auth") sel.innerHTML = '<option value="">Gagal memuat daftar. Buka ulang menu ini.</option>';
    });
    return janjiNomor;
  }
  function infoNomor() {
    var v = $("sc-nomor").value, info = $("sc-info");
    var x = dataNomor.filter(function (d) { return d.nomor === v; })[0];
    if (!x) { info.textContent = "Pilih laporan atau surat yang akan dilampiri scan. Yang terbaru ada di atas."; info.className = "hint"; return; }
    info.textContent = "✓ " + x.jenis + " · " + x.nama + " (" + x.kelas + ") · " + (x.tanggal ? tglPanjang(x.tanggal) : "-") + (x.scan ? " · sudah ada " + x.scan + " scan" : " · belum ada scan");
    info.className = "hint hint-ok";
  }
  $("sc-nomor").addEventListener("change", infoNomor);

  var ukuranTeks = function (b) { return b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"; };
  $("sc-file").addEventListener("change", function () {
    var files = ambilFile("sc-file"), ul = $("sc-pilihan"), nFoto = files.filter(function (f) { return /^image\//.test(f.type); }).length;
    if (files.length && /file/.test($("scan-status").textContent)) status($("scan-status"), "");
    ul.hidden = !files.length;
    ul.innerHTML = files.map(function (f, i) {
      return "<li>" + (files.length > 1 ? "Hal. " + (i + 1) + ": " : "") + esc(f.name) + ' <span class="muted">(' + ukuranTeks(f.size) + ")</span></li>";
    }).join("") + (nFoto > 1 ? '<li class="muted">' + nFoto + " foto akan digabung menjadi satu PDF.</li>" : "");
  });

  $("form-scan").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("scan-status"), btn = f.querySelector("button[type=submit]");
    var bad = tandaiWajib(f);
    if (bad) { status(st, bad.type === "file" ? "Pilih file yang akan diunggah." : "Pilih nomor dokumen.", "err"); bad.focus(); return; }
    var nomor = $("sc-nomor").value;
    if (!POLA_NOMOR.test(nomor)) { status(st, "Pilih nomor dokumen dari daftar.", "err"); $("sc-nomor").focus(); return; }
    sibuk(btn, true, "Mengunggah…");
    unggahUntuk(nomor, ambilFile("sc-file"), $("sc-ket").value.trim(), st).then(function (ids) {
      f.reset(); $("sc-pilihan").hidden = true; $("sc-pilihan").innerHTML = "";
      dimuat.nomor = false; muatNomor(nomor);
      status(st, "Tersimpan untuk " + nomor + " (" + ids.join(", ") + ").", "ok");
      $("cari-scan").value = nomor; muatScan();
    }).catch(function (err) {
      if (err.message === "auth") return;
      status(st, (err.message === "Failed to fetch" ? "Koneksi terputus saat mengunggah." : err.message) + " Coba lagi.", "err");
    }).finally(function () { sibuk(btn, false); });
  });

  function muatScan() {
    var box = $("scan-list"), q = $("cari-scan").value.trim();
    box.innerHTML = '<p class="muted">Memuat…</p>';
    api("daftarScan", { cari: q }).then(function (d) {
      dimuat.scan = true;
      dataScan = d.items || [];
      if (!dataScan.length) {
        box.innerHTML = '<div class="kosong"><strong>' + (q ? 'Tidak ada dokumen untuk "' + esc(q) + '".' : "Belum ada dokumen yang diunggah.") + "</strong><span>" +
          (q ? "Periksa ejaan nama atau nomor." : "Unggah scan surat perjanjian atau laporan lewat formulir di atas.") + "</span></div>";
        return;
      }
      box.innerHTML = '<div class="table-wrap"><table><thead><tr><th scope=col>Tanggal</th><th scope=col>Dokumen</th><th scope=col>Siswa</th><th scope=col>Oleh</th><th scope=col><span class=sr-only>Aksi</span></th></tr></thead><tbody>' +
        dataScan.map(function (x, i) {
          return "<tr><td>" + esc(x.tanggal ? tglPanjang(x.tanggal) : "-") + "</td><td><strong>" + esc(x.jenis) + "</strong><br><span class=muted>" + esc([x.id, x.nomor && "terkait " + x.nomor, x.keterangan].filter(Boolean).join(" · ")) + "</span></td><td>" +
            esc(x.nama) + " (" + esc(x.kelas) + ")</td><td>" + esc(x.oleh) + '</td><td class="sel-scan"><button type="button" class="btn-mini" data-lihat="' + esc(x.id) + '">Lihat</button> <button type="button" class="btn-mini btn-hapus" data-hapus="' + esc(x.id) + '">Hapus</button></td></tr>';
        }).join("") + "</tbody></table></div>";
    }).catch(function (err) { if (err.message !== "auth") box.innerHTML = '<p class="muted">Gagal memuat. Coba lagi.</p>'; });
  }
  $("form-cari-scan").addEventListener("submit", function (e) { e.preventDefault(); muatScan(); });

  var urlLihat = null;
  function lihatScan(id, btn) {
    sibuk(btn, true, "Membuka…");
    api("lihatScan", { id: id }).then(function (d) {
      if (!d.ok) { alertSingkat(btn, d.error); return; }
      var bin = atob(d.data), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      if (urlLihat) URL.revokeObjectURL(urlLihat);
      urlLihat = URL.createObjectURL(new Blob([arr], { type: d.mime }));
      var v = $("scan-viewer");
      $("scan-viewer-judul").textContent = d.nama;
      $("scan-unduh").href = urlLihat; $("scan-unduh").setAttribute("download", d.nama);
      $("scan-viewer-isi").innerHTML = /^image\//.test(d.mime)
        ? '<img src="' + urlLihat + '" alt="' + esc(d.nama) + '">'
        : '<iframe src="' + urlLihat + '" title="' + esc(d.nama) + '"></iframe><p class="muted" style="margin:8px 0 0">PDF tidak tampil? Tekan Unduh untuk membukanya.</p>';
      v.hidden = false;
      v.scrollIntoView({ behavior: "smooth", block: "start" });
      $("scan-viewer-judul").focus({ preventScroll: true });
    }).catch(function (err) { if (err.message !== "auth") alertSingkat(btn, "Gagal membuka. Coba lagi."); })
      .finally(function () { sibuk(btn, false); });
  }
  function alertSingkat(btn, pesan) {
    var p = document.createElement("span"); p.className = "form-status err"; p.setAttribute("role", "status"); p.textContent = " " + pesan;
    btn.insertAdjacentElement("afterend", p); setTimeout(function () { p.remove(); }, 5000);
  }
  $("scan-tutup").addEventListener("click", function () {
    $("scan-viewer").hidden = true; $("scan-viewer-isi").innerHTML = "";
    if (urlLihat) { URL.revokeObjectURL(urlLihat); urlLihat = null; }
  });

  $("scan-list").addEventListener("click", function (e) {
    var l = e.target.closest("button[data-lihat]"); if (l) { lihatScan(l.dataset.lihat, l); return; }
    var h = e.target.closest("button[data-hapus]"); if (!h) return;
    if (h.dataset.yakin !== "1") {
      h.dataset.yakin = "1"; h.textContent = "Yakin hapus " + h.dataset.hapus + "?";
      setTimeout(function () { if (h.isConnected && h.dataset.yakin === "1") { h.dataset.yakin = ""; h.textContent = "Hapus"; } }, 6000);
      return;
    }
    sibuk(h, true, "Menghapus…");
    api("hapusScan", { id: h.dataset.hapus }).then(function (d) {
      if (!d.ok) { sibuk(h, false); h.dataset.yakin = ""; h.textContent = "Hapus"; alertSingkat(h, d.error); return; }
      muatScan();
    }).catch(function (err) { if (err.message !== "auth") { sibuk(h, false); h.dataset.yakin = ""; h.textContent = "Hapus"; alertSingkat(h, "Gagal menghapus."); } });
  });

  /* ---------- Statistik ---------- */
  var statTerakhir = null;
  (function () {
    var d = new Date(), y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
    $("st-dari").value = y + "-07-01"; $("st-sampai").value = hariIni();
  })();

  function bars(judulTeks, rows, opsi) {
    opsi = opsi || {};
    var data = rows.filter(function (r) { return opsi.nol || r.n > 0; });
    if (!data.length) return '<section class="stat-blok"><h3>' + esc(judulTeks) + '</h3><p class="muted">Belum ada data pada periode ini.</p></section>';
    var max = Math.max.apply(null, data.map(function (r) { return r.n; })) || 1;
    return '<section class="stat-blok"><h3>' + esc(judulTeks) + '</h3><ul class="sbars">' + data.map(function (r) {
      var lab = opsi.label ? opsi.label(r.label) : r.label;
      return '<li title="' + esc(lab) + ": " + r.n + '"><span class="sbar-label">' + esc(lab) + '</span><span class="sbar-track"><span class="sbar-fill" style="width:' +
        Math.max(r.n ? 2 : 0, Math.round(r.n / max * 100)) + '%"></span></span><span class="sbar-n">' + r.n + "</span></li>";
    }).join("") + "</ul></section>";
  }

  function muatStatistik() {
    var st = $("statistik-status"), box = $("statistik-isi");
    status(st, ""); box.innerHTML = '<p class="muted">Menghitung…</p>';
    api("statistik", { dari: $("st-dari").value, sampai: $("st-sampai").value }).then(function (d) {
      if (!d.ok) { status(st, d.error, "err"); box.innerHTML = ""; return; }
      dimuat.statistik = true; statTerakhir = d; setBadge(d.baru);
      var total = d.layanan.filter(function (r) { return r.label !== "Survei kepuasan"; }).reduce(function (a, r) { return a + r.n; }, 0);
      var kej = (d.layanan.filter(function (r) { return r.label === "Laporan kejadian"; })[0] || {}).n || 0;
      var belum = Object.keys(d.baru).reduce(function (a, k) { return a + d.baru[k]; }, 0);
      box.innerHTML =
        '<p class="stat-periode">Periode ' + esc(tglPanjang(d.dari)) + " – " + esc(tglPanjang(d.sampai)) + "</p>" +
        '<div class="tiles">' +
        '<div class="tile"><span class="tile-n">' + total + '</span><span class="tile-l">Layanan & catatan BK</span></div>' +
        '<div class="tile"><span class="tile-n">' + kej + '</span><span class="tile-l">Laporan kejadian</span></div>' +
        '<div class="tile"><span class="tile-n">' + belum + '</span><span class="tile-l">Isian web belum ditangani (semua waktu)</span></div>' +
        '<div class="tile"><span class="tile-n">' + (d.survei.n ? d.survei.terbantu.toString().replace(".", ",") : "–") + '</span><span class="tile-l">Rata-rata "terbantu" dari 5 (' + d.survei.n + " survei)</span></div>" +
        "</div>" +
        '<div class="stat-grid">' +
        bars("Layanan dan catatan per jenis", d.layanan.filter(function (r) { return r.label !== "Survei kepuasan"; }), { nol: true }) +
        bars("Jumlah per bulan", d.perBulan, { label: bulanLabel }) +
        bars("Laporan kejadian per kategori", d.kategori) +
        bars("Laporan kejadian per tingkat kelas", d.tingkat) +
        bars("Jenis perundungan yang dilaporkan", d.jenisPerundungan) +
        '<section class="stat-blok"><h3>Survei kepuasan</h3>' + (d.survei.n
          ? '<dl class="isian"><dt>Jumlah responden</dt><dd>' + d.survei.n + "</dd><dt>Rata-rata merasa terbantu</dt><dd>" + d.survei.terbantu.toString().replace(".", ",") + " dari 5</dd><dt>Rata-rata merasa nyaman</dt><dd>" + d.survei.nyaman.toString().replace(".", ",") + " dari 5</dd><dt>Mau datang lagi</dt><dd>" + d.survei.kembaliPersen + "%</dd></dl>"
          : '<p class="muted">Belum ada survei pada periode ini.</p>') + "</section>" +
        "</div>";
    }).catch(function (err) { if (err.message !== "auth") { box.innerHTML = ""; status(st, "Gagal memuat statistik. Coba lagi.", "err"); } });
  }
  $("form-statistik").addEventListener("submit", function (e) {
    e.preventDefault();
    if ($("st-dari").value && $("st-sampai").value && $("st-dari").value > $("st-sampai").value) { status($("statistik-status"), "Tanggal awal harus sebelum tanggal akhir.", "err"); return; }
    muatStatistik();
  });
  $("st-cetak").addEventListener("click", function () { if (!statTerakhir) return; document.body.classList.add("mode-cetak-stat"); window.print(); });
  $("st-salin").addEventListener("click", function () {
    var d = statTerakhir, st = $("statistik-status");
    if (!d) return;
    var baris = ["Rekap layanan BK SMP Labschool Ciracas", "Periode " + tglPanjang(d.dari) + " – " + tglPanjang(d.sampai), ""];
    baris.push("Layanan dan catatan:"); d.layanan.forEach(function (r) { baris.push("- " + r.label + ": " + r.n); });
    var kat = d.kategori.filter(function (r) { return r.n; });
    if (kat.length) { baris.push("", "Laporan kejadian per kategori:"); kat.forEach(function (r) { baris.push("- " + r.label + ": " + r.n); }); }
    if (d.tingkat.length) { baris.push("", "Laporan kejadian per tingkat:"); d.tingkat.forEach(function (r) { baris.push("- " + r.label + ": " + r.n); }); }
    if (d.survei.n) baris.push("", "Survei kepuasan (" + d.survei.n + " responden): terbantu " + d.survei.terbantu + "/5, nyaman " + d.survei.nyaman + "/5, mau datang lagi " + d.survei.kembaliPersen + "%");
    var teks = baris.join("\n");
    (navigator.clipboard ? navigator.clipboard.writeText(teks) : Promise.reject())
      .then(function () { status(st, "Ringkasan disalin. Tempel di laporan Anda.", "ok"); })
      .catch(function () { status(st, "Tidak bisa menyalin otomatis di browser ini.", "err"); });
  });

  /* ---------- Riwayat ---------- */
  var dataRiwayat = { kejadian: [], perjanjian: [], surat: [] };
  var KEPALA = {
    kejadian: "<tr><th scope=col>Tanggal</th><th scope=col>Siswa</th><th scope=col>Kategori</th><th scope=col>Status</th><th scope=col>Oleh</th><th scope=col>Scan</th></tr>",
    perjanjian: "<tr><th scope=col>Tanggal</th><th scope=col>Siswa</th><th scope=col>Poin</th><th scope=col>Oleh</th><th scope=col>Scan</th><th scope=col><span class=sr-only>Aksi</span></th></tr>",
    surat: "<tr><th scope=col>Tanggal</th><th scope=col>Jenis</th><th scope=col>Siswa</th><th scope=col>Oleh</th><th scope=col>Scan</th><th scope=col><span class=sr-only>Aksi</span></th></tr>"
  };
  function barisRiwayat(j, r, i) {
    var siswa = "<td>" + esc(r["Nama siswa"]) + " (" + esc(r["Kelas"]) + ")</td>";
    var btn = '<td><button type="button" class="btn-mini" data-j="' + j + '" data-i="' + i + '">Cetak</button></td>';
    var scan = '<td class="sel-scan">' + (r._scan ? '<button type="button" class="btn-mini" data-lihat-nomor="' + esc(r["ID"]) + '">' + r._scan + " file</button> " : "") +
      '<button type="button" class="btn-mini" data-scan-j="' + j + '" data-i="' + i + '">Unggah</button></td>';
    if (j === "kejadian") return "<tr><td>" + esc(r["Tanggal kejadian"]) + "</td>" + siswa + "<td>" + esc(r["Kategori"]) + "</td><td>" + esc(r["Status"]) + "</td><td>" + esc(r["Diinput oleh"]) + "</td>" + scan + "</tr>";
    if (j === "perjanjian") return "<tr><td>" + esc(r["Tanggal perjanjian"]) + "</td>" + siswa + "<td>" + String(r["Poin kesepakatan"]).split("\n").length + " poin</td><td>" + esc(r["Diinput oleh"]) + "</td>" + scan + btn + "</tr>";
    return "<tr><td>" + esc(r["Tanggal surat"]) + "</td><td>" + esc(r["Jenis surat"]) + "</td>" + siswa + "<td>" + esc(r["Diinput oleh"]) + "</td>" + scan + btn + "</tr>";
  }
  function muatRiwayat() {
    ["kejadian", "perjanjian", "surat"].forEach(function (j) {
      var box = $("riwayat-" + j);
      box.innerHTML = '<p class="muted">Memuat…</p>';
      api("daftar", { jenis: j }).then(function (d) {
        dataRiwayat[j] = d.rows || [];
        if (!dataRiwayat[j].length) { box.innerHTML = '<p class="muted">Belum ada data.</p>'; return; }
        box.innerHTML = '<div class="table-wrap"><table><thead>' + KEPALA[j] + "</thead><tbody>" +
          dataRiwayat[j].map(function (r, i) { return barisRiwayat(j, r, i); }).join("") + "</tbody></table></div>";
      }).catch(function (err) { if (err.message !== "auth") box.innerHTML = '<p class="muted">Gagal memuat. Coba lagi.</p>'; });
    });
  }
  $("tab-riwayat").addEventListener("click", function (e) {
    var sb = e.target.closest("button[data-scan-j]");
    if (sb) {
      keScan(dataRiwayat[sb.dataset.scanJ][+sb.dataset.i]["ID"]);
      return;
    }
    var lb = e.target.closest("button[data-lihat-nomor]");
    if (lb) { $("cari-scan").value = lb.dataset.lihatNomor; dimuat.scan = false; pilihTab("scan"); return; }
    var b = e.target.closest("button[data-j]"); if (!b) return;
    var r = dataRiwayat[b.dataset.j][+b.dataset.i];
    if (b.dataset.j === "perjanjian") {
      siapkanSurat("perjanjian", { id: r["ID"], nama: r["Nama siswa"], kelas: r["Kelas"], tanggal: r["Tanggal perjanjian"], poin: r["Poin kesepakatan"], ortu: r["Nama orang tua/wali"], guru: r["Diinput oleh"] });
    } else {
      var x = {}; try { x = JSON.parse(r["Data cetak (jangan diubah)"] || "{}"); } catch (err) {}
      if (!TEMPLATE[x.jenis]) return;
      x.id = r["ID"]; x.nama = r["Nama siswa"]; x.kelas = r["Kelas"]; x.tanggal = r["Tanggal surat"]; x.ortu = r["Nama orang tua/wali"]; x.guru = r["Diinput oleh"];
      siapkanSurat(x.jenis, x);
    }
    cetak();
  });
  $("btn-muat-ulang").addEventListener("click", muatRiwayat);

  /* ---------- Akun ---------- */
  function muatBackup() {
    api("infoBackup").then(function (d) {
      $("info-backup").textContent = d.terakhir
        ? "Cadangan terakhir: " + d.terakhir + " (" + d.jumlah + " salinan tersimpan)."
        : "Cadangan otomatis belum berjalan.";
    }).catch(function () { $("info-backup").textContent = "Info cadangan tidak dapat dimuat."; });
  }

  $("form-password").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("password-status"), btn = f.querySelector("button[type=submit]");
    if (tandaiWajib(f)) { status(st, "Isi semua kolom.", "err"); return; }
    if ($("pw-baru").value.length < 8) { status(st, "Password baru minimal 8 karakter.", "err"); $("pw-baru").focus(); return; }
    if ($("pw-baru").value !== $("pw-ulang").value) { status(st, "Konfirmasi password tidak sama.", "err"); $("pw-ulang").focus(); return; }
    sibuk(btn, true, "Menyimpan…");
    api("gantiPassword", { lama: $("pw-lama").value, baru: $("pw-baru").value })
      .then(function (d) { if (!d.ok) { status(st, d.error, "err"); return; } f.reset(); status(st, "Password berhasil diganti.", "ok"); })
      .catch(gagalKoneksi(st))
      .finally(function () { sibuk(btn, false); });
  });

  /* ---------- Mulai ---------- */
  var lama = bacaSesi();
  if (lama && lama.token && URL_API) {
    sesi = lama;
    api("cekSesi").then(function (d) { if (d.ok) { sesi.kategori = d.kategori; tampilDashboard(); } }).catch(function () {});
  }
})();
