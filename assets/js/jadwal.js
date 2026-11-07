// Tampilan status & jadwal sesi yang dipakai bersama oleh Cek Balasan, Portal Siswa, dan Portal Wali Kelas.
(function () {
  "use strict";
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  function tgl(iso) { var p = String(iso || "").split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
  function tglPanjang(iso, hari) {
    var d = tgl(iso); if (!d) return iso || "";
    return (hari ? HARI[d.getDay()] + ", " : "") + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
  }

  // Langkah status: Terkirim -> Dijadwalkan -> Selesai (konseling), atau versi rujukan.
  var ALUR = {
    konseling: { urut: ["Baru", "Dijadwalkan", "Selesai"], label: ["Terkirim", "Dijadwalkan", "Selesai"] },
    rujukan: { urut: ["Baru", "Diterima", "Dijadwalkan", "Dalam pendampingan", "Selesai"], label: ["Terkirim", "Diterima", "Dijadwalkan", "Didampingi", "Selesai"] }
  };
  var TEKS_STATUS = {
    konseling: { Baru: "Menunggu jadwal dari guru BK", Dijadwalkan: "Sudah dijadwalkan", Selesai: "Selesai", Dibatalkan: "Dibatalkan" },
    rujukan: { Baru: "Terkirim, belum dibaca", Diterima: "Diterima guru BK", Dijadwalkan: "Siswa sudah dijadwalkan", "Dalam pendampingan": "Dalam pendampingan guru BK", Selesai: "Selesai" }
  };
  function teksStatus(jenis, st) { return (TEKS_STATUS[jenis] || {})[st] || st || "Terkirim"; }

  function langkah(jenis, st) {
    var a = ALUR[jenis], i = a.urut.indexOf(st);
    if (st === "Dibatalkan") return '<p class="pill" style="margin:0;align-self:flex-start">Dibatalkan</p>';
    if (i < 0) i = 0;
    return '<ol class="langkah-mini" aria-label="Status: ' + esc(teksStatus(jenis, st)) + '">' + a.label.map(function (l, k) {
      var cls = k < i || (k === i && k === a.urut.length - 1) ? "selesai" : k === i ? "kini" : "";
      return '<li class="' + cls + '"' + (k === i ? ' aria-current="step"' : "") + "><span>" + (cls === "selesai" ? "✓" : k + 1) + "</span>" + esc(l) + "</li>";
    }).join("") + "</ol>";
  }

  function kartuJadwal(j, judul) {
    if (!j || !j.tanggal) return "";
    var d = tgl(j.tanggal);
    var sudahLewat = d && d < new Date(new Date().toDateString());
    return '<div class="jadwal-kartu' + (sudahLewat ? " lewat" : "") + '">' +
      '<span class="jadwal-tgl" aria-hidden="true">' + d.getDate() + "<small>" + BULAN[d.getMonth()].slice(0, 3).toUpperCase() + "</small></span>" +
      '<span class="jadwal-info"><span class="jadwal-label">' + esc(judul || "Jadwal bertemu guru BK") + "</span>" +
      "<strong>" + esc(tglPanjang(j.tanggal, true)) + "</strong>" +
      "<span>" + esc([j.jam, j.tempat].filter(Boolean).join(" · ") || "Waktu dan tempat menyusul") + "</span></span></div>";
  }

  function pesan(judul, isi) {
    return isi ? '<div class="pesan-bk"><span class="jadwal-label">' + esc(judul) + "</span><p>" + esc(isi) + "</p></div>" : "";
  }

  // Hasil Cek Balasan untuk pengajuan konseling.
  function kartuCek(d) {
    return '<p style="margin:0;font-size:14px;color:#4A5578">' + esc(d.jenis) + (d.topik ? " · " + esc(d.topik) : "") + " · dikirim " + esc(d.dikirim) + "</p>" +
      '<h2 style="margin:0;font-family:Rubik,sans-serif;font-weight:800;font-size:22px">' + esc(teksStatus("konseling", d.status)) + "</h2>" +
      langkah("konseling", d.status) +
      (kartuJadwal(d.jadwal) || (d.status === "Baru" ? '<p style="margin:0;font-size:16px;line-height:1.6;color:#3B4568">Guru BK akan menentukan waktu dan tempatnya. Cek lagi besok, atau datang langsung ke ruang BK kalau mendesak.</p>' : "")) +
      pesan("Pesan guru BK", d.balasan);
  }

  window.BK_JADWAL = { esc: esc, tglPanjang: tglPanjang, teksStatus: teksStatus, langkah: langkah, kartuJadwal: kartuJadwal, pesan: pesan, kartuCek: kartuCek };
})();
