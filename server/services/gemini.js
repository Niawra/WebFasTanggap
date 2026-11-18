/**
 * services/gemini.js
 * Modul Integrasi Google Gemini API menggunakan SDK resmi @google/genai.
 * 
 * Mengelola inisialisasi client, validasi input, sanitasi riwayat percakapan (multi-turn),
 * integrasi system prompt FasTanggap, serta penanganan galat terperinci.
 */

import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt } from "../prompts/systemPrompt.js";

// Konfigurasi Model & Batasan Token
export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
export const MAX_MESSAGE_LENGTH = 500; // Maksimal 500 karakter per pesan pengguna
export const MAX_HISTORY_MESSAGES = 4; // Maksimal 4 pesan riwayat (2 pasang percakapan user-model)
export const MAX_HISTORY_TURNS = 4;   // Alias kompatibilitas untuk riwayat
export const MAX_HISTORY_TEXT_LENGTH = 500; // Maksimal 500 karakter per pesan riwayat
export const MAX_OUTPUT_TOKENS = 500; // Maksimal 500 output token untuk efisiensi respons
export const REQUEST_TIMEOUT_MS = 25000; // Timeout 25 detik (diterapkan via SDK httpOptions)

/**
 * Custom Error Class untuk Layanan Gemini
 */
export class GeminiServiceError extends Error {
  constructor(message, code = "GEMINI_ERROR", statusCode = 500, details = null) {
    super(message);
    this.name = "GeminiServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Memeriksa apakah API Key telah dikonfigurasi dengan aman dan bukan nilai placeholder.
 * @returns {boolean}
 */
export function isGeminiConfigured() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return false;
  const bersih = String(apiKey).trim();
  return (
    bersih !== "" &&
    bersih !== "your_gemini_api_key_here" &&
    bersih !== "placeholder_gemini_api_key" &&
    bersih.length > 10
  );
}

/**
 * Mengambil instance GoogleGenAI client secara aman.
 * @returns {GoogleGenAI}
 */
export function getGeminiClient() {
  if (!isGeminiConfigured()) {
    throw new GeminiServiceError(
      "API Key Google Gemini belum dikonfigurasi pada file .env backend.",
      "GEMINI_KEY_MISSING",
      503
    );
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY.trim(),
    httpOptions: { timeout: REQUEST_TIMEOUT_MS },
  });
}

/**
 * Memvalidasi dan membersihkan riwayat percakapan multi-turn dari client.
 * 
 * Aturan Keamanan & Batasan:
 * 1. Hanya mengizinkan role 'user' dan 'model' (menerima 'assistant' untuk dinormalisasi ke 'model').
 * 2. Mencegah manipulasi system instruction melalui riwayat.
 * 3. Membatasi jumlah pesan riwayat maksimal MAX_HISTORY_TURNS.
 * 4. Memotong panjang teks setiap pesan maksimal MAX_HISTORY_TEXT_LENGTH.
 * 5. Memastikan riwayat selalu diawali dengan pesan dari role 'user'.
 * 
 * @param {Array} riwayatMentah - Array pesan riwayat dari request body
 * @returns {Array<{ role: string, parts: Array<{ text: string }> }>} Riwayat terformat untuk SDK
 */
export function validasiRiwayatPercakapan(riwayatMentah) {
  if (!Array.isArray(riwayatMentah) || riwayatMentah.length === 0) {
    return [];
  }

  const terformat = [];

  // Filter dan normalisasi seluruh pesan valid
  for (const item of riwayatMentah) {
    if (!item || typeof item !== "object") continue;

    // Normalisasi role
    let role = String(item.role || "").toLowerCase().trim();
    if (role === "assistant" || role === "bot") role = "model";

    // Validasi ketat role (hanya user atau model yang diizinkan)
    if (role !== "user" && role !== "model") continue;

    // Ekstraksi teks dari item.text, item.message, atau item.parts[0].text
    let teks = "";
    if (typeof item.text === "string") {
      teks = item.text;
    } else if (typeof item.message === "string") {
      teks = item.message;
    } else if (Array.isArray(item.parts) && item.parts.length > 0) {
      teks = item.parts
        .map((p) => (p && typeof p.text === "string" ? p.text : ""))
        .join(" ");
    }

    const teksBersih = String(teks || "").trim().slice(0, MAX_HISTORY_TEXT_LENGTH);
    if (!teksBersih) continue;

    terformat.push({
      role,
      parts: [{ text: teksBersih }],
    });
  }

  // Gemini API mewajibkan percakapan riwayat dimulai dari turn 'user'
  while (terformat.length > 0 && terformat[0].role !== "user") {
    terformat.shift();
  }

  // Bersihkan jika ada turn beruntun dengan role yang sama
  const hasilGantian = [];
  for (let i = 0; i < terformat.length; i++) {
    if (hasilGantian.length === 0 || hasilGantian[hasilGantian.length - 1].role !== terformat[i].role) {
      hasilGantian.push(terformat[i]);
    }
  }

  // Pastikan riwayat tidak memiliki pesan 'user' menggantung di akhir tanpa pasangan 'model'
  // Karena pesan yang dikirim saat ini adalah turn 'user' baru, riwayat lampau HARUS berakhir di 'model'
  while (hasilGantian.length > 0 && hasilGantian[hasilGantian.length - 1].role !== "model") {
    hasilGantian.pop();
  }

  // Potong riwayat yang sudah bersih dan berpasangan agar maksimal MAX_HISTORY_MESSAGES (4 pesan = 2 pasang)
  const hasilAkhir = hasilGantian.slice(-MAX_HISTORY_MESSAGES);
  while (hasilAkhir.length > 0 && hasilAkhir[0].role !== "user") {
    hasilAkhir.shift();
  }

  return hasilAkhir;
}

