# FasTanggap

Website pelaporan kerusakan fasilitas sekolah. Siswa mengirim laporan dari HP, petugas sekolah memeriksa dan menindaklanjuti, dan statusnya bisa dipantau sampai selesai.

Dibuat untuk tugas Pemodelan Sistem (Use Case Diagram dan Activity Diagram), kelas XI PPLG 4, SMK Telkom Purwokerto.

## Menjalankan

Tidak ada proses build. Cukup jalankan server statis dari folder ini:

```bash
python -m http.server 8000
```

Lalu buka `http://localhost:8000`.

Membuka `index.html` langsung lewat `file://` juga bisa, tetapi sebagian perilaku browser lebih ketat, jadi server lokal lebih aman.

## Akun demo

| Peran | Nama pengguna | Kata sandi |
|---|---|---|
| Siswa | `siswa` | `siswa123` |
| Petugas sekolah | `petugas` | `petugas123` |

Belum ada server. Semua data disimpan di `localStorage` browser, jadi laporan yang kamu buat hanya terlihat di browser itu. Ini cukup untuk memperagakan alur, bukan untuk dipakai sekolah sungguhan.

Kalau dasbor petugas masih kosong, ada tombol **Muat 5 laporan contoh (demo)** untuk mengisi data percobaan.

## Alur yang bisa dicoba

1. **Siswa** masuk, buka *Buat laporan*, isi kategori, lokasi, judul, dan deskripsi. Foto opsional, dan otomatis diperkecil sebelum disimpan.
2. Sistem menyimpan laporan dengan status **Menunggu verifikasi** dan memberi nomor seperti `FT-2611-001`.
3. **Lacak laporan** bisa dipakai tanpa masuk, hanya dengan nomor laporan.
4. **Petugas** membuka dasbor, menyaring laporan menurut status, lalu menekan *Periksa*.
5. Petugas memilih status (**Diproses**, **Selesai**, atau **Ditolak**), menetapkan prioritas, dan menulis catatan tindak lanjut.
6. Setiap perubahan masuk ke riwayat laporan dan terbaca oleh pelapor.

## Peta ke dokumen UML

| Use case di dokumen | Di website |
|---|---|
| Login | `#/masuk`, satu formulir untuk siswa dan petugas |
| Mengajukan Laporan Kerusakan | `#/lapor` |
| Melampirkan Foto (extend, opsional) | Kolom unggah di formulir, gambar diperkecil ke maksimal 1000 px |
| Melihat Riwayat Laporan | `#/laporan` |
| Melihat Status Laporan | `#/lacak` dan halaman detail laporan |
| Melihat Daftar Laporan | `#/petugas` |
| Memverifikasi Laporan | Tombol *Periksa* di dasbor |
| Memperbarui Status Penanganan | Formulir tindak lanjut di dalam dialog |
| Menambahkan Catatan Tindak Lanjut | Kolom catatan, wajib diisi minimal 5 karakter |
| Mengelola Kategori dan Lokasi | `#/petugas/kategori` |
| Melihat Rekap Laporan | `#/petugas/rekap` |

Activity diagram-nya digambarkan sebagai figur isometrik di bagian **Bagaimana satu laporan bergerak**: kartu laporan berjalan melewati gerbang pemeriksaan, berhenti di dial prioritas, lalu ditekan cap selesai. Laporan yang tidak lolos disisihkan ke bak, bukan dibuang.

## Struktur berkas

```
index.html              kerangka halaman
assets/css/style.css    seluruh tampilan
assets/js/store.js      data, akun, dan aturan status
assets/js/app.js        rute, tampilan, dan interaksi
figure/build.mjs        pembangun figur isometrik
figure/triage.html      figur hasil build (dipakai iframe)
figure/kit/             kit gambar isometrik
DESIGN.md               arah visual: palet, tipografi, dial
```

## Membangun ulang figur

```bash
cd figure
node build.mjs
```

Figur memakai kanvas 660x420 dengan palet hangat yang disamakan dengan warna kertas situs.

## Warna dan tipografi

Warna diturunkan dari `telkomschools.sch.id`: merah `#DD3333`, tinta `#2E2E2E`, kertas putih dan kertas hangat `#FBF5F2`. Judul memakai Poppins, isi memakai Roboto, sama seperti situs Telkom Schools. Rinciannya ada di `DESIGN.md`.

## Batasan

- Tidak ada server, tidak ada basis data, dan tidak ada unggahan berkas sungguhan.
- Kata sandi disimpan apa adanya di `localStorage`. Ini hanya untuk demonstrasi.
- Data hilang kalau penyimpanan browser dibersihkan.
