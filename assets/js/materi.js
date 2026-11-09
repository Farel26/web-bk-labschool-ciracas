// Materi BK: tampilkan satu bab sesuai alamat (#bab-3), dan "Ambil kartu acak" untuk permainan refleksi.
// Tanpa JavaScript, semua bab tetap tampil berurutan.
(function () {
  "use strict";
  var babs = [].slice.call(document.querySelectorAll(".materi-bab"));
  var tautan = [].slice.call(document.querySelectorAll(".materi-nav a"));
  if (!babs.length) return;
  document.documentElement.classList.add("materi-js");

  function tampil(no, gulir) {
    no = Math.min(babs.length, Math.max(1, +no || 1));
    babs.forEach(function (b) { b.hidden = b.id !== "bab-" + no; });
    tautan.forEach(function (a) { if (+a.dataset.bab === no) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (gulir) {
      var nav = document.querySelector(".materi-nav");
      window.scrollTo({ top: nav.getBoundingClientRect().top + window.pageYOffset - 12, behavior: "smooth" });
      var h = document.getElementById("judul-bab-" + no); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    }
  }
  function dariHash(gulir) { var m = location.hash.match(/^#bab-(\d)$/); tampil(m ? m[1] : 1, gulir && !!m); }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-bab]");
    if (a) {
      e.preventDefault();
      history.pushState(null, "", "#bab-" + a.dataset.bab);
      tampil(a.dataset.bab, true);
      return;
    }
    var acak = e.target.closest("button[data-acak]");
    if (acak) {
      var kartu = [].slice.call(document.querySelectorAll("#bab-" + acak.dataset.acak + " .kartu-refleksi li"));
      var lama = kartu.filter(function (k) { return k.classList.contains("terpilih"); })[0];
      var pilihan = kartu.filter(function (k) { return k !== lama; });
      var k = pilihan[Math.floor(Math.random() * pilihan.length)];
      kartu.forEach(function (x) { x.classList.remove("terpilih"); x.removeAttribute("aria-current"); });
      k.classList.add("terpilih"); k.setAttribute("aria-current", "true");
      k.scrollIntoView({ behavior: "smooth", block: "center" });
      acak.textContent = "Ambil kartu lain";
    }
  });
  window.addEventListener("popstate", function () { dariHash(true); });
  dariHash(false);
})();
