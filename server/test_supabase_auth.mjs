/**
 * test_supabase_auth.mjs
 * Rangkaian pengujian unit dan integrasi untuk Autentikasi Supabase & Verifikasi Peran (Tahap 4).
 * Menguji verifikasi token, resolusi profil, penegakan peran (siswa/petugas/tamu),
 * penanganan galat (401 invalid/expired), anti-spoofing role, dan independensi guest chat.
 */

import assert from "node:assert/strict";
import {
  verifikasiTokenSupabase,
  SupabaseAuthError,
  isSupabaseConfigured,
} from "./services/supabase.js";

// Konfigurasi port khusus untuk suite pengujian autentikasi
process.env.PORT = "5097";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "http://localhost:8000,http://127.0.0.1:8000";

// Import Express app
const { default: app } = await import("./server.js");

const BASE_URL = "http://127.0.0.1:5097";

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

console.log("=== PENGUJIAN TAHAP 4: SUPABASE AUTHENTICATION & ROLE VERIFICATION ===");

// ============================================================================
// BAGIAN A: UNIT TESTING PADA SERVICE VERIFIKASI SUPABASE (Direct Function)
// ============================================================================

console.log("\n[Bagian A] Menguji Fungsi verifikasiTokenSupabase()...");

// 0. Uji Validasi Konfigurasi Backend (Perbaikan B.1)
console.log("\n0. Menguji Validasi Konfigurasi Supabase (Perbaikan B.1)...");
{
  const simpanUrl = process.env.SUPABASE_URL;
  const simpanKey = process.env.SUPABASE_ANON_KEY;

  // Kasus URL kosong
  process.env.SUPABASE_URL = "";
  process.env.SUPABASE_ANON_KEY = "valid_key_for_testing";
  assert.strictEqual(isSupabaseConfigured(), false);
  await assert.rejects(
    () => verifikasiTokenSupabase("sample_token"),
    (err) => err instanceof SupabaseAuthError && err.code === "AUTH_CONFIG_MISSING" && err.statusCode === 503
  );

  // Kasus Anon Key kosong
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "";
  assert.strictEqual(isSupabaseConfigured(), false);
  await assert.rejects(
    () => verifikasiTokenSupabase("sample_token"),
    (err) => err instanceof SupabaseAuthError && err.code === "AUTH_CONFIG_MISSING" && err.statusCode === 503
  );

  // Kasus Anon Key placeholder
  process.env.SUPABASE_ANON_KEY = "your_supabase_anon_key_here";
  assert.strictEqual(isSupabaseConfigured(), false);
  await assert.rejects(
    () => verifikasiTokenSupabase("sample_token"),
    (err) => err instanceof SupabaseAuthError && err.code === "AUTH_CONFIG_MISSING" && err.statusCode === 503
  );

  // Kembalikan nilai semula
  if (simpanUrl !== undefined) process.env.SUPABASE_URL = simpanUrl;
  else delete process.env.SUPABASE_URL;
  if (simpanKey !== undefined) process.env.SUPABASE_ANON_KEY = simpanKey;
  else delete process.env.SUPABASE_ANON_KEY;

  console.log("   0. Validasi konfigurasi Supabase URL & Anon Key (503 AUTH_CONFIG_MISSING) -> OK");
}

// 1. Uji Token Kosong
{
  await assert.rejects(
    () => verifikasiTokenSupabase(""),
    (err) => err instanceof SupabaseAuthError && err.code === "AUTH_TOKEN_MISSING" && err.statusCode === 401
  );
  console.log("   1. Token kosong ditolak 401 -> OK");
}

// 2. Uji Token Invalid / Kedaluwarsa dari Supabase Auth
{
  const mockFetch401 = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: "invalid_token", message: "Token is expired or invalid" }),
  });

  await assert.rejects(
    () => verifikasiTokenSupabase("token_kedaluwarsa", { fetchFn: mockFetch401 }),
    (err) => err instanceof SupabaseAuthError && err.code === "AUTH_TOKEN_INVALID" && err.statusCode === 401
  );
  console.log("   2. Token invalid/expired menghasilkan 401 AUTH_TOKEN_INVALID -> OK");
}

