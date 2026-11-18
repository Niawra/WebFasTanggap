/**
 * test_rate_limit.mjs
 * Rangkaian pengujian unit dan integrasi untuk Modul Rate Limiting Chat TanggapAI.
 * 
 * Cakupan Pengujian:
 * 1. Penghapusan batas maksimal 10 pesan/15 menit untuk pengguna terautentikasi Supabase.
 * 2. Pengguna terautentikasi dapat mengirim > 10 pesan (misal 15 pesan berturut-turut) tanpa terblokir.
 * 3. Keadilan kuota berbasis identitas (User ID) pada IP bersama (NAT/Lab Komputer Sekolah).
 * 4. Perlindungan kuota wajar anti-spam dan anti-abuse tetap aktif.
 * 5. Kuota pengguna tamu (belum login) terisolasi dan tidak mempengaruhi kuota pengguna terautentikasi.
 * 6. Tidak ada batas 10 pesan yang masih aktif pada endpoint chat.
 * 7. Endpoint /api/health tetap berfungsi normal secara independen.
 */

import assert from "node:assert/strict";
import {
  chatRateLimiter,
  getChatRateLimitKey,
  GUEST_CHAT_RATE_LIMIT,
  AUTH_CHAT_RATE_LIMIT,
} from "./routes/chat.js";

process.env.PORT = "5091";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "http://localhost:8000,http://127.0.0.1:8000";

const { default: app } = await import("./server.js");
const BASE_URL = "http://127.0.0.1:5091";

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

console.log("=== PENGUJIAN RATE LIMITING CHAT TANGGAPAI (FAIR IDENTITY & ANTI-SPAM) ===");

// -------------------------------------------------------------
// 1. Verifikasi Konstanta & Key Generator
// -------------------------------------------------------------
console.log("\n1. Memeriksa Konstanta Batas Pesan & Key Generator...");
{
  assert.strictEqual(GUEST_CHAT_RATE_LIMIT, 20, "Batas tamu harus 20 pesan (bukan 10)");
  assert.strictEqual(AUTH_CHAT_RATE_LIMIT, 100, "Batas pengguna terautentikasi harus 100 pesan (bukan 10)");
  assert.ok(AUTH_CHAT_RATE_LIMIT > 10, "Batas pengguna terautentikasi wajib lebih dari 10 pesan");

  // Uji Key Generator untuk Tamu (berbasis IP)
  const reqTamu = { ip: "192.168.1.100", userAuth: { isAuth: false, role: "tamu" } };
  assert.strictEqual(getChatRateLimitKey(reqTamu), "192.168.1.100");

  // Uji Key Generator untuk Pengguna Terautentikasi (berbasis User ID)
  const reqAuth = {
    ip: "192.168.1.100", // IP sama dengan tamu!
    userAuth: {
      isAuth: true,
      role: "siswa",
      user: { id: "siswa-uuid-001" },
    },
  };
  assert.strictEqual(getChatRateLimitKey(reqAuth), "auth:siswa-uuid-001");

  console.log("   Konstanta batas (Tamu: 20, Terautentikasi: 100) & Key Generator -> OK");
}

// -------------------------------------------------------------
// 2. Mock AI Client & Supabase Verifier untuk Jalur HTTP
// -------------------------------------------------------------
const mockChatClient = {
  chat: {
    completions: {
      async create() {
        return {
          choices: [
            {
              message: { content: "Halo, ini balasan TanggapAI untuk pengujian rate limit." },
              finish_reason: "stop",
            },
          ],
        };
      },
    },
  },
};
app.locals.groqClient = mockChatClient;

app.locals.supabaseVerifier = async (token) => {
  if (token === "token_budi") {
    return {
      user: { id: "user-budi-123", email: "budi@telkom.sch.id" },
      profile: { id: "user-budi-123", full_name: "Budi Santoso", role: "siswa" },
      role: "siswa",
      userName: "Budi Santoso",
    };
  }
  if (token === "token_ani") {
    return {
      user: { id: "user-ani-456", email: "ani@telkom.sch.id" },
      profile: { id: "user-ani-456", full_name: "Ani Wijaya", role: "siswa" },
      role: "siswa",
      userName: "Ani Wijaya",
    };
  }
  throw new Error("Invalid token");
};

function resetLimiterKeys() {
  chatRateLimiter.resetKey("127.0.0.1");
  chatRateLimiter.resetKey("::ffff:127.0.0.1");
  chatRateLimiter.resetKey("::1");
  chatRateLimiter.resetKey("auth:user-budi-123");
  chatRateLimiter.resetKey("auth:user-ani-456");
}

