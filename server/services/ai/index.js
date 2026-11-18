/**
 * services/ai/index.js
 * Lapisan Abstraksi Layanan AI (AI Provider Abstraction Layer) - Fase 1.
 * 
 * Bertindak sebagai antarmuka publik tunggal (public interface) untuk komunikasi
 * dengan penyedia model AI pada FasTanggap (TanggapAI).
 * Memungkinkan pergantian provider di masa mendatang tanpa memodifikasi routing atau frontend.
 */

import {
  kirimPesanTanggapAi,
  GeminiServiceError,
  MAX_MESSAGE_LENGTH as GEMINI_MAX_MESSAGE_LENGTH,
} from "../gemini.js";
import { kirimPesanOpenAi } from "./adapters/openaiAdapter.js";
import { kirimPesanGroq } from "./adapters/groqAdapter.js";

// Konfigurasi Batas Karakter & Provider
export const DEFAULT_AI_PROVIDER = "groq";
export const SUPPORTED_AI_PROVIDERS = Object.freeze(["groq", "gemini", "openai"]);
export const MAX_MESSAGE_LENGTH = GEMINI_MAX_MESSAGE_LENGTH || 500;

/**
 * Custom Error Class untuk Lapisan Layanan AI
 */
export class AIServiceError extends Error {
  constructor(message, code = "AI_SERVICE_ERROR", statusCode = 500, details = null) {
    super(message);
    this.name = "AIServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Mendapatkan nama provider AI aktif dari variabel lingkungan AI_PROVIDER.
 * Fallback ke DEFAULT_AI_PROVIDER ('gemini') jika tidak disetel atau kosong.
 * 
 * @returns {string}
 */
export function getActiveAiProvider() {
  const envProvider = process.env.AI_PROVIDER;
  if (!envProvider || typeof envProvider !== "string" || !envProvider.trim()) {
    return DEFAULT_AI_PROVIDER;
  }
  return envProvider.trim().toLowerCase();
}

/**
 * Mengirim pesan ke layanan AI TanggapAI melalui provider yang terkonfigurasi.
 * Mempertahankan kontrak input dan output yang kompatibel penuh dengan kirimPesanTanggapAi.
 * 
 * Pada Fase 1, provider yang diizinkan aktif HANYA 'gemini'.
 * Permintaan untuk provider lain akan mengembalikan galat konfigurasi yang aman (503).
 * 
 * @param {Object} params
 * @param {string} params.message - Teks pesan pengguna (wajib)
 * @param {Array} [params.history=[]] - Riwayat percakapan sebelumnya
 * @param {string} [params.role="tamu"] - Peran pengguna ('siswa' | 'petugas' | 'tamu')
 * @param {string} [params.userName=""] - Nama pengguna jika tersedia
 * @param {Object} [params.client=null] - Mock client atau custom SDK client untuk testing
 * @param {string} [params.model] - Nama model (opsional)
 * @param {string} [params.provider] - Override provider (opsional)
 * @returns {Promise<{ reply: string, model: string, role: string }>}
 */
export async function kirimPesanAI({
  message,
  history = [],
  role = "tamu",
  userName = "",
  client = null,
  model,
  provider,
  ekstra = "",
} = {}) {
  const providerAktif = (provider || getActiveAiProvider()).toLowerCase().trim();

  // Validasi apakah provider didukung pada sistem
  if (!SUPPORTED_AI_PROVIDERS.includes(providerAktif)) {
    throw new AIServiceError(
      `Penyedia AI '${providerAktif}' tidak didukung. Provider yang diizinkan: ${SUPPORTED_AI_PROVIDERS.join(", ")}.`,
      "AI_PROVIDER_UNSUPPORTED",
      503
    );
  }

  // Delegasikan ke Groq Adapter (Provider Utama)
  if (providerAktif === "groq") {
    return await kirimPesanGroq({
      message,
      history,
      role,
      userName,
      client,
      model,
      ekstra,
    });
  }

  // Delegasikan ke Gemini Service
  if (providerAktif === "gemini") {
    return await kirimPesanTanggapAi({
      message,
      history,
      role,
      userName,
      client,
      model,
      ekstra,
    });
  }

  // Delegasikan ke OpenAI Adapter
  if (providerAktif === "openai") {
    return await kirimPesanOpenAi({
      message,
      history,
      role,
      userName,
      client,
      model,
      ekstra,
    });
  }

  // Fallback pengaman jika terjadi kondisi tak terduga
  throw new AIServiceError(
    "Konfigurasi penyedia layanan AI tidak valid.",
    "AI_CONFIG_ERROR",
    500
  );
}
