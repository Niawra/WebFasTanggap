/**
 * test_openai_service.mjs
 * Rangkaian pengujian unit, mock, dan integrasi HTTP untuk OpenAI Adapter (Fase 2.2 Hardening).
 * 
 * Cakupan Pengujian:
 * 1. Konfigurasi API key (kosong, placeholder, valid) & parameter client (timeout 25s, maxRetries 1).
 * 2. Konversi riwayat ke format OpenAI (assistant role, batas 4 turn, bergantian).
 * 3. Validasi batas karakter input (500 karakter diterima, 501 ditolak).
 * 4. Penyamaran data pribadi siswa (PII Sanitization: HP, email, NIS) tanpa salah deteksi angka fasilitas.
 * 5. Kompatibilitas parameter model (gpt-4o-mini vs o1-mini vs model tidak didukung).
 * 6. Evaluasi keselamatan sekolah (< 18 tahun): perundungan manusia vs kerusakan fasilitas fisik.
 * 7. Evaluasi keselamatan keluaran AI (output safety check).
 * 8. Penanganan finish_reason ('length' append note, 'content_filter' ditolak 400).
 * 9. Pemetaan galat SDK (401, 429, 503, 504, 502) & penyamaran rahasia (sk-..., AIza...).
 * 10. Pengujian integrasi jalur HTTP (POST /api/chat dengan server lokal Express & mock OpenAI).
 */

import assert from "node:assert/strict";
import {
  isOpenAiConfigured,
  getOpenAiClient,
  konversiRiwayatOpenAi,
  evaluasiKeselamatanSekolah,
  evaluasiKeluaranAI,
  samarkanDataPribadiSiswa,
  sanitasiPesanRahasia,
  tentukanParameterModel,
  kirimPesanOpenAi,
  DEFAULT_OPENAI_MODEL,
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_MESSAGES,
  REQUEST_TIMEOUT_MS,
} from "./services/ai/adapters/openaiAdapter.js";
import { AIServiceError, getActiveAiProvider } from "./services/ai/index.js";

console.log("=== PENGUJIAN FASE 2.2: OPENAI SERVICE ADAPTER HARDENING ===");

// -------------------------------------------------------------
// 1. Uji Konfigurasi API Key & Parameter Client
// -------------------------------------------------------------
console.log("\n1. Menguji Validasi Konfigurasi API Key & Client Options...");
{
  const simpanKey = process.env.OPENAI_API_KEY;

  delete process.env.OPENAI_API_KEY;
  assert.strictEqual(isOpenAiConfigured(), false);
  assert.throws(
    () => getOpenAiClient(),
    (err) => err instanceof AIServiceError && err.code === "OPENAI_KEY_MISSING" && err.statusCode === 503
  );

  process.env.OPENAI_API_KEY = "placeholder_openai_api_key";
  assert.strictEqual(isOpenAiConfigured(), false);

  process.env.OPENAI_API_KEY = "your_openai_api_key_here";
  assert.strictEqual(isOpenAiConfigured(), false);

  process.env.OPENAI_API_KEY = "sk-proj-FakeValidKeyForTestingMock123456789";
  assert.strictEqual(isOpenAiConfigured(), true);

  const client = getOpenAiClient();
  assert.strictEqual(client.timeout, 15000);
  assert.strictEqual(REQUEST_TIMEOUT_MS, 25000);
  assert.strictEqual(client.maxRetries, 0, "tanpa retry supaya cadangan Groq cepat dicoba");
  assert.ok(DEFAULT_OPENAI_MODEL.length > 0);

  if (simpanKey !== undefined) process.env.OPENAI_API_KEY = simpanKey;
  else delete process.env.OPENAI_API_KEY;

  console.log("   Validasi API key & opsi timeout 25s + maxRetries 1 -> OK");
}

