/**
 * prompts/drafLaporan.js
 * TanggapAI sebagai pembuat laporan: menanyakan yang kurang, lalu menyiapkan draf
 * yang bisa langsung dikirim siswa lewat tombol "Kirim laporan" di chatbot.
 *
 * Daftar kategori & lokasi dikirim oleh klien (website/aplikasi) dari tabel Supabase,
 * supaya draf memakai nama yang persis ada di database.
 */

const MAKS_ITEM = 60;
const MAKS_PANJANG = 60;

/** Membersihkan daftar nama dari klien (tidak tepercaya). */
export function bersihkanDaftar(daftar) {
  if (!Array.isArray(daftar)) return [];
  const hasil = [];
  for (const x of daftar.slice(0, MAKS_ITEM)) {
    const s = String(x ?? "").replace(/[\r\n[\]{}"`]/g, " ").trim().slice(0, MAKS_PANJANG);
    if (s && !hasil.includes(s)) hasil.push(s);
  }
  return hasil;
}

export function promptPembuatLaporan(kategori, lokasi) {
  const kat = bersihkanDaftar(kategori);
  const lok = bersihkanDaftar(lokasi);
  if (!kat.length || !lok.length) return "";
  return `### PEMBUAT LAPORAN (KHUSUS SISWA)
Jika siswa ingin melaporkan kerusakan, bantu susun laporannya lewat obrolan ini:
1. Pastikan tahu: APA yang rusak, DI MANA (lokasi), dan gejalanya. Jika kurang, tanyakan SATU pertanyaan singkat.
2. Jika informasinya cukup, jawab satu kalimat singkat (mis. "Ini draf laporannya, cek lalu tekan Kirim.")
   lalu tulis blok draf PERSIS dengan format berikut di akhir jawaban:
[[LAPORAN]]{"judul":"<maks 60 karakter>","kategori":"<salah satu KATEGORI>","lokasi":"<salah satu LOKASI>","deskripsi":"<2-3 kalimat: lokasi spesifik, gejala, dampak>"}[[/LAPORAN]]
3. "kategori" dan "lokasi" WAJIB disalin persis dari daftar di bawah. Jika lokasi yang disebut siswa tidak ada di daftar,
   pilih yang paling mendekati dan sebut detailnya di deskripsi.
4. Jangan membuat draf untuk laporan candaan/asal-asalan. Jangan pernah mengaku laporan sudah terkirim.
KATEGORI: ${kat.join(" | ")}
LOKASI: ${lok.join(" | ")}`;
}

const POLA_DRAF = /\[\[LAPORAN\]\]\s*(\{[\s\S]*?\})\s*\[\[\/LAPORAN\]\]/i;

function cocokkan(nilai, daftar) {
  const v = String(nilai || "").trim().toLowerCase();
  if (!v) return null;
  return (
    daftar.find((d) => d.toLowerCase() === v) ||
    daftar.find((d) => d.toLowerCase().includes(v) || v.includes(d.toLowerCase())) ||
    null
  );
}

/**
 * Memisahkan blok draf dari balasan AI.
 * @returns {{ teks: string, draf: null | { judul, kategori, lokasi, deskripsi } }}
 */
export function ambilDrafLaporan(balasan, kategori, lokasi) {
  const teksAsli = String(balasan || "");
  const m = teksAsli.match(POLA_DRAF);
  if (!m) return { teks: teksAsli, draf: null };

  const teks = teksAsli.replace(POLA_DRAF, "").trim() || "Ini draf laporannya. Cek dulu, lalu tekan Kirim laporan.";
  let obj;
  try {
    obj = JSON.parse(m[1]);
  } catch {
    return { teks, draf: null };
  }

  const kat = cocokkan(obj.kategori, bersihkanDaftar(kategori));
  const lok = cocokkan(obj.lokasi, bersihkanDaftar(lokasi));
  const judul = String(obj.judul || "").trim().slice(0, 80);
  const deskripsi = String(obj.deskripsi || "").trim().slice(0, 1000);
  if (!kat || !lok || judul.length < 5 || deskripsi.length < 10) return { teks, draf: null };

  return { teks, draf: { judul, kategori: kat, lokasi: lok, deskripsi } };
}
