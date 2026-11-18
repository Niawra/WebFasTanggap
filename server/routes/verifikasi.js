/**
 * routes/verifikasi.js
 * POST /api/verifikasi-laporan  { reportId }
 *
 * Dipanggil website/aplikasi tepat setelah siswa mengirim laporan.
 * Backend membaca laporan dengan token pengguna (menghormati RLS), meminta AI menilai,
 * lalu menyimpan hasilnya lewat fungsi Supabase terapkan_verifikasi_ai():
 *   asal -> laporan disembunyikan + pelapor mendapat peringatan.
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authMiddleware, getSupabaseConfig } from "../services/supabase.js";
import { nilaiLaporan } from "../services/ai/verifikasi.js";

const router = Router();

const pembatas = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => (req.userAuth?.user?.id ? `auth:${req.userAuth.user.id}` : req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ success: false, error: { code: "RATE_LIMIT", message: "Terlalu banyak permintaan verifikasi." } }),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.post("/verifikasi-laporan", authMiddleware, pembatas, async (req, res) => {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!req.userAuth?.isAuth || !token) {
    return res.status(401).json({ success: false, error: { code: "AUTH_REQUIRED", message: "Masuk dulu untuk verifikasi laporan." } });
  }
  const reportId = String(req.body?.reportId || "").trim();
  if (!UUID.test(reportId)) {
    return res.status(400).json({ success: false, error: { code: "INVALID_REPORT_ID", message: "ID laporan tidak valid." } });
  }

  const { url, anonKey } = getSupabaseConfig();
  const kepala = { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" };

  try {
    // 1. Baca laporan dengan token pengguna
    const r = await fetch(
      `${url}/rest/v1/reports?id=eq.${reportId}&select=id,title,description,ai_verdict,ai_reason,categories(name),locations(name)`,
      { headers: kepala, signal: AbortSignal.timeout(10000) }
    );
    const baris = r.ok ? await r.json() : [];
    const lap = Array.isArray(baris) ? baris[0] : null;
    if (!lap) {
      return res.status(404).json({ success: false, error: { code: "REPORT_NOT_FOUND", message: "Laporan tidak ditemukan." } });
    }
    if (lap.ai_verdict) {
      return res.json({ success: true, verdict: lap.ai_verdict, alasan: lap.ai_reason || "" });
    }

    // 2. Nilai dengan AI
    const { verdict, alasan } = await nilaiLaporan({
      judul: lap.title,
      deskripsi: lap.description,
      kategori: lap.categories?.name,
      lokasi: lap.locations?.name,
    });

    // 3. Simpan hasil (fungsi Supabase memeriksa izin & menerapkan peringatan)
    const s = await fetch(`${url}/rest/v1/rpc/terapkan_verifikasi_ai`, {
      method: "POST",
      headers: kepala,
      body: JSON.stringify({ p_id: reportId, p_verdict: verdict, p_alasan: alasan }),
      signal: AbortSignal.timeout(10000),
    });
    if (!s.ok) {
      console.warn("[Verifikasi] gagal menyimpan verdict:", s.status, await s.text());
      return res.status(502).json({ success: false, error: { code: "SAVE_FAILED", message: "Hasil verifikasi gagal disimpan." } });
    }

    return res.json({ success: true, verdict, alasan });
  } catch (e) {
    console.warn("[Verifikasi] gagal:", e.message);
    // Laporan tetap ada & menunggu petugas; tidak ada hukuman bila AI gagal.
    return res.status(503).json({ success: false, error: { code: "VERIFY_UNAVAILABLE", message: "Verifikasi otomatis sedang tidak tersedia." } });
  }
});

export default router;
