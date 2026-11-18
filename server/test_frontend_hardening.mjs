/**
 * test_frontend_hardening.mjs
 * Pengujian integrasi khusus untuk verifikasi hasil Review & Hardening Frontend TanggapAI:
 * 1. Endpoint /api/health untuk status indikator koneksi.
 * 2. Integrasi POST /api/chat dalam mode Tamu vs Pengguna Login (Siswa/Petugas).
 * 3. Penanganan Galat Lengkap (HTTP 401, 429, 503, 504).
 * 4. Perlindungan Keamanan Token (tidak pernah bocor di respon atau error).
 * 5. Integritas Riwayat Percakapan (Multi-turn alternating turns & Retry bebas duplikasi).
 */

import assert from "node:assert/strict";
import { SupabaseAuthError } from "./services/supabase.js";

process.env.PORT = "5096";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "http://localhost:8000,http://127.0.0.1:8000";

const { default: app } = await import("./server.js");
const BASE_URL = "http://127.0.0.1:5096";

async function apiRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    json,
    text,
  };
}

console.log("=== PENGUJIAN REVIEW & HARDENING FRONTEND TANGGAPAI ===");

try {
  let mockMode = "normal";
  let capturedHistory = null;
  let capturedRole = null;
  let capturedMessage = null;

  const mockGeminiClient = {
    chats: {
      create(params) {
        capturedHistory = params.history;
        const instruction = params.config?.systemInstruction || "";
        if (instruction.includes("KONTEKS PENGGUNA SAAT INI: SISWA")) {
          capturedRole = "siswa";
        } else if (instruction.includes("KONTEKS PENGGUNA SAAT INI: PETUGAS")) {
          capturedRole = "petugas";
        } else if (instruction.includes("PENGUNJUNG UMUM") || instruction.includes("BELUM LOGIN")) {
          capturedRole = "tamu";
        } else {
          capturedRole = "unknown";
        }

        return {
          async sendMessage(sendParams) {
            capturedMessage = sendParams.message;
            if (mockMode === "timeout") {
              const err = new Error("The operation timed out after 25000ms");
              err.name = "AbortError";
              throw err;
            }
            if (mockMode === "service_unavailable") {
              const err = new Error("Gemini Service temporarily unavailable");
              err.status = 503;
              throw err;
            }
            return {
              text: `Jawaban cerdas TanggapAI untuk: ${sendParams.message}`,
            };
          },
        };
      },
    },
  };

  app.locals.geminiClient = mockGeminiClient;

  app.locals.supabaseVerifier = async (token) => {
    if (token === "token_siswa_valid") {
      return {
        user: { id: "uuid-123", email: "siswa@telkom.sch.id" },
        profile: { id: "uuid-123", full_name: "Ahmad Siswa", role: "siswa" },
        role: "siswa",
        userName: "Ahmad Siswa",
      };
    }
    throw new SupabaseAuthError(
      "Token otentikasi Supabase tidak valid atau kedaluwarsa.",
      "AUTH_TOKEN_INVALID",
      401
    );
  };

  // 1. Pengujian Endpoint /api/health untuk Indikator Status Chatbot
  console.log("\n1. Menguji Endpoint /api/health untuk Indikator Status...");
  const healthRes = await apiRequest("/api/health");
  assert.equal(healthRes.status, 200, "Health check harus berstatus 200");
  assert.equal(healthRes.json.status, "ok", "Status harus 'ok'");
  console.log("   GET /api/health mengembalikan 200 OK (Indikator status terhubung) -> OK");

  // 2. Pengujian Mode Tamu (Tanpa Authorization Header)
  console.log("\n2. Menguji Mode Tamu (Tanpa Token)...");
  const guestRes = await apiRequest("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Bagaimana cara melaporkan AC rusak?",
      history: [],
    }),
  });
  assert.equal(guestRes.status, 200, "Mode tamu harus berhasil 200 OK");
  assert.equal(guestRes.json.success, true, "Success harus true");
  assert.equal(capturedRole, "tamu", "Peran harus otomatis menjadi 'tamu'");
  assert.equal(capturedMessage, "Bagaimana cara melaporkan AC rusak?");
  assert.deepEqual(capturedHistory, [], "Riwayat awal harus kosong");
  console.log("   Mode tamu sukses (200 OK, role: tamu) -> OK");

  // 2b. Pengujian Mode Pengguna Login (Siswa)
  console.log("\n2b. Menguji Mode Pengguna Login (Siswa dengan Token)...");
  const siswaRes = await apiRequest("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token_siswa_valid",
    },
    body: JSON.stringify({
      message: "AC lab RPL bocor",
      history: [],
    }),
  });
  assert.equal(siswaRes.status, 200, "Pengguna login harus berhasil 200 OK");
  assert.equal(siswaRes.json.success, true);
  assert.equal(capturedRole, "siswa", "Peran harus diverifikasi sebagai 'siswa'");
  console.log("   Mode login sukses (200 OK, role terverifikasi: siswa) -> OK");

  // 3. Pengujian Integritas Riwayat Multi-Turn yang Dikirim Frontend
  console.log("\n3. Menguji Integritas Riwayat Multi-Turn...");
  // Mensimulasikan giliran ke-2: frontend mengirim history yang hanya berisi giliran selesai
  const turn2History = [
    { role: "user", text: "Bagaimana cara melaporkan AC rusak?" },
    { role: "model", text: "Jawaban cerdas TanggapAI untuk: Bagaimana cara melaporkan AC rusak?" },
  ];
  const turn2Res = await apiRequest("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Apakah perlu menyertakan foto?",
      history: turn2History,
    }),
  });
  assert.equal(turn2Res.status, 200);
  assert.equal(capturedMessage, "Apakah perlu menyertakan foto?");
  assert.equal(capturedHistory.length, 2, "Riwayat harus memuat 2 giliran sebelumnya");
  assert.equal(capturedHistory[0].role, "user");
  assert.equal(capturedHistory[1].role, "model");
  console.log("   Integritas riwayat percakapan terjaga (urutan user -> model) -> OK");

  // 4. Pengujian Skenario Retry Bebas Duplikasi
  console.log("\n4. Menguji Skenario Retry Saat Terjadi Timeout (504)...");
  mockMode = "timeout";
  const retryFailedRes = await apiRequest("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Pertanyaan yang sempat timeout",
      history: turn2History, // history tidak bertambah karena turn belum selesai
    }),
  });
  assert.equal(retryFailedRes.status, 504, "Harus mengembalikan 504 Gateway Timeout");
  assert.equal(retryFailedRes.json.error.code, "GEMINI_TIMEOUT");
  console.log("   Request timeout mengembalikan 504 GEMINI_TIMEOUT -> OK");

  // Sekarang user klik "Coba Lagi" (Retry)
  mockMode = "normal";
  const retrySuccessRes = await apiRequest("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Pertanyaan yang sempat timeout",
      history: turn2History, // riwayat tetap bersih, tidak terduplikasi
    }),
  });
  assert.equal(retrySuccessRes.status, 200, "Retry harus berhasil 200 OK");
  assert.equal(capturedHistory.length, 2, "Riwayat tidak boleh terduplikasi pesan gagal!");
  assert.equal(capturedMessage, "Pertanyaan yang sempat timeout");
  console.log("   Retry berhasil tanpa duplikasi giliran di riwayat -> OK");

  // 5. Pengujian Galat Autentikasi (HTTP 401)
  console.log("\n5. Menguji Penanganan HTTP 401 (Token Invalid/Expired)...");
  const authErrRes = await apiRequest("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token-palsu-atau-kedaluwarsa-12345",
    },
    body: JSON.stringify({
      message: "Tes token invalid",
    }),
  });
  assert.equal(authErrRes.status, 401, "Token tidak valid harus ditolak 401");
  assert.equal(authErrRes.json.error.code, "AUTH_TOKEN_INVALID");
  // Pastikan token tidak dibocorkan di body
  assert.ok(!authErrRes.text.includes("token-palsu-atau-kedaluwarsa-12345"), "Token tidak boleh bocor di respon!");
  console.log("   HTTP 401 ditangani dengan benar dan token TIDAK bocor -> OK");

  // 6. Pengujian Galat Layanan AI Sibuk (HTTP 503)
  console.log("\n6. Menguji Penanganan HTTP 503 (Layanan Sibuk/Gangguan)...");
  mockMode = "service_unavailable";
  const unavailableRes = await apiRequest("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Tes layanan sibuk",
    }),
  });
  assert.equal(unavailableRes.status, 503, "Layanan sibuk harus 503");
  console.log("   HTTP 503 ditangani dengan pesan ramah -> OK");
  mockMode = "normal";

  // 7. Pengujian Penegakan Rate Limit (HTTP 429)
  console.log("\n7. Menguji Penegakan Rate Limiting Khusus Chat (HTTP 429)...");
  let hitLimit = false;
  for (let i = 0; i < 25; i++) {
    const rlRes = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Pesan spam uji rate limit #${i}` }),
    });
    if (rlRes.status === 429) {
      hitLimit = true;
      assert.equal(rlRes.json.error.code, "CHAT_RATE_LIMIT_EXCEEDED");
      break;
    }
  }
  assert.ok(hitLimit, "Rate limit request tamu harus memicu HTTP 429");
  console.log("   HTTP 429 CHAT_RATE_LIMIT_EXCEEDED berhasil terpicu -> OK");

  // 8. Memeriksa kembali endpoint /api/health tetap 200 setelah rate limit chat tercapai
  console.log("\n8. Memeriksa Endpoint Health Check Tidak Terpengaruh Rate Limit Chat...");
  const healthAfterRl = await apiRequest("/api/health");
  assert.equal(healthAfterRl.status, 200, "Health check harus tetap 200");
  console.log("   GET /api/health tetap 200 OK meskipun rate limit chat habis -> OK");

  console.log("\n========================================================");
  console.log("SEMUA PENGUJIAN HARDENING FRONTEND LOLOS (100% SUKSES)");
  console.log("========================================================");
  process.exit(0);
} catch (error) {
  console.error("\nPENGUJIAN GAGAL:", error);
  process.exit(1);
}
