# Deploy FasTanggap ke Vercel + Groq (gratis, tanpa kartu)

Website dan TanggapAI jalan di Vercel, jadi tetap bisa diakses walaupun laptop mati.
Alamatnya tetap, contohnya `https://fastanggap.vercel.app`.

## 1. Ambil API key Groq

Buka console.groq.com, masuk ke **API Keys**, klik **Create API Key**, lalu salin key-nya (diawali `gsk_`).

## 2. Push repo ke GitHub

```powershell
git add -A
git commit -m "Siapkan deploy Vercel + Groq"
git push
```

## 3. Import project di Vercel

1. Buka vercel.com dan pilih **Sign up / Log in with GitHub** (paket Hobby, tanpa kartu).
2. Klik **Add New… → Project**, lalu **Import** repo `WebFasTanggap`.
3. Isi pengaturannya:
   - **Framework Preset:** `Other`.
   - **Root Directory:** `./`, jangan diubah.
   - **Build/Output Settings:** biarkan kosong.
4. Buka **Environment Variables** dan tempel enam baris ini (bisa sekaligus):

   ```
   NODE_ENV=production
   AI_PROVIDER=groq
   GROQ_MODEL=openai/gpt-oss-120b
   GROQ_API_KEY=<key groq kamu>
   SUPABASE_URL=https://gaxykcqqhsdigeviqosl.supabase.co
   SUPABASE_ANON_KEY=<anon key, sama dengan di assets/js/config.js>
   ```

5. Klik **Deploy** dan tunggu sekitar 1 menit.

## 4. Tes

- Buka `https://<nama>.vercel.app`. Website harus tampil.
- Buka `https://<nama>.vercel.app/api/health`. Harus tampil `"status":"ok"`.
- Coba chatbot TanggapAI.

Setiap `git push` ke `main` membuat Vercel otomatis deploy ulang.

## 5. Aplikasi Android

Di `android/app/build.gradle.kts`, ganti nilai `TANGGAPAI_URL` ke `https://<nama>.vercel.app/api/chat`, lalu build ulang APK.

## Catatan

- Di Vercel, server tidak tidur seperti di Render. Permintaan pertama paling lama telat 1–2 detik.
- `render.yaml` tidak dipakai di Vercel. Boleh dibiarkan atau dihapus.