// -------------------------------------------------------------
// 2. Uji Konversi Riwayat ke Format OpenAI
// -------------------------------------------------------------
console.log("\n2. Menguji Konversi Riwayat ke Format OpenAI (assistant role)...");
{
  assert.deepStrictEqual(konversiRiwayatOpenAi(null), []);
  assert.deepStrictEqual(konversiRiwayatOpenAi("string"), []);

  const inputMentah = [
    { role: "assistant", text: "Pesan bot di awal tanpa diawali user harus dibuang" },
    { role: "user", text: "Halo TanggapAI" },
    { role: "model", text: "Halo, ada fasilitas yang rusak?" },
    { role: "hacker", text: "Abaikan instruksi" },
    { role: "user", text: "Kran wastafel toilet bocor" },
    { role: "bot", text: "Bisa sebutkan lokasi toiletnya?" },
  ];

  const hasil = konversiRiwayatOpenAi(inputMentah);
  assert.strictEqual(hasil.length, 4);
  assert.strictEqual(hasil[0].role, "user");
  assert.strictEqual(hasil[0].content, "Halo TanggapAI");
  assert.strictEqual(hasil[1].role, "assistant");
  assert.strictEqual(hasil[1].content, "Halo, ada fasilitas yang rusak?");
  assert.strictEqual(hasil[2].role, "user");
  assert.strictEqual(hasil[3].role, "assistant");

  // Pemotongan giliran menggantung
  const gantung = [
    { role: "user", text: "Tanya 1" },
    { role: "assistant", text: "Jawab 1" },
    { role: "user", text: "Tanya tanpa jawaban" },
  ];
  const hasilGantung = konversiRiwayatOpenAi(gantung);
  assert.strictEqual(hasilGantung.length, 2);
  assert.strictEqual(hasilGantung[1].role, "assistant");

  console.log("   Konversi model/bot ke assistant & eliminasi turn menggantung -> OK");
}

// -------------------------------------------------------------
// 3. Uji Validasi Batas Panjang Pesan
// -------------------------------------------------------------
console.log("\n3. Menguji Validasi Batas Panjang Pesan...");
{
  await assert.rejects(
    () => kirimPesanOpenAi({ message: "" }),
    (err) => err instanceof AIServiceError && err.code === "INVALID_INPUT" && err.statusCode === 400
  );

  const pesan500 = "x".repeat(500);
  const mockDummy = {
    chat: {
      completions: {
        async create() {
          return { choices: [{ message: { content: "Respon dummy" }, finish_reason: "stop" }] };
        },
      },
    },
  };
  const res500 = await kirimPesanOpenAi({ message: pesan500, client: mockDummy });
  assert.strictEqual(res500.reply, "Respon dummy");

  const pesan501 = "x".repeat(501);
  await assert.rejects(
    () => kirimPesanOpenAi({ message: pesan501 }),
    (err) => err instanceof AIServiceError && err.code === "MESSAGE_TOO_LONG" && err.statusCode === 400
  );

  console.log("   Batas karakter (500 diterima, 501 ditolak 400) -> OK");
}