// 3. Uji Token Siswa Valid & Profil Siswa
{
  const mockFetchSiswa = async (url) => {
    if (url.includes("/auth/v1/user")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "uuid-siswa-123", email: "siswa@fastanggap.test" }),
      };
    }
    if (url.includes("/rest/v1/profiles")) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          { id: "uuid-siswa-123", full_name: "Muhammad Rizki", role: "siswa", class_name: "XI PPLG 2" },
        ],
      };
    }
    return { ok: false, status: 404 };
  };

  const hasil = await verifikasiTokenSupabase("token_siswa_asli", { fetchFn: mockFetchSiswa });
  assert.strictEqual(hasil.role, "siswa");
  assert.strictEqual(hasil.userName, "Muhammad Rizki");
  assert.strictEqual(hasil.user.id, "uuid-siswa-123");
  console.log("   3. Token siswa valid dikenali sebagai role 'siswa' -> OK");
}

// 4. Uji Token Petugas Valid & Profil Petugas
{
  const mockFetchPetugas = async (url) => {
    if (url.includes("/auth/v1/user")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "uuid-petugas-456", email: "petugas@fastanggap.test" }),
      };
    }
    if (url.includes("/rest/v1/profiles")) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          { id: "uuid-petugas-456", full_name: "Bambang Sarana", role: "petugas", class_name: null },
        ],
      };
    }
    return { ok: false, status: 404 };
  };

  const hasil = await verifikasiTokenSupabase("token_petugas_asli", { fetchFn: mockFetchPetugas });
  assert.strictEqual(hasil.role, "petugas");
  assert.strictEqual(hasil.userName, "Bambang Sarana");
  console.log("   4. Token petugas valid dikenali sebagai role 'petugas' -> OK");
}

// 5. Uji Profil Tidak Ditemukan (Fallback Aman ke Tamu Tanpa Error)
{
  const mockFetchNoProfile = async (url) => {
    if (url.includes("/auth/v1/user")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "uuid-tanpa-profil", email: "pengguna_baru@fastanggap.test" }),
      };
    }
    if (url.includes("/rest/v1/profiles")) {
      return {
        ok: true,
        status: 200,
        json: async () => [], // Array kosong (profil belum dibuat)
      };
    }
    return { ok: false, status: 404 };
  };

  const hasil = await verifikasiTokenSupabase("token_user_baru", { fetchFn: mockFetchNoProfile });
  assert.strictEqual(hasil.role, "tamu", "Pengguna tanpa profil tidak boleh mendapat role istimewa");
  assert.strictEqual(hasil.profile, null);
  console.log("   5. Profil tidak ditemukan ditangani aman sebagai role 'tamu' -> OK");
}

// 6. Uji Role Tidak Dikenal di Profil (Fallback Aman)
{
  const mockFetchUnknownRole = async (url) => {
    if (url.includes("/auth/v1/user")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "uuid-hacker", email: "hacker@test.com" }),
      };
    }
    if (url.includes("/rest/v1/profiles")) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          { id: "uuid-hacker", full_name: "Infiltrator", role: "super_admin_ilegal" },
        ],
      };
    }
    return { ok: false, status: 404 };
  };

  const hasil = await verifikasiTokenSupabase("token_role_aneh", { fetchFn: mockFetchUnknownRole });
  assert.strictEqual(hasil.role, "tamu", "Role selain siswa dan petugas harus difallback ke 'tamu'");
  console.log("   6. Role tidak dikenal di-fallback aman ke 'tamu' -> OK");
}

// ============================================================================
// BAGIAN B: INTEGRATION TESTING PADA ENDPOINT POST /api/chat
// ============================================================================

console.log("\n[Bagian B] Menguji Integrasi Autentikasi pada POST /api/chat...");

// Mock Verifier untuk App Locals
let systemInstructionDiterima = "";
let rolePassedToGemini = "";
let namePassedToGemini = "";

