// Hasil angket untuk guru BK: status pengisian, AKPD, DCM, sosiometri, data diri.
// Angka dihitung di halaman ini dari jawaban yang tersimpan di Google Sheet.
(function () {
  "use strict";
  var URL_API = ((window.BK_CONFIG || {}).SCRIPT_URL || "").trim();
  var D = window.BK_ANGKET, KEY = "bk_guru_sesi";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var sesi = null, R = null, tab = "status";
  try { sesi = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) {}
  var isi = $("ha-isi"), stEl = $("ha-status"), selKelas = $("ha-kelas");
  var BID = [["Pribadi", [0, 1, 2, 3, 4]], ["Sosial", [5, 6, 7]], ["Belajar", [8, 9, 10]], ["Karir", [11]]];
  var NAMA_B = { P: "Pribadi", S: "Sosial", B: "Belajar", K: "Karir" };

  function status(msg, type) { stEl.textContent = msg || ""; stEl.className = "form-status" + (type ? " " + type : ""); }
  function api(action, extra) {
    var body = { action: action, token: sesi.token };
    for (var k in extra || {}) body[k] = extra[k];
    return fetch(URL_API, { method: "POST", body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.auth === false) { try { sessionStorage.removeItem(KEY); } catch (e) {} location.replace("guru.html"); throw new Error("auth"); } return d; });
  }
  var kartu = function (judul, html) { return '<section class="card-form" style="padding: 24px; gap: 16px"><h2 class="dash-h" style="font-size: 19px">' + judul + "</h2>" + html + "</section>"; };
  function tbl(kepala, baris, kosong) {
    if (!baris.length) return '<p class="ak-catatan">' + (kosong || "Belum ada data.") + "</p>";
    return '<div class="table-wrap ak-tabel"><table><thead><tr>' + kepala.map(function (h) { var num = h.charAt(0) === "#"; return "<th" + (num ? ' class="num"' : "") + ' scope="col">' + esc(num ? h.slice(1) : h) + "</th>"; }).join("") + "</tr></thead><tbody>" + baris.join("") + "</tbody></table></div>";
  }
  var num = function (v) { return '<td class="num">' + v + "</td>"; };
  var pill = function (kelas, teks) { return '<span class="pill ' + kelas + '">' + esc(teks) + "</span>"; };
  var ringkas = function (arr) { return '<div class="ak-ringkas">' + arr.map(function (x) { return "<div><b>" + x[0] + "</b><span>" + esc(x[1]) + "</span></div>"; }).join("") + "</div>"; };
  var kunci = function (s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); };
  var persen = function (v) { return v.toFixed(1).replace(".", ",") + "%"; };
  function peta(arr) { var m = {}; arr.forEach(function (x) { m[x.akun] = x; }); return m; }

  /* ---------- Status ---------- */
  function vStatus() {
    var akunNama = {}; R.akun.forEach(function (a) { akunNama[kunci(a.nama)] = a.id; });
    var P = peta(R.persetujuan), L = peta(R.latar), A = peta(R.akpd), C = peta(R.dcm), S = peta(R.sosio);
    var ya = pill("pill-selesai", "Sudah"), blm = '<span class="muted">Belum</span>';
    var buka = function (id, j, ada) { return ada ? ya + ' <button type="button" class="btn-mini ak-noprint" data-buka="' + j + '" data-akun="' + esc(id) + '" style="min-height: 32px; padding: 0 10px; font-size: 12px">Buka ulang</button>' : blm; };
    var baris = R.daftar.map(function (nama, i) {
      var id = akunNama[kunci(nama)];
      if (!id) return "<tr><td>" + (i + 1) + "</td><td>" + esc(nama) + '</td><td colspan="6" class="muted">Belum mengaktifkan akun portal</td></tr>';
      var p = P[id], ortu = R.ortu[id];
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(nama) + "</td><td>" + (p ? (p.keputusan === "Setuju" ? pill("pill-selesai", "Setuju") : pill("pill-c", "Belum setuju")) + '<br><span class="muted" style="font-size: 12px">' + esc(p.waktu) + "</span>" : blm) + "</td><td>" +
        (ortu ? ya : blm) + ' <button type="button" class="btn-mini ak-noprint" data-ortu="' + (ortu ? "0" : "1") + '" data-akun="' + esc(id) + '" style="min-height: 32px; padding: 0 10px; font-size: 12px">' + (ortu ? "Batalkan" : "Catat izin") + "</button></td><td>" +
        (L[id] ? ya : blm) + "</td><td>" + buka(id, "akpd", A[id]) + "</td><td>" + buka(id, "dcm", C[id]) + "</td><td>" + buka(id, "sosio", S[id]) + "</td></tr>";
    });
    var setuju = R.persetujuan.filter(function (x) { return x.keputusan === "Setuju"; }).length;
    return kartu("Kelas " + esc(R.kelasDipilih), ringkas([[R.daftar.length, "siswa di daftar kelas"], [R.akun.length, "akun portal aktif"], [setuju, "setuju"], [R.latar.length, "data diri"], [R.akpd.length, "AKPD"], [R.dcm.length, "DCM"], [R.sosio.length, "sosiometri"]]) +
      tbl(["No", "Nama", "Persetujuan siswa", "Izin orang tua", "Data diri", "AKPD", "DCM", "Sosiometri"], baris, "Daftar siswa kelas ini masih kosong. Isi tab DataSiswa di Sheet.") +
      '<p class="ak-catatan">“Buka ulang” membuat siswa bisa mengisi angket itu sekali lagi. Jawaban lamanya tetap ada di Sheet dengan tanda Berlaku = TIDAK dan tidak ikut dihitung.</p>') +
      kartu("Izin orang tua", '<label class="check"><input type="checkbox" id="ha-wajib"' + (R.wajibOrtu ? " checked" : "") + '> <span>Angket baru terbuka setelah saya mencatat izin orang tua siswa (berlaku untuk semua kelas).</span></label>' +
        '<p class="ak-catatan">Izin orang tua dikumpulkan di luar portal ini, misalnya lewat lembar izin bertanda tangan. Setelah lembarnya Bapak/Ibu terima, tekan “Catat izin” pada nama siswa di tabel atas.</p>');
  }

  /* ---------- AKPD ---------- */
  function vAkpd() {
    var A = D.akpd[R.jenjang], M = R.akpd.filter(function (x) { return x.jenjang === R.jenjang; });
    if (!A) return kartu("AKPD", '<p class="ak-catatan">Belum ada butir AKPD untuk jenjang kelas ini.</p>');
    if (!M.length) return kartu("AKPD kelas " + esc(R.kelasDipilih), '<p class="ak-catatan">Belum ada siswa kelas ini yang mengirim AKPD.</p>');
    var jml = A.q.map(function (q, k) { return M.filter(function (x) { return x.jawaban[k]; }).length; }), tot = jml.reduce(function (a, b) { return a + b; }, 0);
    var but = A.q.map(function (q, k) { var p = tot ? jml[k] / tot * 100 : 0; return { k: k, q: q, b: A.b.charAt(k), jml: jml[k], p: p, pr: p >= 2 ? "TINGGI" : p >= 1 ? "SEDANG" : "RENDAH" }; });
    var prPill = function (p) { return pill(p === "TINGGI" ? "pill-e" : p === "SEDANG" ? "pill-c" : "pill-a", p); };
    var bid = ["P", "S", "B", "K"].map(function (b) {
      var x = but.filter(function (y) { return y.b === b; }), j = x.reduce(function (a, y) { return a + y.jml; }, 0);
      return "<tr><td>" + NAMA_B[b] + "</td>" + num(x.length) + num(j) + num(persen(tot ? j / tot * 100 : 0)) + "</tr>";
    });
    var urut = but.slice().sort(function (a, b) { return b.jml - a.jml || a.k - b.k; });
    var ps = M.slice().sort(function (a, b) { return a.nama < b.nama ? -1 : 1; }).map(function (x, i) {
      var c = { P: 0, S: 0, B: 0, K: 0 }, n = 0; x.jawaban.forEach(function (v, k) { if (v) { c[A.b.charAt(k)]++; n++; } });
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(x.nama) + "</td>" + num(n) + num(persen(n / 50 * 100)) + num(c.P) + num(c.S) + num(c.B) + num(c.K) + "</tr>";
    });
    return kartu("AKPD kelas " + esc(R.kelasDipilih) + " (angket kelas " + esc(R.jenjang) + ")", ringkas([[M.length, "siswa mengisi"], [tot, "jawaban Ya seluruhnya"], [but.filter(function (x) { return x.pr === "TINGGI"; }).length, "butir prioritas tinggi"]]) +
      tbl(["Bidang", "#Jumlah butir", "#Jawaban Ya", "#Persen"], bid)) +
      kartu("Butir kebutuhan, dari yang paling banyak dipilih", tbl(["No", "Bidang", "Pernyataan", "#Pemilih", "#Persen", "Prioritas"], urut.map(function (x) {
        return "<tr><td>" + (x.k + 1) + "</td><td>" + NAMA_B[x.b] + "</td><td>" + esc(x.q) + "</td>" + num(x.jml) + num(persen(x.p)) + "<td>" + prPill(x.pr) + "</td></tr>";
      })) + '<p class="ak-catatan">Rumus seperti di aplikasi AKPD: persen = jumlah pemilih butir dibagi jumlah seluruh jawaban Ya. Prioritas TINGGI bila 2% atau lebih, SEDANG bila 1% atau lebih, selain itu RENDAH.</p>') +
      kartu("Per siswa", tbl(["No", "Nama", "#Jumlah Ya", "#Persen dari 50", "#Pribadi", "#Sosial", "#Belajar", "#Karir"], ps));
  }

  /* ---------- DCM ---------- */
  var derajat = function (p) { return p === 0 ? "A" : p <= 10 ? "B" : p <= 25 ? "C" : p <= 50 ? "D" : "E"; };
  var dPill = function (d) { return pill("pill-" + d.toLowerCase(), d); };
  function vDcm() {
    var M = R.dcm, N = M.length, T = D.dcm.topik;
    if (!N) return kartu("DCM kelas " + esc(R.kelasDipilih), '<p class="ak-catatan">Belum ada siswa kelas ini yang mengirim DCM.</p>');
    var hit = {}; M.forEach(function (x) { x.nomor.forEach(function (n) { hit[n] = (hit[n] || 0) + 1; }); });
    var top = T.map(function (t, ti) { var nm = 0; for (var k = 1; k <= 20; k++) nm += hit[ti * 20 + k] || 0; return { nm: nm, p: nm / (20 * N) * 100 }; });
    var bt = [];
    BID.forEach(function (b) {
      var sum = b[1].reduce(function (a, x) { return a + top[x].p; }, 0);
      bt.push("<tr><td><strong>" + b[0] + '</strong></td><td></td><td></td><td class="num"><strong>' + persen(sum) + "</strong></td><td>" + dPill(derajat(sum)) + "</td></tr>");
      b[1].forEach(function (x) { bt.push("<tr><td>" + esc(T[x].rom + ". " + (T[x].s || T[x].n)) + "</td>" + num(top[x].nm) + num(20 * N) + num(persen(top[x].p)) + "<td>" + dPill(derajat(top[x].p)) + "</td></tr>"); });
    });
    var but = [];
    T.forEach(function (t, ti) { t.q.forEach(function (q, k) { var no = ti * 20 + k + 1, nm = hit[no] || 0; if (nm) but.push({ no: no, q: q, t: t.s || t.n, nm: nm, p: nm / N * 100 }); }); });
    but.sort(function (a, b) { return b.nm - a.nm || a.no - b.no; });
    var ps = M.slice().sort(function (a, b) { return b.nomor.length - a.nomor.length; }).map(function (x, i) {
      var c = T.map(function () { return 0; }); x.nomor.forEach(function (n) { c[Math.floor((n - 1) / 20)]++; });
      var ur = c.map(function (v, ti) { return [v, ti]; }).filter(function (y) { return y[0]; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, 3).map(function (y) { return (T[y[1]].s || T[y[1]].n) + " (" + y[0] + ")"; });
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(x.nama) + "</td>" + num(x.nomor.length) + num(persen(x.nomor.length / 240 * 100)) + "<td>" + dPill(derajat(x.nomor.length / 240 * 100)) + "</td><td>" + esc(ur.join(", ") || "–") + "</td></tr>";
    });
    var isian = M.filter(function (x) { return x.isian.some(Boolean); }).map(function (x) {
      return "<tr><td>" + esc(x.nama) + "</td><td>" + esc(x.isian[0] || "–") + "</td><td>" + esc(x.isian[1] || "–") + "</td><td>" + esc(x.isian[2] || "–") + (x.isian[3] ? ", dengan " + esc(x.isian[3]) : "") + "</td></tr>";
    });
    var DK = '<p class="ak-catatan">Derajat masalah seperti di software DCM: A = 0%, B = sampai 10%, C = sampai 25%, D = sampai 50%, E = di atas 50%. D dan E perlu didahulukan.</p>';
    return kartu("DCM kelas " + esc(R.kelasDipilih), ringkas([[N, "siswa mengisi"], [but.length, "butir dipilih minimal sekali"], [but.filter(function (x) { return x.p > 25; }).length, "butir derajat D atau E"]]) +
      tbl(["Bidang dan topik", "#Nm", "#20 × N", "#Persen", "Derajat"], bt) + DK +
      '<p class="ak-catatan">Persen topik = jumlah centang pada topik itu dibagi (20 butir × jumlah siswa pengisi). Persen bidang adalah jumlah persen topik-topiknya, mengikuti software.</p>') +
      kartu("Butir masalah, dari yang paling banyak dialami", tbl(["No", "Topik", "Pernyataan", "#Nm", "#Persen", "Derajat"], but.slice(0, 60).map(function (x) {
        return "<tr><td>" + x.no + "</td><td>" + esc(x.t) + "</td><td>" + esc(x.q) + "</td>" + num(x.nm) + num(persen(x.p)) + "<td>" + dPill(derajat(x.p)) + "</td></tr>";
      })) + (but.length > 60 ? '<p class="ak-catatan">Ditampilkan 60 teratas dari ' + but.length + " butir. Selengkapnya ada di tab AngketDCM pada Sheet.</p>" : "")) +
      kartu("Per siswa", tbl(["No", "Nama", "#Jumlah masalah", "#Persen dari 240", "Derajat", "Topik terbanyak"], ps)) +
      kartu("Jawaban nomor 241–243", tbl(["Nama", "241. Belum tercantum", "242. Paling menyusahkan", "243. Suka membicarakan kesulitan?"], isian, "Belum ada yang mengisi bagian ini."));
  }

  /* ---------- Sosiometri ---------- */
  function vSosio() {
    var M = R.sosio;
    if (!M.length) return kartu("Sosiometri kelas " + esc(R.kelasDipilih), '<p class="ak-catatan">Belum ada siswa kelas ini yang mengirim sosiometri.</p>');
    var d = {}, t = {}, olehP = {}, olehT = {}, B = 0, E = 0, isiOleh = {};
    R.daftar.forEach(function (n) { d[n] = 0; t[n] = 0; olehP[n] = []; olehT[n] = []; });
    M.forEach(function (x) {
      isiOleh[x.nama] = x;
      x.pilih.forEach(function (n) { if (n) { B++; if (n in d) { d[n]++; if (olehP[n].indexOf(x.nama) < 0) olehP[n].push(x.nama); } } });
      x.tolak.forEach(function (n) { if (n) { E++; if (n in t) { t[n]++; if (olehT[n].indexOf(x.nama) < 0) olehT[n].push(x.nama); } } });
    });
    var mxD = Math.max.apply(null, R.daftar.map(function (n) { return d[n]; })), mxT = Math.max.apply(null, R.daftar.map(function (n) { return t[n]; }));
    var baris = R.daftar.map(function (n) {
      var cs = B ? d[n] / B : 0, rs = E ? -t[n] / E : 0, k = [];
      if (mxD > 0 && d[n] === mxD) k.push(pill("pill-selesai", "Populer"));
      if (mxT > 0 && t[n] === mxT) k.push(pill("pill-d", "Kontroversial"));
      if (d[n] >= 1 && d[n] <= 2) k.push(pill("pill-c", "Neglectee"));
      if (d[n] === 0) k.push(pill("pill-e", "Isolasi"));
      return { n: n, d: d[n], t: t[n], cs: cs, rs: rs, crs: cs - rs, k: k };
    });
    var lengkap = M.length >= R.daftar.length * 0.8;
    var saling = [];
    M.forEach(function (x) { x.pilih.forEach(function (n) { var y = isiOleh[n]; if (y && x.nama < n && y.pilih.indexOf(x.nama) >= 0 && saling.indexOf(x.nama + " ↔ " + n) < 0) saling.push(x.nama + " ↔ " + n); }); });
    var f3 = function (v) { return v.toFixed(3).replace(".", ","); };
    return kartu("Sosiometri kelas " + esc(R.kelasDipilih), ringkas([[M.length + " / " + R.daftar.length, "siswa mengisi"], [B, "jawaban memilih"], [E, "jawaban menjauhi"], [saling.length, "pasangan saling memilih"]]) +
      (lengkap ? "" : '<p class="form-status err" style="margin: 0">Baru ' + M.length + " dari " + R.daftar.length + " siswa yang mengisi. Label Isolasi dan Neglectee belum bisa dipercaya sampai hampir seluruh kelas mengisi.</p>") +
      tbl(["No", "Nama", "#Dipilih", "#CS", "#Ditolak", "#RS", "#CRS", "Kelompok"], baris.map(function (x, i) {
        return "<tr><td>" + (i + 1) + "</td><td>" + esc(x.n) + (isiOleh[x.n] ? "" : ' <span class="muted" style="font-size: 12px">(belum mengisi)</span>') + "</td>" + num(x.d) + num(f3(x.cs)) + num(x.t) + num(f3(x.rs)) + num(f3(x.crs)) + "<td>" + (x.k.join(" ") || "–") + "</td></tr>";
      })) +
      '<p class="ak-catatan">Rumus seperti di Excel: CS = dipilih ÷ jumlah jawaban memilih, RS = −(ditolak ÷ jumlah jawaban menjauhi), CRS = CS − RS. Populer = paling banyak dipilih, Kontroversial = paling banyak ditolak, Neglectee = dipilih 1 atau 2 kali, Isolasi = tidak dipilih. Label ini bahan awal untuk observasi dan wawancara, bukan kesimpulan tentang anak, dan tidak untuk ditunjukkan ke siswa.</p>') +
      kartu("Saling memilih", saling.length ? '<p style="margin: 0; font-size: 15px; line-height: 1.8">' + saling.map(esc).join("<br>") + "</p>" : '<p class="ak-catatan">Belum ada pasangan yang saling memilih.</p>') +
      kartu("Siapa memilih siapa", tbl(["Nama", "Dipilih oleh", "Ditolak oleh", "Memilih (A1–A4)", "Menjauhi (B1–B4)"], R.daftar.map(function (n) {
        var x = isiOleh[n], al = function (arr, als) { return arr.map(function (v, k) { return v ? esc(v) + (als[k] ? ' <span class="muted">(' + esc(als[k]) + ")</span>" : "") : "–"; }).join("<br>"); };
        return "<tr><td>" + esc(n) + "</td><td>" + (esc(olehP[n].join(", ")) || "–") + "</td><td>" + (esc(olehT[n].join(", ")) || "–") + "</td><td>" + (x ? al(x.pilih, x.alasanPilih) : '<span class="muted">belum mengisi</span>') + "</td><td>" + (x ? al(x.tolak, x.alasanTolak) : "") + "</td></tr>";
      })));
  }

  /* ---------- Data diri ---------- */
  function vLatar() {
    if (!R.latar.length) return kartu("Data diri kelas " + esc(R.kelasDipilih), '<p class="ak-catatan">Belum ada siswa kelas ini yang mengisi data diri.</p>');
    return kartu("Data diri kelas " + esc(R.kelasDipilih), R.latar.slice().sort(function (a, b) { return a.nama < b.nama ? -1 : 1; }).map(function (x) {
      return '<details style="border-top: 1px solid #ECE8DA; padding: 12px 0"><summary style="font-weight: 700; color: #12204F; cursor: pointer; min-height: 32px">' + esc(x.nama) + '</summary><dl class="ak-kv" style="margin-top: 10px">' +
        x.data.map(function (y) { return "<dt>" + esc(y[0]) + "</dt><dd>" + (esc(y[1]) || "–") + "</dd>"; }).join("") + "</dl></details>";
    }).join(""));
  }

  function vSheet() {
    var t = [["PersetujuanSiswa", "Satu baris tiap keputusan siswa: waktu, nama, kelas, Setuju atau Belum setuju, versi teks persetujuan."],
      ["IzinOrtuAngket", "Izin orang tua yang Bapak/Ibu catat: siapa yang mencatat dan kapan."],
      ["LatarBelakangSiswa", "Data diri siswa, satu baris per siswa, satu kolom per isian."],
      ["AngketAKPD", "Satu baris per siswa: jumlah Ya, jumlah per bidang, daftar nomor yang dijawab Ya, lalu kolom No 1 sampai No 50 berisi Ya atau Tidak."],
      ["AngketDCM", "Satu baris per siswa: jumlah masalah, jumlah per topik, nomor masalah per topik (seperti lembar tabulasi), dan jawaban 241–243."],
      ["AngketSosiometri", "Satu baris per siswa: nama yang dipilih dan dijauhi untuk tiap pertanyaan beserta alasannya."],
      ["ButirAngket", "Kamus: bunyi setiap nomor pernyataan AKPD (kelas 7, 8, 9), DCM, dan sosiometri, supaya nomor di tab lain bisa dibaca."]];
    return kartu("Membaca data di Google Sheet", '<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #3B4568">Setiap jawaban yang dikirim siswa langsung ditulis ke Google Sheet “Data Web BK Labschool Ciracas”. Buka Sheet itu dari Google Drive Bapak/Ibu, lalu pilih tab di bagian bawah:</p>' +
      tbl(["Nama tab", "Isinya"], t.map(function (x) { return "<tr><td><strong>" + x[0] + "</strong></td><td>" + x[1] + "</td></tr>"; })) +
      '<p class="ak-catatan">Kolom “Berlaku” berisi YA untuk jawaban yang dipakai. Bila angket dibuka ulang, baris lama menjadi TIDAK dan tetap tersimpan. Sebaiknya jangan mengubah judul kolom atau nama tab, karena halaman ini membacanya dari sana. Untuk mengolah sendiri, salin tab ke file lain.</p>');
  }

  function gambar() {
    document.querySelectorAll("#ha-tabs .dash-tab").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false"); });
    isi.innerHTML = tab === "akpd" ? vAkpd() : tab === "dcm" ? vDcm() : tab === "sosio" ? vSosio() : tab === "latar" ? vLatar() : tab === "sheet" ? vSheet() : vStatus();
  }
  function muat(kelas, pesan) {
    status("Memuat…");
    return api("angketRekap", { kelas: kelas || "" }).then(function (d) {
      if (!d.ok) { status(d.error || "Data belum bisa dimuat.", "err"); return; }
      R = d; status(pesan || "", pesan ? "ok" : "");
      selKelas.innerHTML = d.kelas.map(function (k) { return "<option" + (k === d.kelasDipilih ? " selected" : "") + ">" + esc(k) + "</option>"; }).join("");
      $("ha-tabs").hidden = false; gambar();
    }).catch(function (e) { if (e.message !== "auth") status("Koneksi bermasalah. Coba muat ulang.", "err"); });
  }
  var NAMA_J = { akpd: "AKPD", dcm: "DCM", sosio: "sosiometri" };
  isi.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.ortu) {
      b.disabled = true;
      api("catatIzinOrtu", { akun: b.dataset.akun, izin: b.dataset.ortu === "1" }).then(function (d) { if (d.ok) muat(R.kelasDipilih, b.dataset.ortu === "1" ? "Izin orang tua dicatat." : "Catatan izin orang tua dibatalkan."); else { b.disabled = false; status(d.error, "err"); } }).catch(function () { b.disabled = false; });
    }
    if (b.dataset.buka) {
      if (b.dataset.yakin !== "1") { b.dataset.yakin = "1"; b.textContent = "Yakin buka ulang?"; setTimeout(function () { if (b.isConnected) { b.dataset.yakin = ""; b.textContent = "Buka ulang"; } }, 4000); return; }
      b.disabled = true;
      api("bukaUlangAngket", { akun: b.dataset.akun, jenis: b.dataset.buka }).then(function (d) { if (d.ok) muat(R.kelasDipilih, "Angket " + NAMA_J[b.dataset.buka] + " dibuka ulang. Siswa bisa mengisinya lagi."); else { b.disabled = false; status(d.error, "err"); } }).catch(function () { b.disabled = false; });
    }
  });
  isi.addEventListener("change", function (e) {
    if (e.target.id !== "ha-wajib") return;
    api("aturAngket", { wajibOrtu: e.target.checked }).then(function (d) { if (d.ok) { R.wajibOrtu = d.wajibOrtu; status(d.wajibOrtu ? "Angket sekarang menunggu izin orang tua." : "Angket tidak lagi menunggu izin orang tua.", "ok"); } }).catch(function () {});
  });
  $("ha-tabs").addEventListener("click", function (e) { var b = e.target.closest(".dash-tab"); if (b) { tab = b.dataset.tab; gambar(); } });
  selKelas.addEventListener("change", function () { muat(selKelas.value); });

  if (!sesi || !sesi.token) { location.replace("guru.html"); return; }
  if (!URL_API || !D) { status("Halaman ini belum bisa dibuka.", "err"); return; }
  muat("");
})();
