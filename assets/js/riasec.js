/* Tes Minat Karier RIASEC (Holland), versi web BK SMP Labschool Ciracas.
 * 42 pernyataan, 7 per tipe. Siswa menjawab "Ya, sesuai" atau "Tidak".
 * Skor tiap tipe = jumlah jawaban "Ya". Kode minat = 3 tipe dengan skor tertinggi. */
(function () {
  "use strict";

  // Kunci: huruf tipe untuk butir 1–42 (sesuai lembar "The RIASEC Test").
  var KUNCI = "RIASECRACEISSRCEAIESIRACCIASERARISCERCISAE";

  var BUTIR = [
    "Saya suka mengutak-atik kendaraan, seperti sepeda, motor, atau mobil.",
    "Saya suka mengerjakan teka-teki.",
    "Saya bisa bekerja dengan baik secara mandiri.",
    "Saya suka bekerja dalam tim.",
    "Saya orang yang punya ambisi dan suka menetapkan target untuk diri sendiri.",
    "Saya suka merapikan barang, seperti berkas, meja, atau ruangan.",
    "Saya suka membuat atau membangun sesuatu.",
    "Saya suka membaca tentang seni dan musik.",
    "Saya suka mengikuti petunjuk yang jelas.",
    "Saya suka memengaruhi atau membujuk orang lain.",
    "Saya suka melakukan percobaan atau eksperimen.",
    "Saya suka mengajari atau melatih orang lain.",
    "Saya suka membantu orang lain menyelesaikan masalahnya.",
    "Saya suka merawat hewan.",
    "Saya tidak keberatan bekerja 8 jam sehari di kantor.",
    "Saya suka berjualan.",
    "Saya senang menulis cerita, puisi, atau tulisan kreatif lain.",
    "Saya senang belajar sains (IPA).",
    "Saya cepat mau menerima tanggung jawab baru.",
    "Saya tertarik merawat atau menyembuhkan orang sakit.",
    "Saya senang mencari tahu cara kerja suatu benda.",
    "Saya suka merakit atau menyusun barang.",
    "Saya orang yang kreatif.",
    "Saya teliti dan memperhatikan hal-hal kecil.",
    "Saya suka mengarsipkan berkas atau mengetik.",
    "Saya suka menganalisis suatu masalah atau keadaan.",
    "Saya suka bermain alat musik atau bernyanyi.",
    "Saya senang mempelajari budaya lain.",
    "Suatu hari nanti saya ingin punya usaha sendiri.",
    "Saya suka memasak.",
    "Saya suka berakting atau bermain drama.",
    "Saya orang yang praktis.",
    "Saya suka bekerja dengan angka atau grafik.",
    "Saya suka berdiskusi tentang suatu isu.",
    "Saya rapi dalam mencatat hasil pekerjaan saya.",
    "Saya suka memimpin.",
    "Saya suka bekerja di luar ruangan.",
    "Saya ingin bekerja di kantor.",
    "Saya pandai matematika.",
    "Saya suka membantu orang lain.",
    "Saya suka menggambar.",
    "Saya suka berpidato atau berbicara di depan banyak orang."
  ];

  var URUT = ["R", "I", "A", "S", "E", "C"];

  // Ikon garis 24x24 untuk kartu pekerjaan.
  var IKON = {
    mekanik: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    insinyur: '<path d="M2 20h20M5 20V10l7-6 7 6v10M9 20v-6h6v6"/>',
    tani: '<path d="M12 21v-9M12 12c0-4 3-7 8-7 0 5-3 7-8 7zM12 15c0-3-2.5-5-6.5-5 0 3.5 2.5 5 6.5 5z"/>',
    chef: '<path d="M6 13a4 4 0 1 1 2-7.5 4.5 4.5 0 0 1 8 0A4 4 0 1 1 18 13v7H6zM6 17h12"/>',
    komputer: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    dokter: '<path d="M6 3v6a6 6 0 0 0 12 0V3M12 15v2a4 4 0 0 0 8 0v-3"/><circle cx="20" cy="12" r="2"/>',
    ilmuwan: '<path d="M9 3h6M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4A1.5 1.5 0 0 0 20 19l-6-10V3M7 15h10"/>',
    laut: '<path d="M2 16c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M2 20c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M14 4l-4 6h7z"/>',
    psikolog: '<path d="M12 21c-5-3-8-6-8-10a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 4-3 7-8 10z"/><path d="M9 11h2l1-2 1 4 1-2h1"/>',
    desain: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 9.8C22 6 17.5 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
    foto: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
    musik: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    arsitek: '<path d="M3 21h18M5 21V10l7-6 7 6v11"/><path d="M9 21v-6h6v6"/>',
    siaran: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/>',
    guru: '<path d="M2 8l10-5 10 5-10 5zM6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 8v6"/>',
    konselor: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>',
    perawat: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
    terapi: '<circle cx="12" cy="5" r="2"/><path d="M12 7v6l-4 7M12 13l4 7M7 10h10"/>',
    wisata: '<path d="M3 11l18-8-8 18-2-8z"/>',
    humas: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 8a5 5 0 0 1 0 8"/>',
    usaha: '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M3 9h18"/>',
    hukum: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    pemasaran: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    diplomat: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
    fesyen: '<path d="M12 4a2 2 0 0 1 2 2c0 1-1 1.5-2 2v1M4 19l8-7 8 7z"/>',
    akuntan: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/>',
    admin: '<path d="M4 4h6l2 2h8v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M8 13h8M8 16h5"/>',
    rekam: '<path d="M9 3h6v4H9zM7 5H5v16h14V5h-2M12 11v6M9 14h6"/>',
    data: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    asuransi: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'
  };

  var TIPE = {
    R: { kode: "R", nama: "Realistic", id: "Realistis", julukan: "Si Pelaku", warna: "#C2410C", latar: "#FFF1E8",
      gambar: "assets/img/riasec/R.svg",
      ringkas: "Kamu senang bekerja dengan tangan, alat, mesin, tumbuhan, atau hewan, dan suka hasil kerja yang nyata dan bisa dilihat.",
      ciri: ["Praktis dan suka langsung mencoba", "Senang merakit, memperbaiki, atau membangun", "Betah beraktivitas fisik dan di luar ruangan"],
      pekerjaan: [
        { nama: "Teknisi otomotif atau mesin", ket: "Merawat dan memperbaiki kendaraan dan mesin.", ikon: "mekanik" },
        { nama: "Insinyur atau ahli konstruksi", ket: "Merancang dan membangun gedung, jalan, dan jembatan.", ikon: "insinyur" },
        { nama: "Ahli pertanian", ket: "Mengembangkan tanaman pangan dan pertanian modern.", ikon: "tani" },
        { nama: "Chef dan perhotelan", ket: "Mengolah makanan dan melayani tamu.", ikon: "chef" },
        { nama: "Teknisi komputer dan jaringan", ket: "Merakit, memasang, dan memperbaiki perangkat komputer.", ikon: "komputer" }
      ],
      jurusan: ["Pertanian", "Asisten tenaga kesehatan", "Komputer", "Konstruksi", "Mesin dan permesinan", "Teknik", "Tata boga dan perhotelan"],
      jalur: ["Sumber daya alam", "Layanan kesehatan", "Teknologi industri dan rekayasa", "Seni dan komunikasi"],
      kegiatan: ["Ekstrakurikuler robotik, pramuka, atau olahraga", "Proyek membuat atau memperbaiki barang sederhana", "Berkebun atau merawat tanaman di sekolah"] },
    I: { kode: "I", nama: "Investigative", id: "Investigatif", julukan: "Si Pemikir", warna: "#1D4ED8", latar: "#EAF2FF",
      gambar: "assets/img/riasec/I.svg",
      ringkas: "Kamu senang mengamati, belajar, menganalisis, dan memecahkan masalah. Rasa ingin tahumu besar.",
      ciri: ["Penasaran dan suka bertanya “mengapa”", "Senang sains, matematika, dan teka-teki", "Teliti saat mencari jawaban"],
      pekerjaan: [
        { nama: "Dokter atau dokter bedah", ket: "Memeriksa, mendiagnosis, dan mengobati pasien.", ikon: "dokter" },
        { nama: "Ilmuwan atau ahli kimia", ket: "Melakukan penelitian dan percobaan di laboratorium.", ikon: "ilmuwan" },
        { nama: "Ahli biologi kelautan atau zoologi", ket: "Meneliti kehidupan hewan di laut dan darat.", ikon: "laut" },
        { nama: "Psikolog", ket: "Mempelajari perilaku dan membantu kesehatan mental.", ikon: "psikolog" },
        { nama: "Insinyur", ket: "Memecahkan masalah teknis dengan ilmu pengetahuan.", ikon: "insinyur" }
      ],
      jurusan: ["Biologi kelautan", "Teknik", "Kimia", "Zoologi", "Kedokteran dan bedah", "Ekonomi konsumen", "Psikologi"],
      jalur: ["Layanan kesehatan", "Bisnis", "Layanan publik dan kemanusiaan", "Teknologi industri dan rekayasa"],
      kegiatan: ["Kelompok ilmiah remaja (KIR) atau klub sains", "Olimpiade matematika atau IPA", "Membaca buku dan menonton dokumenter sains"] },
    A: { kode: "A", nama: "Artistic", id: "Artistik", julukan: "Si Pencipta", warna: "#7C3AED", latar: "#F6EEFF",
      gambar: "assets/img/riasec/A.svg",
      ringkas: "Kamu senang berkarya dan berekspresi dengan bebas, dan suka suasana yang tidak terlalu kaku tempat kreativitasmu bisa tumbuh.",
      ciri: ["Imajinatif dan punya banyak ide", "Senang seni, musik, menulis, atau tampil", "Suka cara-cara baru dan berbeda"],
      pekerjaan: [
        { nama: "Desainer grafis dan komunikasi visual", ket: "Membuat poster, logo, dan konten digital.", ikon: "desain" },
        { nama: "Fotografer atau videografer", ket: "Mengabadikan momen dan bercerita lewat gambar.", ikon: "foto" },
        { nama: "Musisi atau seniman pertunjukan", ket: "Bermain musik, menyanyi, berakting, atau menari.", ikon: "musik" },
        { nama: "Arsitek atau desainer interior", ket: "Merancang bangunan dan ruangan yang indah dan nyaman.", ikon: "arsitek" },
        { nama: "Penyiar radio dan TV", ket: "Membawakan acara dan menyampaikan informasi.", ikon: "siaran" }
      ],
      jurusan: ["Ilmu komunikasi", "Tata rias (kosmetologi)", "Seni rupa dan seni pertunjukan", "Fotografi", "Radio dan televisi", "Desain interior", "Arsitektur"],
      jalur: ["Layanan publik dan kemanusiaan", "Seni dan komunikasi"],
      kegiatan: ["Ekstrakurikuler seni, musik, tari, atau teater", "Jurnalistik atau majalah dinding sekolah", "Lomba menggambar, menulis, atau fotografi"] },
    S: { kode: "S", nama: "Social", id: "Sosial", julukan: "Si Penolong", warna: "#15803D", latar: "#EAF8EF",
      gambar: "assets/img/riasec/S.svg",
      ringkas: "Kamu senang bekerja dengan orang daripada dengan benda: membantu, mengajar, mendengarkan, dan merawat.",
      ciri: ["Peduli dan mudah memahami perasaan orang lain", "Senang bekerja sama dan berbagi", "Nyaman menjelaskan dan mengajari teman"],
      pekerjaan: [
        { nama: "Guru atau pendidik", ket: "Mengajar dan membimbing peserta didik.", ikon: "guru" },
        { nama: "Konselor", ket: "Mendengarkan dan membantu orang menyelesaikan masalah.", ikon: "konselor" },
        { nama: "Perawat", ket: "Merawat pasien dan mendampingi pemulihan.", ikon: "perawat" },
        { nama: "Fisioterapis", ket: "Membantu pemulihan gerak tubuh setelah sakit atau cedera.", ikon: "terapi" },
        { nama: "Pemandu wisata atau humas", ket: "Melayani orang dan menyampaikan informasi dengan ramah.", ikon: "wisata" }
      ],
      jurusan: ["Bimbingan dan konseling", "Keperawatan", "Fisioterapi", "Pariwisata", "Periklanan", "Hubungan masyarakat", "Pendidikan"],
      jalur: ["Layanan kesehatan", "Layanan publik dan kemanusiaan"],
      kegiatan: ["OSIS, PMR, atau kegiatan sosial", "Menjadi tutor sebaya untuk teman", "Kegiatan bakti sosial dan relawan"] },
    E: { kode: "E", nama: "Enterprising", id: "Wirausaha", julukan: "Si Pemimpin", warna: "#B91C1C", latar: "#FFF0F0",
      gambar: "assets/img/riasec/E.svg",
      ringkas: "Kamu senang bekerja dengan orang lain untuk memimpin, meyakinkan, dan tampil, serta berani mengambil peluang.",
      ciri: ["Percaya diri dan berani berbicara", "Senang memimpin dan mengatur tim", "Suka tantangan dan target"],
      pekerjaan: [
        { nama: "Pengusaha atau wirausaha", ket: "Membangun dan mengelola usaha sendiri.", ikon: "usaha" },
        { nama: "Pengacara atau ahli hukum", ket: "Membela dan memberi nasihat hukum.", ikon: "hukum" },
        { nama: "Pemasaran dan penjualan", ket: "Memperkenalkan dan menjual produk.", ikon: "pemasaran" },
        { nama: "Diplomat atau ahli politik", ket: "Mewakili negara dan menjalin kerja sama internasional.", ikon: "diplomat" },
        { nama: "Bankir atau ahli keuangan", ket: "Mengelola keuangan dan investasi.", ikon: "bank" }
      ],
      jurusan: ["Bisnis fesyen", "Properti (real estat)", "Pemasaran dan penjualan", "Hukum", "Ilmu politik", "Perdagangan internasional", "Perbankan dan keuangan"],
      jalur: ["Bisnis", "Layanan publik dan kemanusiaan", "Seni dan komunikasi"],
      kegiatan: ["OSIS, MPK, atau ketua kelas", "Bazar atau usaha kecil saat kegiatan sekolah", "Lomba debat dan pidato"] },
    C: { kode: "C", nama: "Conventional", id: "Konvensional", julukan: "Si Pengatur", warna: "#0F766E", latar: "#E8F7F6",
      gambar: "assets/img/riasec/C.svg",
      ringkas: "Kamu teliti, rapi, dan teratur, serta senang bekerja dengan data, angka, dan aturan yang jelas.",
      ciri: ["Rapi dan terorganisasi", "Teliti terhadap detail dan angka", "Nyaman dengan jadwal dan prosedur yang jelas"],
      pekerjaan: [
        { nama: "Akuntan", ket: "Mencatat dan memeriksa keuangan perusahaan.", ikon: "akuntan" },
        { nama: "Administrator perkantoran", ket: "Mengatur dokumen, jadwal, dan kegiatan kantor.", ikon: "admin" },
        { nama: "Petugas rekam medis", ket: "Mengelola data kesehatan pasien di rumah sakit.", ikon: "rekam" },
        { nama: "Analis atau pengolah data", ket: "Mengolah data menjadi informasi yang berguna.", ikon: "data" },
        { nama: "Pegawai bank atau asuransi", ket: "Melayani transaksi dan perlindungan keuangan nasabah.", ikon: "asuransi" }
      ],
      jurusan: ["Akuntansi", "Stenografi pengadilan", "Asuransi", "Administrasi", "Rekam medis", "Perbankan", "Pengolahan data"],
      jalur: ["Layanan kesehatan", "Bisnis", "Teknologi industri dan rekayasa"],
      kegiatan: ["Menjadi sekretaris atau bendahara kelas atau OSIS", "Mengelola data atau inventaris kegiatan", "Klub komputer atau literasi digital"] }
  };

  function hitung(jawaban) {
    var skor = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    for (var i = 0; i < 42; i++) if (jawaban.charAt(i) === "1") skor[KUNCI.charAt(i)]++;
    var urut = URUT.slice().sort(function (a, b) { return skor[b] - skor[a] || URUT.indexOf(a) - URUT.indexOf(b); });
    var kode = urut.slice(0, 3).join("");
    // Seri di batas huruf ke-3 dan ke-4: kode minat sebaiknya dibaca bersama guru BK.
    var seri = skor[urut[2]] === skor[urut[3]];
    return { skor: skor, urut: urut, kode: kode, seri: seri, total: URUT.reduce(function (t, k) { return t + skor[k]; }, 0) };
  }

  function ikon(nama, warna) {
    return '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="' + warna + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IKON[nama] || "") + "</svg>";
  }

  window.RIASEC = { KUNCI: KUNCI, BUTIR: BUTIR, TIPE: TIPE, URUT: URUT, hitung: hitung, ikon: ikon };
})();
