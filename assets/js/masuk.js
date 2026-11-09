// Halaman masuk gabungan: siswa (masuk/aktivasi), guru BK, wali kelas.
// Setelah berhasil, sesi disimpan dengan kunci yang sama seperti di portal masing-masing,
// lalu browser pindah ke portal itu (portal membaca sesi dan langsung terbuka).
(function () {
  "use strict";
  var URL_API = ((window.BK_CONFIG || {}).SCRIPT_URL || "").trim();
  var $ = function (id) { return document.getElementById(id); };
  var TUJUAN = {
    siswa: { key: "bk_siswa_sesi", url: "siswa.html" },
    guru: { key: "bk_guru_sesi", url: "guru.html" },
    wali: { key: "bk_wali_sesi", url: "wali.html" }
  };

  function status(el, msg, type) { el.textContent = msg || ""; el.className = "form-status" + (type ? " " + type : ""); }
  function sibuk(btn, on, teks) {
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = teks || "Memproses…"; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }
  function tandaiWajib(form) {
    var bad = null;
    form.querySelectorAll("[required]").forEach(function (f) {
      if (f.closest("[hidden]")) return;
      var kosong = f.type === "checkbox" ? !f.checked : !String(f.value || "").trim();
      f.setAttribute("aria-invalid", kosong ? "true" : "false");
      if (kosong && !bad) bad = f;
      f.addEventListener("input", function () { f.setAttribute("aria-invalid", "false"); }, { once: true });
      f.addEventListener("change", function () { f.setAttribute("aria-invalid", "false"); }, { once: true });
    });
    return bad;
  }
  function salah(el, pesan, st) { el.setAttribute("aria-invalid", "true"); status(st, pesan, "err"); el.focus(); }
  function api(peran, action, extra) {
    var body = { action: action };
    if (peran !== "guru") body.peran = peran;
    for (var k in extra || {}) body[k] = extra[k];
    return fetch(URL_API, { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  function masukKe(peran, sesi) {
    try { sessionStorage.setItem(TUJUAN[peran].key, JSON.stringify(sesi)); } catch (e) {}
    location.href = TUJUAN[peran].url;
  }

  /* ---------- Pilih peran ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".peran-tabs [role=tab]"));
  function pilihPeran(peran, fokus) {
    tabs.forEach(function (t) {
      var aktif = t.dataset.peran === peran;
      t.setAttribute("aria-selected", aktif ? "true" : "false");
      t.tabIndex = aktif ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !aktif;
      if (aktif && fokus) t.focus();
    });
    try { history.replaceState(null, "", "#" + peran); } catch (e) {}
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { pilihPeran(t.dataset.peran); });
    t.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      var n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      pilihPeran(n.dataset.peran, true);
    });
  });

  /* ---------- Siswa: masuk atau aktivasi ---------- */
  var infoDimuat = false;
  function pilihMode(m) {
    document.querySelectorAll(".masuk-seg .seg-btn").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.mode === m ? "true" : "false"); });
    $("s-masuk").hidden = m !== "masuk";
    $("s-aktivasi").hidden = m !== "aktivasi";
    if (m === "aktivasi") muatInfo();
  }
  document.querySelectorAll(".masuk-seg .seg-btn").forEach(function (b) {
    b.addEventListener("click", function () { pilihMode(b.dataset.mode); (b.dataset.mode === "masuk" ? $("s-email") : $("s-kelas")).focus(); });
  });

  function muatInfo() {
    if (infoDimuat || !URL_API) return;
    infoDimuat = true;
    api("siswa", "infoAktivasi").then(function (d) {
      if (!d.ok) { infoDimuat = false; return; }
      if (d.perluNis) { $("s-nis-wrap").hidden = false; $("s-nis").required = true; }
      if (d.dibuka === false) { $("s-tutup").hidden = false; $("s-tutup").textContent = "Aktivasi akun belum dibuka. Tanyakan ke guru BK."; }
      var sel = $("s-kelas");
      (d.kelas || []).forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = "Kelas " + k; sel.appendChild(o); });
    }).catch(function () { infoDimuat = false; });
  }

  var pinMudah = function (p) { return /^(\d)\1{5}$/.test(p) || p === "123456" || p === "654321"; };

  $("s-masuk").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("s-masuk-status"), btn = this.querySelector("button[type=submit]");
    var bad = tandaiWajib(this);
    if (bad) { status(st, "Isi email dan PIN.", "err"); bad.focus(); return; }
    if (!/^\d{6}$/.test($("s-pin").value)) { salah($("s-pin"), "PIN terdiri dari 6 angka.", st); return; }
    if (!URL_API) { status(st, "Layanan belum tersambung. Hubungi guru BK.", "err"); return; }
    sibuk(btn, true, "Masuk…"); status(st, "");
    api("siswa", "login", { email: $("s-email").value, pin: $("s-pin").value }).then(function (d) {
      if (!d.ok) { status(st, d.error || "Gagal masuk.", "err"); $("s-pin").value = ""; $("s-pin").focus(); sibuk(btn, false); return; }
      masukKe("siswa", { token: d.token, nama: d.nama, kelas: d.kelas });
    }).catch(function () { status(st, "Koneksi bermasalah. Coba lagi.", "err"); sibuk(btn, false); });
  });

  $("s-aktivasi").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("s-aktivasi-status"), btn = f.querySelector("button[type=submit]");
    var bad = tandaiWajib(f);
    if (bad) { status(st, bad.type === "checkbox" ? "Centang persetujuan dulu, ya." : "Ada kolom yang belum diisi.", "err"); bad.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($("s-email2").value.trim())) { salah($("s-email2"), "Email belum benar. Contoh: nama@gmail.com", st); return; }
    var pin = $("s-pin1").value;
    if (!/^\d{6}$/.test(pin)) { salah($("s-pin1"), "PIN harus 6 angka.", st); return; }
    if (pinMudah(pin)) { salah($("s-pin1"), "PIN terlalu mudah ditebak. Pilih 6 angka lain.", st); return; }
    if (pin !== $("s-pin2").value) { salah($("s-pin2"), "Ulangan PIN belum sama.", st); return; }
    if (!URL_API) { status(st, "Layanan belum tersambung. Hubungi guru BK.", "err"); return; }
    sibuk(btn, true, "Mengaktifkan…"); status(st, "");
    var email = $("s-email2").value.trim();
    api("siswa", "aktivasi", { data: { nama: $("s-nama").value, kelas: $("s-kelas").value, nis: $("s-nis").value, email: email, pin: pin,
      setuju: $("s-setuju").checked, website: $("s-hp").value } }).then(function (d) {
      if (!d.ok) { status(st, d.error || "Gagal mengaktifkan.", "err"); sibuk(btn, false); return; }
      return api("siswa", "login", { email: email, pin: pin }).then(function (l) {
        if (!l.ok) {
          pilihMode("masuk"); $("s-email").value = email;
          status($("s-masuk-status"), "Akun aktif. Silakan masuk dengan PIN-mu.", "ok"); sibuk(btn, false); return;
        }
        masukKe("siswa", { token: l.token, nama: l.nama, kelas: l.kelas });
      });
    }).catch(function () { status(st, "Koneksi bermasalah. Coba lagi.", "err"); sibuk(btn, false); });
  });

  /* ---------- Guru BK ---------- */
  $("g-masuk").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("g-status"), btn = this.querySelector("button[type=submit]");
    if (tandaiWajib(this)) { status(st, "Isi username dan password.", "err"); return; }
    if (!URL_API) { status(st, "Layanan belum tersambung.", "err"); return; }
    sibuk(btn, true, "Masuk…"); status(st, "");
    api("guru", "login", { username: $("g-user").value, password: $("g-pass").value }).then(function (d) {
      if (!d.ok) { status(st, d.error || "Gagal masuk.", "err"); $("g-pass").value = ""; $("g-pass").focus(); sibuk(btn, false); return; }
      masukKe("guru", { token: d.token, nama: d.nama, username: d.username, kategori: d.kategori });
    }).catch(function () { status(st, "Koneksi bermasalah. Coba lagi.", "err"); sibuk(btn, false); });
  });

  /* ---------- Wali kelas ---------- */
  $("w-masuk").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("w-status"), btn = this.querySelector("button[type=submit]");
    if (tandaiWajib(this)) { status(st, "Isi email dan password.", "err"); return; }
    if (!URL_API) { status(st, "Layanan belum tersambung.", "err"); return; }
    sibuk(btn, true, "Masuk…"); status(st, "");
    api("wali", "login", { email: $("w-email").value, password: $("w-pass").value }).then(function (d) {
      if (!d.ok) { status(st, d.error || "Gagal masuk.", "err"); $("w-pass").value = ""; $("w-pass").focus(); sibuk(btn, false); return; }
      masukKe("wali", { token: d.token, nama: d.nama, kelas: d.kelas });
    }).catch(function () { status(st, "Koneksi bermasalah. Coba lagi.", "err"); sibuk(btn, false); });
  });

  /* ---------- Mulai ---------- */
  var awal = (location.hash || "").replace("#", "");
  if (awal === "aktivasi") { pilihPeran("siswa"); pilihMode("aktivasi"); }
  else if (TUJUAN[awal]) pilihPeran(awal);
})();
