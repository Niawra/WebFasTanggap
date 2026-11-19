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
  return getAiProviderChain()[0];
}

/**
 * Urutan provider dari AI_PROVIDER, dipisah koma. Contoh "openai,groq":
 * coba openai dulu, kalau gagal (mati/timeout/limit) baru groq.
 * @returns {string[]}
 */
export function getAiProviderChain() {
  const daftar = String(process.env.AI_PROVIDER || "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const urutan = daftar.length ? daftar : [DEFAULT_AI_PROVIDER];
  // AI utama FasTanggap: kalau key gateway (OPENAI_API_KEY) terpasang, selalu dicoba paling dulu.
  if (process.env.OPENAI_API_KEY && !urutan.includes("openai")) urutan.unshift("openai");
  return urutan;
}

/** Galat yang layak dicoba ulang ke provider berikutnya (bukan salah input pengguna). */
function bolehPindahProvider(err) {
  const status = Number(err?.statusCode || err?.status || 0);
  return !status || status >= 500 || status === 429 || status === 408 || status === 401 || status === 403;
}

/**
 * Menjalankan fungsi per provider sesuai urutan, pindah ke berikutnya bila gagal.
 * @template T
 * @param {(provider: string) => Promise<T>} kerja
 * @param {string[]} [urutan]
 * @returns {Promise<T>}
 */
export async function denganCadangan(kerja, urutan = getAiProviderChain()) {
  let galatTerakhir;
  for (let i = 0; i < urutan.length; i++) {
    try {
      try {
        return await kerja(urutan[i]);
      } catch (err) {
        // Provider utama dicoba ulang sekali bila galatnya jaringan/server (tunnel kadang putus sesaat).
        const status = Number(err?.statusCode || err?.status || 0);
        const kodeTimeout = /TIMEOUT/i.test(String(err?.code || ""));
        if (i === 0 && urutan.length > 1 && !kodeTimeout && (!status || status >= 500)) {
          console.warn(`[TanggapAI] Provider '${urutan[i]}' gagal (${err?.code || err?.message}). Coba ulang sekali.`);
          return await kerja(urutan[i]);
        }
        throw err;
      }
    } catch (err) {
      galatTerakhir = err;
      const adaLagi = i < urutan.length - 1;
      if (!adaLagi || !bolehPindahProvider(err)) throw err;
      console.warn(`[TanggapAI] Provider '${urutan[i]}' gagal (${err?.code || err?.message}). Beralih ke '${urutan[i + 1]}'.`);
    }
  }
  throw galatTerakhir;
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
  const urutan = provider ? [String(provider).toLowerCase().trim()] : getAiProviderChain();
  return denganCadangan(
    (p) => kirimKeSatuProvider({ message, history, role, userName, client, model, ekstra, providerAktif: p }),
    urutan
  );
}

async function kirimKeSatuProvider({ message, history, role, userName, client, model, ekstra, providerAktif }) {

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
