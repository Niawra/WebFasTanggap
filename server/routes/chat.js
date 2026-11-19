/**
 * routes/chat.js
 * Router endpoint untuk layanan Chatbot TanggapAI (Tahap 3).
 * 
 * Mengelola endpoint POST /api/chat, validasi ketat request body,
 * rate limiting khusus chat (20 request / 15 menit), format respon konsisten,
 * serta penanganan galat terstandarisasi.
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  kirimPesanAI,
  AIServiceError,
  MAX_MESSAGE_LENGTH,
} from "../services/ai/index.js";
import { authMiddleware } from "../services/supabase.js";
import { promptPembuatLaporan, ambilDrafLaporan } from "../prompts/drafLaporan.js";

const router = Router();

/**
 * Konfigurasi Rate Limiting Khusus Chat TanggapAI:
 * - Pengguna Terautentikasi Supabase: Kuota anti-spam berbasis User ID (100 pesan / 15 menit),
 *   bebas dari batas 10 pesan dan adil untuk pengguna pada IP bersama (misal WiFi/lab sekolah).
 * - Pengguna Tamu (Belum Login): Kuota berbasis IP (20 pesan / 15 menit).
 */
export const GUEST_CHAT_RATE_LIMIT = Number(process.env.CHAT_RATE_LIMIT_GUEST) || 20;
export const AUTH_CHAT_RATE_LIMIT = Number(process.env.CHAT_RATE_LIMIT_AUTH) || 100;

export function getChatRateLimitKey(req) {
  // Jika terautentikasi Supabase, gunakan user.id unik agar pembatasan adil bagi pengguna IP bersama
  if (req.userAuth?.isAuth && req.userAuth?.user?.id) {
    return `auth:${req.userAuth.user.id}`;
  }
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
}

export const chatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: (req) => {
    // Pengguna terautentikasi Supabase tidak dibatasi 10 pesan, mendapat kuota anti-spam 100
    if (req.userAuth?.isAuth) {
      return AUTH_CHAT_RATE_LIMIT;
    }
    return GUEST_CHAT_RATE_LIMIT;
  },
  keyGenerator: getChatRateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  handler: (req, res, next, options) => {
    const isAuth = Boolean(req.userAuth?.isAuth);
    const limit = isAuth ? AUTH_CHAT_RATE_LIMIT : GUEST_CHAT_RATE_LIMIT;
    const pesan = isAuth
      ? `Terlalu banyak permintaan pesan ke TanggapAI (maksimal ${limit} pesan per 15 menit). Untuk mencegah spam, silakan coba lagi beberapa saat.`
      : `Terlalu banyak permintaan pesan ke TanggapAI (maksimal ${limit} pesan per 15 menit untuk tamu). Silakan login ke akun FasTanggap untuk batas pesan yang lebih tinggi, atau coba lagi setelah 15 menit.`;

    return res.status(options.statusCode).json({
      success: false,
      reply: null,
      error: {
        code: "CHAT_RATE_LIMIT_EXCEEDED",
        message: pesan,
      },
    });
  },
});

/**
 * POST /api/chat
 * Endpoint utama komunikasi pengguna dengan asisten AI TanggapAI.
 */
router.post("/chat", authMiddleware, chatRateLimiter, async (req, res) => {
  // 1. Validasi Keberadaan dan Format Request Body
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({
      success: false,
      reply: null,
      error: {
        code: "INVALID_REQUEST_BODY",
        message: "Request body harus berupa JSON object yang valid.",
      },
    });
  }

  const { message, history } = req.body;

  // 2. Validasi Properti 'message'
  if (message === undefined || message === null) {
    return res.status(400).json({
      success: false,
      reply: null,
      error: {
        code: "MESSAGE_REQUIRED",
        message: "Pesan tidak boleh kosong. Sertakan properti 'message'.",
      },
    });
  }

  if (typeof message !== "string") {
    return res.status(400).json({
      success: false,
      reply: null,
      error: {
        code: "INVALID_MESSAGE_TYPE",
        message: "Pesan harus berupa teks (string).",
      },
    });
  }

  const pesanBersih = message.trim();
  if (pesanBersih.length === 0) {
    return res.status(400).json({
      success: false,
      reply: null,
      error: {
        code: "MESSAGE_EMPTY",
        message: "Pesan tidak boleh kosong atau hanya berisi spasi.",
      },
    });
  }

  if (pesanBersih.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      success: false,
      reply: null,
      error: {
        code: "MESSAGE_TOO_LONG",
        message: `Pesan terlalu panjang. Maksimal ${MAX_MESSAGE_LENGTH} karakter.`,
      },
    });
  }

  // 3. Validasi Properti 'history'
  if (history !== undefined && history !== null && !Array.isArray(history)) {
    return res.status(400).json({
      success: false,
      reply: null,
      error: {
        code: "INVALID_HISTORY",
        message: "Format riwayat percakapan tidak valid. Riwayat harus berupa daftar pesan (array).",
      },
    });
  }

  // 4. Kebijakan Keamanan: Gunakan Peran Hasil Verifikasi Autentikasi Backend
  // Nilai role dari request body diabaikan sepenuhnya demi keamanan!
  const roleTerverifikasi = req.userAuth?.role || "tamu";
  const namaPengguna = req.userAuth?.userName || "";

  // 5. Eksekusi Permintaan ke Layanan AI (Abstraksi Provider)
  try {
    // Mendukung mock client via app.locals untuk kebutuhan pengujian
    const clientMock = req.app?.locals?.aiClient || req.app?.locals?.groqClient || req.app?.locals?.openAiClient || req.app?.locals?.geminiClient || null;

    let provider = undefined;
    if (req.app?.locals?.groqClient) {
      provider = "groq";
    } else if (req.app?.locals?.openAiClient) {
      provider = "openai";
    } else if (req.app?.locals?.geminiClient) {
      provider = "gemini";
    }

    const hasil = await kirimPesanAI({
      message: pesanBersih,
      history: Array.isArray(history) ? history : [],
      role: roleTerverifikasi,
      userName: namaPengguna,
      client: clientMock,
      provider,
      ekstra: roleTerverifikasi === "siswa" ? promptPembuatLaporan(req.body.kategori, req.body.lokasi) : "",
    });

    // Draf laporan dari AI (hanya untuk siswa) -> dipisah dari teks balasan
    const { teks, draf } =
      roleTerverifikasi === "siswa"
        ? ambilDrafLaporan(hasil.reply, req.body.kategori, req.body.lokasi)
        : { teks: hasil.reply, draf: null };

    return res.status(200).json({
      success: true,
      reply: teks,
      draft: draf,
      model: hasil.model || null,
      error: null,
    });
  } catch (error) {
    // Tangani Galat Terstruktur dari Layanan AI (AIServiceError atau galat terstruktur provider)
    if (
      error instanceof AIServiceError ||
      error.name === "AIServiceError" ||
      error.name === "GeminiServiceError" ||
      (typeof error.statusCode === "number" && error.code)
    ) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        reply: null,
        error: {
          code: error.code || "AI_ERROR",
          message: error.message,
        },
      });
    }

    // Tangani Galat Tak Terduga (Jangan bocorkan internal server ke frontend)
    console.error("[TanggapAI Chat Internal Error]", error.message);
    return res.status(500).json({
      success: false,
      reply: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Terjadi kesalahan internal pada layanan TanggapAI.",
      },
    });
  }
});

export default router;
