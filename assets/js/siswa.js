// Portal siswa: aktivasi akun, masuk dengan PIN, pengajuan konseling + jadwal, target belajar, waktu fokus.
(function () {
  "use strict";
  var URL_API = ((window.BK_CONFIG || {}).SCRIPT_URL || "").trim();
  var J = window.BK_JADWAL, esc = J.esc;
  var KEY = "bk_siswa_sesi";
  var sesi = null;
  var $ = function (id) { return document.getElementById(id); };
  var NAMA_TIPE = { R: ["Realistis", "#C2410C"], I: ["Investigatif", "#1D4ED8"], A: ["Artistik", "#7C3AED"], S: ["Sosial", "#15803D"], E: ["Wirausaha", "#B91C1C"], C: ["Konvensional", "#0F766E"] };

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
  function api(action, extra) {
    var body = { peran: "siswa", action: action };
    if (sesi && sesi.token) body.token = sesi.token;
    for (var k in extra || {}) body[k] = extra[k];
    return fetch(URL_API, { method: "POST", body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.auth === false) { keluar(d.error); throw new Error("auth"); } return d; });
  }
  var hariIni = function () { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  var pinMudah = function (p) { return /^(\d)\1{5}$/.test(p) || p === "123456" || p === "654321"; };

  /* ---------- Masuk / aktivasi ---------- */
  var nisDicek = false;
  function pilihMode(m) {
    document.querySelectorAll("#panel-masuk .seg-btn").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.mode === m ? "true" : "false"); });
    $("form-masuk").hidden = m !== "masuk";
    $("form-aktivasi").hidden = m !== "aktivasi";
    (m === "masuk" ? $("m-email") : $("a-nama")).focus();
    if (m === "aktivasi" && !nisDicek && URL_API) {
      nisDicek = true;
      api("infoAktivasi").then(function (d) { if (d.ok && d.perluNis) { $("a-nis-wrap").hidden = false; $("a-nis").required = true; } }).catch(function () { nisDicek = false; });
    }
  }
  document.querySelectorAll("#panel-masuk .seg-btn").forEach(function (b) { b.addEventListener("click", function () { pilihMode(b.dataset.mode); }); });

  $("form-masuk").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("masuk-status"), btn = this.querySelector("button[type=submit]");
    var bad = tandaiWajib(this);
    if (bad) { status(st, "Isi email dan PIN.", "err"); bad.focus(); return; }
    if (!/^\d{6}$/.test($("m-pin").value)) { salah($("m-pin"), "PIN terdiri dari 6 angka.", st); return; }
    if (!URL_API) { status(st, "Layanan belum tersambung. Hubungi guru BK.", "err"); return; }
    sibuk(btn, true, "Masuk…"); status(st, "");
    api("login", { email: $("m-email").value, pin: $("m-pin").value }).then(function (d) {
      if (!d.ok) { status(st, d.error || "Gagal masuk.", "err"); $("m-pin").value = ""; $("m-pin").focus(); return; }
      simpanSesi({ token: d.token, nama: d.nama, kelas: d.kelas });
      tampilPortal();
    }).catch(function () { status(st, "Koneksi bermasalah. Coba lagi.", "err"); }).finally(function () { sibuk(btn, false); });
  });

  $("form-aktivasi").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("aktivasi-status"), btn = f.querySelector("button[type=submit]");
    var bad = tandaiWajib(f);
    if (bad) { status(st, bad.type === "checkbox" ? "Centang persetujuan dulu, ya." : "Ada kolom yang belum diisi.", "err"); bad.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($("a-email").value.trim())) { salah($("a-email"), "Email belum benar. Contoh: nama@gmail.com", st); return; }
    var pin = $("a-pin").value;
    if (!/^\d{6}$/.test(pin)) { salah($("a-pin"), "PIN harus 6 angka.", st); return; }
    if (pinMudah(pin)) { salah($("a-pin"), "PIN terlalu mudah ditebak. Pilih 6 angka lain.", st); return; }
    if (pin !== $("a-pin2").value) { salah($("a-pin2"), "Ulangan PIN belum sama.", st); return; }
    if (!URL_API) { status(st, "Layanan belum tersambung. Hubungi guru BK.", "err"); return; }
    sibuk(btn, true, "Mengaktifkan…"); status(st, "");
    var email = $("a-email").value.trim();
    api("aktivasi", { data: { nama: $("a-nama").value, kelas: $("a-kelas").value, nis: $("a-nis").value, email: email, pin: pin,
      setuju: $("a-setuju").checked, website: $("a-hp").value } }).then(function (d) {
      if (!d.ok) { status(st, d.error || "Gagal mengaktifkan.", "err"); return; }
      // Langsung masuk dengan data yang baru dibuat.
      return api("login", { email: email, pin: pin }).then(function (l) {
        if (!l.ok) { pilihMode("masuk"); $("m-email").value = email; status($("masuk-status"), "Akun aktif. Silakan masuk.", "ok"); return; }
        f.reset();
        simpanSesi({ token: l.token, nama: l.nama, kelas: l.kelas });
        tampilPortal(true);
      });
    }).catch(function () { status(st, "Koneksi bermasalah. Coba lagi.", "err"); }).finally(function () { sibuk(btn, false); });
  });

  function tampilPortal(baru) {
    $("panel-masuk").hidden = true; $("panel-portal").hidden = false;
    $("nama-siswa").textContent = (sesi.nama || "").split(" ")[0];
    $("kelas-siswa").textContent = sesi.nama + " · Kelas " + sesi.kelas;
    if (baru) status($("ajuan-status"), "Akunmu sudah aktif. Selamat datang!", "ok");
    muatRingkasan();
  }

  function keluar(pesan) {
    if (sesi && sesi.token && !pesan) api("logout").catch(function () {});
    simpanSesi(null);
    pmBerhenti(); chatBerhenti();
    $("chat-isi").innerHTML = ""; $("daftar-hasil").innerHTML = ""; $("daftar-formulir").innerHTML = ""; $("sek-formulir").hidden = true;
    $("panel-portal").hidden = true; $("panel-masuk").hidden = false;
    $("form-masuk").reset(); $("daftar-ajuan").innerHTML = ""; $("target-list").innerHTML = ""; $("daftar-tes").innerHTML = "";
    pilihMode("masuk");
    status($("masuk-status"), pesan || "", pesan ? "err" : "");
  }
  $("btn-keluar").addEventListener("click", function () { keluar(); });

  /* ---------- Ringkasan: pengajuan, target, tes ---------- */
  var dataTarget = [];
  function muatRingkasan() {
    var box = $("daftar-ajuan");
    box.innerHTML = '<p class="muted">Memuat…</p>';
    return api("ringkasan").then(function (d) {
      if (!d.ok) { box.innerHTML = '<p class="muted">' + esc(d.error) + "</p>"; return; }
      // Urutkan sekali saat dimuat: yang belum selesai di atas, tenggat terdekat dulu.
      // Saat dicentang, urutan tidak berubah agar target lain tidak "melompat" ke bawah jari.
      dataTarget = d.target.sort(function (a, b) {
        if (a.selesai !== b.selesai) return a.selesai ? 1 : -1;
        return (a.tenggat || "9999") < (b.tenggat || "9999") ? -1 : 1;
      });
      gambarAjuan(d.pengajuan); gambarTarget(); gambarTes(d.tes);
      gambarCheckin(d.checkin, d.hariIni, d.perasaan); gambarFormulir(d.formulir || []); gambarHasil(d.hasil || []);
      setBadgeChat(d.chatBaru || 0);
      if (!chat.mulai) chatMulai();
    }).catch(function (err) { if (err.message !== "auth") box.innerHTML = '<p class="muted">Gagal memuat. Coba lagi.</p>'; });
  }
  $("btn-muat").addEventListener("click", muatRingkasan);

  function gambarAjuan(list) {
    var box = $("daftar-ajuan");
    if (!list.length) {
      box.innerHTML = '<div class="kosong"><strong>Belum ada pengajuan.</strong><span>Isi formulir di atas kapan pun kamu butuh teman bicara. Nggak harus nunggu masalahnya besar.</span></div>';
      return;
    }
    box.innerHTML = '<ul class="daftar-ajuan">' + list.map(function (x) {
      return '<li><div class="ajuan-kepala"><div><h3>' + esc(x.topik) + "</h3><p>Dikirim " + esc(J.tglPanjang(x.dikirim)) + " · ingin " + esc(String(x.waktu).toLowerCase()) +
        '</p></div><span class="kode-kecil">' + esc(x.kode) + "</span></div>" +
        J.langkah("konseling", x.status) +
        (J.kartuJadwal(x.status === "Dijadwalkan" ? x.jadwal : null) || (x.status === "Baru" ? '<p class="muted" style="margin:0">Guru BK akan menentukan waktu dan tempatnya. Cek lagi nanti.</p>' : "")) +
        J.pesan("Pesan guru BK", x.pesan) + "</li>";
    }).join("") + "</ul>";
  }

  $("form-ajuan").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("ajuan-status"), btn = f.querySelector("button[type=submit]");
    var bad = tandaiWajib(f);
    if (bad) { status(st, "Pilih topik dan waktu dulu, ya.", "err"); bad.focus(); return; }
    sibuk(btn, true, "Mengirim…"); status(st, "");
    api("ajukanKonseling", { data: { topik: $("k-topik").value, waktu: $("k-waktu").value, cerita: $("k-cerita").value } }).then(function (d) {
      if (!d.ok) { status(st, d.error || "Belum terkirim.", "err"); return; }
      f.reset();
      status(st, "Terkirim! Jadwalmu akan muncul di bawah setelah guru BK menentukannya.", "ok");
      return muatRingkasan();
    }).catch(function (err) { if (err.message !== "auth") status(st, "Belum terkirim karena koneksi. Coba lagi.", "err"); }).finally(function () { sibuk(btn, false); });
  });

  /* ---------- Target belajar ---------- */
  function gambarTarget() {
    var ul = $("target-list"), today = hariIni(), urut = dataTarget;
    var beres = dataTarget.filter(function (t) { return t.selesai; }).length;
    $("target-hitung").textContent = dataTarget.length ? beres + " dari " + dataTarget.length + " selesai" : "";
    $("target-progres").hidden = !dataTarget.length;
    $("target-progres").firstElementChild.style.width = (dataTarget.length ? Math.round(beres / dataTarget.length * 100) : 0) + "%";
    if (!urut.length) { ul.innerHTML = '<li style="grid-template-columns:1fr;border-style:dashed"><span class="t-teks muted">Belum ada target. Tulis satu yang bisa kamu selesaikan minggu ini.</span></li>'; return; }
    ul.innerHTML = urut.map(function (t) {
      var telat = !t.selesai && t.tenggat && t.tenggat < today;
      var meta = [t.bidang, t.tenggat ? (telat ? "lewat tenggat " : "sampai ") + J.tglPanjang(t.tenggat) : ""].filter(Boolean).join(" · ");
      return '<li class="' + (t.selesai ? "beres" : "") + '"><input type="checkbox" data-id="' + esc(t.id) + '"' + (t.selesai ? " checked" : "") + ' aria-label="Tandai selesai: ' + esc(t.target) + '">' +
        '<span class="t-teks"><span class="t-isi">' + esc(t.target) + '</span><span class="t-meta' + (telat ? " telat" : "") + '">' + esc(meta) + "</span></span>" +
        '<button type="button" class="btn-x" data-hapus="' + esc(t.id) + '" aria-label="Hapus target: ' + esc(t.target) + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></li>';
    }).join("");
  }
  function gambarTes(list) {
    var box = $("daftar-tes");
    if (!list.length) {
      box.innerHTML = '<p class="muted" style="margin:0 0 12px">Kamu belum mengerjakan tes minat karier dengan nama ini.</p><ul class="tautan-list"><li><a href="tes-minat.html">Mulai tes minat karier <span aria-hidden="true">→</span></a></li></ul>';
      return;
    }
    box.innerHTML = '<ul class="tautan-list">' + list.map(function (x) {
      var huruf = String(x.kodeMinat || "").split("").map(function (h) { var t = NAMA_TIPE[h]; return t ? '<b style="background:' + t[1] + '" title="' + t[0] + '">' + h + "</b>" : ""; }).join("");
      return '<li><a href="tes-minat.html?kode=' + encodeURIComponent(x.kode) + '"><span>Tes minat karier · ' + esc(J.tglPanjang(x.tanggal)) + '</span><span class="kode-minat">' + huruf + "</span></a></li>";
    }).join("") + '</ul><p class="muted" style="margin:0;font-size:13px">Hasil dicocokkan dengan nama yang kamu tulis saat tes. <a href="tes-minat.html">Kerjakan lagi</a> bila minatmu berubah.</p>';
  }

  $("form-target").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("target-status"), btn = f.querySelector("button[type=submit]");
    var bad = tandaiWajib(f);
    if (bad) { status(st, "Tulis targetmu dulu.", "err"); bad.focus(); return; }
    var data = { target: $("t-teks").value.trim(), bidang: $("t-bidang").value, tenggat: $("t-tenggat").value };
    sibuk(btn, true, "Menyimpan…"); status(st, "");
    api("simpanTarget", { data: data }).then(function (d) {
      if (!d.ok) { status(st, d.error, "err"); return; }
      dataTarget.push({ id: d.id, target: data.target, bidang: data.bidang, tenggat: data.tenggat, selesai: false });
      $("t-teks").value = ""; $("t-tenggat").value = ""; status(st, ""); gambarTarget(); $("t-teks").focus();
    }).catch(function (err) { if (err.message !== "auth") status(st, "Belum tersimpan karena koneksi. Coba lagi.", "err"); }).finally(function () { sibuk(btn, false); });
  });
  $("target-list").addEventListener("change", function (e) {
    var cb = e.target.closest("input[type=checkbox][data-id]"); if (!cb) return;
    var t = dataTarget.filter(function (x) { return x.id === cb.dataset.id; })[0], nilai = cb.checked;
    t.selesai = nilai; gambarTarget();
    api("tandaiTarget", { id: t.id, selesai: nilai }).then(function (d) {
      if (!d.ok) { t.selesai = !nilai; gambarTarget(); status($("target-status"), d.error, "err"); }
      else if (nilai) status($("target-status"), "Mantap, satu target selesai!", "ok");
    }).catch(function (err) { if (err.message !== "auth") { t.selesai = !nilai; gambarTarget(); status($("target-status"), "Belum tersimpan karena koneksi.", "err"); } });
  });
  $("target-list").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-hapus]"); if (!b) return;
    var id = b.dataset.hapus, simpan = dataTarget.slice();
    dataTarget = dataTarget.filter(function (x) { return x.id !== id; }); gambarTarget();
    api("hapusTarget", { id: id }).then(function (d) {
      if (!d.ok) { dataTarget = simpan; gambarTarget(); status($("target-status"), d.error, "err"); }
    }).catch(function (err) { if (err.message !== "auth") { dataTarget = simpan; gambarTarget(); status($("target-status"), "Belum terhapus karena koneksi.", "err"); } });
  });

  /* ---------- Check-in emosi ---------- */
  var WAJAH = [
    [1, "Sangat berat", "M8 17c1.2-1.6 2.6-2.4 4-2.4s2.8.8 4 2.4"],
    [2, "Kurang baik", "M8.5 16c1-.9 2.2-1.3 3.5-1.3s2.5.4 3.5 1.3"],
    [3, "Biasa saja", "M8.5 15.5h7"],
    [4, "Baik", "M8.5 14.5c1 1 2.2 1.5 3.5 1.5s2.5-.5 3.5-1.5"],
    [5, "Sangat baik", "M8 14c1.1 1.7 2.5 2.6 4 2.6s2.9-.9 4-2.6"]
  ];
  var ciSkor = 0, ciRasa = [];
  $("ci-wajah").innerHTML = WAJAH.map(function (w) {
    return '<label><input type="radio" name="ci-skor" value="' + w[0] + '"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9.5"></circle><circle cx="9" cy="10" r=".9" fill="currentColor"></circle><circle cx="15" cy="10" r=".9" fill="currentColor"></circle><path d="' + w[2] + '"></path></svg><span>' + w[1] + "</span></label>";
  }).join("");
  $("ci-wajah").addEventListener("change", function (e) { ciSkor = +e.target.value; });
  function gambarRasa(daftar) {
    if ($("ci-rasa").children.length || !daftar.length) return;
    $("ci-rasa").innerHTML = daftar.map(function (r) { return '<button type="button" aria-pressed="false" data-rasa="' + esc(r) + '">' + esc(r) + "</button>"; }).join("");
  }
  $("ci-rasa").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-rasa]"); if (!b) return;
    var on = b.getAttribute("aria-pressed") !== "true";
    if (on && ciRasa.length >= 4) { status($("checkin-status"), "Pilih paling banyak 4 perasaan.", "err"); return; }
    b.setAttribute("aria-pressed", on ? "true" : "false");
    ciRasa = on ? ciRasa.concat(b.dataset.rasa) : ciRasa.filter(function (x) { return x !== b.dataset.rasa; });
    status($("checkin-status"), "");
  });
  function tanggalIso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function gambarCheckin(list, today, perasaan) {
    gambarRasa(perasaan || []);
    list = list || [];
    var kini = list.filter(function (x) { return x.tanggal === today; })[0];
    $("ci-info").textContent = kini ? "Kamu sudah check-in hari ini. Boleh diubah kalau perasaanmu berubah." : "Cukup 10 detik. Hanya kamu dan guru BK yang bisa melihatnya.";
    if (kini && !ciSkor) {
      ciSkor = kini.skor;
      var r = document.querySelector('input[name=ci-skor][value="' + kini.skor + '"]'); if (r) r.checked = true;
      ciRasa = kini.perasaan ? kini.perasaan.split(/\s*,\s*/) : [];
      document.querySelectorAll("#ci-rasa button").forEach(function (b) { b.setAttribute("aria-pressed", ciRasa.indexOf(b.dataset.rasa) >= 0 ? "true" : "false"); });
      $("ci-catatan").value = kini.catatan || ""; $("ci-ngobrol").checked = !!kini.ngobrol;
    }
    var hari = [];
    for (var i = 13; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); hari.push(tanggalIso(d)); }
    var peta = {}; list.forEach(function (x) { peta[x.tanggal] = x; });
    $("ci-riwayat").hidden = !list.length;
    $("ci-batang").innerHTML = hari.map(function (h) {
      var x = peta[h], hr = ["M", "S", "S", "R", "K", "J", "S"][new Date(h + "T00:00:00").getDay()];
      return '<span title="' + esc(J.tglPanjang(h) + (x ? ": " + WAJAH[x.skor - 1][1] : ": belum check-in")) + '"><i style="height:' + (x ? x.skor * 20 : 6) + '%"' + (x ? "" : ' class="ci-kosong"') + "></i><b>" + hr + "</b></span>";
    }).join("");
  }
  $("form-checkin").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("checkin-status"), btn = this.querySelector("button[type=submit]");
    if (!ciSkor) { status(st, "Pilih salah satu wajah dulu, ya.", "err"); $("ci-wajah").querySelector("input").focus(); return; }
    sibuk(btn, true, "Menyimpan…"); status(st, "");
    api("checkin", { data: { skor: ciSkor, perasaan: ciRasa, catatan: $("ci-catatan").value, ngobrol: $("ci-ngobrol").checked } }).then(function (d) {
      if (!d.ok) { status(st, d.error, "err"); return; }
      status(st, ciSkor >= 4 ? "Tersimpan. Senang mendengarnya!" : "Tersimpan. Terima kasih sudah check-in hari ini.", "ok");
      $("ci-dukungan").hidden = !(ciSkor <= 2 || $("ci-ngobrol").checked);
      gambarCheckin(d.riwayat, hariIni(), []);
    }).catch(function (err) { if (err.message !== "auth") status(st, "Belum tersimpan karena koneksi. Coba lagi.", "err"); }).finally(function () { sibuk(btn, false); });
  });
  $("ci-dukungan").addEventListener("click", function (e) {
    if (e.target.closest("[data-ke=chat]")) { $("sek-chat").scrollIntoView({ behavior: "smooth", block: "start" }); $("chat-teks").focus({ preventScroll: true }); }
  });

  /* ---------- Formulir dari guru BK ---------- */
  var dataFormulir = [];
  function gambarFormulir(list) {
    dataFormulir = list;
    $("sek-formulir").hidden = !list.length;
    var today = hariIni();
    $("daftar-formulir").innerHTML = list.map(function (f) {
      var telat = !f.selesai && f.tenggat && f.tenggat < today;
      return '<li><div class="ajuan-kepala"><div><h3>' + esc(f.judul) + "</h3>" +
        (f.tenggat ? "<p" + (telat ? ' style="color:#A1260D;font-weight:700"' : "") + ">" + (telat ? "Lewat tenggat " : "Isi sebelum ") + esc(J.tglPanjang(f.tenggat)) + "</p>" : "") + "</div>" +
        (f.selesai ? '<span class="pill pill-selesai">Sudah diisi</span>' : "") + "</div>" +
        (f.keterangan ? '<p style="margin:0;font-size:15px;color:#3B4568">' + esc(f.keterangan) + "</p>" : "") +
        '<div class="tombol-baris" style="align-items:center"><a class="btn-solid" style="display:inline-flex;align-items:center;text-decoration:none;min-height:48px" href="' + esc(f.link) + '" target="_blank" rel="noopener">Buka formulir</a>' +
        '<label class="check" style="font-size:14px"><input type="checkbox" data-form="' + esc(f.id) + '"' + (f.selesai ? " checked" : "") + "> Aku sudah mengisinya</label></div></li>";
    }).join("");
  }
  $("daftar-formulir").addEventListener("change", function (e) {
    var cb = e.target.closest("input[data-form]"); if (!cb) return;
    var f = dataFormulir.filter(function (x) { return x.id === cb.dataset.form; })[0], nilai = cb.checked;
    cb.disabled = true;
    api("tandaiFormulir", { id: f.id, selesai: nilai }).then(function (d) {
      if (!d.ok) { cb.checked = !nilai; return; }
      f.selesai = nilai; gambarFormulir(dataFormulir);
    }).catch(function () { cb.checked = !nilai; }).finally(function () { cb.disabled = false; });
  });

  /* ---------- Hasil psikotes ---------- */
  var dataHasil = [], urlHasil = null;
  function gambarHasil(list) {
    dataHasil = list;
    $("daftar-hasil").innerHTML = list.length ? '<ul class="tautan-list" style="margin-bottom:12px">' + list.map(function (x, i) {
      return '<li><button type="button" class="hasil-btn" data-hasil="' + i + '"><span>Hasil ' + esc(x.jenis.toLowerCase()) + (x.tanggal ? " · " + esc(J.tglPanjang(x.tanggal)) : "") + '</span><span class="hasil-aksi">Buka</span></button>' +
        (x.catatan ? '<p class="muted" style="margin:6px 4px 0;font-size:13px">' + esc(x.catatan) + "</p>" : "") + "</li>";
    }).join("") + '</ul><p class="muted" style="margin:0 0 12px;font-size:13px">Hasil tes bukan label untukmu. Diskusikan dengan guru BK supaya kamu paham artinya.</p>' : "";
  }
  $("daftar-hasil").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-hasil]"); if (!b) return;
    var x = dataHasil[+b.dataset.hasil], label = b.querySelector(".hasil-aksi");
    // Buka tab baru saat diklik (agar tidak diblokir browser), lalu isi setelah file datang.
    var w = window.open("", "_blank");
    label.textContent = "Membuka…";
    api("lihatHasil", { id: x.id }).then(function (d) {
      if (!d.ok) { if (w) w.close(); label.textContent = d.error; return; }
      var bin = atob(d.data), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      if (urlHasil) URL.revokeObjectURL(urlHasil);
      urlHasil = URL.createObjectURL(new Blob([arr], { type: d.mime }));
      if (w) w.location.href = urlHasil;
      else { var a = document.createElement("a"); a.href = urlHasil; a.download = d.nama; document.body.appendChild(a); a.click(); a.remove(); }
      label.textContent = "Buka";
    }).catch(function (err) { if (w) w.close(); if (err.message !== "auth") label.textContent = "Gagal, coba lagi"; });
  });

  /* ---------- Chat dengan guru BK ---------- */
  var chat = { mulai: false, sejak: 0, timer: null, pesan: [], pertama: false, terlihat: false };
  function setBadgeChat(n) { var b = $("chat-badge"); b.hidden = !n; b.textContent = n; b.setAttribute("aria-label", n + " pesan baru"); }
  function jamPesan(ms) {
    var d = new Date(ms), t = ("0" + d.getHours()).slice(-2) + "." + ("0" + d.getMinutes()).slice(-2);
    return d.toDateString() === new Date().toDateString() ? t : d.getDate() + "/" + (d.getMonth() + 1) + " " + t;
  }
  function gambarChat() {
    var box = $("chat-isi"), bawah = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.innerHTML = chat.pesan.length ? chat.pesan.map(function (m) {
      var aku = m.dari === "Siswa";
      return '<div class="gelembung' + (aku ? " aku" : "") + '"><p>' + esc(m.isi) + "</p><span>" + (aku ? "" : esc(m.pengirim) + " · ") + jamPesan(m.waktu) + "</span></div>";
    }).join("") : '<p class="muted chat-kosong">Belum ada pesan. Sapa guru BK kapan saja, misalnya "Bu/Pak, aku mau cerita."</p>';
    if (bawah || chat.pertama) { box.scrollTop = box.scrollHeight; chat.pertama = false; }
  }
  function chatTarik() {
    if (!sesi || !sesi.token) return Promise.resolve();
    return api("chatAmbil", { sejak: chat.sejak }).then(function (d) {
      if (!d.ok) return;
      if (d.pesan.length) {
        var ada = {}; chat.pesan.forEach(function (m) { ada[m.id] = 1; });
        d.pesan.forEach(function (m) { if (!ada[m.id]) chat.pesan.push(m); });
        chat.sejak = chat.pesan[chat.pesan.length - 1].waktu;
        gambarChat();
      }
      setBadgeChat(0);
    }).catch(function () {});
  }
  function chatJadwal() {
    clearTimeout(chat.timer);
    // Cepat (15 detik) hanya bila kotak chat terlihat di layar; selain itu 60 detik, agar kuota Apps Script hemat.
    chat.timer = setTimeout(function () { if (!chat.mulai) return; (document.hidden ? Promise.resolve() : chatTarik()).then(chatJadwal); }, chat.terlihat ? 15000 : 60000);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      var dulu = chat.terlihat; chat.terlihat = en[0].isIntersecting;
      if (chat.terlihat && !dulu && chat.mulai) { chatTarik(); chatJadwal(); }
    }).observe($("sek-chat"));
  } else chat.terlihat = true;
  function chatMulai() { chat.mulai = true; chat.pertama = true; chat.pesan = []; chat.sejak = 0; gambarChat(); chatTarik().then(chatJadwal); }
  function chatBerhenti() { clearTimeout(chat.timer); chat.mulai = false; chat.pesan = []; chat.sejak = 0; }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && chat.mulai) chatTarik(); });
  $("form-chat").addEventListener("submit", function (e) {
    e.preventDefault();
    var isi = $("chat-teks").value.trim(), st = $("chat-status"), btn = this.querySelector("button[type=submit]");
    if (!isi) { $("chat-teks").focus(); return; }
    sibuk(btn, true, "…"); status(st, "");
    api("chatKirim", { isi: isi }).then(function (d) {
      if (!d.ok) { status(st, d.error, "err"); return; }
      $("chat-teks").value = "";
      return chatTarik();
    }).catch(function (err) { if (err.message !== "auth") status(st, "Belum terkirim karena koneksi. Coba lagi.", "err"); }).finally(function () { sibuk(btn, false); });
  });
  $("chat-teks").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("form-chat").requestSubmit(); }
  });

  /* ---------- Waktu fokus (Pomodoro), hanya di browser ---------- */
  var FASE = { fokus: [25 * 60, "Fokus 25 menit"], istirahat: [5 * 60, "Istirahat 5 menit"], panjang: [15 * 60, "Istirahat panjang 15 menit"] };
  var pm = { fase: "fokus", sisa: FASE.fokus[0], jalan: null, akhir: 0, putaran: 0 };
  function pmTampil() {
    var m = Math.floor(pm.sisa / 60), s = pm.sisa % 60, t = ("0" + m).slice(-2) + ":" + ("0" + s).slice(-2);
    $("pm-waktu").textContent = t;
    $("pm-mode").textContent = FASE[pm.fase][1];
    $("pm-mulai").textContent = pm.jalan ? "Jeda" : (pm.sisa < FASE[pm.fase][0] ? "Lanjut" : "Mulai");
    $("pm-putaran").textContent = pm.putaran ? "Putaran selesai hari ini: " + pm.putaran + "." : "";
    document.title = (pm.jalan ? t + " · " : "") + "Portal Siswa — BK SMP Labschool Ciracas";
  }
  function pmBerhenti() { if (pm.jalan) { clearInterval(pm.jalan); pm.jalan = null; } pmTampil(); }
  function pmTik() {
    pm.sisa = Math.max(0, Math.round((pm.akhir - Date.now()) / 1000));
    if (pm.sisa === 0) {
      pmBerhenti();
      if (pm.fase === "fokus") { pm.putaran++; pm.fase = pm.putaran % 4 === 0 ? "panjang" : "istirahat"; }
      else pm.fase = "fokus";
      pm.sisa = FASE[pm.fase][0];
      $("pm-waktu").setAttribute("aria-live", "assertive");
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    }
    pmTampil();
  }
  $("pm-mulai").addEventListener("click", function () {
    if (pm.jalan) { pmBerhenti(); return; }
    $("pm-waktu").setAttribute("aria-live", "off");
    pm.akhir = Date.now() + pm.sisa * 1000;
    pm.jalan = setInterval(pmTik, 1000); pmTampil();
  });
  $("pm-ulang").addEventListener("click", function () { pmBerhenti(); pm.fase = "fokus"; pm.sisa = FASE.fokus[0]; pmTampil(); });

  /* ---------- Ganti PIN ---------- */
  $("form-pin").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, st = $("pin-status"), btn = f.querySelector("button[type=submit]");
    if (tandaiWajib(f)) { status(st, "Isi semua kolom.", "err"); return; }
    var baru = $("pin-baru").value;
    if (!/^\d{6}$/.test(baru)) { salah($("pin-baru"), "PIN baru harus 6 angka.", st); return; }
    if (pinMudah(baru)) { salah($("pin-baru"), "PIN terlalu mudah ditebak.", st); return; }
    if (baru !== $("pin-ulang").value) { salah($("pin-ulang"), "Ulangan PIN belum sama.", st); return; }
    sibuk(btn, true, "Menyimpan…");
    api("gantiPin", { lama: $("pin-lama").value, baru: baru }).then(function (d) {
      if (!d.ok) { status(st, d.error, "err"); return; }
      f.reset(); status(st, "PIN berhasil diganti.", "ok");
    }).catch(function (err) { if (err.message !== "auth") status(st, "Koneksi bermasalah. Coba lagi.", "err"); }).finally(function () { sibuk(btn, false); });
  });

  /* ---------- Mulai ---------- */
  pmTampil();
  var lama = bacaSesi();
  if (lama && lama.token && URL_API) {
    sesi = lama;
    api("cekSesi").then(function (d) { if (d.ok) { sesi.nama = d.nama; sesi.kelas = d.kelas; simpanSesi(sesi); tampilPortal(); } }).catch(function () {});
  }
  if (location.hash === "#aktivasi") pilihMode("aktivasi");
})();
