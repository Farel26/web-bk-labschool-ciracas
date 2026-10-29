# DESIGN.md · Web BK SMP Labschool Ciracas

Arah desain: **"Stiker Sekolah"**, diturunkan dari *Poster Stop Kekerasan A3*.
Tegas, hangat, dan mudah dibaca anak SMP: huruf tebal, bentuk pil dengan garis biru,
bayangan kuning emas yang "menempel" seperti stiker, dan angka bulat untuk setiap langkah.
Warna tetap warna sekolah (biru, navy, kuning emas) supaya web dan poster terasa satu keluarga.

Semua nilai di bawah tersedia sebagai variabel CSS di `assets/css/style.css` (blok `:root`).
Halaman baru memakai nama token, bukan nilai mentah.

## 1. Warna

| Token | Nilai | Peran |
|---|---|---|
| `--c-primary` | `#1D3FAE` | Tombol utama, tautan, garis stiker, angka langkah |
| `--c-primary-hover` | `#142C7A` | Hover/aktif tombol & tautan |
| `--c-primary-soft` | `#EEF1FB` | Isi pil/stiker, latar kartu informasi |
| `--c-navy` | `#12204F` | Judul, teks utama, band atas, footer |
| `--c-gold` | `#E4A93A` | Bayangan stiker, lengkungan dekor, outline fokus. **Bukan untuk teks di atas krem/putih** (kontras 2:1) |
| `--c-gold-soft` | `#FDF1DA` | Latar sorotan hangat, lengkungan dekor kedua |
| `--c-alert` | `#C0321A` | Isi besar khusus peringatan (tangan STOP, lencana STOP) |
| `--c-alert-text` | `#A1260D` | Teks/tautan peringatan ("Lapor"), kontras ≥ 6:1 di krem |
| `--c-alert-soft` | `#FFF4F0` | Latar kotak darurat |
| `--c-success` | `#17603B` | Status berhasil, tombol WhatsApp (isi `#E6F4EC`) |
| `--c-bg` | `#FEFBF2` | Latar halaman (krem) |
| `--c-surface` | `#FFFFFF` | Kartu, formulir, kotak QR |
| `--c-text` | `#12204F` | Teks utama |
| `--c-text-muted` | `#3B4568` | Paragraf panjang, deskripsi |
| `--c-text-subtle` | `#4A5578` | Keterangan, petunjuk, catatan kaki |
| `--c-border` | `#D9DCE6` | Pemisah, garis kartu biasa |
| `--c-border-warm` | `#ECE8DA` | Garis kartu di atas krem |

Aturan: satu warna aksi (biru). Kuning emas hanya dekorasi dan fokus. Merah hanya untuk keselamatan dan pelaporan, tidak pernah untuk hiasan. Tidak ada mode gelap.

## 2. Tipografi

- **Display: Poppins** 800–900, untuk judul, angka langkah, nomor telepon, label tebal. Huruf kapital penuh hanya untuk band peringatan dan judul poster ("STOP!", "HUBUNGI GURU BK").
- **Teks: Plus Jakarta Sans** 400–700, untuk paragraf, formulir, navigasi.

| Token | Ukuran / tinggi baris | Berat | Pemakaian |
|---|---|---|---|
| `--fs-display` | 56 / 64 (HP 40 / 48) | 900 | Judul hero, "STOP!" |
| `--fs-h1` | 42 / 52 (HP 32 / 40) | 800 | Judul halaman |
| `--fs-h2` | 32 / 40 (HP 26 / 34) | 800 | Judul bagian |
| `--fs-h3` | 22 / 30 | 700 | Judul kartu, judul langkah |
| `--fs-lead` | 19 / 30 | 500 | Pembuka bagian |
| `--fs-body` | 16 / 26 | 400 | Paragraf |
| `--fs-small` | 14 / 20 | 500 | Keterangan, petunjuk |
| `--fs-label` | 13 / 16, spasi huruf 0.08em, kapital | 700 | Eyebrow, label kecil |

Panjang baris paragraf maksimal 680px (±70 karakter).

