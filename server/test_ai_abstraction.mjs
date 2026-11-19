/**
 * test_ai_abstraction.mjs
 * Pengujian unit untuk Lapisan Abstraksi Layanan AI (Fase Abstraksi Multi-Provider).
 * 
 * Menguji:
 * 1. Default provider fallback ke 'groq'.
 * 2. Eksekusi kirimPesanAI() mendelegasikan ke Groq saat provider 'groq' (default).
 * 3. Eksekusi kirimPesanAI() mendelegasikan ke Gemini saat provider 'gemini'.
 * 4. Penolakan aman saat provider tidak didukung (misal 'claude') dengan kode AI_PROVIDER_UNSUPPORTED (503).
 * 5. Konsistensi konstanta MAX_MESSAGE_LENGTH.
 */

import assert from "node:assert/strict";
import {
  kirimPesanAI,
  getActiveAiProvider,
  AIServiceError,
  DEFAULT_AI_PROVIDER,
  SUPPORTED_AI_PROVIDERS,
  MAX_MESSAGE_LENGTH,
} from "./services/ai/index.js";

console.log("=== PENGUJIAN FASE 1: AI PROVIDER ABSTRACTION ===");

// 1. Uji Konfigurasi Provider Aktif & Default
console.log("\n1. Menguji Konfigurasi Provider Aktif & Default...");
{
  const simpanProvider = process.env.AI_PROVIDER;
  // Uji urutan dari AI_PROVIDER saja, tanpa gateway bawaan yang selalu didahulukan.
  const simpanKeyGateway = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  // Kasus tidak disetel -> Default adalah 'groq'
  delete process.env.AI_PROVIDER;
  assert.strictEqual(getActiveAiProvider(), "groq");
  assert.strictEqual(DEFAULT_AI_PROVIDER, "groq");
  assert.deepStrictEqual(SUPPORTED_AI_PROVIDERS, ["groq", "gemini", "openai"]);

  // Kasus whitespace atau uppercase
  process.env.AI_PROVIDER = "  GROQ  ";
  assert.strictEqual(getActiveAiProvider(), "groq");

  // Kasus provider lain
  process.env.AI_PROVIDER = "gemini";
  assert.strictEqual(getActiveAiProvider(), "gemini");

  process.env.AI_PROVIDER = "openai";
  assert.strictEqual(getActiveAiProvider(), "openai");

  // Kembalikan environment
  if (simpanProvider !== undefined) process.env.AI_PROVIDER = simpanProvider;
  else delete process.env.AI_PROVIDER;

  console.log("   Resolusi provider default (groq) dan normalisasi env -> OK");
  if (simpanKeyGateway !== undefined) process.env.OPENAI_API_KEY = simpanKeyGateway;
}

// 2. Uji Konstanta Batas Pesan
console.log("\n2. Menguji Konstanta Batas Pesan...");
{
  assert.strictEqual(MAX_MESSAGE_LENGTH, 500);
  console.log("   MAX_MESSAGE_LENGTH = 500 -> OK");
}

// 3. Uji Delegasi ke Groq dengan Mock Client
console.log("\n3. Menguji Delegasi kirimPesanAI() ke Groq...");
{
  let payloadDiterima = null;
  const mockGroqClient = {
    chat: {
      completions: {
        async create(params) {
          payloadDiterima = params;
          return {
            choices: [
              {
                message: {
                  content: "Halo, saya TanggapAI yang didukung Groq Cloud API.",
                },
                finish_reason: "stop",
              },
            ],
          };
        },
      },
    },
  };

  const hasil = await kirimPesanAI({
    message: "Bagaimana cara lapor proyektor mati?",
    client: mockGroqClient,
    provider: "groq",
  });

  assert.ok(payloadDiterima !== null);
  assert.strictEqual(payloadDiterima.messages[payloadDiterima.messages.length - 1].content, "Bagaimana cara lapor proyektor mati?");
  assert.ok(hasil.reply.includes("Groq Cloud API"));
  assert.strictEqual(hasil.role, "tamu");
  console.log("   Delegasi kirimPesanAI() ke Groq -> OK");
}

// 4. Uji Delegasi ke Gemini dengan Mock Client
console.log("\n4. Menguji Delegasi kirimPesanAI() ke Gemini...");
{
  let pesanDiterima = null;
  const mockClient = {
    chats: {
      create(params) {
        return {
          async sendMessage(sendParams) {
            pesanDiterima = sendParams.message;
            return {
              text: "Halo, saya TanggapAI yang didelegasikan melalui AI Provider Abstraction (Gemini).",
            };
          },
        };
      },
    },
  };

  const hasil = await kirimPesanAI({
    message: "Bagaimana cara lapor kipas rusak?",
    client: mockClient,
    provider: "gemini",
  });

  assert.strictEqual(pesanDiterima, "Bagaimana cara lapor kipas rusak?");
  assert.ok(hasil.reply.includes("Gemini"));
  assert.strictEqual(hasil.role, "tamu");
  console.log("   Delegasi kirimPesanAI() ke Gemini -> OK");
}

// 5. Uji Penanganan Pemilihan Provider (Groq key missing & Unsupported)
console.log("\n5. Menguji Penanganan Galat Provider (Groq Key Missing & Unsupported)...");
{
  // 5a. Provider: 'groq' tanpa API Key harus gagal aman (503 GROQ_KEY_MISSING)
  const simpanGroqKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;

  await assert.rejects(
    () => kirimPesanAI({ message: "Halo", provider: "groq" }),
    (err) => {
      assert.ok(err instanceof AIServiceError);
      assert.strictEqual(err.code, "GROQ_KEY_MISSING");
      assert.strictEqual(err.statusCode, 503);
      return true;
    }
  );

  if (simpanGroqKey !== undefined) process.env.GROQ_API_KEY = simpanGroqKey;

  // 5b. Environment AI_PROVIDER = 'claude' (provider tidak didukung)
  const simpan = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "claude";

  await assert.rejects(
    () => kirimPesanAI({ message: "Halo", provider: "claude" }),
    (err) => {
      assert.ok(err instanceof AIServiceError);
      assert.strictEqual(err.code, "AI_PROVIDER_UNSUPPORTED");
      assert.strictEqual(err.statusCode, 503);
      assert.ok(err.message.includes("claude"));
      return true;
    }
  );

  if (simpan !== undefined) process.env.AI_PROVIDER = simpan;
  else delete process.env.AI_PROVIDER;

  console.log("   Penanganan pemilihan provider (Groq key missing 503 & unsupported 503) -> OK");
}

console.log("\n========================================================");
console.log("SEMUA PENGUJIAN ABSTRAKSI AI FASE 1 BERHASIL LOLOS (100%)");
console.log("========================================================");
