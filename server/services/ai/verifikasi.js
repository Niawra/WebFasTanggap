/**
 * services/ai/verifikasi.js
 * Menilai apakah sebuah laporan kerusakan fasilitas layak atau asal-asalan.
 * Memakai provider AI yang sama dengan chatbot (AI_PROVIDER: openai | groq).
 */

import { denganCadangan } from "./index.js";

// Timeout per provider; dipendekkan lewat AI_TIMEOUT_MS supaya cadangan sempat dicoba.
const batasWaktuMs = () => Number(process.env.AI_TIMEOUT_MS) || 25000;
import { getOpenAiClient, DEFAULT_OPENAI_MODEL } from "./adapters/openaiAdapter.js";
import { getGroqClient, DEFAULT_GROQ_MODEL } from "./adapters/groqAdapter.js";

const PROMPT_PENILAI = `Kamu adalah penyaring laporan kerusakan fasilitas sekolah (SMK) untuk aplikasi FasTanggap.
FasTanggap HANYA menerima laporan tentang SARANA & PRASARANA FISIK milik sekolah yang rusak, kotor, hilang, atau tidak berfungsi:
bangunan (atap, dinding, pintu, jendela, lantai, plafon), listrik & lampu, AC/kipas, proyektor, komputer/lab, meja-kursi,
toilet & air, kebersihan area sekolah, lapangan, kantin (bangunan/peralatannya), jaringan/Wi-Fi sekolah, dan sejenisnya.

Nilai SATU laporan (judul + deskripsi + kategori + lokasi) dan pilih verdict:
- "valid": jelas menyebut fasilitas fisik sekolah DAN masalahnya (apa yang rusak/bermasalah). Ejaan kurang rapi tidak masalah.
- "ragu": tentang fasilitas sekolah tetapi terlalu kabur untuk ditindaklanjuti (mis. hanya "rusak" tanpa menyebut benda/masalah).
- "asal": BUKAN laporan fasilitas sekolah, termasuk:
  * ketikan acak, tes/coba-coba, spam, judul dan deskripsi yang tidak nyambung;
  * candaan, ejekan, sindiran, kata kasar, gosip, atau menyebut nama orang/tokoh publik/politik (mis. "Gibran", "Jokowi") sebagai isi laporan;
  * makanan/minuman, program bantuan (mis. MBG / makan bergizi gratis), uang, atau barang PRIBADI (HP, tas, dompet) yang hilang;
  * masalah antarorang, perilaku siswa/guru, nilai, jadwal, atau topik apa pun di luar sarana fisik sekolah.
Jika SEBAGIAN isi berupa candaan/ejekan/nama tokoh yang tidak relevan, pilih "asal".
Jangan beri "valid" hanya karena ada kata "hilang", "rusak", atau waktu kejadian; yang dinilai adalah BENDA apa yang dilaporkan.

Contoh:
- Judul "Lampu kelas mati", Deskripsi "2 lampu di belakang tidak menyala sejak pagi" -> valid
- Judul "Kran toilet bocor", Deskripsi "air terus menetes" -> valid
- Judul "Rusak", Deskripsi "tolong dicek" -> ragu
- Judul "MBG hilang", Deskripsi "hilang sejak 20 menit lalu" -> asal (makanan program MBG, bukan fasilitas)
- Judul "Proyektor", Deskripsi "gibran jamsut" -> asal (ejekan/nama tokoh, tidak menjelaskan kerusakan)
- Judul "HP saya hilang", Deskripsi "di kelas" -> asal (barang pribadi)
- Judul "asdf", Deskripsi "tes" -> asal

Jawab HANYA dengan JSON satu baris: {"verdict":"valid|ragu|asal","alasan":"<maks 20 kata, bahasa Indonesia>"}`;

function klienDanModel(provider) {
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
  const isi = [
    `Judul: ${String(laporan.judul || "").slice(0, 200)}`,
    `Kategori: ${laporan.kategori || "-"}`,
    `Lokasi: ${laporan.lokasi || "-"}`,
    `Deskripsi: ${String(laporan.deskripsi || "").slice(0, 1500)}`,
  ].join("\n");

  const minta = ({ client, model }) => client.chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: PROMPT_PENILAI },
        { role: "user", content: isi },
      ],
      max_tokens: 150,
      temperature: 0,
    },
    { signal: AbortSignal.timeout(batasWaktuMs()) }
  );
  const hasil = klienUji
    ? await minta({ client: klienUji, model: modelUji || "uji" })
    : await denganCadangan((p) => minta(klienDanModel(p)));

  const v = uraiVerdict(hasil?.choices?.[0]?.message?.content);
  // Balasan tidak terbaca -> jangan menghukum siswa, serahkan ke petugas.
  return v || { verdict: "ragu", alasan: "Penilaian otomatis tidak terbaca, perlu dicek petugas." };
}
