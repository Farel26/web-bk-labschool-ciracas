// Halaman Informasi PSB.
// Isi diambil dari tab Info_PSB di Google Sheet "Info & Agen WA PSB" lewat Apps Script (PSB_URL di config.js),
// jadi guru cukup memperbarui Sheet; halaman ini dan halaman link WhatsApp ikut berubah.
(function () {
  var URL_PSB = ((window.BK_CONFIG || {}).PSB_URL || "").trim();
  var status = document.getElementById("psb-status");
  var daftar = document.getElementById("psb-daftar");
  var cari = document.getElementById("psb-cari");
  var kosongCari = document.getElementById("psb-kosong-cari");
  if (!status || !daftar) return;

  var IKON = '<svg class="psb-ikon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>';

  function gagal() {
    status.className = "psb-status is-error";
    status.innerHTML = 'Informasi belum bisa dimuat. Silakan buka <a href="' + URL_PSB + '">halaman informasi PSB</a> atau hubungi WhatsApp sekolah <a href="https://wa.me/6282280003416">0822 8000 3416</a>.';
  }

  function tampilkan(data) {
    if (!data.length) {
      status.textContent = "Informasi PSB sedang disiapkan. Silakan kunjungi halaman ini kembali dalam waktu dekat.";
      return;
    }
    status.hidden = true;
    data.forEach(function (d) {
      var item = document.createElement("details");
      item.className = "psb-item";
      item.id = d.id;
      var judul = document.createElement("summary");
      judul.textContent = d.topik;
      judul.insertAdjacentHTML("beforeend", IKON);
      var isi = document.createElement("div");
      isi.className = "psb-isi";
      isi.innerHTML = d.html; // sudah di-escape oleh Apps Script (formatInfo_)
      isi.querySelectorAll("a[href^='http']").forEach(function (a) { a.target = "_blank"; a.rel = "noopener"; });
      item.appendChild(judul);
      item.appendChild(isi);
      daftar.appendChild(item);
    });

    // Buka topik dari link, misalnya psb.html?t=biaya
    var t = (new URLSearchParams(location.search).get("t") || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (t) {
      var cocok = Array.prototype.filter.call(daftar.children, function (el) { return el.id.indexOf(t) !== -1; });
      cocok.forEach(function (el) { el.open = true; });
      if (cocok.length) cocok[0].scrollIntoView({ block: "start" });
    }

    cari.disabled = false;
    cari.addEventListener("input", function () {
      var q = cari.value.trim().toLowerCase();
      var terlihat = 0;
      Array.prototype.forEach.call(daftar.children, function (el) {
        var ada = !q || el.textContent.toLowerCase().indexOf(q) !== -1;
        el.hidden = !ada;
        el.open = !!q && ada;
        if (ada) terlihat++;
      });
      kosongCari.hidden = !(q && !terlihat);
    });
  }

  if (!URL_PSB) { gagal(); return; }
  fetch(URL_PSB + "?format=json")
    .then(function (r) { return r.json(); })
    .then(function (j) { tampilkan((j && j.data) || []); })
    .catch(gagal);
})();
