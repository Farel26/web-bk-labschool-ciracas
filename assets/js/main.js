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
    var firstBad = null, seen = {};
    form.querySelectorAll("[required]").forEach(function (f) {
      var bad, target = f;
      if (f.type === "radio") {
        if (seen[f.name]) return;
        seen[f.name] = true;
        bad = !form.querySelector('input[name="' + f.name + '"]:checked');
        target = f.closest("fieldset") || f;
        target.setAttribute("aria-invalid", bad ? "true" : "false");
        form.querySelectorAll('input[name="' + f.name + '"]').forEach(function (r) {
          r.addEventListener("change", function () { target.setAttribute("aria-invalid", "false"); }, { once: true });
        });
      } else {
        bad = f.type === "checkbox" ? !f.checked : !String(f.value || "").trim();
        f.setAttribute("aria-invalid", bad ? "true" : "false");
        f.addEventListener("input", function () { f.setAttribute("aria-invalid", "false"); }, { once: true });
      }
      if (bad && !firstBad) firstBad = f;
    });
    return firstBad;
  }

  function newCode() {
    var abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "BK-", buf = new Uint32Array(6);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 6; i++) s += abc.charAt(buf[i] % abc.length);
    return s;
  }

  function showCode(form, kode) {
    var box = form.parentNode.querySelector(".kode-box");
    if (!box) return;
    box.querySelector(".kode-val").textContent = kode;
    box.querySelector(".kode-link").href = "cek.html?kode=" + encodeURIComponent(kode);
    box.querySelector(".kode-copy").onclick = function () {
      var b = this;
      (navigator.clipboard ? navigator.clipboard.writeText(kode) : Promise.reject())
        .then(function () { b.textContent = "Kode tersalin"; })
        .catch(function () { b.textContent = "Salin manual: " + kode; });
    };
    form.hidden = true;
    box.hidden = false;
    box.focus();
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
      var kode = form.dataset.kode ? newCode() : "";
      var data = new URLSearchParams(new FormData(form));
      data.append("form", form.dataset.form || "");
      if (kode) data.append("kode", kode);
      if (submit) { submit.disabled = true; submit.textContent = "Mengirim…"; }
      setStatus(status, "", "");

      fetch(URL_API, { method: "POST", mode: "no-cors", body: data })
        .then(function () {
          form.reset();
          if (kode) { showCode(form, kode); return; }
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

  /* ---------- Cek balasan dengan kode ---------- */
  var fc = document.getElementById("form-cek");
  if (fc) {
    var inp = fc.querySelector("#k-kode"), st = fc.querySelector(".form-status"), out = document.getElementById("hasil-cek");
    var q = new URLSearchParams(location.search).get("kode");
    if (q) inp.value = q;
    var esc2 = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
    fc.addEventListener("submit", function (e) {
      e.preventDefault();
      var k = inp.value.trim().toUpperCase().replace(/\s+/g, "");
      if (k && k.indexOf("BK-") !== 0) k = "BK-" + k.replace(/^BK/, "");
      if (!/^BK-[A-Z0-9]{6}$/.test(k)) { inp.setAttribute("aria-invalid", "true"); setStatus(st, "Kodenya terdiri dari BK- dan 6 huruf/angka, misalnya BK-7F3K9Q.", "err"); inp.focus(); return; }
      inp.value = k; inp.setAttribute("aria-invalid", "false");
      if (!URL_API) { setStatus(st, "Layanan cek balasan belum aktif.", "err"); return; }
      var btn2 = fc.querySelector('button[type="submit"]'); btn2.disabled = true; btn2.textContent = "Mencari…"; setStatus(st, "", "");
      fetch(URL_API + "?action=cek&kode=" + encodeURIComponent(k))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          out.hidden = false;
          if (!d.found) { out.innerHTML = '<p style="margin:0;font-size:16px;line-height:1.6">Kode <strong>' + esc2(k) + '</strong> belum ditemukan. Periksa lagi penulisannya. Kalau baru saja mengirim, tunggu sebentar lalu coba lagi.</p>'; return; }
          var balas = d.balasan
            ? '<div style="background:#EEF1FB;border-radius:16px;padding:18px 20px;font-size:16px;line-height:1.7;white-space:pre-line">' + esc2(d.balasan) + '</div>'
            : '<p style="margin:0;font-size:16px;line-height:1.6;color:#3B4568">Guru BK belum menulis balasan. Coba cek lagi besok, atau datang langsung ke ruang BK kalau mendesak.</p>';
          out.innerHTML = '<p style="margin:0;font-size:14px;color:#4A5578">' + esc2(d.jenis) + ' · dikirim ' + esc2(d.dikirim) + '</p>' +
            '<p style="margin:0"><span class="soon" style="background:#E7ECFA;color:#1D3FAE">Status: ' + esc2(d.status) + '</span></p>' +
            '<h2 style="margin:4px 0 0;font-family:Rubik,sans-serif;font-weight:800;font-size:22px">Balasan guru BK</h2>' + balas;
        })
        .catch(function () { setStatus(st, "Gagal memuat karena koneksi. Coba lagi sebentar lagi.", "err"); })
        .finally(function () { btn2.disabled = false; btn2.textContent = "Cek Balasan"; });
    });
  }

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