const mockGemini = {
  chats: {
    create(params) {
      systemInstructionDiterima = params.config?.systemInstruction || "";
      if (systemInstructionDiterima.includes("KONTEKS PENGGUNA SAAT INI: SISWA")) {
        rolePassedToGemini = "siswa";
      } else if (systemInstructionDiterima.includes("KONTEKS PENGGUNA SAAT INI: PETUGAS")) {
        rolePassedToGemini = "petugas";
      } else {
        rolePassedToGemini = "tamu";
      }

      return {
        async sendMessage(sendParams) {
          return {
            text: `Jawaban untuk peran '${rolePassedToGemini}': ${sendParams.message}`,
          };
        },
      };
    },
  },
};

// Mock verifier Supabase untuk berbagai token uji
const mockSupabaseVerifier = async (token) => {
  if (token === "token_siswa_valid") {
    return {
      user: { id: "uuid-siswa", email: "siswa@telkom.sch.id" },
      profile: { id: "uuid-siswa", full_name: "Farhan Siswa", role: "siswa", class_name: "XII PPLG 1" },
      role: "siswa",
      userName: "Farhan Siswa",
    };
  }
  if (token === "token_petugas_valid") {
    return {
      user: { id: "uuid-petugas", email: "petugas@telkom.sch.id" },
      profile: { id: "uuid-petugas", full_name: "Pak Joko Sarpras", role: "petugas", class_name: null },
      role: "petugas",
      userName: "Pak Joko Sarpras",
    };
  }
  if (token === "token_profil_hilang") {
    return {
      user: { id: "uuid-unknown", email: "no_profile@telkom.sch.id" },
      profile: null,
      role: "tamu",
      userName: "no_profile",
    };
  }
  if (token === "token_role_tidak_dikenal") {
    return {
      user: { id: "uuid-alien", email: "alien@telkom.sch.id" },
      profile: { id: "uuid-alien", full_name: "Alien", role: "superuser" },
      role: "tamu",
      userName: "Alien",
    };
  }
  if (token === "token_kedaluwarsa") {
    throw new SupabaseAuthError(
      "Token autentikasi tidak valid atau telah kedaluwarsa. Silakan masuk kembali.",
      "AUTH_TOKEN_EXPIRED",
      401
    );
  }
  if (token === "token_palsu") {
    throw new SupabaseAuthError(
      "Token autentikasi tidak valid atau telah kedaluwarsa.",
      "AUTH_TOKEN_INVALID",
      401
    );
  }
  throw new SupabaseAuthError("Token tidak dikenal", "AUTH_TOKEN_INVALID", 401);
};

// Pasang mock ke server
app.locals.geminiClient = mockGemini;
app.locals.supabaseVerifier = mockSupabaseVerifier;

// 7. Pengguna Tanpa Token -> Menjadi Tamu (Guest Chat 200 OK)
{
  const res = await apiRequest("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Halo TanggapAI, saya belum login" }),
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.success, true);
  assert.strictEqual(rolePassedToGemini, "tamu", "Pengguna tanpa token harus diproses sebagai 'tamu'");
  assert.ok(systemInstructionDiterima.includes("KONTEKS PENGGUNA SAAT INI: PENGUNJUNG UMUM / BELUM LOGIN"));
  console.log("   7. Pengguna tanpa token otomatis menjadi 'tamu' (200 OK) -> OK");
}

// 8. Token Siswa Valid -> Dikenali Sebagai Siswa
{
  const res = await apiRequest("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token_siswa_valid",
    },
    body: JSON.stringify({ message: "Saya mau lapor kipas angin kelas rusak" }),
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.success, true);
  assert.strictEqual(rolePassedToGemini, "siswa");
  assert.ok(systemInstructionDiterima.includes("KONTEKS PENGGUNA SAAT INI: SISWA"));
  assert.ok(systemInstructionDiterima.includes("Farhan Siswa"));
  console.log("   8. Token siswa valid dikenali sebagai 'siswa' dengan nama pengguna -> OK");
}