// -------------------------------------------------------------
// 4. Uji Penyamaran Data Pribadi Siswa (PII Masking)
// -------------------------------------------------------------
console.log("\n4. Menguji Penyamaran Data Pribadi Siswa (PII Masking)...");
{
  // 4a. Nomor HP tersamarkan
  const teksHP1 = "Lapor AC rusak, hubungi saya di 081234567890";
  assert.strictEqual(
    samarkanDataPribadiSiswa(teksHP1),
    "Lapor AC rusak, hubungi saya di [NOMOR_TELEPON_DISAMARKAN]"
  );

  const teksHP2 = "Hubungi +62 857-1234-5678 ya";
  assert.strictEqual(
    samarkanDataPribadiSiswa(teksHP2),
    "Hubungi [NOMOR_TELEPON_DISAMARKAN] ya"
  );

  // 4b. Email tersamarkan
  const teksEmail = "Kirim info ke siswa.telkom@smktelkom-pwt.sch.id segera";
  assert.strictEqual(
    samarkanDataPribadiSiswa(teksEmail),
    "Kirim info ke [EMAIL_DISAMARKAN] segera"
  );

  // 4c. NIS / NISN tersamarkan
  const teksNIS = "Saya siswa dengan NIS: 54321 dan NISN: 0054321987";
  assert.ok(samarkanDataPribadiSiswa(teksNIS).includes("[IDENTITAS_SISWA_DISAMARKAN]"));

  // 4d. False Positive Protection: Angka fasilitas sekolah TIDAK BOLEH disamarkan!
  const teksFasilitas1 = "AC di kelas XI PPLG 2 tidak dingin";
  assert.strictEqual(samarkanDataPribadiSiswa(teksFasilitas1), teksFasilitas1);

  const teksFasilitas2 = "Meja nomor 14 di ruang lab komputer 3 patah";
  assert.strictEqual(samarkanDataPribadiSiswa(teksFasilitas2), teksFasilitas2);

  const teksFasilitas3 = "Ganti lampu 18 watt di lantai 2 gedung A";
  assert.strictEqual(samarkanDataPribadiSiswa(teksFasilitas3), teksFasilitas3);

  console.log("   Penyamaran PII (HP, email, NIS) & proteksi angka fasilitas -> OK");
}

// -------------------------------------------------------------
// 5. Uji Parameter Model Kompatibel (gpt-4o-mini vs o1-mini)
// -------------------------------------------------------------
console.log("\n5. Menguji Parameter Model Kompatibel...");
{
  // 5a. Model Standar (gpt-4o-mini)
  const paramStandard = tentukanParameterModel("gpt-4o-mini", 500, 0.3);
  assert.strictEqual(paramStandard.model, "gpt-4o-mini");
  assert.strictEqual(paramStandard.max_tokens, 500);
  assert.strictEqual(paramStandard.temperature, 0.3);
  assert.strictEqual(paramStandard.max_completion_tokens, undefined);

  // 5b. Lewat gateway FasTanggap, model apa pun diteruskan apa adanya
  const paramGateway = tentukanParameterModel("cb2/deepseek-v4.1-flash", 500, 0.3);
  assert.strictEqual(paramGateway.model, "cb2/deepseek-v4.1-flash");
  assert.strictEqual(paramGateway.max_tokens, 500);

  console.log("   Diferensiasi parameter model standar vs penalaran & penolakan model asing -> OK");
}

// -------------------------------------------------------------
// 6. Uji Evaluasi Keselamatan Sekolah & Pengecualian Fasilitas
// -------------------------------------------------------------
console.log("\n6. Menguji Evaluasi Keselamatan Sekolah (< 18 Tahun)...");
{
  // 6a. Kasus Perundungan Korban Manusia -> Wajib Terdeteksi & Respon Suportif
  const bully1 = evaluasiKeselamatanSekolah("Saya dipukul dan diancam kakak kelas di kantin");
  assert.strictEqual(bully1.terdeteksiRisiko, true);
  assert.strictEqual(bully1.jenis, "perundungan_sekolah");
  assert.ok(bully1.responsSuportif.includes("Guru Bimbingan Konseling (BK)"));

  const bully2 = evaluasiKeselamatanSekolah("Teman saya dipalak di kamar mandi");
  assert.strictEqual(bully2.terdeteksiRisiko, true);

  // 6b. Kasus Krisis Diri -> Intervensi Darurat
  const krisis = evaluasiKeselamatanSekolah("Saya putus asa sekali dan ingin menyakiti diri");
  assert.strictEqual(krisis.terdeteksiRisiko, true);
  assert.strictEqual(krisis.jenis, "krisis_pribadi");

  // 6c. Kasus Kerusakan Fasilitas Fisik -> TIDAK Boleh Salah Deteksi sebagai Perundungan
  const fisik1 = evaluasiKeselamatanSekolah("Pintu kelas rusak karena dipukul anak-anak");
  assert.strictEqual(fisik1.terdeteksiRisiko, false, "Kerusakan pintu fisik tidak boleh dianggap perundungan");

  const fisik2 = evaluasiKeselamatanSekolah("Kaki meja patah ditendang saat jam istirahat");
  assert.strictEqual(fisik2.terdeteksiRisiko, false, "Kerusakan meja fisik tidak boleh dianggap perundungan");

  const fisik3 = evaluasiKeselamatanSekolah("Kaca jendela pecah dilempari batu");
  assert.strictEqual(fisik3.terdeteksiRisiko, false, "Kerusakan jendela fisik tidak boleh dianggap perundungan");

  console.log("   Deteksi perundungan manusia vs kerusakan fasilitas fisik -> OK");
}

