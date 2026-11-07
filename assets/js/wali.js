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

  /* ---------- Masuk & keluar ---------- */
  function tampilPortal(info) {
    sesi.nama = info.nama; sesi.kelas = info.kelas;
    simpanSesi(sesi);
    $("panel-masuk").hidden = true; $("panel-portal").hidden = false;
    $("nama-wali").textContent = info.nama;
    $("kelas-wali").textContent = info.kelas ? "Wali kelas " + info.kelas : "Wali kelas";
    $("r-kelas").value = info.kelas || "";
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
