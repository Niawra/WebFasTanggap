# Notifikasi WhatsApp lewat OpenWA

Alurnya:

```
Siswa kirim laporan (aplikasi/web)
   └─► tabel reports (Supabase)
         └─► trigger reports_kabari_wa  ──pg_net──►  Edge Function kabari-wa
                                                        └─► OpenWA (laptop/server)
                                                              └─► WhatsApp semua petugas
Petugas tekan "Ambil tugas" ─► ambil_tugas() (hanya yang pertama berhasil)
   └─► trigger lagi (jenis "diambil") ─► WA ke petugas lain: "FT-xxx sudah diambil Pak X"
Petugas tandai selesai ─► WA ke pelapor (kalau dia mengisi nomor)
```

> ⚠️ OpenWA bukan API resmi Meta. Pakai **nomor WhatsApp khusus** untuk bot
> FasTanggap, jangan nomor pribadi, karena ada risiko nomor dibatasi/diblokir.

## 1. Jalankan migrasi

Supabase → SQL Editor → tempel isi `supabase/migrasi-aplikasi.sql` → Run.

## 2. Jalankan OpenWA

Butuh Docker Desktop (atau Node.js 22 kalau dari source).

```bash
git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA
docker compose -f docker-compose.dev.yml up -d
docker exec openwa-api cat /app/data/.api-key   # catat API key-nya
```

Dasbor OpenWA: http://localhost:2785. Buat sesi dan scan QR pakai HP bot:

```bash
curl -X POST http://localhost:2785/api/sessions -H "X-API-Key: API_KEY" -H "Content-Type: application/json" -d '{"name":"fastanggap"}'
curl -X POST http://localhost:2785/api/sessions/ID_SESI/start -H "X-API-Key: API_KEY"
```

Lalu buka QR dari dasbor (atau `GET /api/sessions/ID_SESI/qr`) dan scan dari
WhatsApp → Perangkat tertaut.

## 3. Buka OpenWA ke internet

Edge Function berjalan di server Supabase, jadi OpenWA di laptop harus punya
alamat publik. Paling gampang pakai Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:2785
```

Catat alamat `https://xxxx.trycloudflare.com` yang muncul.

## 4. Deploy Edge Function

```bash
npx supabase login
npx supabase link --project-ref gaxykcqqhsdigeviqosl
npx supabase secrets set OPENWA_URL=https://xxxx.trycloudflare.com OPENWA_KEY=API_KEY OPENWA_SESI=ID_SESI RAHASIA_WA=rahasia-acak-panjang
npx supabase functions deploy kabari-wa --no-verify-jwt
```

`--no-verify-jwt` karena yang memanggil adalah database; keamanannya dijaga
header `x-rahasia`.

## 5. Sambungkan database ke fungsi

Di SQL Editor (pakai rahasia yang sama dengan `RAHASIA_WA`):

```sql
insert into public.konfigurasi_wa (url_fungsi, rahasia)
values ('https://gaxykcqqhsdigeviqosl.supabase.co/functions/v1/kabari-wa', 'rahasia-acak-panjang')
on conflict (id) do update set url_fungsi = excluded.url_fungsi, rahasia = excluded.rahasia;
```

## 6. Isi nomor petugas

Setiap petugas masuk ke aplikasi → tab **Akun** → isi nomor WhatsApp → Simpan.
Selesai: kirim laporan percobaan, semua petugas akan dapat WA.

Kalau `konfigurasi_wa` belum diisi, laporan tetap tersimpan seperti biasa, hanya
tanpa WhatsApp.
