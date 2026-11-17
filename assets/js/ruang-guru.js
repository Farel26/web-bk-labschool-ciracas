// Ruang Guru BK: Dasbor ringkasan dan Data siswa (NISN, NIS, akun, persetujuan, data diri).
// Data hanya diminta lewat sesi guru BK; NISN tidak pernah dikirim ke portal siswa atau wali kelas.
(function () {
  "use strict";
  var URL_API = ((window.BK_CONFIG || {}).SCRIPT_URL || "").trim(), KEY = "bk_guru_sesi";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var tglPanjang = function (iso) { var p = String(iso || "").split("-"); return p.length === 3 ? +p[2] + " " + BULAN[+p[1] - 1] + " " + p[0] : (iso || ""); };

  function sesi() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function api(action, extra) {
    var s = sesi(); if (!s || !s.token) return Promise.reject(new Error("auth"));
    var body = { action: action, token: s.token };
    for (var k in extra || {}) body[k] = extra[k];
    return fetch(URL_API, { method: "POST", body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.auth === false) { try { sessionStorage.removeItem(KEY); } catch (e) {} location.reload(); throw new Error("auth"); } return d; });
  }
  var head = function (eyebrow, judul, ket) { return '<div class="rg-head"><span class="eyebrow">' + eyebrow + "</span><h2>" + judul + "</h2>" + (ket ? '<p class="rg-ket">' + ket + "</p>" : "") + "</div>"; };
  var card = function (judul, html, stiker) { return '<section class="rg-card' + (stiker ? " stk" : "") + '">' + (judul ? "<h3>" + judul + "</h3>" : "") + html + "</section>"; };
  var pill = function (jenis, teks) { return '<span class="pill ' + jenis + '">' + esc(teks) + "</span>"; };
  function tbl(kepala, baris, kosong) {
    if (!baris.length) return '<p class="rg-note">' + (kosong || "Belum ada data.") + "</p>";
    return '<div class="table-wrap rg-tbl"><table><thead><tr>' + kepala.map(function (h) { var n = h.charAt(0) === "#"; return "<th" + (n ? ' class="num"' : "") + ' scope="col">' + esc(n ? h.slice(1) : h) + "</th>"; }).join("") + "</tr></thead><tbody>" + baris.join("") + "</tbody></table></div>";
  }
  function bars(list, maks) {
    maks = maks || Math.max.apply(null, list.map(function (x) { return x[1]; }).concat([1]));
    return '<div class="rg-bars">' + list.map(function (x) {
      return '<div class="rg-bar-row"><span class="l">' + esc(x[0]) + '</span><span class="t"><i style="width:' + Math.round(x[1] / maks * 100) + '%"></i></span><span class="v">' + esc(x[2] != null ? x[2] : x[1]) + "</span></div>";
    }).join("") + "</div>";
  }
  var gagal = function (el) { return function (e) { if (e.message !== "auth") el.innerHTML = '<p class="form-status err">Koneksi bermasalah. <button type="button" class="btn-mini" data-ulang="1">Coba lagi</button></p>'; }; };

  /* ================= Dasbor ================= */
  var dasborMinta = 0;
  function muatDasbor() {
    var el = $("dasbor-isi"), ke = ++dasborMinta;
    if (!el.innerHTML) el.innerHTML = head("Dasbor", "Ringkasan") + '<p class="rg-note">Memuat ringkasan…</p>';
    api("dasbor").then(function (d) {
      if (ke !== dasborMinta) return;
      if (!d.ok) { el.innerHTML = head("Dasbor", "Ringkasan") + '<p class="form-status err">' + esc(d.error || "Ringkasan belum bisa dimuat.") + "</p>"; return; }
      el.innerHTML = vDasbor(d);
    }).catch(gagal(el));
  }
  function vDasbor(d) {
    var J = Object.keys(d.jenjang).sort();
    var tiles = [[d.siswa, "Siswa di daftar sekolah"], [d.akunAktif + "/" + d.siswa, "Akun portal siswa aktif"],
      [d.belumDitangani, "Isian belum ditangani", d.belumDitangani ? "warn" : ""], [d.kasusAktif, "Kasus masih didampingi"]];
    var perlu = d.perhatian.length ? '<ul class="rg-list">' + d.perhatian.map(function (x) {
      return '<li class="' + (x.tingkat > 1 ? "mendesak" : "") + '"><span><b>' + esc(x.judul) + "</b>" + (x.ket ? "<br>" + esc(x.ket) : "") + '</span><button type="button" class="btn-mini" data-ke="' + esc(x.tab) + '">Buka</button></li>';
    }).join("") + "</ul>" : '<p class="rg-note">Tidak ada yang mendesak saat ini.</p>';
    var stat = tbl([""].concat(J.map(function (j) { return "#Kelas " + j; })), [["Siswa", "siswa"], ["Akun portal aktif", "akun"], ["Setuju angket", "setuju"], ["Data diri", "latar"], ["AKPD", "akpd"], ["DCM", "dcm"], ["Sosiometri", "sosio"]].map(function (m) {
      return "<tr><td><b>" + m[0] + "</b></td>" + J.map(function (j) { var s = d.jenjang[j]; return '<td class="num">' + s[m[1]] + (m[1] === "siswa" ? "" : '<span class="rg-dari">/' + s.siswa + "</span>") + "</td>"; }).join("") + "</tr>";
    })).replace("rg-tbl", "rg-tbl kecil");
    var poin = d.poin.length ? '<ul class="rg-list">' + d.poin.map(function (x) { return "<li><span><b>" + esc(x.nama) + "</b> · " + esc(x.kelas) + "</span><span class=\"pill wait\">" + x.total + " poin</span></li>"; }).join("") + "</ul>" : '<p class="rg-note">Belum ada laporan kejadian yang diberi poin.</p>';
    return head("Dasbor", "Ringkasan", "Disusun dari semua menu. Dibuka ulang setiap kali Anda kembali ke Dasbor.") +
      '<div class="rg-tiles">' + tiles.map(function (t) { return '<div class="rg-tile ' + (t[2] || "") + '"><b>' + t[0] + "</b><span>" + t[1] + "</span></div>"; }).join("") + "</div>" +
      '<div class="rg-grid2">' + card("Perlu perhatian", perlu, true) +
      card("Status angket siswa", stat + '<div class="tombol-baris"><button type="button" class="btn-mini" data-ke="angket">Buka hasil angket</button><button type="button" class="btn-mini" data-ke="datasiswa">Buka data siswa</button></div>') + "</div>" +
      '<div class="rg-grid2">' + card("Poin tertinggi", poin + '<div class="tombol-baris"><button type="button" class="btn-mini" data-ke="admin">Rekap poin</button></div>') +
      card("Pintasan", '<div class="rg-pintas">' + [["kejadian", "Tulis laporan kejadian"], ["jurnal", "Isi jurnal harian"], ["datasiswa", "Cari data siswa"], ["akun", "Akun wali kelas dan siswa"]].map(function (x) { return '<button type="button" class="btn-line" data-ke="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>") + "</div>";
  }
  $("dasbor-isi").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.ke && window.BK_PILIH_TAB) window.BK_PILIH_TAB(b.dataset.ke);
    if (b.dataset.ulang) muatDasbor();
  });

  /* ================= Data siswa ================= */
  var DS = null, dsTab = "daftar", dsKelas = "", dsCari = "", dsPilih = -1, dsMinta = 0;
  function muatDataSiswa(paksa) {
    var el = $("ds-isi"), ke = ++dsMinta;
    if (DS && !paksa) { gambarDs(); return; }
    el.innerHTML = head("Data master", "Data siswa") + '<p class="rg-note">Memuat data siswa…</p>';
    api("dataSiswaGuru").then(function (d) {
      if (ke !== dsMinta) return;
      if (!d.ok) { el.innerHTML = head("Data master", "Data siswa") + '<p class="form-status err">' + esc(d.error || "Data belum bisa dimuat.") + "</p>"; return; }
      DS = d; if (!dsKelas && d.kelas.length) dsKelas = d.kelas[0]; gambarDs();
    }).catch(gagal(el));
  }
  var saring = function () {
    var q = dsCari.toLowerCase().trim();
    return DS.items.map(function (x, i) { x.i = i; return x; }).filter(function (x) {
      if (q) return x.nama.toLowerCase().indexOf(q) >= 0 || x.nis.indexOf(q) >= 0 || x.nisn.indexOf(q) >= 0;
      return !dsKelas || x.kelas === dsKelas;
    });
  };
  function akunPill(x) { return !x.akun ? '<span class="rg-redup">Belum aktivasi</span>' : x.akun.aktif ? pill("ok", "Aktif") : pill("warn", "Nonaktif"); }
  function vDaftar() {
    var L = saring(), dobel = {}, n = {};
    DS.items.forEach(function (x) { if (x.nisn) n[x.nisn] = (n[x.nisn] || 0) + 1; });
    DS.items.forEach(function (x) { if (n[x.nisn] > 1) dobel[x.nisn] = 1; });
    var warn = Object.keys(dobel).length ? '<p class="rg-warnbox"><b>NISN sama dipakai lebih dari satu siswa:</b> ' + Object.keys(dobel).map(function (k) {
      return esc(k) + " (" + DS.items.filter(function (x) { return x.nisn === k; }).map(function (x) { return esc(x.nama) + ", " + esc(x.kelas); }).join("; ") + ")";
    }).join(" · ") + ". Periksa ke data Dapodik lalu perbaiki kolom NISN di tab DataSiswa.</p>" : "";
    var L1 = L.length, L2 = L.filter(function (x) { return x.jk === "L"; }).length;
    return card((dsCari ? "Hasil pencarian" : "Kelas " + esc(dsKelas)) + ' <span class="rg-redup">· ' + L1 + " siswa (" + L2 + " L, " + (L1 - L2) + " P)</span>",
      tbl(["No", "NISN", "NIS", "Nama", "Kelas", "L/P", "Akun portal", "Persetujuan", "Data diri", "Angket"], L.map(function (x, k) {
        var ang = [["AKPD", x.akpd], ["DCM", x.dcm], ["Sosio", x.sosio]].map(function (a) { return '<span class="rg-cek ' + (a[1] ? "on" : "") + '" title="' + a[0] + (a[1] ? " sudah" : " belum") + '">' + a[0] + "</span>"; }).join("");
        return '<tr class="rg-pick" data-i="' + x.i + '" tabindex="0"><td>' + (k + 1) + '</td><td class="mono">' + (esc(x.nisn) || "–") + '</td><td class="mono">' + esc(x.nis) + "</td><td><b>" + esc(x.nama) + "</b></td><td>" + esc(x.kelas) + "</td><td>" + esc(x.jk) + "</td><td>" + akunPill(x) +
          "</td><td>" + (x.setuju === "Setuju" ? pill("ok", "Setuju") : x.setuju ? pill("warn", x.setuju) : '<span class="rg-redup">–</span>') + "</td><td>" + (x.latar ? pill("ok", "Terisi") : '<span class="rg-redup">–</span>') + "</td><td class=\"nowrap\">" + ang + "</td></tr>";
      }), "Tidak ada siswa yang cocok.") + warn +
      '<p class="rg-note">Klik baris untuk membuka Rekap persiswa. NISN dan NIS hanya tampil di Ruang Guru BK; portal siswa dan wali kelas tidak menerimanya. Sumber: tab <b>DataSiswa</b> pada Sheet.</p>', true);
  }
  function vRekap() {
    var L = DS.items.filter(function (x) { return x.kelas === dsKelas; });
    if (dsPilih < 0 || !DS.items[dsPilih] || DS.items[dsPilih].kelas !== dsKelas) dsPilih = L.length ? L[0].i : -1;
    var pil = '<div class="field ak-noprint" style="min-width: 260px; flex: 1"><label for="ds-siswa">Siswa</label><select id="ds-siswa">' + L.map(function (x) { return '<option value="' + x.i + '"' + (x.i === dsPilih ? " selected" : "") + ">" + esc(x.nama) + "</option>"; }).join("") + "</select></div>";
    if (dsPilih < 0) return card("", pil + '<p class="rg-note">Belum ada siswa di kelas ini.</p>');
    var s = DS.items[dsPilih], L2 = {};
    (s.latar || []).forEach(function (x) { L2[x[0]] = x[1]; });
    var r = function (no, l, v) { return '<div class="rg-dr"><span class="no">' + no + '</span><span class="lb">' + esc(l) + '</span><span class="co">:</span><span class="vl">' + (esc(v) || '<span class="rg-redup">–</span>') + "</span></div>"; };
    var tl = [L2["Tempat lahir"], L2["Tanggal lahir"] ? tglPanjang(L2["Tanggal lahir"]) : ""].filter(Boolean).join(", ");
    var doc = '<div class="rg-doc" id="ds-doc"><p class="kop">KETERANGAN TENTANG DIRI PESERTA DIDIK</p><p class="kop2">SMP Labschool Ciracas · Tahun Pelajaran 2026/2027</p>' +
      r("1.", "NISN / NIS", (s.nisn || "–") + " / " + (s.nis || "–")) + r("2.", "Nama", s.nama) + r("3.", "Kelas", s.kelas) + r("4.", "Jenis kelamin", s.jk === "L" ? "Laki-laki" : s.jk === "P" ? "Perempuan" : s.jk) +
      r("5.", "Tempat, tanggal lahir", tl) + r("6.", "Agama", L2["Agama"]) + r("7.", "Status dalam keluarga", L2["Status dalam keluarga"]) + r("8.", "Anak ke / jumlah saudara kandung", [L2["Anak ke"], L2["Jumlah saudara kandung"]].filter(Boolean).join(" / ")) +
      r("9.", "Alamat lengkap", L2["Alamat lengkap"]) + r("10.", "Nomor HP siswa", L2["Nomor HP siswa"]) + r("11.", "Sekolah asal", L2["Sekolah asal"]) +
      r("12.", "Nama ayah / pekerjaan", [L2["Nama ayah"], L2["Pekerjaan ayah"]].filter(Boolean).join(" / ")) + r("13.", "Nama ibu / pekerjaan", [L2["Nama ibu"], L2["Pekerjaan ibu"]].filter(Boolean).join(" / ")) +
      r("14.", "Nomor HP orang tua", L2["Nomor HP orang tua"]) + r("15.", "Nama wali", L2["Nama wali (jika ada)"]) + r("16.", "Tinggal bersama", L2["Tinggal bersama"]) +
      r("17.", "Hobi", L2["Hobi"]) + r("18.", "Cita-cita", L2["Cita-cita"]) + r("19.", "Kegiatan di luar sekolah", L2["Kegiatan di luar sekolah"]) + r("20.", "Hal yang ingin guru BK ketahui", L2["Hal yang ingin guru BK ketahui"]) +
      '<div class="rg-ttd"><p>Jakarta, ' + tglPanjang(new Date().toISOString().slice(0, 10)) + "</p><p>Guru BK,</p><div style=\"height: 56px\"></div><p>" + esc((sesi() || {}).nama || "") + "</p></div></div>";
    var info = [["Akun portal", s.akun ? (s.akun.aktif ? "Aktif" : "Nonaktif") + (s.akun.email ? " · " + s.akun.email : "") + (s.akun.terakhir ? " · terakhir masuk " + tglPanjang(s.akun.terakhir) : "") : "Belum aktivasi"],
      ["Persetujuan angket", s.setuju || "Belum mengisi"], ["Izin orang tua", s.ortu ? "Tercatat" : "Belum tercatat"],
      ["Angket", ["AKPD", "DCM", "Sosiometri"].map(function (a, k) { return a + " " + ([s.akpd, s.dcm, s.sosio][k] ? "sudah" : "belum"); }).join(" · ")]];
    return '<div class="rg-baris ak-noprint">' + pil + '<button type="button" class="btn-line" id="ds-cetak"' + (s.latar ? "" : " disabled") + ">Cetak</button></div>" +
      (s.latar ? "" : '<p class="rg-warnbox">Siswa ini belum mengisi data diri di Angket BK, jadi baru NISN, NIS, nama, kelas, dan jenis kelamin yang terisi.</p>') +
      '<div class="rg-grid2 lebar">' + card("", doc) + card("Status di portal", '<dl class="rg-kv">' + info.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + esc(x[1]) + "</dd>"; }).join("") + "</dl>" +
        '<div class="tombol-baris ak-noprint"><button type="button" class="btn-mini" data-ke="siswa" data-nama="' + esc(s.nama) + '">Lihat riwayat di Profil siswa</button></div>') + "</div>";
  }
  function vGrafik() {
    var K = DS.kelas;
    var jk = K.map(function (k) { var L = DS.items.filter(function (x) { return x.kelas === k; }); return [k, L.length, L.filter(function (x) { return x.jk === "L"; }).length + " L · " + L.filter(function (x) { return x.jk === "P"; }).length + " P"]; });
    var ak = K.map(function (k) { var L = DS.items.filter(function (x) { return x.kelas === k; }), a = L.filter(function (x) { return x.akun && x.akun.aktif; }).length; return [k, a, a + " dari " + L.length]; });
    var agama = {}, isi = 0;
    DS.items.forEach(function (x) { (x.latar || []).forEach(function (y) { if (y[0] === "Agama" && y[1]) { agama[y[1]] = (agama[y[1]] || 0) + 1; isi++; } }); });
    var maxK = Math.max.apply(null, jk.map(function (x) { return x[1]; }).concat([1]));
    return '<div class="rg-grid2">' + card("Jumlah siswa per kelas", bars(jk, maxK)) + card("Akun portal aktif per kelas", bars(ak, maxK)) + "</div>" +
      card("Agama (dari data diri)", isi ? bars(Object.keys(agama).sort(function (a, b) { return agama[b] - agama[a]; }).map(function (a) { return [a, agama[a]]; })) + '<p class="rg-note">Dari ' + isi + " siswa yang sudah mengisi data diri.</p>" : '<p class="rg-note">Belum ada siswa yang mengisi data diri.</p>');
  }
  function gambarDs() {
    var el = $("ds-isi"), n = DS.items.length;
    var kelasPil = '<div class="field" style="min-width: 150px"><label for="ds-kelas">Kelas</label><select id="ds-kelas">' + DS.kelas.map(function (k) { return "<option" + (k === dsKelas ? " selected" : "") + ">" + esc(k) + "</option>"; }).join("") + "</select></div>";
    var cari = dsTab === "daftar" ? '<div class="field" style="min-width: 220px; flex: 1"><label for="ds-cari">Cari nama, NIS, atau NISN (semua kelas)</label><input id="ds-cari" type="search" autocomplete="off" value="' + esc(dsCari) + '"></div>' : "";
    el.innerHTML = head("Data master", "Data siswa", n + " siswa dari tab DataSiswa. Daftar ini yang dipakai untuk aktivasi akun siswa.") +
      '<div class="rg-subtabs ak-noprint" role="tablist" aria-label="Bagian data siswa">' + [["daftar", "Daftar siswa"], ["rekap", "Rekap persiswa"], ["grafik", "Grafik siswa"]].map(function (t) {
        return '<button type="button" class="rg-subtab" role="tab" data-ds="' + t[0] + '" aria-selected="' + (dsTab === t[0]) + '">' + t[1] + "</button>"; }).join("") + "</div>" +
      (dsTab !== "grafik" ? '<div class="rg-baris ak-noprint">' + kelasPil + cari + '<button type="button" class="btn-mini" id="ds-muat" style="align-self: flex-end">Muat ulang</button></div>' : "") +
      '<div id="ds-konten" style="display: flex; flex-direction: column; gap: 20px">' + (dsTab === "rekap" ? vRekap() : dsTab === "grafik" ? vGrafik() : vDaftar()) + "</div>";
  }
  var dsEl = $("ds-isi");
  dsEl.addEventListener("click", function (e) {
    var b = e.target.closest("button"), tr = e.target.closest("tr.rg-pick");
    if (b && b.dataset.ds) { dsTab = b.dataset.ds; gambarDs(); return; }
    if (b && b.id === "ds-muat") { muatDataSiswa(true); return; }
    if (b && b.dataset.ulang) { muatDataSiswa(true); return; }
    if (b && b.id === "ds-cetak") { document.body.classList.add("cetak-rekap"); window.print(); setTimeout(function () { document.body.classList.remove("cetak-rekap"); }, 300); return; }
    if (b && b.dataset.ke === "siswa") {
      window.BK_PILIH_TAB("siswa");
      var f = document.querySelector("#tab-siswa input[type=search], #tab-siswa input[type=text]");
      if (f) { f.value = b.dataset.nama; var form = f.closest("form"); if (form && form.requestSubmit) form.requestSubmit(); }
      return;
    }
    if (tr) { var x = DS.items[+tr.dataset.i]; dsPilih = x.i; dsKelas = x.kelas; dsTab = "rekap"; dsCari = ""; gambarDs(); window.scrollTo(0, 0); }
  });
  dsEl.addEventListener("keydown", function (e) { var tr = e.target.closest("tr.rg-pick"); if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); tr.click(); } });
  dsEl.addEventListener("change", function (e) {
    if (e.target.id === "ds-kelas") { dsKelas = e.target.value; dsCari = ""; gambarDs(); }
    if (e.target.id === "ds-siswa") { dsPilih = +e.target.value; gambarDs(); }
  });
  var tunda = null;
  dsEl.addEventListener("input", function (e) {
    if (e.target.id !== "ds-cari") return;
    dsCari = e.target.value; clearTimeout(tunda);
    tunda = setTimeout(function () {
      $("ds-konten").innerHTML = vDaftar();
    }, 200);
  });

  window.BK_PANEL = window.BK_PANEL || {};
  window.BK_PANEL.dasbor = function () { if (URL_API) muatDasbor(); };
  window.BK_PANEL.datasiswa = function () { if (URL_API) muatDataSiswa(false); };
  (window.BK_PANEL_RESET = window.BK_PANEL_RESET || []).push(function () { DS = null; dsTab = "daftar"; dsKelas = ""; dsCari = ""; dsPilih = -1; $("ds-isi").innerHTML = ""; $("dasbor-isi").innerHTML = ""; });
})();
