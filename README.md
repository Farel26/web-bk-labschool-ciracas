# Web BK SMP Labschool Ciracas

Website layanan Bimbingan dan Konseling SMP Labschool Ciracas. Isinya: konsultasi, kotak curhat anonim, janji temu orang tua, materi BK, agenda, dan galeri.

## Isi folder

| File | Fungsi |
|---|---|
| `index.html` | Beranda |
| `curhat.html` | Kotak curhat anonim |
| `janji-orang-tua.html` | Formulir janji temu orang tua/wali |
| `lapor.html` | Lapor perundungan (boleh anonim, dapat kode) |
| `cek.html` | Cek balasan dan jadwal konseling dengan kode |
| `siswa.html` | Portal siswa: aktivasi akun (nama + kelas + NIS cocok dengan DataSiswa), pengajuan konseling dan jadwalnya, target belajar, waktu fokus, hasil tes minat |
| `wali.html` | Portal wali kelas: kirim rujukan siswa, pantau status, jadwal, dan tanggapan guru BK (tanpa catatan konseling) |
| `tes-minat.html` | Tes minat karier RIASEC (persetujuan, identitas, 42 pernyataan, halaman hasil bergambar) |
| `survei.html` | Survei kepuasan layanan |
| `kaldik.html` | Kalender pendidikan, otomatis dari file kaldik resmi |
| `psb.html` | Informasi Penerimaan Siswa Baru (PSB), otomatis dari tab **Info_PSB** |
| `guru.html` | Dashboard tertutup guru BK (login): kotak masuk (termasuk rujukan wali kelas dan penjadwalan sesi), pemantauan + evaluasi sesi, jurnal harian, profil siswa, laporan, surat, arsip scan, statistik, akun wali kelas & siswa |
| `privasi.html` | Kebijakan privasi |
| `arsip.html`, `arsip-*.html` | Arsip kegiatan (tujuan, hasil, evaluasi, dokumentasi) |
| `assets/css/style.css` | Tampilan |
| `assets/js/config.js` | **Tempat URL Apps Script** |
| `assets/js/main.js` | Menu HP, pengiriman formulir, agenda dari Sheets |
| `assets/js/riasec.js` | Butir soal, kunci, dan isi hasil RIASEC (pekerjaan, jurusan, kegiatan) |
| `assets/js/tes-minat.js` | Alur tes minat dan tampilan hasil |
| `assets/js/jadwal.js` | Tampilan status & jadwal sesi (dipakai cek.html, siswa.html, wali.html) |
| `assets/js/siswa.js`, `assets/js/wali.js` | Portal siswa dan portal wali kelas |
| `assets/img/` | Logo, ilustrasi, foto guru, galeri, QR code |
| `apps-script/Code.gs` | Kode untuk Google Sheet (tidak dijalankan oleh GitHub) |

## Menyambungkan formulir ke Google Sheet

1. Buka sheet **Data Web BK Labschool Ciracas** di Google Drive.
2. **Ekstensi → Apps Script**, hapus isi bawaan, tempel isi `apps-script/Code.gs`, lalu simpan.
3. **Terapkan → Deployment baru → Aplikasi web**
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
4. Izinkan akses yang diminta, lalu salin URL yang berakhiran `/exec`.
5. Tempel URL itu di `assets/js/config.js` pada `SCRIPT_URL`, lalu commit.

Isian formulir masuk ke tab **Konseling** (sekarang dengan kode, jadi siswa bisa cek jadwalnya), **Curhat**, **LaporanPerundungan**, **JanjiOrangTua**, dan **Survei**. Tab **Rekap** menghitung semuanya otomatis.

**Setelah mengubah CSS/JS:** naikkan angka `?v=` di tautan `style.css`/`*.js` pada semua halaman agar browser tidak memakai file lama.

**Setelah mengganti `Code.gs`:** Terapkan → Kelola deployment → edit (pensil) → Versi: *Versi baru* → Terapkan. URL tetap sama. Setiap isian baru juga mengirim email pemberitahuan ke pemilik sheet, tanpa isi ceritanya.

## Memperbarui isi tanpa mengedit kode

- **Kalender pendidikan:** otomatis. Apps Script menyalin file *Kalender Pendidikan SMP Labscira 2026-2027 (PUBLIC).xlsx* ke tab **Kaldik** setiap jam (fungsi `syncKaldik`). Cukup perbarui file kaldik aslinya. Untuk tahun ajaran baru, ganti `KALDIK_FILE_ID` di `Code.gs`.

- **Agenda beranda:** gabungan kegiatan dari kaldik dan tab **Agenda** (khusus kegiatan BK). Baris dengan Tampil = `YA` yang tanggalnya belum lewat muncul di web, maksimal 4.
- **Pengumuman:** baris pertama dengan Tampil = `YA` di tab **Pengumuman** muncul di pita biru.

- **Informasi PSB (`psb.html`):** otomatis dari tab **Info_PSB** di Google Sheet *Info & Agen WA PSB* (Apps Script terpisah, URL-nya di `PSB_URL` pada `config.js`). Baris dengan Aktif = `Ya` yang sudah diisi (bukan `[ISI ...]`) langsung tampil. Link per topik: `psb.html?t=biaya`, `?t=jadwal`, `?t=psikotes`, dst.

## Letak file di Google Drive

