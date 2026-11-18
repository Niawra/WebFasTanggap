import assert from "node:assert/strict";
import http from "node:http";

// Jalankan server pada port uji khusus agar tidak bentrok
process.env.PORT = "5099";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "http://localhost:8000,http://127.0.0.1:8000";

const { default: app } = await import("./server.js");

const BASE_URL = "http://127.0.0.1:5099";

async function req(path, options = {}) {
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

console.log("=== PENGUJIAN TAHAP 1: BACKEND TANGGAPAI ===");

try {
  // 1. Uji Endpoint GET /api/health
  console.log("\n1. Menguji GET /api/health...");
  const health = await req("/api/health");
  console.log("   Status:", health.status);
  console.log("   Body:", JSON.stringify(health.json));
  assert.strictEqual(health.status, 200, "Status /api/health harus 200 OK");
  assert.strictEqual(health.json.status, "ok", "Properti status harus 'ok'");
  assert.strictEqual(health.json.service, "TanggapAI Backend Service");
  assert.ok(health.json.timestamp, "Timestamp harus tersedia");
  assert.strictEqual(typeof health.json.uptime, "number", "Uptime harus berupa angka");

  // 2. Uji Security Headers (Helmet & Express)
  console.log("\n2. Menguji Header Keamanan (Helmet)...");
  console.log("   x-powered-by:", health.headers["x-powered-by"] || "(disembunyikan - AMAN)");
  console.log("   x-content-type-options:", health.headers["x-content-type-options"]);
  assert.strictEqual(health.headers["x-powered-by"], undefined, "x-powered-by harus disembunyikan");
  assert.strictEqual(health.headers["x-content-type-options"], "nosniff", "x-content-type-options harus nosniff");

  // 3. Uji Rate Limiting Headers
  console.log("\n3. Menguji Header Rate Limiting...");
  console.log("   ratelimit-limit:", health.headers["ratelimit-limit"]);
  console.log("   ratelimit-remaining:", health.headers["ratelimit-remaining"]);
  assert.ok(health.headers["ratelimit-limit"], "Header ratelimit-limit harus ada");

  // 4. Uji CORS: Origin yang Diizinkan (Termasuk VS Code Live Preview 127.0.0.1:3000)
  console.log("\n4. Menguji CORS dengan origin terdaftar (http://localhost:8000 & http://127.0.0.1:3000)...");
  const corsValid = await req("/api/health", {
    headers: { Origin: "http://localhost:8000" },
  });
  console.log("   Status:", corsValid.status);
  console.log("   Access-Control-Allow-Origin:", corsValid.headers["access-control-allow-origin"]);
  assert.strictEqual(corsValid.status, 200);
  assert.strictEqual(corsValid.headers["access-control-allow-origin"], "http://localhost:8000");

  const corsLivePreview = await req("/api/health", {
    headers: { Origin: "http://127.0.0.1:3000" },
  });
  assert.strictEqual(corsLivePreview.status, 200);
  assert.strictEqual(corsLivePreview.headers["access-control-allow-origin"], "http://127.0.0.1:3000");

  const corsPreflightChat = await req("/api/chat", {
    method: "OPTIONS",
    headers: {
      Origin: "http://127.0.0.1:3000",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type,Authorization",
    },
  });
  assert.strictEqual(corsPreflightChat.status, 204, "Preflight OPTIONS harus mengembalikan 204");
  assert.strictEqual(corsPreflightChat.headers["access-control-allow-origin"], "http://127.0.0.1:3000");
  console.log("   CORS origin http://127.0.0.1:3000 & Preflight OPTIONS /api/chat -> OK");

  // 5. Uji CORS: Origin Tidak Diizinkan (Unauthorized)
  console.log("\n5. Menguji CORS dengan origin tidak sah (http://situs-jahat.com)...");
  const corsInvalid = await req("/api/health", {
    headers: { Origin: "http://situs-jahat.com" },
  });
  console.log("   Status:", corsInvalid.status);
  console.log("   Body:", JSON.stringify(corsInvalid.json));
  assert.strictEqual(corsInvalid.status, 403, "Origin tidak dikenal harus ditolak dengan 403");
  assert.ok(corsInvalid.json.error.includes("CORS"), "Pesan error harus menyebutkan CORS");

  // 6. Uji 404 Route Not Found
  console.log("\n6. Menguji rute tidak terdaftar (GET /api/tidak-ada)...");
  const notFound = await req("/api/tidak-ada");
  console.log("   Status:", notFound.status);
  assert.strictEqual(notFound.status, 404);
  assert.strictEqual(notFound.json.status, 404);

  // 7. Uji Validasi POST /api/chat (Endpoint Aktif)
  console.log("\n7. Menguji validasi POST /api/chat saat request kosong...");
  const chatResponse = await req("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  console.log("   Status:", chatResponse.status);
  console.log("   Body:", JSON.stringify(chatResponse.json));
  assert.strictEqual(chatResponse.status, 400, "Request tanpa message harus ditolak dengan 400");
  assert.strictEqual(chatResponse.json.success, false);
  assert.strictEqual(chatResponse.json.error.code, "MESSAGE_REQUIRED");

  console.log("\n==========================================");
  console.log("SEMUA PENGUJIAN TAHAP 1 BERHASIL (100% LOLOS)");
  console.log("==========================================");
  process.exit(0);
} catch (err) {
  console.error("\nPENGUJIAN GAGAL:", err);
  process.exit(1);
}