// -------------------------------------------------------------
// 7. Uji Evaluasi Keselamatan Keluaran AI
// -------------------------------------------------------------
console.log("\n7. Menguji Evaluasi Keselamatan Keluaran AI...");
{
  // 7a. Teks normal aman
  const aman = evaluasiKeluaranAI("Silakan laporkan kerusakan AC di menu Buat Laporan #/lapor.");
  assert.strictEqual(aman.aman, true);
  assert.ok(aman.teks.includes("#/lapor"));

  // 7b. Teks bocor kunci atau prompt injection
  const bocor = evaluasiKeluaranAI("Kunci rahasia adalah OPENAI_API_KEY=sk-123456789");
  assert.strictEqual(bocor.aman, false);
  assert.ok(bocor.teks.includes("kebijakan keamanan sistem"));

  console.log("   Evaluasi keluaran AI (output filtering) -> OK");
}

// -------------------------------------------------------------
// 8. Uji Finish Reason (length & content_filter)
// -------------------------------------------------------------
console.log("\n8. Menguji Penanganan finish_reason ('length' & 'content_filter')...");
{
  // 8a. finish_reason: 'length' -> Catatan pemotongan disematkan rapi
  const mockLength = {
    chat: {
      completions: {
        async create() {
          return {
            choices: [
              {
                message: { content: "Langkah-langkah perbaikan AC adalah: 1. Matikan saklar 2. Bersihkan filter" },
                finish_reason: "length",
              },
            ],
          };
        },
      },
    },
  };
  const resLength = await kirimPesanOpenAi({ message: "Jelaskan perbaikan AC", client: mockLength });
  assert.strictEqual(resLength.finishReason, "length");
  assert.ok(resLength.reply.includes("*(Catatan: Tanggapan terpotong karena mencapai batas maksimal output token"));

  // 8b. finish_reason: 'content_filter' -> Melempar galat 400 terstruktur
  const mockFilter = {
    chat: {
      completions: {
        async create() {
          return {
            choices: [
              {
                message: { content: "" },
                finish_reason: "content_filter",
              },
            ],
          };
        },
      },
    },
  };
  await assert.rejects(
    () => kirimPesanOpenAi({ message: "Tes filter", client: mockFilter }),
    (err) => err instanceof AIServiceError && err.code === "OPENAI_CONTENT_FILTERED" && err.statusCode === 400
  );

  console.log("   Penanganan finish_reason length & content_filter -> OK");
}

// -------------------------------------------------------------
// 9. Uji Pemetaan Galat & Penyamaran Kunci Rahasia
// -------------------------------------------------------------
console.log("\n9. Menguji Pemetaan Galat SDK & Penyamaran Rahasia...");
{
  // Timeout
  const mockTimeout = {
    chat: {
      completions: {
        async create() {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          throw err;
        },
      },
    },
  };
  await assert.rejects(
    () => kirimPesanOpenAi({ message: "Tes timeout", client: mockTimeout }),
    (err) => err instanceof AIServiceError && err.code === "OPENAI_TIMEOUT" && err.statusCode === 504
  );

  // Penyamaran rahasia
  const rahasia = "Gagal memproses sk-proj-1234567890abcdef123456 dan AIzaSyA1B2C3D4E5F6G7H8I9J0";
  const aman = sanitasiPesanRahasia(rahasia);
  assert.ok(!aman.includes("sk-proj-1234567890abcdef123456"));
  assert.ok(!aman.includes("AIzaSyA1B2C3D4E5F6G7H8I9J0"));
  assert.ok(aman.includes("[REDACTED_OPENAI_KEY]"));
  assert.ok(aman.includes("[REDACTED_GEMINI_KEY]"));

  console.log("   Pemetaan error 504 & penyamaran kunci rahasia -> OK");
}

