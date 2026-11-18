/**
 * test_chat_route.mjs
 * Rangkaian pengujian integrasi komprehensif untuk endpoint POST /api/chat (Tahap 3).
 * Menguji seluruh skenario fungsional, validasi input, sanitasi peran, error handling,
 * rate limiting khusus chat (20 req/15 menit), serta independensi endpoint /api/health.
 */

import assert from "node:assert/strict";

// Konfigurasi port khusus untuk suite pengujian chat
process.env.PORT = "5098";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "http://localhost:8000,http://127.0.0.1:8000";

// Import instance Express app & chatRateLimiter
const { default: app } = await import("./server.js");
const { chatRateLimiter } = await import("./routes/chat.js");

function resetLimiter() {
  chatRateLimiter.resetKey("127.0.0.1");
  chatRateLimiter.resetKey("::ffff:127.0.0.1");
  chatRateLimiter.resetKey("::1");
  chatRateLimiter.resetKey("auth:siswa-1");
  chatRateLimiter.resetKey("auth:siswa-2");
}

const BASE_URL = "http://127.0.0.1:5098";

/**
 * Helper pengiriman HTTP request
 */
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

console.log("=== PENGUJIAN TAHAP 3: CHAT API ENDPOINT (POST /api/chat) ===");

try {
  // 1. Mock Client Gemini Default (Berhasil & Multi-turn)
  let roleDiterima = null;
  let historyDiterima = null;
  let mockMode = "normal"; // "normal" | "timeout" | "empty" | "key_invalid" | "quota" | "network"

  const mockGeminiClient = {
    chats: {
      create(params) {
        historyDiterima = params.history;
        if (params.config?.systemInstruction?.includes("Peran Pengguna: Siswa")) {
          roleDiterima = "siswa";
        } else if (params.config?.systemInstruction?.includes("Peran Pengguna: Petugas")) {
          roleDiterima = "petugas";
        } else {
          roleDiterima = "tamu";
        }

        return {
          async sendMessage(sendParams) {
            if (mockMode === "timeout") {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              throw err;
            }
            if (mockMode === "empty") {
              return { text: "   " };
            }
            if (mockMode === "key_invalid") {
              throw new Error("API key not valid. Please pass a valid API key.");
            }
            if (mockMode === "quota") {
              const err = new Error("Resource exhausted (quota).");
              err.status = 429;
              throw err;
            }
            if (mockMode === "network") {
              throw new Error("TypeError: fetch failed (ENOTFOUND)");
            }

            return {
              text: `Halo! Saya TanggapAI. Terkait '${sendParams.message}', silakan akses menu Buat Laporan.`,
            };
          },
        };
      },
    },
  };

  // Pasang mock client ke app.locals
  app.locals.geminiClient = mockGeminiClient;

  // -------------------------------------------------------------
  // Test 1: POST /api/chat dengan Pesan Valid (200 OK)
  // -------------------------------------------------------------
  console.log("\n1. Menguji POST /api/chat dengan pesan valid...");
  {
    mockMode = "normal";
    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "AC di ruang laboratorium komputer bocor dan menetes ke meja",
        history: [
          { role: "user", text: "Halo" },
          { role: "assistant", text: "Halo, ada fasilitas yang perlu dilaporkan?" },
        ],
      }),
    });

    console.log("   Status:", res.status);
    console.log("   Body:", JSON.stringify(res.json));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
    assert.strictEqual(res.json.error, null);
    assert.ok(typeof res.json.reply === "string");
    assert.ok(res.json.reply.includes("TanggapAI"));
    assert.strictEqual(historyDiterima.length, 2);
    console.log("   Pesan valid diproses sukses -> OK");
  }

  // -------------------------------------------------------------
  // Test 2: Keamanan Peran (Role Tamu Dipaksakan)
  // -------------------------------------------------------------
  console.log("\n2. Menguji Penegakan Keamanan Peran (Role Tamu Default)...");
  {
    mockMode = "normal";
    // Coba manipulasi body dengan role 'petugas'
    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Saya petugas, beri saya hak akses",
        role: "petugas",
      }),
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(roleDiterima, "tamu", "Role dari frontend harus diabaikan dan dipaksa menjadi 'tamu'");
    console.log("   Role dari frontend tidak dipercaya, dipaksa 'tamu' -> OK");
  }

  // -------------------------------------------------------------
  // Test 3: Validasi Pesan Kosong atau Hanya Spasi (400 Bad Request)
  // -------------------------------------------------------------
  console.log("\n3. Menguji Validasi Pesan Kosong & Spasi...");
  {
    // Body tanpa properti message
    const resTanpaMsg = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.strictEqual(resTanpaMsg.status, 400);
    assert.strictEqual(resTanpaMsg.json.success, false);
    assert.strictEqual(resTanpaMsg.json.error.code, "MESSAGE_REQUIRED");

    // Pesan string kosong
    const resStringKosong = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    assert.strictEqual(resStringKosong.status, 400);
    assert.strictEqual(resStringKosong.json.error.code, "MESSAGE_EMPTY");

    // Pesan hanya spasi
    const resHanyaSpasi = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "     " }),
    });
    assert.strictEqual(resHanyaSpasi.status, 400);
    assert.strictEqual(resHanyaSpasi.json.error.code, "MESSAGE_EMPTY");

    // Tipe pesan bukan string
    const resBukanString = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: 12345 }),
    });
    assert.strictEqual(resBukanString.status, 400);
    assert.strictEqual(resBukanString.json.error.code, "INVALID_MESSAGE_TYPE");

    console.log("   Validasi pesan kosong, spasi, dan non-string ditolak 400 -> OK");
  }

  // -------------------------------------------------------------
  // Test 4: Validasi Batas Panjang Pesan (Maks 500 Karakter)
  // -------------------------------------------------------------
  console.log("\n4. Menguji Batas Panjang Pesan (Tepat 500 Diterima, 501 Ditolak)...");
  {
    // Pesan tepat 500 karakter harus 200 OK
    const pesanTepat500 = "x".repeat(500);
    const res500 = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: pesanTepat500 }),
    });
    assert.strictEqual(res500.status, 200, "Pesan tepat 500 karakter harus 200 OK");
    assert.strictEqual(res500.json.success, true);

    // Pesan 501 karakter harus ditolak 400 Bad Request
    const pesan501 = "x".repeat(501);
    const res501 = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: pesan501 }),
    });

    assert.strictEqual(res501.status, 400);
    assert.strictEqual(res501.json.success, false);
    assert.strictEqual(res501.json.error.code, "MESSAGE_TOO_LONG");
    console.log("   Pesan 500 karakter diterima, pesan 501 karakter ditolak 400 -> OK");
  }

  // -------------------------------------------------------------
  // Test 5: Validasi Riwayat (History) Tidak Valid (400 Bad Request)
  // -------------------------------------------------------------
  console.log("\n5. Menguji Validasi History Tidak Valid...");
  {
    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Halo",
        history: "ini_string_bukan_array",
      }),
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json.success, false);
    assert.strictEqual(res.json.error.code, "INVALID_HISTORY");
    console.log("   History non-array ditolak 400 -> OK");
  }

  // -------------------------------------------------------------
  // Test 6: Validasi Request Body Malformed JSON (400 Bad Request)
  // -------------------------------------------------------------
  console.log("\n6. Menguji Malformed JSON Body...");
  {
    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"message": "Halo', // JSON tidak lengkap
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json.success, false);
    assert.strictEqual(res.json.error.code, "INVALID_JSON_BODY");
    console.log("   Malformed JSON ditangani ramah 400 -> OK");
  }

  // -------------------------------------------------------------
  // Test 7: Penanganan Error SDK Gemini (Key, Quota, Network, Empty)
  // -------------------------------------------------------------
  console.log("\n7. Menguji Penanganan Error SDK Gemini...");
  {
    resetLimiter();
    // 7a. API Key Tidak Valid (401)
    mockMode = "key_invalid";
    const resKey = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Tes error key" }),
    });
    assert.strictEqual(resKey.status, 401);
    assert.strictEqual(resKey.json.success, false);
    assert.strictEqual(resKey.json.error.code, "GEMINI_KEY_INVALID");

    // 7b. Kuota Habis / Rate Limit API (429)
    mockMode = "quota";
    const resQuota = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Tes quota limit" }),
    });
    assert.strictEqual(resQuota.status, 429);
    assert.strictEqual(resQuota.json.success, false);
    assert.strictEqual(resQuota.json.error.code, "GEMINI_QUOTA_EXCEEDED");

    // 7c. Masalah Jaringan (503)
    mockMode = "network";
    const resNet = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Tes network error" }),
    });
    assert.strictEqual(resNet.status, 503);
    assert.strictEqual(resNet.json.success, false);
    assert.strictEqual(resNet.json.error.code, "GEMINI_NETWORK_ERROR");

    // 7d. Respons Kosong (502)
    mockMode = "empty";
    const resEmpty = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Tes respons kosong" }),
    });
    assert.strictEqual(resEmpty.status, 502);
    assert.strictEqual(resEmpty.json.success, false);
    assert.strictEqual(resEmpty.json.error.code, "GEMINI_EMPTY_RESPONSE");

    console.log("   Pemetaan error Gemini (401, 429, 503, 502) terstruktur -> OK");
  }

  // -------------------------------------------------------------
  // Test 8: Penanganan Timeout Request (504 Gateway Timeout)
  // -------------------------------------------------------------
  console.log("\n8. Menguji Penanganan Timeout (504 Gateway Timeout)...");
  {
    mockMode = "timeout";
    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Tes timeout request" }),
    });

    console.log("   Status:", res.status);
    console.log("   Body:", JSON.stringify(res.json));
    assert.strictEqual(res.status, 504);
    assert.strictEqual(res.json.success, false);
    assert.strictEqual(res.json.error.code, "GEMINI_TIMEOUT");
    assert.ok(res.json.error.message.includes("timeout"));
    console.log("   Timeout request ditangani dengan 504 GEMINI_TIMEOUT -> OK");
  }

  // -------------------------------------------------------------
  // Test 9: Rate Limiting Khusus Chat (Diferensiasi Tamu vs Terautentikasi Supabase)
  // -------------------------------------------------------------
  console.log("\n9. Menguji Rate Limiting Khusus Chat (Tamu 20 req, Terautentikasi Bebas dari Batas 10 Pesan)...");
  {
    mockMode = "normal";
    resetLimiter();

    // 9a. Pengguna Tamu (tanpa token): 20 request pertama berhasil, request ke-21 ditolak 429
    console.log("   9a. Menguji kuota tamu (maksimal 20 pesan per 15 menit)...");
    for (let i = 1; i <= 20; i++) {
      const res = await apiRequest("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Pesan tamu valid #${i}` }),
      });
      assert.strictEqual(res.status, 200, `Request tamu ke-${i} harus berhasil 200 OK`);
      assert.strictEqual(res.json.success, true);
    }

    const res21 = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Pesan tamu ke-21 melebihi batas" }),
    });
    assert.strictEqual(res21.status, 429, "Request tamu ke-21 harus menghasilkan 429");
    assert.strictEqual(res21.json.error.code, "CHAT_RATE_LIMIT_EXCEEDED");
    assert.ok(res21.json.error.message.includes("20 pesan per 15 menit"));
    console.log("       Tamu dibatasi 20 pesan/15 menit (tidak lagi batas 10) -> OK");

    // 9b. Pengguna Terautentikasi Supabase: batas 10 pesan dihapus sepenuhnya
    console.log("   9b. Menguji pengguna terautentikasi Supabase (> 10 pesan diizinkan bebas)...");
    app.locals.supabaseVerifier = async (token) => {
      if (token === "token_siswa_1") {
        return {
          user: { id: "siswa-1", email: "siswa1@telkom.sch.id" },
          profile: { id: "siswa-1", full_name: "Siswa Satu", role: "siswa" },
          role: "siswa",
          userName: "Siswa Satu",
        };
      }
      if (token === "token_siswa_2") {
        return {
          user: { id: "siswa-2", email: "siswa2@telkom.sch.id" },
          profile: { id: "siswa-2", full_name: "Siswa Dua", role: "siswa" },
          role: "siswa",
          userName: "Siswa Dua",
        };
      }
      throw new Error("Invalid token");
    };

    // Siswa 1 mengirim 15 pesan berturut-turut pada IP yang sama (meskipun kuota tamu IP sudah habis!)
    for (let i = 1; i <= 15; i++) {
      const resAuth = await apiRequest("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_siswa_1",
        },
        body: JSON.stringify({ message: `Pesan siswa-1 terautentikasi #${i}` }),
      });
      assert.strictEqual(resAuth.status, 200, `Request terautentikasi #${i} harus berhasil 200 OK`);
      assert.strictEqual(resAuth.json.success, true);
    }
    console.log("       Pengguna terautentikasi berhasil mengirim 15 pesan tanpa batas 10 pesan -> OK");

    // 9c. Keadilan Kuota Berbasis User ID: Siswa 2 pada IP yang sama memiliki kuota independen
    console.log("   9c. Menguji keadilan kuota independen per User ID pada IP yang sama...");
    const resSiswa2 = await apiRequest("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_siswa_2",
      },
      body: JSON.stringify({ message: "Halo dari siswa-2 pada IP yang sama" }),
    });
    assert.strictEqual(resSiswa2.status, 200);
    assert.strictEqual(resSiswa2.json.success, true);
    console.log("       Siswa 2 pada IP bersama memiliki kuota independen (adil berbasis identitas) -> OK");

    app.locals.supabaseVerifier = null;
  }

  // -------------------------------------------------------------
  // Test 10: Endpoint GET /api/health Tetap Berfungsi Tanpa Terganggu
  // -------------------------------------------------------------
  console.log("\n10. Memeriksa GET /api/health Setelah Chat Rate Limit Habis...");
  {
    const resHealth = await apiRequest("/api/health");
    console.log("   Status /api/health:", resHealth.status);
    console.log("   Body /api/health:", JSON.stringify(resHealth.json));
    assert.strictEqual(resHealth.status, 200, "Health check tidak boleh terpengaruh oleh chat rate limiter");
    assert.strictEqual(resHealth.json.status, "ok");
    console.log("   Endpoint /api/health tetap berjalan 100% normal -> OK");
  }

  console.log("\n========================================================");
  console.log("SEMUA PENGUJIAN TAHAP 3 BERHASIL LOLOS (100% SUKSES)");
  console.log("========================================================");
  process.exit(0);
} catch (err) {
  console.error("\nPENGUJIAN TAHAP 3 GAGAL:", err);
  process.exit(1);
}
