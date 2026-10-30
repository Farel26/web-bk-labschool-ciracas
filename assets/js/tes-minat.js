(function () {
  "use strict";
  var R = window.RIASEC;
  var URL_API = ((window.BK_CONFIG || {}).SCRIPT_URL || "").trim();
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var tglPanjang = function (iso) { var p = String(iso || "").split("-"); return p.length === 3 ? +p[2] + " " + BULAN[+p[1] - 1] + " " + p[0] : ""; };
  var hariIni = function () { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  var PER_HAL = 7, JML_HAL = 6;
  var jawaban = new Array(42).fill(""), hal = 0, identitas = null, sedangTes = false;

  function status(el, msg, type) { el.textContent = msg || ""; el.className = "form-status" + (type ? " " + type : ""); }
  function tampil(id) {
    document.querySelectorAll(".tm-step").forEach(function (s) { s.hidden = s.id !== id; });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function buatKode() {
    var abjad = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "", arr = new Uint32Array(6);
    (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(arr) : arr.forEach(function (_, i) { arr[i] = Math.random() * 1e9; });
    for (var i = 0; i < 6; i++) s += abjad.charAt(arr[i] % abjad.length);
    return "RM-" + s;
  }

  /* ---------- 1. Persetujuan ---------- */
  $("form-persetujuan").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!$("tm-setuju").checked) { status($("persetujuan-status"), "Centang persetujuan terlebih dahulu untuk memulai tes.", "err"); $("tm-setuju").focus(); return; }
    status($("persetujuan-status"), "");
    tampil("tm-identitas"); $("tm-nama").focus({ preventScroll: true });
  });
  $("tm-setuju").addEventListener("change", function () { status($("persetujuan-status"), ""); });
  document.querySelectorAll("[data-kembali]").forEach(function (b) { b.addEventListener("click", function () { tampil(b.dataset.kembali); }); });

  /* ---------- 2. Identitas ---------- */
  $("form-identitas").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("identitas-status"), bad = null;
    function cek(el, ok) { el.setAttribute("aria-invalid", ok ? "false" : "true"); if (!ok && !bad) bad = el; }
    var jk = document.querySelector("input[name=tm-jk]:checked");
    var usia = Number($("tm-usia").value);
    cek($("tm-nama"), $("tm-nama").value.trim().length >= 3);
    cek($("tm-kelas"), /^\s*\d{1,2}\s*[A-Za-z]?\s*$/.test($("tm-kelas").value));
    $("tm-jk-set").setAttribute("aria-invalid", jk ? "false" : "true"); if (!jk && !bad) bad = document.querySelector("input[name=tm-jk]");
    cek($("tm-usia"), usia >= 9 && usia <= 20);
    if (bad) {
      status(st, !jk && bad.name === "tm-jk" ? "Pilih jenis kelamin." : bad.id === "tm-usia" ? "Isi usia dengan angka antara 9 dan 20." : bad.id === "tm-kelas" ? "Isi kelas, misalnya 7B." : "Isi nama lengkapmu.", "err");
      bad.focus(); return;
    }
    identitas = { nama: $("tm-nama").value.trim(), kelas: $("tm-kelas").value.replace(/\s+/g, "").toUpperCase(), absen: $("tm-absen").value,
      jk: jk.value, usia: usia, cita: $("tm-cita").value.trim(), rencana: $("tm-rencana").value, website: $("tm-website").value };
    status(st, ""); sedangTes = true; hal = 0; gambarHalaman(); tampil("tm-soal");
  });
  ["tm-nama", "tm-kelas", "tm-usia"].forEach(function (id) { $(id).addEventListener("input", function () { $(id).setAttribute("aria-invalid", "false"); }); });
  document.querySelectorAll("input[name=tm-jk]").forEach(function (r) { r.addEventListener("change", function () { $("tm-jk-set").setAttribute("aria-invalid", "false"); }); });

  /* ---------- 3. Soal ---------- */
  function terjawab() { return jawaban.filter(Boolean).length; }
  function perbaruiProgress() {
    var n = terjawab();
    $("tm-bar").style.width = Math.round(n / 42 * 100) + "%";
    document.querySelector(".tm-progress").setAttribute("aria-valuenow", n);
    $("tm-progress-teks").textContent = n + " dari 42 dijawab";
  }
  function gambarHalaman() {
    var awal = hal * PER_HAL;
    $("tm-hal-judul").textContent = "Halaman " + (hal + 1) + " dari " + JML_HAL;
    $("tm-butir").innerHTML = R.BUTIR.slice(awal, awal + PER_HAL).map(function (teks, j) {
      var i = awal + j, v = jawaban[i];
      return '<li class="tm-item" id="tm-item-' + i + '"><fieldset><legend><span class="tm-no">' + (i + 1) + "</span>" + esc(teks) + "</legend>" +
        '<div class="tm-opsi"><label class="tm-pil"><input type="radio" name="b' + i + '" value="1"' + (v === "1" ? " checked" : "") + '><span>Ya, sesuai</span></label>' +
        '<label class="tm-pil"><input type="radio" name="b' + i + '" value="0"' + (v === "0" ? " checked" : "") + "><span>Tidak</span></label></div></fieldset></li>";
    }).join("");
    $("tm-sebelum").hidden = hal === 0;
    $("tm-lanjut").textContent = hal === JML_HAL - 1 ? "Lihat hasil" : "Lanjut";
    status($("soal-status"), "");
    perbaruiProgress();
  }
  $("tm-butir").addEventListener("change", function (e) {
    var r = e.target; if (r.type !== "radio") return;
    var i = +r.name.slice(1); jawaban[i] = r.value;
    $("tm-item-" + i).classList.remove("tm-kurang");
    perbaruiProgress();
  });
  $("tm-sebelum").addEventListener("click", function () { if (hal > 0) { hal--; gambarHalaman(); $("tm-hal-judul").focus(); window.scrollTo({ top: 0, behavior: "smooth" }); } });
  $("form-soal").addEventListener("submit", function (e) {
    e.preventDefault();
    var awal = hal * PER_HAL, kosong = [];
    for (var i = awal; i < awal + PER_HAL; i++) if (!jawaban[i]) kosong.push(i);
    if (kosong.length) {
      kosong.forEach(function (i) { $("tm-item-" + i).classList.add("tm-kurang"); });
      status($("soal-status"), kosong.length + " pernyataan belum dijawab: nomor " + kosong.map(function (i) { return i + 1; }).join(", ") + ".", "err");
      var el = document.querySelector("#tm-item-" + kosong[0] + " input"); el.focus(); el.scrollIntoView({ block: "center" });
      return;
    }
    if (hal < JML_HAL - 1) { hal++; gambarHalaman(); $("tm-hal-judul").focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    selesai();
  });
  window.addEventListener("beforeunload", function (e) { if (sedangTes && terjawab() > 0) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- 4. Kirim & hasil ---------- */
  var kirimanTerakhir = null;
  function selesai() {
    var jw = jawaban.join("");
    var h = R.hitung(jw);
    var kode = buatKode();
    kirimanTerakhir = { kode: kode, setuju: true, jawaban: jw };
    for (var k in identitas) kirimanTerakhir[k] = identitas[k];
    sedangTes = false;
    tampilHasil({ kode: kode, nama: identitas.nama, kelas: identitas.kelas, tanggal: hariIni(), skor: h.skor, kodeMinat: h.kode, seri: h.seri, baru: true });
    try { history.replaceState(null, "", "?kode=" + kode); } catch (err) {}
    kirim();
  }
  function kirim() {
    var st = $("simpan-status"), ulang = $("btn-kirim-ulang");
    if (!st) return;
    status(st, "Menyimpan hasil ke data BK…", ""); if (ulang) ulang.hidden = true;
    if (!URL_API) { status(st, "Layanan belum tersambung. Tunjukkan hasil ini kepada guru BK.", "err"); return; }
    fetch(URL_API, { method: "POST", body: JSON.stringify({ action: "simpanRiasec", data: kirimanTerakhir }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) throw new Error(d.error || "Gagal menyimpan.");
        status(st, "Hasil sudah tersimpan dan bisa dilihat guru BK.", "ok");
      })
      .catch(function (err) {
        status(st, (err.message === "Failed to fetch" ? "Koneksi terputus, hasil belum tersimpan." : err.message) + " Tekan Kirim ulang.", "err");
        if (ulang) ulang.hidden = false;
      });
  }

  function heksagon(skor, warna) {
    // Heksagon Holland: R kiri atas, lalu searah jarum jam I, A, S, E, C.
    var cx = 160, cy = 150, rad = 110, sudut = [-120, -60, 0, 60, 120, 180];
    function titik(k, f) { var a = sudut[R.URUT.indexOf(k)] * Math.PI / 180; return [cx + rad * f * Math.cos(a), cy + rad * f * Math.sin(a)]; }
    var grid = [1, 2 / 3, 1 / 3].map(function (f) {
      return '<polygon points="' + R.URUT.map(function (k) { return titik(k, f).map(function (v) { return v.toFixed(1); }).join(","); }).join(" ") + '" fill="none" stroke="#D9DCE6" stroke-width="1.5"/>';
    }).join("");
    var sumbu = R.URUT.map(function (k) { var p = titik(k, 1); return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#E5E7EB" stroke-width="1.5"/>'; }).join("");
    var poli = R.URUT.map(function (k) { return titik(k, Math.max(skor[k], 0.15) / 7).map(function (v) { return v.toFixed(1); }).join(","); }).join(" ");
    var label = R.URUT.map(function (k) {
      var p = titik(k, 1.2), t = R.TIPE[k];
      return '<g><circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="17" fill="' + t.warna + '"/><text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 6).toFixed(1) + '" text-anchor="middle" font-family="Rubik, sans-serif" font-weight="800" font-size="17" fill="#FFFFFF">' + k + "</text></g>";
    }).join("");
    var desc = R.URUT.map(function (k) { return R.TIPE[k].id + " " + skor[k]; }).join(", ");
    return '<svg class="tm-heks" viewBox="0 0 320 300" role="img" aria-label="Heksagon minat: ' + desc + ' dari 7">' + grid + sumbu +
      '<polygon points="' + poli + '" fill="' + warna + '33" stroke="' + warna + '" stroke-width="3" stroke-linejoin="round"/>' +
      R.URUT.map(function (k) { var p = titik(k, Math.max(skor[k], 0.15) / 7); return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4.5" fill="' + warna + '"/>'; }).join("") +
      label + "</svg>";
  }

  function kartuPekerjaan(t) {
    return '<ul class="tm-kerja">' + t.pekerjaan.map(function (p) {
      return '<li style="--c:' + t.warna + ";--bg:" + t.latar + '"><span class="tm-kerja-ikon">' + R.ikon(p.ikon, t.warna) + "</span><div><strong>" + esc(p.nama) + "</strong><span>" + esc(p.ket) + "</span></div></li>";
    }).join("") + "</ul>";
  }
  function chips(list, t) { return '<ul class="tm-chips">' + list.map(function (x) { return '<li style="--c:' + t.warna + ";--bg:" + t.latar + '">' + esc(x) + "</li>"; }).join("") + "</ul>"; }

  function tampilHasil(d) {
    var skor = d.skor, kode = String(d.kodeMinat || "").split(""), utama = R.TIPE[kode[0]];
    var urut = R.URUT.slice().sort(function (a, b) { return skor[b] - skor[a] || R.URUT.indexOf(a) - R.URUT.indexOf(b); });
    var total = R.URUT.reduce(function (t, k) { return t + skor[k]; }, 0);
    var nama = String(d.nama || "").split(/\s+/)[0];
    var html =
      '<div class="tm-hasil-kepala" style="--c:' + utama.warna + ";--bg:" + utama.latar + '">' +
        '<p class="tm-langkah" style="color:' + utama.warna + '">Hasil tes minat karier</p>' +
        '<h1 class="h2" style="margin-top:6px">' + (nama ? "Hai " + esc(nama) + ", ini" : "Ini") + " tipe minatmu</h1>" +
        '<p class="muted" style="margin:6px 0 0">' + esc([d.kelas && "Kelas " + d.kelas, d.tanggal && tglPanjang(d.tanggal)].filter(Boolean).join(" · ")) + "</p>" +
        '<div class="tm-kode" aria-label="Kode minat ' + kode.join(" ") + '">' + kode.map(function (k, i) {
          var t = R.TIPE[k]; return '<div class="tm-kode-huruf" style="--c:' + t.warna + '"><span class="tm-kh">' + k + '</span><span class="tm-kn">' + esc(t.id) + "</span><span class=\"tm-kr\">" + ["Terkuat", "Kedua", "Ketiga"][i] + "</span></div>";
        }).join("") + "</div>" +
        '<p class="tm-ringkas">Minat terkuatmu adalah <strong>' + esc(utama.id) + " (" + esc(utama.julukan) + ")</strong>, diikuti " + esc(R.TIPE[kode[1]].id) + " dan " + esc(R.TIPE[kode[2]].id) + ". " + esc(utama.ringkas) + "</p>" +
      "</div>";
    if (total < 3) html += '<aside class="tm-catatan">Kamu memilih "Ya" pada sedikit sekali pernyataan, sehingga hasil ini belum bisa menggambarkan minatmu dengan baik. Coba ulangi tes dengan lebih santai, atau bicarakan dengan guru BK.</aside>';
    else if (d.seri) html += '<aside class="tm-catatan">Beberapa tipe punya skor yang sama, jadi urutan huruf kode minatmu bisa dibaca lebih luwes. Diskusikan bersama guru BK tipe mana yang paling sesuai dengan dirimu.</aside>';

    html += '<section class="tm-sec"><h2>Profil minatmu</h2><div class="tm-grafik">' + heksagon(skor, utama.warna) +
      '<ul class="tm-skor">' + urut.map(function (k) {
        var t = R.TIPE[k];
        return '<li><span class="tm-skor-l"><b style="background:' + t.warna + '">' + k + "</b>" + esc(t.id) + '</span><span class="tm-skor-t"><span style="width:' + Math.round(skor[k] / 7 * 100) + "%;background:" + t.warna + '"></span></span><span class="tm-skor-n">' + skor[k] + "/7</span></li>";
      }).join("") + "</ul></div></section>";

    html += '<section class="tm-sec tm-utama" style="--c:' + utama.warna + ";--bg:" + utama.latar + '">' +
      '<div class="tm-utama-atas"><img src="' + utama.gambar + '" alt="" width="480" height="320"><div><span class="tm-badge" style="background:' + utama.warna + '">Tipe terkuat · ' + utama.kode + "</span><h2>" + esc(utama.id) + " · " + esc(utama.julukan) + "</h2><p>" + esc(utama.ringkas) + "</p>" +
      '<ul class="tm-ciri">' + utama.ciri.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div></div>" +
      "<h3>Contoh pekerjaan yang cocok untukmu</h3>" + kartuPekerjaan(utama) +
      '<div class="tm-dua"><div><h3>Jurusan kuliah yang cocok</h3>' + chips(utama.jurusan, utama) + "</div><div><h3>Bidang karier terkait</h3>" + chips(utama.jalur, utama) + "</div></div>" +
      "<h3>Yang bisa kamu coba sekarang di sekolah</h3><ul class=\"prose-list\">" + utama.kegiatan.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></section>";

    html += '<section class="tm-sec"><h2>Minat kedua dan ketiga</h2><div class="tm-lain">' + kode.slice(1).map(function (k) {
      var t = R.TIPE[k];
      return '<article class="tm-lain-kartu" style="--c:' + t.warna + ";--bg:" + t.latar + '"><img src="' + t.gambar + '" alt="" width="480" height="320" loading="lazy"><div class="tm-lain-isi">' +
        '<h3><b style="background:' + t.warna + '">' + k + "</b>" + esc(t.id) + " · " + esc(t.julukan) + "</h3><p>" + esc(t.ringkas) + "</p>" + kartuPekerjaan({ warna: t.warna, latar: t.latar, pekerjaan: t.pekerjaan.slice(0, 3) }) +
        '<p class="muted" style="margin:10px 0 0"><strong>Jurusan:</strong> ' + esc(t.jurusan.slice(0, 5).join(", ")) + ".</p></div></article>";
    }).join("") + "</div></section>";

    html += '<section class="tm-sec tm-penutup"><h2>Langkah selanjutnya</h2><ul class="prose-list">' +
      "<li>Hasil ini menggambarkan <strong>minat</strong>, bukan kemampuan atau kepastian masa depan. Minat bisa berkembang seiring waktu.</li>" +
      "<li>Ceritakan hasilmu kepada orang tua dan guru BK. Kalian bisa membahasnya bersama saat konseling karier.</li>" +
      "<li>Cari tahu lebih banyak tentang pekerjaan di atas, misalnya lewat video, buku, atau bertanya kepada orang yang bekerja di bidang itu.</li></ul>" +
      '<div class="tm-kode-akses"><div><span class="muted">Kode hasilmu</span><strong>' + esc(d.kode) + '</strong><span class="muted">Simpan kode ini untuk membuka hasilmu lagi di halaman ini.</span></div>' +
      '<div class="tombol-baris"><button type="button" class="btn-line" id="btn-cetak-hasil">Cetak atau simpan PDF</button><a class="btn-solid tm-a" href="index.html#konsultasi">Buat janji konseling karier</a></div></div>' +
      (d.baru ? '<p class="form-status" id="simpan-status" role="status" aria-live="polite"></p><button type="button" class="btn-mini" id="btn-kirim-ulang" hidden>Kirim ulang</button>' : "") +
      "</section>";

    $("tm-hasil").innerHTML = html;
    tampil("tm-hasil");
    $("btn-cetak-hasil").addEventListener("click", function () { window.print(); });
    if ($("btn-kirim-ulang")) $("btn-kirim-ulang").addEventListener("click", kirim);
  }

  /* ---------- Buka hasil dengan kode ---------- */
  function bukaKode(kode, st) {
    kode = String(kode || "").trim().toUpperCase();
    if (!/^RM-[A-Z0-9]{6}$/.test(kode)) { if (st) status(st, "Kode berbentuk RM-XXXXXX.", "err"); return; }
    if (!URL_API) return;
    if (st) status(st, "Mencari hasil…", "");
    fetch(URL_API + "?action=hasilMinat&kode=" + encodeURIComponent(kode)).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.found) { if (st) status(st, "Hasil dengan kode itu belum ditemukan. Periksa lagi kodenya.", "err"); else tampil("tm-persetujuan"); return; }
      tampilHasil(d);
      try { history.replaceState(null, "", "?kode=" + kode); } catch (err) {}
    }).catch(function () { if (st) status(st, "Koneksi bermasalah. Coba lagi.", "err"); });
  }
  $("form-buka").addEventListener("submit", function (e) { e.preventDefault(); bukaKode($("tm-kode-buka").value, $("buka-status")); });
  var awal = new URLSearchParams(location.search).get("kode");
  if (awal) { $("tm-kode-buka").value = awal; bukaKode(awal, $("buka-status")); }
})();