## 3. Spasi dan lebar

Skala 8 (dengan 4 untuk detail): `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 24 · `--s-6` 32 · `--s-7` 48 · `--s-8` 64 · `--s-9` 96.

- Jarak antarbagian: 96px di laptop, 64px di HP.
- Lebar konten: 1200px (`--w-content`), teks 680px (`--w-text`), gutter samping 24px.
- Jarak antar-langkah bernomor: 18px.

## 4. Bentuk dan kedalaman

- Radius: `--r-sm` 12 (input), `--r-md` 20 (kartu), `--r-lg` 28 (lencana peringatan), `--r-pill` 999 (tombol, pil, angka).
- Garis stiker: `--bw-sticker` 3px warna `--c-primary`.
- Bayangan: hanya dua, keduanya padat tanpa blur.
  - `--sh-sticker`: `6px 6px 0 var(--c-gold)` untuk stiker besar (langkah, kartu kontak).
  - `--sh-sticker-sm`: `4px 4px 0 var(--c-gold)` untuk tombol dan pil kecil.
- Tidak ada gradasi, glassmorphism, atau bayangan kabur. Kedalaman datang dari garis + bayangan emas.

## 5. Komponen

- **Tombol utama** (`.btn-stk`): isi biru, teks putih Poppins 700, pil, tinggi min. 52px, `--sh-sticker-sm`. Hover: biru tua, bergeser 2px ke kanan-bawah dan bayangan mengecil (seperti stiker ditekan). Fokus: outline emas 3px, jarak 3px. Nonaktif: opasitas 0.5, tanpa geser.
- **Tombol kedua** (`.btn-stk.is-outline`): isi putih, garis biru 3px, teks biru.
- **Tombol tenang**: tautan teks biru tebal, garis bawah saat hover.
- **Tombol peringatan** (`.btn-stk.is-alert`): isi `--c-alert`, teks putih, hanya untuk "Lapor".
- **Pil kontak** (`.pill-stk`): isi `--c-primary-soft`, garis stiker, `--sh-sticker-sm`, nomor dalam Poppins 800.
- **Langkah bernomor** (`.step-stk`): lingkaran angka putih 72px (HP 52px) bergaris biru 4px, menimpa pil langkah 28px; pil berisi `--c-primary-soft`, garis stiker, `--sh-sticker`.
- **Kartu** (`.card`): putih, garis `--c-border-warm`, radius 20, tanpa bayangan. Kartu yang perlu menonjol memakai garis stiker + `--sh-sticker`.
- **Input**: putih, garis 1.5px `#CFD5E6`, radius 12, tinggi min. 46px; fokus garis biru + outline `#B9C8F2`; error garis `--c-alert-text` + pesan di bawah.
- **Navigasi**: putih/krem, tautan navy 600, satu tombol utama "Konsultasi"; "Lapor" ditulis merah `--c-alert-text`.
- **Band peringatan**: latar navy, judul kapital Poppins 800, lencana "STOP!" merah dengan cincin putih 6px.
- **Footer**: navy, teks `#DCE3F8`, ikon garis putih, QR dalam kotak putih radius 14.

## 6. Gambar dan ikon

- **Ikon**: garis 2px, kotak 24px, ujung membulat (gaya Lucide/Feather). Tanpa emoji.
- **Dekor**: band navy di atas + lengkungan emas (`--c-gold`, `--c-gold-soft`) satu kali per halaman, di hero saja.
- **Foto**: foto kegiatan sekolah asli, sudut membulat 16–24px. Tanpa foto stok.
- **Logo**: logo SMP Labschool Ciracas dan maskot elang, di dalam pil putih bergaris stiker.
- **Ilustrasi peringatan**: telapak tangan merah datar hanya di konteks pelaporan/kekerasan.

## 7. Aksesibilitas

Kontras teks minimal 4.5:1 (teks besar 3:1). Target sentuh min. 44px. Fokus selalu terlihat (outline emas). Gerakan hover dimatikan bila `prefers-reduced-motion`.
