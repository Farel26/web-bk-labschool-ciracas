# Web BK SMP Labschool Ciracas

Website layanan Bimbingan dan Konseling SMP Labschool Ciracas. Isinya: konsultasi, kotak curhat anonim, janji temu orang tua, materi BK, agenda, dan galeri.

## Isi folder

| File | Fungsi |
|---|---|
| `index.html` | Beranda |
| `curhat.html` | Kotak curhat anonim |
| `janji-orang-tua.html` | Formulir janji temu orang tua/wali |
| `lapor.html` | Lapor perundungan (boleh anonim, dapat kode) |
| `cek.html` | Cek balasan guru BK dengan kode |
| `survei.html` | Survei kepuasan layanan |
| `kaldik.html` | Kalender pendidikan, otomatis dari file kaldik resmi |
| `arsip.html`, `arsip-*.html` | Arsip kegiatan (tujuan, hasil, evaluasi, dokumentasi) |
| `assets/css/style.css` | Tampilan |
| `assets/js/config.js` | **Tempat URL Apps Script** |
| `assets/js/main.js` | Menu HP, pengiriman formulir, agenda dari Sheets |
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

Isian formulir masuk ke tab **Konseling**, **Curhat**, **LaporanPerundungan**, **JanjiOrangTua**, dan **Survei**. Tab **Rekap** menghitung semuanya otomatis.

**Setelah mengganti `Code.gs`:** Terapkan → Kelola deployment → edit (pensil) → Versi: *Versi baru* → Terapkan. URL tetap sama. Setiap isian baru juga mengirim email pemberitahuan ke pemilik sheet, tanpa isi ceritanya.

## Memperbarui isi tanpa mengedit kode

- **Kalender pendidikan:** otomatis. Apps Script menyalin file *Kalender Pendidikan SMP Labscira 2026-2027 (PUBLIC).xlsx* ke tab **Kaldik** setiap jam (fungsi `syncKaldik`). Cukup perbarui file kaldik aslinya. Untuk tahun ajaran baru, ganti `KALDIK_FILE_ID` di `Code.gs`.

- **Agenda beranda:** gabungan kegiatan dari kaldik dan tab **Agenda** (khusus kegiatan BK). Baris dengan Tampil = `YA` yang tanggalnya belum lewat muncul di web, maksimal 4.
- **Pengumuman:** baris pertama dengan Tampil = `YA` di tab **Pengumuman** muncul di pita biru.

## Privasi

- Data siswa hanya disimpan di Google Sheet, bukan di repo ini. Repo ini publik.
- Bagikan sheet hanya kepada guru BK.

## Kode cek balasan

Curhat dan laporan perundungan mendapat kode (mis. `BK-7F3K9Q`). Guru BK menulis jawaban di kolom **"Balasan untuk siswa/pelapor (tampil di web)"**. Siswa membacanya di `cek.html` dengan kode itu. Kolom catatan internal tidak pernah tampil di web.
