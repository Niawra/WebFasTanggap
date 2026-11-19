# Deploy FasTanggap ke Render + Groq

Website dan TanggapAI jalan di Render, jadi tetap bisa diakses walaupun laptop mati.
Alamatnya tetap, contohnya `https://fastanggap.onrender.com`.

## 1. Ambil API key Groq (gratis)

1. Buka https://console.groq.com, lalu daftar atau masuk.
2. Buka menu **API Keys** dan klik **Create API Key**.
3. Salin key-nya (diawali `gsk_`). Jangan ditaruh di kode atau di chat.

## 2. Push repo ke GitHub

`render.yaml` harus sudah ada di GitHub (`Niawra/WebFasTanggap`, branch `main`):

```powershell
git add render.yaml DEPLOY-RENDER.md .gitignore
git commit -m "Siapkan deploy Render + Groq"
git push
```

## 3. Buat service di Render

1. Buka https://render.com dan masuk pakai akun GitHub.
2. Klik **New → Blueprint**, lalu pilih repo `WebFasTanggap`.
3. Render membaca `render.yaml` dan meminta dua nilai:
   - `GROQ_API_KEY`: key Groq dari langkah 1.
   - `SUPABASE_ANON_KEY`: salin dari `server/.env` di laptop (sama dengan yang ada di `assets/js/config.js`).
4. Klik **Apply** dan tunggu build selesai, sekitar 2–3 menit.
5. Buka alamat `https://<nama>.onrender.com`. Website harus tampil, dan `.../api/health` harus menampilkan `"status":"ok"`.

Setiap kali kamu `git push` ke `main`, Render otomatis deploy ulang.

## 4. Arahkan aplikasi Android ke Render

Di `android/app/build.gradle.kts`, ganti nilai `TANGGAPAI_URL` ke:

```
https://<nama>.onrender.com/api/chat
```

Lalu build ulang APK dan pasang di HP. Ini cukup dilakukan sekali, karena alamat Render tidak berubah.

## Catatan

- **Server tidur:** paket gratis Render menidurkan server kalau 15 menit tidak ada yang akses. Permintaan pertama setelah itu butuh sekitar 30–50 detik, lalu normal lagi.
- **Batas Groq:** paket gratis Groq punya batas permintaan per menit dan per hari. Cukup untuk demo dan tugas sekolah.
- **Cloudflared dan gateway lokal** tidak dibutuhkan lagi setelah pindah ke Render. `server/.env` di laptop tetap bisa dipakai kalau mau menjalankan server secara lokal.
