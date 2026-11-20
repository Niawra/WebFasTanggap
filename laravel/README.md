# FasTanggap: versi Laravel (Tugas PSAS MK-3)

Aplikasi pelaporan kerusakan fasilitas sekolah dengan Login (Authentication) dan Admin Dashboard (CRUD).

Datanya **sama dengan aplikasi Android dan website FasTanggap**. Ketiganya memakai database Supabase
yang sama, jadi laporan yang dikirim dari HP langsung muncul di dashboard Laravel, dan sebaliknya.
Akun login juga sama.

## Menjalankan

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate        # hanya membuat tabel session lokal (SQLite)
php artisan serve
```

Isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di `.env` dengan nilai dari `../assets/js/config.js`.
Buka `http://localhost:8000` dan masuk dengan akun FasTanggap (akun petugas untuk dashboard admin).

## Cara kerja

- Laravel terhubung ke Supabase lewat API resminya (`app/Services/Supabase.php`), memakai token login
  pengguna. Aturan akses (RLS) di Supabase tetap berlaku: siswa hanya melihat laporannya sendiri.
- Login dicek ke Supabase Auth (`app/Auth/SupabaseUserProvider.php`), lalu diteruskan ke sistem Auth
  Laravel, jadi middleware `auth` bekerja seperti biasa.
- SQLite lokal hanya dipakai untuk menyimpan session Laravel.

## Pemetaan ke ketentuan tugas

| Ketentuan | File |
|---|---|
| Halaman login, validasi, logout | `app/Http/Controllers/AuthController.php`, `resources/views/auth/login.blade.php` |
| Middleware pelindung dashboard | `routes/web.php` (`auth`, `guest`), `app/Http/Middleware/PastikanPetugas.php` (`petugas`), `bootstrap/app.php` |
| Dashboard ringkasan jumlah data | `app/Http/Controllers/DashboardController.php`, `resources/views/dashboard.blade.php` |
| Navigasi menu | `resources/views/layouts/app.blade.php` |
| CRUD laporan (tabel utama) | `app/Http/Controllers/ReportController.php`, `resources/views/reports/*` |
| CRUD kategori & lokasi | `CategoryController.php`, `LocationController.php`, `resources/views/master/*` |
| Model | `app/Models/` (`Report`, `Category`, `Location`, `Profile`, dasar `SupabaseModel`) |
| Migration (rancangan DB MK-1) | `database/migrations/2026_11_20_*`: struktur tabel yang ada di Supabase |

## Hak akses

- **Petugas**: melihat semua laporan, mengubah status/prioritas, CRUD kategori dan lokasi.
- **Siswa**: membuat laporan, melihat laporannya sendiri, menghapus selama masih "Menunggu verifikasi".
