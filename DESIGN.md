# DESIGN.md: FasTanggap

Arah visual diturunkan langsung dari `telkomschools.sch.id` (warna, tipografi, dan kadar ruang), lalu dipakai untuk produk yang berbeda: pelaporan kerusakan fasilitas sekolah.

## Identitas

- Nama produk: **FasTanggap**
- Konteks: website pelaporan kerusakan fasilitas untuk siswa dan petugas sekolah, SMK Telkom Purwokerto.
- Karakter: institusional tetapi hangat. Kertas putih, tinta gelap, satu merah yang dipakai hemat. Bukan dashboard startup, bukan neon.

## Palet (diambil dari situs Telkom Schools)

| Token | Nilai | Asal / alasan |
|---|---|---|
| `--merah` | `#DD3333` | Warna aksen paling dominan di telkomschools.sch.id (rgb 221,51,51) |
| `--merah-tua` | `#B82525` | Turunan untuk hover dan pressed, supaya merah tidak berubah hue |
| `--tinta` | `#2E2E2E` | Teks utama; versi situs aslinya `#363636`, digelapkan sedikit agar lolos AA di atas kertas hangat |
| `--tinta-lembut` | `#5C5C5C` | Teks sekunder |
| `--kertas` | `#FFFFFF` | Latar utama, sama seperti situs aslinya |
| `--kertas-hangat` | `#FBF5F2` | Latar section bergantian, turunan merah (bukan hue baru) |
| `--garis` | `#E7E0DC` | Garis pemisah |

Warna status bersifat semantik dan hanya muncul pada status laporan: menunggu (amber), diproses (biru), selesai (hijau), ditolak (merah tua). Bukan bagian dari palet dekoratif.

## Tipografi

- Judul: **Poppins** 600/700. Situs Telkom Schools memakai Poppins untuk judul.
- Isi: **Roboto** 400/500. Situs yang sama memakai Roboto untuk 282 dari 300 elemen teks.
- Skala: 15px dasar isi (nyaman dibaca di HP), judul section 28-34px, H1 44-56px di desktop.
- Tanpa huruf monospace, tanpa uppercase bertracking lebar.

## Bentuk dan ruang

- Radius: 10px untuk tombol dan input (sama dengan tombol `.readon` di situs asli), 14px untuk kartu, 999px hanya untuk chip status.
- Bayangan: satu tingkat saja (`0 1px 2px` dan `0 10px 30px -18px`), dipakai pada elemen yang memang mengambang di atas kertas.
- Grid: maksimum 1120px, gutter 24px, section 88-120px.

## Motif identitas

**Simpul merah**: satu kotak merah 8px yang selalu menandai awal sesuatu (awal judul section, awal baris status, awal langkah). Muncul berulang, tidak pernah jadi hiasan di tempat lain. Ini juga yang membuat halaman tidak bisa ditukar logo dengan produk lain.

## Dials

`ENERGY 2 / RHYTHM 3 / MOTION 2`

- ENERGY 2: berani lewat tipografi dan satu blok merah penuh, bukan lewat gradien.
- RHYTHM 3: tiap section beda komposisi (hero asimetris, band penuh, figure lebar, daftar baris, panel gelap).
- MOTION 2: transisi halus pada hover, focus, dan perubahan status. Tanpa parallax.

## Yang sengaja tidak dipakai

- Gradien ungu-biru, glassmorphism, glow, grid latar.
- Bento grid, "3 langkah" dengan ikon bulat, logo klien palsu, testimoni karangan.
- Statistik tanpa sumber. Angka di halaman ini hanya berasal dari data laporan yang benar-benar ada di perangkat pengguna.