/**
 * Mengirim pesan ke Google Gemini API dengan System Prompt dan Multi-turn Conversation.
 * 
 * @param {Object} parameter
 * @param {string} parameter.message - Pesan dari pengguna (wajib)
 * @param {Array} [parameter.history=[]] - Riwayat percakapan sebelumnya
 * @param {string} [parameter.role="tamu"] - Peran pengguna (default 'tamu' sampai autentikasi Supabase diverifikasi)
 * @param {string} [parameter.userName=""] - Nama pengguna jika tersedia
 * @param {string} [parameter.model] - Nama model Gemini (opsional, default DEFAULT_GEMINI_MODEL)
 * @param {GoogleGenAI} [parameter.client] - Client mock/custom untuk keperluan pengujian
 * @returns {Promise<{ reply: string, model: string, role: string }>}
 */
export async function kirimPesanTanggapAi({
  message,
  history = [],
  role = "tamu",
  userName = "",
  model = DEFAULT_GEMINI_MODEL,
  client = null,
  ekstra = "",
} = {}) {
  // 1. Validasi Input Pesan Pengguna
  if (!message || typeof message !== "string" || message.trim() === "") {
    throw new GeminiServiceError(
      "Pesan tidak boleh kosong.",
      "INVALID_INPUT",
      400
    );
  }

  const pesanBersih = message.trim();
  if (pesanBersih.length > MAX_MESSAGE_LENGTH) {
    throw new GeminiServiceError(
      `Pesan terlalu panjang. Maksimal ${MAX_MESSAGE_LENGTH} karakter.`,
      "MESSAGE_TOO_LONG",
      400
    );
  }

  // 2. Siapkan Client SDK
  const ai = client || getGeminiClient();

  // 3. Bangun System Instruction Sesuai Konteks FasTanggap
  // Catatan Keamanan: Role dipaksa 'tamu' kecuali jika ada verifikasi server resmi
  const roleAman = ["siswa", "petugas"].includes(role) ? role : "tamu";
  const instruksiSistem = buildSystemPrompt({ role: roleAman, name: userName , ekstra });

  // 4. Validasi dan Normalisasi Riwayat Percakapan
  const riwayatTervalidasi = validasiRiwayatPercakapan(history);

  // 5. Eksekusi Permintaan ke Gemini melalui Sesi Chat Multi-turn
  try {
    // Buat sesi chat multi-turn dengan konfigurasi instruksi sistem dan batas token
    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction: instruksiSistem,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: {
          includeThoughts: false,
        },
      },
      history: riwayatTervalidasi,
    });

    const hasil = await chat.sendMessage({
      message: pesanBersih,
    });

    // 6. Ekstraksi dan Validasi Respons Teks
    const teksBalasan = hasil?.text || hasil?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!teksBalasan || typeof teksBalasan !== "string" || teksBalasan.trim() === "") {
      throw new GeminiServiceError(
        "Asisten AI tidak mengembalikan respon teks yang valid.",
        "GEMINI_EMPTY_RESPONSE",
        502
      );
    }

    return {
      reply: teksBalasan.trim(),
      model,
      role: roleAman,
    };
  } catch (error) {
    // Jika error sudah merupakan GeminiServiceError buatan sendiri
    if (error instanceof GeminiServiceError) {
      throw error;
    }

    const pesanGalat = String(error.message || "").toLowerCase();
    const statusKode = error.status || error.statusCode || 500;

    // Tangani Timeout Pembatalan Request Native SDK
    if (
      error.name === "AbortError" ||
      error.code === "ABORT_ERR" ||
      error.name === "TimeoutError" ||
      pesanGalat.includes("timeout") ||
      pesanGalat.includes("timed out") ||
      pesanGalat.includes("etimedout") ||
      pesanGalat.includes("aborted") ||
      pesanGalat.includes("deadline_exceeded")
    ) {
      throw new GeminiServiceError(
        "Permintaan ke layanan AI melebihi batas waktu (timeout 25 detik). Silakan coba lagi.",
        "GEMINI_TIMEOUT",
        504
      );
    }

    // Tangani Galat Spesifik SDK Gemini & Jaringan
    if (pesanGalat.includes("api key not valid") || pesanGalat.includes("api_key_invalid")) {
      throw new GeminiServiceError(
        "Kunci API Google Gemini tidak valid. Periksa konfigurasi GEMINI_API_KEY pada server.",
        "GEMINI_KEY_INVALID",
        401
      );
    }

    if (
      statusKode === 429 ||
      pesanGalat.includes("quota") ||
      pesanGalat.includes("rate limit") ||
      pesanGalat.includes("resource_exhausted")
    ) {
      throw new GeminiServiceError(
        "Batas kuota penggunaan Google Gemini API telah tercapai. Silakan coba beberapa saat lagi.",
        "GEMINI_QUOTA_EXCEEDED",
        429
      );
    }

    if (
      pesanGalat.includes("fetch failed") ||
      pesanGalat.includes("enotfound") ||
      pesanGalat.includes("econnrefused")
    ) {
      throw new GeminiServiceError(
        "Gagal terhubung ke server Google Gemini API. Periksa koneksi internet server backend.",
        "GEMINI_NETWORK_ERROR",
        503
      );
    }

    // Default Error (dengan sanitasi agar tidak ada pola API key yang bocor)
    const pesanSanitasi =
      process.env.NODE_ENV === "development"
        ? String(error.message || "").replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_KEY]")
        : null;

    throw new GeminiServiceError(
      "Terjadi kendala pada layanan kecerdasan buatan TanggapAI.",
      "GEMINI_GENERAL_ERROR",
      statusKode >= 400 && statusKode < 600 ? statusKode : 500,
      pesanSanitasi
    );
  }
}
