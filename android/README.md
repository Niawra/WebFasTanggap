# FasTanggap Android

Aplikasi pelaporan kerusakan fasilitas untuk siswa dan petugas sarana.
Memakai database Supabase yang sama dengan website.

## Membuka

1. Android Studio → **Open** → pilih folder `android/` ini.
2. Tunggu Gradle sync selesai (Gradle 9.5 + AGP 9.3.2, sama dengan Android Studio di laptop ini).
3. Pilih emulator/HP → **Run ▶**.

Sebelum dipakai, jalankan `supabase/migrasi-aplikasi.sql` di Supabase
(kolom nomor WA, klaim tugas, realtime). Panduan WhatsApp: `supabase/README-WA.md`.

## Isi aplikasi

**Siswa**
- Beranda: sapaan, kartu "Ada yang rusak?", jumlah laporan per status (angka berhitung).
- Buat laporan (tombol merah bulat): 4 langkah — kategori → lokasi → judul/foto → cek → terkirim (animasi centang + kode FT-xxxx).
- Laporan saya: saringan status, detail dengan garis waktu, tombol **Chat petugas di WhatsApp** setelah laporan diambil.

**Petugas**
- Tugas: tugas yang belum diambil, tersambung realtime. Tombol **Ambil tugas** — hanya petugas pertama yang berhasil, yang lain langsung dapat notifikasi "sudah diambil".
- Tugasku: tandai selesai / tolak dengan catatan.
- Ringkasan: cincin persentase selesai + batang per kategori yang tumbuh.
- Akun: nomor WhatsApp untuk notifikasi OpenWA.

## Tampilan

- Bilah navigasi kaca mengambang (blur dari library Haze + kilau tepi ala liquid glass), pil merah muda yang meluncur dengan pegas.
- Judul besar ala iOS, kartu membulat 24dp yang mengecil saat ditekan, notifikasi "pulau" yang turun dari atas.
- Blur kaca aktif di Android 12+; di versi lebih lama otomatis jadi kaca putih transparan.

## Struktur

```
app/src/main/java/id/fastanggap/app/
  MainActivity.kt, AppViewModel.kt
  data/   Model.kt, Repo.kt (Supabase)
  ui/     Tema.kt, Komponen.kt (kaca, kartu, tombol), Aplikasi.kt (kerangka + tab), Masuk.kt
  ui/siswa/    Siswa.kt (beranda, daftar, detail), Lapor.kt (alur lapor)
  ui/petugas/  Petugas.kt (tugas, tugasku, ringkasan, akun)
```
