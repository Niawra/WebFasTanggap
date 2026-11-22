# Deploy FasTanggap ke Vercel (gratis, tanpa kartu)

Website dan TanggapAI jalan di Vercel, jadi tetap bisa diakses walaupun laptop mati.
Alamatnya tetap, contohnya `https://fastanggap.vercel.app`.

TanggapAI hanya memakai gateway DeepSeek (key bawaan ada di `server/services/ai/gatewayBawaan.js`).
Groq sudah dimatikan di kode (`PROVIDER_DIMATIKAN` di `server/services/ai/index.js`), jadi tidak perlu
API key Groq. Kalau gateway mati, chatbot menampilkan pesan gagal sampai gateway pulih.

## 1. Push repo ke GitHub

```powershell
git add -A
git commit -m "Siapkan deploy Vercel"
git push
```

## 2. Import project di Vercel

1. Buka vercel.com dan pilih **Sign up / Log in with GitHub** (paket Hobby, tanpa kartu).
2. Klik **Add New… → Project**, lalu **Import** repo `WebFasTanggap`.
3. Isi pengaturannya:
   - **Framework Preset:** `Other`.
   - **Root Directory:** `./`, jangan diubah.
   - **Build/Output Settings:** biarkan kosong.
4. Buka **Environment Variables** dan tempel baris ini (bisa sekaligus):

   ```
   NODE_ENV=production
   AI_PROVIDER=openai
   OPENAI_MODEL=cb2/deepseek-v4.1-flash
   SUPABASE_URL=https://gaxykcqqhsdigeviqosl.supabase.co
   SUPABASE_ANON_KEY=<anon key, sama dengan di assets/js/config.js>
   ```

   Opsional: `OPENAI_API_KEY` dan `OPENAI_BASE_URL` untuk mengganti key/alamat gateway bawaan.

5. Klik **Deploy** dan tunggu sekitar 1 menit.

Project lama yang masih punya `AI_PROVIDER=groq` dan `GROQ_API_KEY` tetap aman (Groq diabaikan kode),
tapi sebaiknya diganti ke `AI_PROVIDER=openai` dan `GROQ_API_KEY` dihapus supaya tidak membingungkan.

## 3. Tes

- Buka `https://<nama>.vercel.app`. Website harus tampil.
- Buka `https://<nama>.vercel.app/api/health`. Harus tampil `"status":"ok"`.
- Coba chatbot TanggapAI.

Setiap `git push` ke `main` membuat Vercel otomatis deploy ulang.

## 4. Aplikasi Android

Di `android/app/build.gradle.kts`, ganti nilai `TANGGAPAI_URL` ke `https://<nama>.vercel.app/api/chat`, lalu build ulang APK.

## Catatan

- Di Vercel, server tidak tidur seperti di Render. Permintaan pertama paling lama telat 1–2 detik.
- `render.yaml` tidak dipakai di Vercel. Boleh dibiarkan atau dihapus.
