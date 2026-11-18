/**
 * services/ai/adapters/groqAdapter.js
 * Adapter Layanan Groq API untuk FasTanggap (TanggapAI).
 * 
 * Mengimplementasikan integrasi Groq Cloud API menggunakan OpenAI SDK resmi
 * sebagai layer kompatibilitas client (baseURL: https://api.groq.com/openai/v1),
 * penegakan batasan token (max 500 tokens), timeout 25 detik dengan AbortController terpadu,
 * moderasi keselamatan siswa usia sekolah (< 18 tahun), penyamaran PII,
 * inspeksi finish_reason, serta penanganan galat terstruktur.
 */

import OpenAI from "openai";
import { buildSystemPrompt } from "../../../prompts/systemPrompt.js";
import { AIServiceError, MAX_MESSAGE_LENGTH } from "../index.js";
import {
  evaluasiKeselamatanSekolah,
  evaluasiKeluaranAI,
  samarkanDataPribadiSiswa,
} from "../moderation.js";

// Re-ekspor fungsi moderasi dan PII untuk kenyamanan integrasi
export { evaluasiKeselamatanSekolah, evaluasiKeluaranAI, samarkanDataPribadiSiswa };

// Konfigurasi Endpoint, Model & Batasan
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
export const MAX_HISTORY_MESSAGES = 4; // Maksimal 4 pesan riwayat (2 pasang user-assistant)
export const MAX_HISTORY_TEXT_LENGTH = 500; // Maksimal 500 karakter per pesan riwayat
export const MAX_OUTPUT_TOKENS = 500; // Maksimal 500 output token
export const REQUEST_TIMEOUT_MS = 25000; // Timeout 25 detik (plafon keras)
export { MAX_MESSAGE_LENGTH };

export const DAFTAR_MODEL_DIDUKUNG = Object.freeze([
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
]);

/**
 * Menentukan parameter model untuk Chat Completions API pada Groq.
 * 
 * @param {string} modelName
 * @param {number} [maxTokens=MAX_OUTPUT_TOKENS]
 * @param {number} [temperature=0.3]
 * @returns {Object} Parameter payload chat completions
 */
export function tentukanParameterModel(modelName, maxTokens = MAX_OUTPUT_TOKENS, temperature = 0.3) {
  if (!modelName || typeof modelName !== "string" || !modelName.trim()) {
    throw new AIServiceError(
      "Nama model Groq tidak boleh kosong.",
      "GROQ_MODEL_INVALID",
      400
    );
  }

  const namaBersih = modelName.trim().toLowerCase();

  // Model yang didukung pada Groq
  if (
    namaBersih === "openai/gpt-oss-120b" ||
    namaBersih.includes("gpt-oss") ||
    namaBersih.startsWith("llama") ||
    namaBersih.startsWith("mixtral") ||
    namaBersih.startsWith("gemma")
  ) {
    return {
      model: modelName.trim(),
      max_tokens: maxTokens,
      temperature,
    };
  }

  // Jika model lain yang eksplisit diizinkan dalam DAFTAR_MODEL_DIDUKUNG
  if (DAFTAR_MODEL_DIDUKUNG.includes(namaBersih)) {
    return {
      model: modelName.trim(),
      max_tokens: maxTokens,
      temperature,
    };
  }

  throw new AIServiceError(
    `Model Groq '${modelName}' belum diverifikasi untuk TanggapAI. Model yang didukung: ${DAFTAR_MODEL_DIDUKUNG.join(", ")}.`,
    "GROQ_MODEL_UNSUPPORTED",
    400
  );
}

/**
 * Menyamarkan kunci rahasia (Groq gsk_..., OpenAI sk-..., dan Gemini AIza...) dari teks atau pesan galat.
 * @param {string} teks
 * @returns {string}
 */
export function sanitasiPesanRahasia(teks) {
  if (!teks || typeof teks !== "string") return "";
  return teks
    .replace(/gsk_[a-zA-Z0-9_-]{20,}/g, "[REDACTED_GROQ_KEY]")
    .replace(/sk-(?:proj-)?[a-zA-Z0-9_-]{20,}/g, "[REDACTED_OPENAI_KEY]")
    .replace(/AIza[0-9A-Za-z-_]{20,35}/g, "[REDACTED_GEMINI_KEY]");
}

