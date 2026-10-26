# Web BK SMP Labschool Ciracas

Website layanan Bimbingan dan Konseling SMP Labschool Ciracas. Isinya: konsultasi, kotak curhat anonim, janji temu orang tua, materi BK, agenda, dan galeri.

## Isi folder

| File | Fungsi |
|---|---|
| `index.html` | Beranda |
| `curhat.html` | Kotak curhat anonim |
| `janji-orang-tua.html` | Formulir janji temu orang tua/wali |
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

Isian formulir masuk ke tab **Konseling**, **Curhat**, dan **JanjiOrangTua**. Setiap isian baru juga mengirim email pemberitahuan ke pemilik sheet, tanpa isi ceritanya.

## Memperbarui isi tanpa mengedit kode

- **Agenda:** isi tab **Agenda** di sheet. Baris dengan Tampil = `YA` yang tanggalnya belum lewat akan muncul di web, maksimal 4.
- **Pengumuman:** baris pertama dengan Tampil = `YA` di tab **Pengumuman** muncul di pita biru.

## Privasi

- Data siswa hanya disimpan di Google Sheet, bukan di repo ini. Repo ini publik.
- Bagikan sheet hanya kepada guru BK.
