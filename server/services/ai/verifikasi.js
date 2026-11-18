/**
 * services/ai/verifikasi.js
 * Menilai apakah sebuah laporan kerusakan fasilitas layak atau asal-asalan.
 * Memakai provider AI yang sama dengan chatbot (AI_PROVIDER: openai | groq).
 */

import { getActiveAiProvider } from "./index.js";
import { getOpenAiClient, DEFAULT_OPENAI_MODEL } from "./adapters/openaiAdapter.js";
import { getGroqClient, DEFAULT_GROQ_MODEL } from "./adapters/groqAdapter.js";

const PROMPT_PENILAI = `Kamu adalah penyaring laporan kerusakan fasilitas sekolah (SMK) untuk aplikasi FasTanggap.
Nilai SATU laporan dan pilih salah satu verdict:
- "valid": laporan masuk akal tentang kerusakan/masalah fasilitas sekolah, walaupun singkat atau ejaannya kurang rapi.
- "ragu": mungkin sungguhan tetapi terlalu kabur untuk ditindaklanjuti (mis. hanya "rusak" tanpa keterangan), atau kamu tidak yakin.
- "asal": jelas bukan laporan sungguhan: ketikan acak (mis. "asdfgh"), tes/coba-coba, candaan, ejekan atau kata kasar, spam,
  atau topik yang sama sekali tidak berhubungan dengan fasilitas sekolah.
Bersikap hati-hati: pilih "asal" HANYA jika sangat jelas. Jika ragu, pilih "ragu".
Jawab HANYA dengan JSON satu baris: {"verdict":"valid|ragu|asal","alasan":"<maks 20 kata, bahasa Indonesia>"}`;

function klienDanModel() {
  const provider = getActiveAiProvider();
  if (provider === "openai") return { client: getOpenAiClient(), model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL };
  if (provider === "groq") return { client: getGroqClient(), model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL };
  throw new Error(`Verifikasi laporan belum mendukung provider '${provider}'.`);
}

/** Mengambil objek JSON pertama dari teks balasan model. */
export function uraiVerdict(teks) {
  const cocok = String(teks || "").match(/\{[\s\S]*?\}/);
  if (!cocok) return null;
  try {
    const obj = JSON.parse(cocok[0]);
    const verdict = String(obj.verdict || "").toLowerCase().trim();
    if (!["valid", "ragu", "asal"].includes(verdict)) return null;
    return { verdict, alasan: String(obj.alasan || "").trim().slice(0, 300) };
  } catch {
    return null;
  }
}

/**
 * @param {{ judul: string, deskripsi: string, kategori?: string, lokasi?: string }} laporan
 * @returns {Promise<{ verdict: 'valid'|'ragu'|'asal', alasan: string }>}
 */
export async function nilaiLaporan(laporan, { client: klienUji = null, model: modelUji } = {}) {
  const { client, model } = klienUji ? { client: klienUji, model: modelUji || "uji" } : klienDanModel();
  const isi = [
    `Judul: ${String(laporan.judul || "").slice(0, 200)}`,
    `Kategori: ${laporan.kategori || "-"}`,
    `Lokasi: ${laporan.lokasi || "-"}`,
    `Deskripsi: ${String(laporan.deskripsi || "").slice(0, 1500)}`,
  ].join("\n");

  const hasil = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: PROMPT_PENILAI },
        { role: "user", content: isi },
      ],
      max_tokens: 150,
      temperature: 0,
    },
    { signal: AbortSignal.timeout(25000) }
  );

  const v = uraiVerdict(hasil?.choices?.[0]?.message?.content);
  // Balasan tidak terbaca -> jangan menghukum siswa, serahkan ke petugas.
  return v || { verdict: "ragu", alasan: "Penilaian otomatis tidak terbaca, perlu dicek petugas." };
}