resetLimiterKeys();

// -------------------------------------------------------------
// 3. Uji Pengguna Terautentikasi: Bebas dari Batas 10 Pesan
// -------------------------------------------------------------
console.log("\n2. Menguji Pengguna Terautentikasi Supabase (> 10 Pesan Berturut-turut Diizinkan)...");
{
  // Budi mengirim 15 pesan berturut-turut
  for (let i = 1; i <= 15; i++) {
    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_budi",
      },
      body: JSON.stringify({ message: `Pertanyaan terautentikasi ke-${i}` }),
    });

    assert.strictEqual(res.status, 200, `Pesan ke-${i} harus berhasil 200 OK`);
    assert.strictEqual(res.json.success, true);
  }
  console.log("   Pengguna terautentikasi berhasil mengirim 15 pesan (batas 10 pesan terbukti dihapus) -> OK");
}

// -------------------------------------------------------------
// 4. Uji Keadilan Kuota Berbasis Identitas Pengguna pada IP Bersama
// -------------------------------------------------------------
console.log("\n3. Menguji Keadilan Kuota Berbasis Identitas pada IP Bersama (Lab/WiFi Sekolah)...");
{
  // Ani mengirim pesan dari IP yang sama (127.0.0.1)
  const resAni = await apiRequest("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token_ani",
    },
    body: JSON.stringify({ message: "Halo, saya Ani di lab yang sama dengan Budi" }),
  });

  assert.strictEqual(resAni.status, 200, "Ani harus tetap berhasil mengirim pesan");
  assert.strictEqual(resAni.json.success, true);
  console.log("   Ani memiliki kuota independen dari Budi meskipun berada pada IP yang sama -> OK");
}

// -------------------------------------------------------------
// 5. Uji Kuota Tamu (Belum Login) & Penolakan 429
// -------------------------------------------------------------
console.log("\n4. Menguji Kuota Tamu (Batas 20 Pesan per 15 Menit)...");
{
  // Reset kunci IP tamu
  chatRateLimiter.resetKey("127.0.0.1");
  chatRateLimiter.resetKey("::ffff:127.0.0.1");
  chatRateLimiter.resetKey("::1");

  // Tamu mengirim 20 pesan (semua 200 OK)
  for (let i = 1; i <= 20; i++) {
    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Pesan tamu #${i}` }),
    });
    assert.strictEqual(res.status, 200, `Pesan tamu #${i} harus 200 OK`);
  }

  // Pesan ke-21 harus ditolak 429
  const resTamu21 = await apiRequest("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Pesan tamu ke-21 melebihi kuota" }),
  });

  assert.strictEqual(resTamu21.status, 429, "Pesan tamu ke-21 harus ditolak 429 Too Many Requests");
  assert.strictEqual(resTamu21.json.error.code, "CHAT_RATE_LIMIT_EXCEEDED");
  assert.ok(resTamu21.json.error.message.includes("20 pesan"), "Pesan galat harus menyatakan batas 20 pesan");
  assert.ok(!resTamu21.json.error.message.includes("10 pesan"), "Pesan galat tidak boleh memuat batas 10 pesan");
  console.log("   Pesan tamu ke-21 ditolak 429 dengan informasi kuota 20 pesan -> OK");

  // Tamu yang habis kuota TIDAK menghalangi pengguna terautentikasi pada IP yang sama!
  const resBudiLagi = await apiRequest("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token_budi",
    },
    body: JSON.stringify({ message: "Budi tetap bisa kirim pesan meski kuota tamu IP habis" }),
  });
  assert.strictEqual(resBudiLagi.status, 200, "Pengguna terautentikasi tidak terpengaruh habisnya kuota tamu IP");
  console.log("   Pengguna terautentikasi tetap dapat mengirim pesan saat kuota tamu IP habis -> OK");
}

// -------------------------------------------------------------
// 6. Uji Endpoint GET /api/health Bebas dari Chat Rate Limiter
// -------------------------------------------------------------
console.log("\n5. Memeriksa Endpoint GET /api/health Tetap Berfungsi Normal...");
{
  const resHealth = await apiRequest("/api/health");
  assert.strictEqual(resHealth.status, 200);
  assert.strictEqual(resHealth.json.status, "ok");
  console.log("   GET /api/health tetap 200 OK tanpa terpengaruh chat rate limit -> OK");
}

console.log("\n========================================================");
console.log("SEMUA PENGUJIAN RATE LIMITING CHAT BERHASIL LOLOS (100%)");
console.log("========================================================");
process.exit(0);
