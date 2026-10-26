(function () {
  "use strict";
  var CFG = window.BK_CONFIG || {};
  var URL_API = (CFG.SCRIPT_URL || "").trim();

  /* ---------- Menu HP ---------- */
  var btn = document.getElementById("menu-btn");
  var nav = document.getElementById("nav-utama");
  if (btn && nav) {
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        nav.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
        btn.setAttribute("aria-label", "Buka menu");
      }
    });
  }

  /* ---------- Formulir ---------- */
  function setStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = "form-status" + (type ? " " + type : "");
  }

  function validate(form) {
    var firstBad = null;
    form.querySelectorAll("[required]").forEach(function (f) {
      var bad = f.type === "checkbox" ? !f.checked : !String(f.value || "").trim();
      f.setAttribute("aria-invalid", bad ? "true" : "false");
      if (bad && !firstBad) firstBad = f;
    });
    form.querySelectorAll("[required]").forEach(function (f) {
      f.addEventListener("input", function () { f.setAttribute("aria-invalid", "false"); }, { once: true });
    });
    return firstBad;
  }

  document.querySelectorAll("form.js-form").forEach(function (form) {
    var status = form.querySelector(".form-status");
    var submit = form.querySelector('button[type="submit"]');
    var label = submit ? submit.textContent : "";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var bad = validate(form);
      if (bad) {
        setStatus(status, "Ada kolom wajib yang belum diisi. Lengkapi dulu, ya.", "err");
        bad.focus();
        return;
      }
      if (!URL_API) {
        setStatus(status, "Formulir online belum aktif. Untuk sementara, hubungi guru BK lewat WhatsApp di bagian Guru BK.", "err");
        return;
      }
      var data = new URLSearchParams(new FormData(form));
      data.append("form", form.dataset.form || "");
      if (submit) { submit.disabled = true; submit.textContent = "Mengirim…"; }
      setStatus(status, "", "");

      fetch(URL_API, { method: "POST", mode: "no-cors", body: data })
        .then(function () {
          form.reset();
          setStatus(status, form.dataset.ok || "Terkirim. Terima kasih! Guru BK akan menindaklanjuti secepatnya.", "ok");
        })
        .catch(function () {
          setStatus(status, "Belum terkirim karena koneksi bermasalah. Coba lagi sebentar lagi, atau hubungi guru BK lewat WhatsApp.", "err");
        })
        .finally(function () {
          if (submit) { submit.disabled = false; submit.textContent = label; }
        });
    });
  });

  /* ---------- Agenda & pengumuman dari Google Sheets ---------- */
  var list = document.getElementById("agenda-list");
  var info = document.getElementById("pengumuman-teks");
  if (!URL_API || (!list && !info)) return;

  var BULAN = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function tgl(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }

  fetch(URL_API + "?action=data")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (info && d.pengumuman && d.pengumuman.teks) info.textContent = d.pengumuman.teks;
      if (!list || !d.agenda || !d.agenda.length) return;
      list.innerHTML = d.agenda.map(function (a, i) {
        var m = tgl(a.mulai), s = a.selesai ? tgl(a.selesai) : null;
        var hari = s && s.getTime() !== m.getTime()
          ? (m.getMonth() === s.getMonth() ? m.getDate() + "–" + s.getDate() : m.getDate() + "+")
          : String(m.getDate());
        var warna = i % 2 ? "background: #FDF1DA; color: #7A520C" : "background: #E7ECFA; color: #1D3FAE";
        return '<li style="display: flex; gap: 16px; align-items: center">' +
          '<span style="flex: none; width: 64px; height: 64px; border-radius: 16px; ' + warna + '; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Rubik, sans-serif; font-weight: 800; font-size: 17px; line-height: 1">' +
          esc(hari) + '<span style="font-size: 12px; font-weight: 700; margin-top: 4px">' + BULAN[m.getMonth()] + "</span></span>" +
          '<span style="display: flex; flex-direction: column; gap: 2px"><strong style="font-size: 16px">' + esc(a.judul) + "</strong>" +
          (a.keterangan ? '<span style="font-size: 14px; color: #4A5578">' + esc(a.keterangan) + "</span>" : "") +
          "</span></li>";
      }).join("");
    })
    .catch(function () { /* tetap pakai agenda bawaan di HTML */ });
})();