Semua yang terkait web ada di folder Drive **BK SMP LABSCIRA › WEB BK (website)**:

- **Data Web BK Labschool Ciracas** (Google Sheet + Apps Script di dalamnya)
- **Backup Data Web BK**: salinan sheet otomatis setiap Minggu malam
- **Arsip Scan Web BK**: hasil scan/foto dokumen dari dashboard guru (nama file diawali nomor dokumen)
- **Catatan Web BK**: daftar tautan, arti nomor dokumen, dan cara merawat web

Folder backup dan arsip scan selalu dibuat di sebelah sheet. Jika sheet dipindah, pindahkan kedua folder itu bersamanya.

## Privasi

- Data siswa hanya disimpan di Google Sheet, bukan di repo ini. Repo ini publik.
- Bagikan sheet hanya kepada guru BK.

## Dashboard guru BK

- Akun ada di tab **AkunGuruBK** (Username, Nama, Salt, Hash password, Aktif, Terakhir masuk). Password hanya disimpan sebagai hash; ganti lewat tab **Akun** di dashboard. Isi `TIDAK` di kolom Aktif untuk menonaktifkan akun.
- Data masuk ke tab **LaporanKejadian** dan **SuratPerjanjian**.
- Sesi berlaku 6 jam; 5x salah password = dikunci 15 menit.
- **DataSiswa**: daftar siswa resmi (Nama siswa, Kelas, L/P). Dipakai untuk saran nama dan isi kelas otomatis di dashboard. Perbarui setiap tahun ajaran.
- **CatatanPerkembangan**: catatan tindak lanjut setiap kasus (KJ-). Kolom *Pantau berikutnya* di LaporanKejadian menentukan urutan di menu Pemantauan.
- Pengingat email setiap Senin 06.00 (fungsi `pengingatPemantauan`, dipasang sekali lewat `pasangPemicuPengingat`).
- Laporan bulanan untuk kepala sekolah dicetak dari menu Statistik.

## Tes minat karier (RIASEC)

- Instrumen: 42 pernyataan Ya/Tidak, 7 per tipe (Realistis, Investigatif, Artistik, Sosial, Wirausaha, Konvensional). Kunci tipe tiap butir ada di `RIASEC_KUNCI` (Code.gs) dan `KUNCI` (riasec.js); keduanya harus sama.
- Siswa mengisi persetujuan dan identitas, lalu menjawab. Skor dihitung di browser dan dihitung ulang di Apps Script dari jawaban, lalu disimpan di tab **TesMinatKarier**.
- Setiap hasil punya kode `RM-XXXXXX` untuk membuka hasil lagi di `tes-minat.html?kode=...`.
- Guru BK melihat rekap per kelas di menu **Tes minat** dashboard. Hasil juga muncul di Profil siswa dan Statistik.
- Gambar hasil ada di `assets/img/riasec/` (R, I, A, S, E, C).

## Kode cek balasan

Curhat dan laporan perundungan mendapat kode (mis. `BK-7F3K9Q`). Guru BK menulis jawaban di kolom **"Balasan untuk siswa/pelapor (tampil di web)"**. Siswa membacanya di `cek.html` dengan kode itu. Kolom catatan internal tidak pernah tampil di web.

## Portal siswa, portal wali kelas, jurnal harian (November 2026)

**Setelah menempel `Code.gs` versi ini dan membuat Versi baru:** buka web sekali (halaman mana saja). Tab baru dibuat otomatis dan kolom baru ditambahkan di ujung kanan tab lama. Data lama tidak diubah.

| Tab baru | Isi |
|---|---|
| **RujukanWaliKelas** | Rujukan dari portal wali kelas. Muncul di Kotak masuk › Rujukan wali kelas |
| **AkunWaliKelas** | Akun wali kelas (dibuat guru BK di menu Akun). Password hanya disimpan sebagai hash |
| **AkunSiswa** | Akun yang diaktifkan siswa sendiri. PIN hanya disimpan sebagai hash |
| **TargetSiswa** | Target belajar yang ditulis siswa di portal |
| **JurnalHarian** | Jurnal harian guru BK |

Kolom baru: **Konseling** (Kode, Akun siswa, Jadwal sesi, Jam sesi, Tempat sesi, Pesan untuk siswa) dan **CatatanPerkembangan** (Sesi ke, Pendekatan/teknik, laiseg, pikiran otomatis/alternatif, skala kemajuan).

**Aktivasi akun siswa** mencocokkan nama lengkap + kelas dengan tab **DataSiswa**. Bila tab itu punya kolom berjudul **NIS** (atau NISN), siswa juga wajib mengisi NIS. Tanpa kolom NIS, siapa pun yang tahu nama dan kelas seorang siswa bisa mengaktifkan akun atas namanya, jadi sebaiknya tambahkan kolom NIS sebelum portal siswa diumumkan. Satu nama hanya bisa diaktifkan sekali; bila ada yang mengaku "akunku sudah dipakai orang", nonaktifkan akun itu di menu Akun lalu minta siswa mengaktifkan ulang.

**Keamanan sesi:** guru BK, wali kelas, dan siswa memakai jenis sesi yang terpisah. Token wali kelas atau siswa ditolak oleh semua aksi dashboard guru. Akun yang dinonaktifkan langsung keluar. Lima kali salah password/PIN mengunci akun itu 15 menit.