/**
 * Memeriksa apakah GROQ_API_KEY telah dikonfigurasi dan bukan placeholder.
 * @returns {boolean}
 */
export function isGroqConfigured() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return false;
  const bersih = String(apiKey).trim();
  return (
    bersih !== "" &&
    bersih !== "your_groq_api_key_here" &&
    bersih !== "placeholder_groq_api_key" &&
    !bersih.startsWith("your_") &&
    bersih.length > 10
  );
}

/**
 * Menginisialisasi instance OpenAI Client resmi yang diarahkan ke Groq endpoint
 * dengan timeout 25 detik dan retry terkontrol (maksimal 1 kali).
 * @returns {OpenAI}
 */
export function getGroqClient() {
  if (!isGroqConfigured()) {
    throw new AIServiceError(
      "API Key Groq belum dikonfigurasi pada file .env backend (GROQ_API_KEY).",
      "GROQ_KEY_MISSING",
      503
    );
  }

  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY.trim(),
    baseURL: GROQ_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1, // Dibatasi 1 kali agar total waktu tunggu tidak menumpuk melebihi toleransi frontend
  });
}

/**
 * Validasi dan Konversi Riwayat Percakapan ke Format Chat Completions:
 * Mengubah role 'model' atau 'bot' menjadi 'assistant',
 * membatasi maksimal 4 pesan riwayat (2 pasang), dan memastikan urutan bergantian.
 * 
 * @param {Array} riwayatMentah
 * @returns {Array<{ role: 'user'|'assistant', content: string }>}
 */
export function konversiRiwayatGroq(riwayatMentah) {
  if (!Array.isArray(riwayatMentah) || riwayatMentah.length === 0) {
    return [];
  }

  const terformat = [];

  for (const item of riwayatMentah) {
    if (!item || typeof item !== "object") continue;

    let role = String(item.role || "").toLowerCase().trim();
    if (role === "model" || role === "bot") role = "assistant";

    // Validasi ketat peran: hanya 'user' atau 'assistant'
    if (role !== "user" && role !== "assistant") continue;

    // Ambil konten teks
    let teks = "";
    if (typeof item.text === "string") {
      teks = item.text;
    } else if (typeof item.content === "string") {
      teks = item.content;
    } else if (typeof item.message === "string") {
      teks = item.message;
    } else if (Array.isArray(item.parts) && item.parts.length > 0) {
      teks = item.parts.map((p) => p?.text || "").join(" ");
    }

    const teksBersih = String(teks || "").trim().slice(0, MAX_HISTORY_TEXT_LENGTH);
    if (!teksBersih) continue;

    terformat.push({
      role,
      content: teksBersih,
    });
  }

  // Percakapan lampau wajib dimulai dari giliran 'user'
  while (terformat.length > 0 && terformat[0].role !== "user") {
    terformat.shift();
  }

  // Buang turn beruntun dengan peran yang sama
  const bergantian = [];
  for (let i = 0; i < terformat.length; i++) {
    if (bergantian.length === 0 || bergantian[bergantian.length - 1].role !== terformat[i].role) {
      bergantian.push(terformat[i]);
    }
  }

  // Riwayat lampau HARUS diakhiri 'assistant' karena pesan saat ini adalah 'user' baru
  while (bergantian.length > 0 && bergantian[bergantian.length - 1].role !== "assistant") {
    bergantian.pop();
  }

  // Ambil maksimal MAX_HISTORY_MESSAGES (4 pesan = 2 pasang user-assistant)
  const hasilAkhir = bergantian.slice(-MAX_HISTORY_MESSAGES);
  while (hasilAkhir.length > 0 && hasilAkhir[0].role !== "user") {
    hasilAkhir.shift();
  }

  return hasilAkhir;
}

