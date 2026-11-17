// Angket BK untuk siswa: persetujuan → data diri (sekali) → AKPD, DCM, sosiometri.
// Nama dan kelas diambil dari akun yang sedang masuk (sesi portal siswa), bukan diketik ulang.
(function () {
  "use strict";
  var URL_API = ((window.BK_CONFIG || {}).SCRIPT_URL || "").trim();
  var D = window.BK_ANGKET, KEY = "bk_siswa_sesi";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var sesi = null, st = null, layar = "beranda", dcmHal = 0;
  try { sesi = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) {}
  var isi = $("ak-isi"), stEl = $("ak-status"), h1 = $("ak-h1");

  function status(msg, type) { stEl.textContent = msg || ""; stEl.className = "form-status" + (type ? " " + type : ""); }
  function keLogin() { try { sessionStorage.removeItem(KEY); } catch (e) {} location.replace("siswa.html"); }
  function api(action, extra) {
    var body = { peran: "siswa", action: action, token: sesi.token };
    for (var k in extra || {}) body[k] = extra[k];
    return fetch(URL_API, { method: "POST", body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.auth === false) { keLogin(); throw new Error("auth"); } return d; });
  }
  // Draf jawaban disimpan di perangkat ini saja supaya tidak hilang bila halaman tertutup.
  var kunciDraf = function (j) { return "bk_angket_draf_" + j + "_" + (sesi.nama + "|" + sesi.kelas).toLowerCase(); };
  function bacaDraf(j) { try { return JSON.parse(localStorage.getItem(kunciDraf(j)) || "null"); } catch (e) { return null; } }
  function tulisDraf(j, v) { try { v == null ? localStorage.removeItem(kunciDraf(j)) : localStorage.setItem(kunciDraf(j), JSON.stringify(v)); } catch (e) {} }

  function buka(l) { layar = l; status(""); gambar(); window.scrollTo(0, 0); h1.focus({ preventScroll: true }); }
  function kirim(btn, action, data, sesudah) {
    var label = btn.textContent; btn.disabled = true; btn.textContent = "Menyimpan…"; status("");
    api(action, { data: data }).then(function (d) {
      btn.disabled = false; btn.textContent = label;
      if (!d.ok) { status(d.error || "Belum tersimpan. Coba lagi.", "err"); stEl.scrollIntoView({ block: "center" }); return; }
      st = d; sesudah(d);
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = label;
      if (e.message !== "auth") { status("Koneksi bermasalah, jawabanmu BELUM terkirim. Jawabanmu masih ada di halaman ini. Coba tekan kirim lagi.", "err"); stEl.scrollIntoView({ block: "center" }); }
    });
  }
  var kartu = function (html, extra) { return '<section class="card-form" style="padding: 24px; gap: 16px"' + (extra || "") + ">" + html + "</section>"; };
  var kembali = '<button type="button" class="btn-line" data-ke="beranda">← Kembali</button>';

  /* ---------- Beranda ---------- */
  function vBeranda() {
    h1.textContent = "Angket BK";
    var p = st.persetujuan, setuju = p && p.keputusan === "Setuju";
    function baris(judul, ket, selesai, terbuka, ke, teksTombol) {
      var kanan = selesai ? '<span class="pill pill-selesai">Sudah diisi ✓</span>' : terbuka ? '<button type="button" class="btn-solid" data-ke="' + ke + '">' + teksTombol + "</button>" : '<span class="pill">Terkunci</span>';
      return '<li class="' + (!selesai && !terbuka ? "kunci" : "") + '"><div class="ak-kiri"><p class="ak-judul">' + judul + '</p><p class="ak-ket">' + ket + "</p></div>" + kanan + "</li>";
    }
    var awal = '<ol class="ak-langkah">' +
      baris("1. Persetujuan", setuju ? "Kamu sudah setuju pada " + esc(p.waktu) + "." : p ? "Kamu memilih belum setuju. Kamu boleh membacanya lagi kapan saja." : "Baca dulu penjelasannya, lalu pilih setuju atau belum.", setuju, true, "persetujuan", p ? "Baca lagi" : "Mulai") +
      baris("2. Data diri", "Cukup sekali. Setelah ini nama dan kelasmu muncul otomatis di setiap angket.", st.latar, setuju, "latar", "Isi data diri") + "</ol>";
    var ortu = st.wajibOrtu && !st.ortu && setuju && st.latar ? '<p class="form-status err" style="margin: 0">Persetujuan dan data dirimu sudah tercatat. Angket baru terbuka setelah guru BK mencatat izin dari orang tuamu. Tanyakan lembar izinnya ke guru BK.</p>' : "";
    var ang = '<ol class="ak-langkah">' +
      baris("Angket Kebutuhan (AKPD)", "50 pernyataan, jawab Ya atau Tidak. Kira-kira 10 menit.", st.akpd, st.siap, "akpd", bacaDraf("akpd") ? "Lanjutkan" : "Isi") +
      baris("Daftar Cek Masalah (DCM)", "240 pernyataan dalam 12 bagian. Centang yang kamu alami. Kira-kira 30 menit, boleh dicicil.", st.dcm, st.siap, "dcm", bacaDraf("dcm") ? "Lanjutkan" : "Isi") +
      baris("Sosiometri", "8 pertanyaan tentang teman sekelas. Kira-kira 5 menit.", st.sosio, st.siap, "sosio", bacaDraf("sosio") ? "Lanjutkan" : "Isi") + "</ol>";
    var lihat = st.latar ? '<p class="ak-catatan"><button type="button" class="btn-mini" data-ke="saya">Lihat data diri yang kusimpan</button></p>' : "";
    return kartu('<h2 class="dash-h" style="font-size: 19px">Sebelum mengisi angket</h2>' + awal + ortu + lihat) +
      kartu('<h2 class="dash-h" style="font-size: 19px">Angket</h2>' + ang +
        '<p class="ak-catatan">Setiap angket hanya bisa dikirim satu kali. Kalau ada yang keliru setelah terkirim, sampaikan ke guru BK supaya dibukakan lagi. Jawabanmu hanya dibaca guru BK.</p>');
  }

  /* ---------- Persetujuan ---------- */
  function vPersetujuan() {
    h1.textContent = "Persetujuan";
    var teks = D.persetujuan.map(function (x) { return "<h3>" + esc(x[0]) + "</h3><p>" + esc(x[1]) + "</p>"; }).join("");
    var sudah = st.persetujuan && st.persetujuan.keputusan === "Setuju";
    return kartu('<div class="ak-teks">' + teks + "</div>" +
      (sudah ? '<p class="form-status ok" style="margin: 0">Kamu sudah menyetujui ini pada ' + esc(st.persetujuan.waktu) + ".</p>" + '<div class="ak-nav">' + kembali + "</div>" :
        '<label class="check"><input type="checkbox" id="ps-baca"> <span>Aku sudah membaca dan memahami penjelasan di atas.</span></label>' +
        '<div class="ak-nav">' + kembali + '<span style="display: flex; gap: 10px; flex-wrap: wrap"><button type="button" class="btn-line" id="ps-belum">Aku belum setuju</button><button type="button" class="btn-solid" id="ps-setuju">Aku setuju</button></span></div>' +
        '<p class="ak-catatan">Atas nama <strong>' + esc(st.nama) + "</strong>, kelas " + esc(st.kelas) + ". Pilihanmu dicatat bersama tanggal hari ini.</p>"));
  }

  /* ---------- Data diri ---------- */
  function vLatar() {
    h1.textContent = "Data diri";
    var d = bacaDraf("latar") || {};
    var f = D.latar.map(function (x) {
      var id = "lt-" + x[0], req = x[4] ? " required" : "", v = esc(d[x[0]] || ""), el;
      if (x[2] === "select") el = '<select id="' + id + '"' + req + '><option value="">Pilih…</option>' + x[3].map(function (o) { return "<option" + (d[x[0]] === o ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select>";
      else if (x[2] === "area") el = '<textarea id="' + id + '" rows="3" maxlength="500">' + v + "</textarea>";
      else el = '<input id="' + id + '" type="' + x[2] + '"' + (x[2] === "number" ? ' min="0" max="20" inputmode="numeric"' : "") + ' maxlength="200" value="' + v + '"' + req + ">";
      return '<div class="field"' + (x[2] === "area" || x[0] === "alamat" ? ' style="grid-column: 1 / -1"' : "") + '><label for="' + id + '">' + esc(x[1]) + (x[4] ? "" : ' <span class="muted" style="font-weight: 400">(boleh dikosongkan)</span>') + "</label>" + el + "</div>";
    }).join("");
    return kartu('<dl class="ak-kv"><dt>Nama</dt><dd><strong>' + esc(st.nama) + "</strong></dd><dt>Kelas</dt><dd><strong>" + esc(st.kelas) + '</strong></dd></dl><p class="ak-catatan">Nama dan kelas diambil dari akunmu. Kalau keliru, sampaikan ke guru BK.</p>' +
      '<form id="form-latar" novalidate style="display: flex; flex-direction: column; gap: 16px"><div class="ak-g2">' + f + "</div>" +
      '<div class="ak-nav">' + kembali + '<button type="submit" class="btn-solid">Simpan data diri</button></div></form>' +
      '<p class="ak-catatan">Data diri hanya bisa disimpan satu kali. Periksa lagi sebelum menyimpan.</p>');
  }
  function nilaiLatar() { var o = {}; D.latar.forEach(function (x) { var e = $("lt-" + x[0]); if (e) o[x[0]] = e.value.trim(); }); return o; }

  function vSaya(d) {
    h1.textContent = "Data diriku";
    return kartu('<dl class="ak-kv"><dt>Nama</dt><dd>' + esc(st.nama) + "</dd><dt>Kelas</dt><dd>" + esc(st.kelas) + "</dd>" +
      d.data.map(function (x) { return "<dt>" + esc(x[0]) + "</dt><dd>" + (esc(x[1]) || "–") + "</dd>"; }).join("") + "</dl>" +
      '<p class="ak-catatan">Ada yang perlu diperbaiki? Sampaikan ke guru BK.</p><div class="ak-nav">' + kembali + "</div>");
  }

  function kepala(petunjuk) {
    return '<dl class="ak-kv"><dt>Nama</dt><dd><strong>' + esc(st.nama) + "</strong></dd><dt>Kelas</dt><dd><strong>" + esc(st.kelas) + "</strong></dd></dl>" +
      '<div class="ak-teks">' + petunjuk.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>";
  }

  /* ---------- AKPD ---------- */
  function vAkpd() {
    h1.textContent = "Angket Kebutuhan (AKPD)";
    var A = D.akpd[st.jenjang];
    if (!A) return kartu('<p class="form-status err" style="margin: 0">Angket untuk kelasmu belum tersedia. Sampaikan ke guru BK.</p><div class="ak-nav">' + kembali + "</div>");
    var d = bacaDraf("akpd") || [];
    var butir = A.q.map(function (q, k) {
      var n = "ak" + k;
      return '<div class="ak-butir" id="b' + k + '" role="group" aria-label="Nomor ' + (k + 1) + '"><span class="ak-no">' + (k + 1) + ".</span><p>" + esc(q) + '</p><span class="ak-yt">' +
        '<label><input type="radio" name="' + n + '" value="1"' + (d[k] === true ? " checked" : "") + "><span>Ya</span></label>" +
        '<label><input type="radio" name="' + n + '" value="0"' + (d[k] === false ? " checked" : "") + "><span>Tidak</span></label></span></div>";
    }).join("");
    return kartu(kepala(A.pet)) + kartu('<form id="form-akpd" novalidate>' + butir + "</form>") +
      kartu('<p class="ak-catatan" id="akpd-hitung" aria-live="polite"></p><div class="ak-nav">' + kembali + '<button type="button" class="btn-solid" id="akpd-kirim">Kirim jawaban</button></div>');
  }
  function jawabAkpd() {
    var n = D.akpd[st.jenjang].q.length, out = [];
    for (var k = 0; k < n; k++) { var c = document.querySelector('input[name="ak' + k + '"]:checked'); out.push(c ? c.value === "1" : null); }
    return out;
  }
  function hitungAkpd() { var j = jawabAkpd(), t = j.filter(function (x) { return x !== null; }).length; var e = $("akpd-hitung"); if (e) e.textContent = "Terjawab " + t + " dari " + j.length + "."; return j; }

  /* ---------- DCM ---------- */
  var dcm = null;
  function vDcm() {
    h1.textContent = "Daftar Cek Masalah (DCM)";
    if (!dcm) dcm = bacaDraf("dcm") || { n: {}, a: "", b: "", c: "", d: "" };
    var T = D.dcm.topik, total = T.length + 2, maju = '<div class="ak-maju" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + (dcmHal + 1) + '" aria-label="Kemajuan"><span style="width:' + Math.round((dcmHal + 1) / total * 100) + '%"></span></div>';
    var nav = function (akhir) {
      return '<div class="ak-nav"><button type="button" class="btn-line" id="dcm-mundur">' + (dcmHal ? "← Sebelumnya" : "← Kembali") + "</button>" +
        (akhir ? '<button type="button" class="btn-solid" id="dcm-kirim">Kirim jawaban</button>' : '<button type="button" class="btn-solid" id="dcm-maju">Berikutnya →</button>') + "</div>";
    };
    if (dcmHal === 0) return kartu(maju + kepala(D.dcm.intro) + '<p class="ak-catatan">Centang hanya pernyataan yang benar-benar kamu alami. Yang tidak kamu alami, biarkan kosong. Jawabanmu tersimpan sementara di perangkat ini sampai kamu mengirimnya.</p>' + nav());
    if (dcmHal <= T.length) {
      var t = T[dcmHal - 1], awal = (dcmHal - 1) * 20;
      return kartu(maju + '<h2 class="dash-h" style="font-size: 19px">Bagian ' + dcmHal + " dari " + T.length + ": " + esc(t.s || t.n) + "</h2>" +
        '<div id="dcm-butir">' + t.q.map(function (q, k) { var no = awal + k + 1; return '<label class="ak-cek"><input type="checkbox" data-no="' + no + '"' + (dcm.n[no] ? " checked" : "") + '><span class="ak-no">' + no + ".</span><span>" + esc(q) + "</span></label>"; }).join("") + "</div>" + nav());
    }
    var jml = Object.keys(dcm.n).length;
    return kartu(maju + '<h2 class="dash-h" style="font-size: 19px">Pertanyaan penutup</h2>' +
      '<div class="field"><label for="dc-a">241. ' + esc(D.dcm.open[0]) + '</label><textarea id="dc-a" rows="2" maxlength="500">' + esc(dcm.a) + "</textarea></div>" +
      '<div class="field"><label for="dc-b">242. ' + esc(D.dcm.open[1]) + '</label><textarea id="dc-b" rows="2" maxlength="500">' + esc(dcm.b) + "</textarea></div>" +
      '<div class="field"><label for="dc-c">243. ' + esc(D.dcm.open[2]) + '</label><select id="dc-c"><option value="">Pilih…</option>' + ["Suka", "Tidak suka"].map(function (o) { return "<option" + (dcm.c === o ? " selected" : "") + ">" + o + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label for="dc-d">Kalau suka, dengan siapa?</label><input id="dc-d" type="text" maxlength="200" value="' + esc(dcm.d) + '"></div>' +
      '<p class="ak-catatan">Kamu mencentang <strong>' + jml + "</strong> dari 240 pernyataan." + (jml ? "" : " Kalau memang tidak ada yang kamu alami, kamu tetap boleh mengirim.") + "</p>" + nav(true));
  }
  function simpanDcmLayar() {
    document.querySelectorAll("#dcm-butir input").forEach(function (c) { if (c.checked) dcm.n[c.dataset.no] = 1; else delete dcm.n[c.dataset.no]; });
    ["a", "b", "c", "d"].forEach(function (k) { var e = $("dc-" + k); if (e) dcm[k] = e.value.trim(); });
    tulisDraf("dcm", dcm);
  }

  /* ---------- Sosiometri ---------- */
  function vSosio() {
    h1.textContent = "Sosiometri";
    var d = bacaDraf("sosio") || {}, teman = st.teman || [];
    if (teman.length < 2) return kartu('<p class="form-status err" style="margin: 0">Daftar teman sekelasmu belum tersedia. Sampaikan ke guru BK.</p><div class="ak-nav">' + kembali + "</div>");
    var pilihan = function (v) { return '<option value="">Pilih nama…</option>' + teman.map(function (t) { return "<option" + (v === t ? " selected" : "") + ">" + esc(t) + "</option>"; }).join(""); };
    function blok(huruf, arr, wajib) {
      return arr.map(function (q, k) {
        var id = "so-" + huruf + k;
        return '<div class="ak-g2" style="padding: 14px 0; border-top: 1px solid #ECE8DA"><div class="field"><label for="' + id + '">' + huruf.toUpperCase() + (k + 1) + ". " + esc(q) + (wajib ? "" : ' <span class="muted" style="font-weight: 400">(boleh dikosongkan)</span>') + '</label><select id="' + id + '">' + pilihan(d[id]) + "</select></div>" +
          '<div class="field"><label for="' + id + 'x">Alasan</label><input id="' + id + 'x" type="text" maxlength="300" value="' + esc(d[id + "x"] || "") + '"></div></div>';
      }).join("");
    }
    return kartu(kepala([D.sos.intro.join("").replace(/\s+/g, " ")])) +
      kartu('<form id="form-sosio" novalidate><h2 class="dash-h" style="font-size: 19px">A. Teman yang kupilih</h2>' + blok("a", D.sos.A, true) +
        '<h2 class="dash-h" style="font-size: 19px; margin-top: 20px">B. Teman yang ingin kujauhi</h2><p class="ak-catatan" style="margin: 6px 0 0">Bagian ini boleh dikosongkan kalau memang tidak ada. Jawabanmu tidak akan diberitahukan kepada temanmu.</p>' + blok("b", D.sos.B, false) + "</form>") +
      kartu('<div class="ak-nav">' + kembali + '<button type="button" class="btn-solid" id="sosio-kirim">Kirim jawaban</button></div>');
  }
  function nilaiSosio() { var o = {}; document.querySelectorAll("#form-sosio select, #form-sosio input").forEach(function (e) { o[e.id] = e.value.trim(); }); return o; }

  function vSelesai(nama) {
    h1.textContent = "Terkirim";
    return kartu('<p class="form-status ok" style="margin: 0">Jawaban ' + nama + " atas nama " + esc(st.nama) + " (" + esc(st.kelas) + ') sudah tersimpan. Terima kasih sudah mengisi dengan jujur.</p><p class="ak-catatan">Kalau ada hal yang ingin kamu ceritakan setelah mengisi angket ini, kamu bisa mengajukan konseling dari portal siswa.</p><div class="ak-nav"><button type="button" class="btn-solid" data-ke="beranda">Kembali ke daftar angket</button></div>');
  }

  var selesai = null, saya = null;
  function gambar() {
    $("ak-siapa").hidden = false; $("ak-siapa").textContent = st.nama + " · " + st.kelas;
    var terkunci = (layar === "akpd" || layar === "dcm" || layar === "sosio") && (!st.siap || st[layar]);
    if (layar === "latar" && (st.latar || !st.persetujuan || st.persetujuan.keputusan !== "Setuju")) terkunci = true;
    if (terkunci) layar = "beranda";
    isi.innerHTML = layar === "persetujuan" ? vPersetujuan() : layar === "latar" ? vLatar() : layar === "akpd" ? vAkpd() : layar === "dcm" ? vDcm() : layar === "sosio" ? vSosio() : layar === "selesai" ? vSelesai(selesai) : layar === "saya" && saya ? vSaya(saya) : vBeranda();
    if (layar === "akpd") hitungAkpd();
  }

  isi.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.ke === "saya") { api("dataSayaAngket").then(function (d) { if (d.ok) { saya = d; buka("saya"); } }).catch(function () {}); return; }
    if (b.dataset.ke) { if (layar === "dcm") simpanDcmLayar(); if (b.dataset.ke === "dcm") dcmHal = 0; buka(b.dataset.ke); return; }
    if (b.id === "ps-setuju") {
      if (!$("ps-baca").checked) { status("Centang dulu bahwa kamu sudah membaca penjelasannya.", "err"); $("ps-baca").focus(); return; }
      kirim(b, "simpanPersetujuan", { setuju: true }, function () { buka("latar"); status("Persetujuanmu tercatat. Sekarang lengkapi data dirimu.", "ok"); });
    }
    if (b.id === "ps-belum") kirim(b, "simpanPersetujuan", { setuju: false }, function () { buka("beranda"); status("Pilihanmu tercatat. Tidak apa-apa. Kalau ada yang ingin ditanyakan dulu, temui guru BK.", "ok"); });
    if (b.id === "akpd-kirim") {
      var j = hitungAkpd(), kosong = j.indexOf(null);
      document.querySelectorAll(".ak-butir.kosong").forEach(function (x) { x.classList.remove("kosong"); });
      if (kosong >= 0) {
        j.forEach(function (x, k) { if (x === null) $("b" + k).classList.add("kosong"); });
        status("Masih ada " + j.filter(function (x) { return x === null; }).length + " pernyataan yang belum dijawab. Yang pertama nomor " + (kosong + 1) + ".", "err");
        $("b" + kosong).scrollIntoView({ block: "center" }); var r = $("b" + kosong).querySelector("input"); if (r) r.focus({ preventScroll: true }); return;
      }
      kirim(b, "simpanAkpd", { jawaban: j }, function () { tulisDraf("akpd", null); selesai = "AKPD"; buka("selesai"); });
    }
    if (b.id === "dcm-maju") { simpanDcmLayar(); dcmHal++; buka("dcm"); }
    if (b.id === "dcm-mundur") { simpanDcmLayar(); if (dcmHal) { dcmHal--; buka("dcm"); } else buka("beranda"); }
    if (b.id === "dcm-kirim") {
      simpanDcmLayar();
      kirim(b, "simpanDcm", { nomor: Object.keys(dcm.n).map(Number), isian: { a: dcm.a, b: dcm.b, c: dcm.c, d: dcm.d } }, function () { tulisDraf("dcm", null); dcm = null; dcmHal = 0; selesai = "DCM"; buka("selesai"); });
    }
    if (b.id === "sosio-kirim") {
      var v = nilaiSosio(), o = { pilih: [], alasanPilih: [], tolak: [], alasanTolak: [] }, galat = "", fokus = null;
      for (var k = 0; k < 4; k++) {
        o.pilih.push(v["so-a" + k]); o.alasanPilih.push(v["so-a" + k + "x"]); o.tolak.push(v["so-b" + k]); o.alasanTolak.push(v["so-b" + k + "x"]);
        if (!galat && !v["so-a" + k]) { galat = "Pertanyaan A" + (k + 1) + " belum diisi."; fokus = "so-a" + k; }
        if (!galat && v["so-b" + k] && v["so-b" + k] === v["so-a" + k]) { galat = "Pada nomor " + (k + 1) + ", teman yang dipilih dan yang dijauhi tidak boleh orang yang sama."; fokus = "so-b" + k; }
      }
      if (galat) { status(galat, "err"); $(fokus).focus(); return; }
      kirim(b, "simpanSosio", o, function () { tulisDraf("sosio", null); selesai = "sosiometri"; buka("selesai"); });
    }
  });
  isi.addEventListener("submit", function (e) {
    e.preventDefault();
    if (e.target.id !== "form-latar") return;
    var v = nilaiLatar(), kurang = null;
    D.latar.forEach(function (x) { var el = $("lt-" + x[0]), k = x[4] && !v[x[0]]; el.setAttribute("aria-invalid", k ? "true" : "false"); if (k && !kurang) kurang = x; });
    if (kurang) { status('Bagian "' + kurang[1] + '" belum diisi.', "err"); $("lt-" + kurang[0]).focus(); return; }
    kirim(e.target.querySelector('button[type="submit"]'), "simpanLatar", v, function () { tulisDraf("latar", null); buka("beranda"); status(st.siap ? "Data dirimu tersimpan. Angket sudah bisa kamu isi." : "Data dirimu tersimpan.", "ok"); });
  });
  isi.addEventListener("change", function (e) {
    if (layar === "akpd") { tulisDraf("akpd", hitungAkpd()); var bb = e.target.closest(".ak-butir"); if (bb) bb.classList.remove("kosong"); }
    else if (layar === "dcm") simpanDcmLayar();
    else if (layar === "sosio") tulisDraf("sosio", nilaiSosio());
    else if (layar === "latar") tulisDraf("latar", nilaiLatar());
  });
  isi.addEventListener("input", function () { if (layar === "latar") tulisDraf("latar", nilaiLatar()); else if (layar === "sosio") tulisDraf("sosio", nilaiSosio()); });

  if (!sesi || !sesi.token) { location.replace("siswa.html"); return; }
  if (!URL_API || !D) { status("Angket belum bisa dibuka. Sampaikan ke guru BK.", "err"); return; }
  status("Memuat…");
  api("angketStatus").then(function (d) {
    if (!d.ok) { status(d.error || "Angket belum bisa dibuka. Sampaikan ke guru BK.", "err"); return; }
    st = d; status(""); gambar();
  }).catch(function (e) { if (e.message !== "auth") status("Koneksi bermasalah. Muat ulang halaman ini.", "err"); });
})();