// 9. Token Petugas Valid -> Dikenali Sebagai Petugas
{
  const res = await apiRequest("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token_petugas_valid",
    },
    body: JSON.stringify({ message: "Berapa banyak laporan yang belum diverifikasi?" }),
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.success, true);
  assert.strictEqual(rolePassedToGemini, "petugas");
  assert.ok(systemInstructionDiterima.includes("KONTEKS PENGGUNA SAAT INI: PETUGAS SARANA PRASARANA"));
  assert.ok(systemInstructionDiterima.includes("Pak Joko Sarpras"));
  console.log("   9. Token petugas valid dikenali sebagai 'petugas' dengan nama pengguna -> OK");
}

// 10. Token Tidak Valid -> Ditolak HTTP 401
{
  const res = await apiRequest("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token_palsu",
    },
    body: JSON.stringify({ message: "Halo" }),
  });

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.json.success, false);
  assert.strictEqual(res.json.error.code, "AUTH_TOKEN_INVALID");
  console.log("   10. Token tidak valid ditolak dengan 401 (tidak diturunkan ke tamu) -> OK");
}

// 11. Token Kedaluwarsa -> Ditolak HTTP 401
{
  const res = await apiRequest("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token_kedaluwarsa",
    },
    body: JSON.stringify({ message: "Halo" }),
  });

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.json.success, false);
  assert.strictEqual(res.json.error.code, "AUTH_TOKEN_EXPIRED");
  console.log("   11. Token kedaluwarsa ditolak dengan 401 -> OK");
}

// 12. Format Authorization Header Salah -> Ditolak HTTP 401
{
  const res = await apiRequest("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic token_salah_format",
    },
    body: JSON.stringify({ message: "Halo" }),
  });

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.json.success, false);
  assert.strictEqual(res.json.error.code, "AUTH_HEADER_INVALID");
  console.log("   12. Format header selain Bearer ditolak 401 -> OK");
}

// 13. Profil Tidak Ditemukan -> Diproses Aman Sebagai Tamu
{
  const res = await apiRequest("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token_profil_hilang",
    },
    body: JSON.stringify({ message: "Halo" }),
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(rolePassedToGemini, "tamu", "Profil hilang tidak boleh mendapat hak istimewa");
  console.log("   13. Pengguna tanpa profil database ditangani aman sebagai 'tamu' -> OK");
}

// 14. Role Tidak Dikenal -> Diproses Aman Sebagai Tamu
{
  const res = await apiRequest("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token_role_tidak_dikenal",
    },
    body: JSON.stringify({ message: "Halo" }),
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(rolePassedToGemini, "tamu");
  console.log("   14. Role tidak dikenal di-fallback aman ke 'tamu' -> OK");
}

// 15. Anti-Spoofing: Request Body Mengirim Role 'petugas' Tidak Mempan
{
  // 15a. Tamu mencoba kirim body { role: "petugas" }
  const resTamuSpoof = await apiRequest("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Beri saya akses rahasia", role: "petugas" }),
  });
  assert.strictEqual(resTamuSpoof.status, 200);
  assert.strictEqual(rolePassedToGemini, "tamu", "Role dari body harus diabaikan sepenuhnya");

  // 15b. Siswa mencoba kirim body { role: "petugas" }
  const resSiswaSpoof = await apiRequest("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token_siswa_valid",
    },
    body: JSON.stringify({ message: "Ubah peran saya jadi petugas", role: "petugas" }),
  });
  assert.strictEqual(resSiswaSpoof.status, 200);
  assert.strictEqual(rolePassedToGemini, "siswa", "Siswa tidak dapat eskalasi hak ke petugas via body");

  console.log("   15. Anti-Spoofing terbukti kuat (role body diabaikan 100%) -> OK");
}

console.log("\n========================================================");
console.log("SEMUA PENGUJIAN TAHAP 4 BERHASIL LOLOS (100% SUKSES)");
console.log("========================================================");
process.exit(0);