/**
 * Mengirim pesan ke Groq API melalui OpenAI SDK compatibility client dengan timeout terkontrol dan pengamanan siswa.
 * 
 * @param {Object} params
 * @param {string} params.message - Pesan dari pengguna (wajib)
 * @param {Array} [params.history=[]] - Riwayat percakapan sebelumnya
 * @param {string} [params.role="tamu"] - Peran pengguna ('siswa' | 'petugas' | 'tamu')
 * @param {string} [params.userName=""] - Nama pengguna
 * @param {string} [params.model] - Nama model Groq (default: DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b')
 * @param {OpenAI} [params.client=null] - Mock client untuk kebutuhan pengujian
 * @returns {Promise<{ reply: string, model: string, role: string, finishReason: string }>}
 */
export async function kirimPesanGroq({
  message,
  history = [],
  role = "tamu",
  userName = "",
  model = DEFAULT_GROQ_MODEL,
  client = null,
  ekstra = "",
} = {}) {
  // 1. Validasi Input Pesan Pengguna
  if (!message || typeof message !== "string" || message.trim() === "") {
    throw new AIServiceError(
      "Pesan tidak boleh kosong.",
      "INVALID_INPUT",
      400
    );
  }

  const pesanMentah = message.trim();
  if (pesanMentah.length > MAX_MESSAGE_LENGTH) {
    throw new AIServiceError(
      `Pesan terlalu panjang. Maksimal ${MAX_MESSAGE_LENGTH} karakter.`,
      "MESSAGE_TOO_LONG",
      400
    );
  }

  // 2. Evaluasi Keselamatan Pengguna Sekolah (< 18 Tahun) pada input mentah
  const evaluasi = evaluasiKeselamatanSekolah(pesanMentah);
  if (evaluasi.terdeteksiRisiko && evaluasi.responsSuportif) {
    return {
      reply: evaluasi.responsSuportif,
      model,
      role: ["siswa", "petugas"].includes(role) ? role : "tamu",
      finishReason: "safety_intervention",
    };
  }

  // 3. Penyamaran Data Pribadi Siswa (PII Sanitization) pada Teks Pesan Pengguna
  // Menyaring nomor HP, email, dan NIS tanpa merusak konteks nomor fasilitas
  const pesanTersanitasi = samarkanDataPribadiSiswa(pesanMentah);

  // 4. Siapkan Parameter Model Kompatibel
  const paramsModel = tentukanParameterModel(model, MAX_OUTPUT_TOKENS);

  // 5. Siapkan Client SDK (Mock atau Resmi dengan Groq Base URL)
  const ai = client || getGroqClient();

  // 6. Bangun System Instruction Sesuai Konteks FasTanggap
  // Kebijakan Privasi Siswa: Untuk akun 'siswa', nama lengkap TIDAK dikirim ke pihak ketiga
  const roleAman = ["siswa", "petugas"].includes(role) ? role : "tamu";
  const namaAman = roleAman === "siswa" ? "" : String(userName || "").trim().slice(0, 30);
  const instruksiSistem = buildSystemPrompt({ role: roleAman, name: namaAman , ekstra });

  // 7. Normalisasi Riwayat Percakapan
  const riwayatTervalidasi = konversiRiwayatGroq(history);

  // 8. Susun Pesan untuk Chat Completions API
  const daftarPesan = [
    { role: "system", content: instruksiSistem },
    ...riwayatTervalidasi,
    { role: "user", content: pesanTersanitasi },
  ];

  // 9. Eksekusi Permintaan ke Groq dengan Pengendali Abort Terpadu (Hard Timeout 25 Detik)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const hasil = await ai.chat.completions.create(
      {
        ...paramsModel,
        messages: daftarPesan,
      },
      {
        signal: controller.signal,
      }
    );

    const choice = hasil?.choices?.[0];
    const finishReason = choice?.finish_reason;
    const teksBalasan = choice?.message?.content;

    // 10. Tangani Blokir Filter Konten Upstream Groq
    if (finishReason === "content_filter") {
      throw new AIServiceError(
        "Respons AI tidak dapat ditampilkan karena terdeteksi oleh sistem penyaringan konten upstream Groq.",
        "GROQ_CONTENT_FILTERED",
        400
      );
    }

    if (!teksBalasan || typeof teksBalasan !== "string" || teksBalasan.trim() === "") {
      throw new AIServiceError(
        "Asisten AI Groq tidak mengembalikan respon teks yang valid.",
        "GROQ_EMPTY_RESPONSE",
        502
      );
    }

    let teksAkhir = teksBalasan.trim();

    // 11. Tangani Finish Reason 'length' (Jawaban Terpotong Akibat Batas Token)
    if (finishReason === "length") {
      teksAkhir = `${teksAkhir}\n\n*(Catatan: Tanggapan terpotong karena mencapai batas maksimal output token. Silakan ajukan pertanyaan lanjutan yang lebih spesifik.)*`;
    }

    // 12. Evaluasi Keselamatan Keluaran AI
    const cekOutput = evaluasiKeluaranAI(teksAkhir);
    if (!cekOutput.aman) {
      teksAkhir = cekOutput.teks;
    }

    return {
      reply: teksAkhir,
      model,
      role: roleAman,
      finishReason: finishReason || "stop",
    };
  } catch (error) {
    if (error instanceof AIServiceError) {
      throw error;
    }

    const pesanGalat = String(error.message || "").toLowerCase();
    const statusKode = error.status || error.statusCode || 500;

    // Tangani Timeout Pembatalan Request Native SDK atau AbortController
    if (
      error.name === "APIConnectionTimeoutError" ||
      error.name === "TimeoutError" ||
      error.name === "AbortError" ||
      pesanGalat.includes("timeout") ||
      pesanGalat.includes("timed out") ||
      pesanGalat.includes("aborted")
    ) {
      throw new AIServiceError(
        "Permintaan ke layanan Groq melebihi batas waktu (timeout 25 detik). Silakan coba lagi.",
        "GROQ_TIMEOUT",
        504
      );
    }

    // Tangani Galat Autentikasi API Key (401)
    if (
      statusKode === 401 ||
      pesanGalat.includes("incorrect api key") ||
      pesanGalat.includes("invalid api key") ||
      pesanGalat.includes("authentication") ||
      pesanGalat.includes("unauthorized")
    ) {
      throw new AIServiceError(
        "Kunci API Groq tidak valid. Periksa konfigurasi GROQ_API_KEY pada server backend.",
        "GROQ_KEY_INVALID",
        401
      );
    }

    // Tangani Kuota Habis / Rate Limiting (429)
    if (
      statusKode === 429 ||
      pesanGalat.includes("rate limit") ||
      pesanGalat.includes("tokens per minute") ||
      pesanGalat.includes("requests per minute") ||
      pesanGalat.includes("insufficient_quota") ||
      pesanGalat.includes("quota")
    ) {
      throw new AIServiceError(
        "Batas kuota penggunaan Groq API telah tercapai. Silakan coba beberapa saat lagi.",
        "GROQ_QUOTA_EXCEEDED",
        429
      );
    }

    // Tangani Galat Jaringan / Koneksi (503)
    if (
      error.name === "APIConnectionError" ||
      pesanGalat.includes("connection error") ||
      pesanGalat.includes("fetch failed") ||
      pesanGalat.includes("enotfound") ||
      pesanGalat.includes("econnrefused")
    ) {
      throw new AIServiceError(
        "Gagal terhubung ke server Groq API. Periksa koneksi internet server backend.",
        "GROQ_NETWORK_ERROR",
        503
      );
    }

    // Default Galat Terstruktur (dengan penyamaran kunci rahasia)
    const pesanSanitasi = sanitasiPesanRahasia(String(error.message || ""));
    throw new AIServiceError(
      "Terjadi kendala pada layanan kecerdasan buatan TanggapAI (Groq).",
      "GROQ_GENERAL_ERROR",
      statusKode >= 400 && statusKode < 600 ? statusKode : 500,
      process.env.NODE_ENV === "development" ? pesanSanitasi : null
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