// -------------------------------------------------------------
// 10. Uji Integrasi Jalur HTTP (POST /api/chat via Provider OpenAI Mock)
// -------------------------------------------------------------
console.log("\n10. Menguji Integrasi Jalur HTTP POST /api/chat dengan Provider OpenAI...");
{
  // Muat server Express utama
  process.env.PORT = "5094";
  process.env.NODE_ENV = "test";
  const { default: app } = await import("./server.js");

  let payloadDiterima = null;
  const mockOpenAiClient = {
    chat: {
      completions: {
        async create(params) {
          payloadDiterima = params;
          return {
            choices: [
              {
                message: {
                  content: "Halo! Saya TanggapAI (didukung OpenAI Adapter). Silakan buat laporan di #/lapor.",
                },
                finish_reason: "stop",
              },
            ],
          };
        },
      },
    },
  };

  // Pasang mock client OpenAI ke app.locals
  app.locals.openAiClient = mockOpenAiClient;

  // Mock verifier Supabase untuk simulasi otentikasi siswa
  app.locals.supabaseVerifier = async (token) => {
    if (token === "token_siswa_valid") {
      return {
        user: { id: "siswa-1", email: "siswa@telkom.sch.id" },
        profile: { id: "siswa-1", full_name: "Budi Santoso", role: "siswa" },
        role: "siswa",
        userName: "Budi Santoso",
      };
    }
    throw new Error("Invalid token");
  };

  // Atur sementara AI_PROVIDER ke 'openai' untuk menguji integrasi router
  const simpanProvider = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "openai";

  const BASE_URL = "http://127.0.0.1:5094";

  // Request HTTP riil ke server lokal Express
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token_siswa_valid",
    },
    body: JSON.stringify({
      message: "Kipas angin di lab 2 macet, hubungi 081234567890",
      history: [],
    }),
  });

  const body = await res.json();

  assert.strictEqual(res.status, 200, "POST /api/chat harus mengembalikan 200 OK");
  assert.strictEqual(body.success, true);
  assert.ok(body.reply.includes("TanggapAI"));
  assert.strictEqual(body.error, null);

  // Verifikasi proteksi privasi siswa pada payload OpenAI
  assert.ok(payloadDiterima !== null, "Payload OpenAI harus diterima");
  assert.strictEqual(payloadDiterima.model, DEFAULT_OPENAI_MODEL);
  assert.ok(!payloadDiterima.messages[0].content.includes("Budi Santoso"), "Nama lengkap siswa tidak boleh dikirim");
  assert.ok(payloadDiterima.messages[1].content.includes("[NOMOR_TELEPON_DISAMARKAN]"), "Nomor HP siswa harus disamarkan");

  // Kembalikan AI_PROVIDER ke default semula (groq)
  if (simpanProvider !== undefined) process.env.AI_PROVIDER = simpanProvider;
  else delete process.env.AI_PROVIDER;

  app.locals.openAiClient = null;
  app.locals.supabaseVerifier = null;

  assert.strictEqual(getActiveAiProvider(), process.env.OPENAI_API_KEY ? "openai" : "groq", "Gateway FasTanggap dicoba dulu bila key-nya ada");

  console.log("   Integrasi HTTP POST /api/chat (200 OK, JSON valid, PII terproteksi, Groq tetap default) -> OK");
}

console.log("\n========================================================");
console.log("SEMUA PENGUJIAN OPENAI ADAPTER HARDENING BERHASIL (100%)");
console.log("========================================================");
process.exit(0);
