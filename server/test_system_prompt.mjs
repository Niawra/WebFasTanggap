import assert from "node:assert/strict";
import {
  SYSTEM_PROMPT_VERSION,
  KATEGORI_FASILITAS,
  STATUS_LAPORAN,
  PRIORITAS_LAPORAN,
  PANDUAN_NAVIGASI,
  TANGGAPAI_BASE_PROMPT,
  buildSystemPrompt,
} from "./prompts/systemPrompt.js";

console.log("=== PENGUJIAN TAHAP 1: FOUNDATION & SYSTEM PROMPT TANGGAPAI ===");

// 1. Uji Versi dan Metadata
console.log("\n1. Memeriksa Versi System Prompt...");
assert.ok(SYSTEM_PROMPT_VERSION, "Versi harus terdefinisi");
assert.strictEqual(SYSTEM_PROMPT_VERSION, "1.0.0");
console.log("   Versi:", SYSTEM_PROMPT_VERSION, "-> OK");

// 2. Uji Kelengkapan Kategori Fasilitas
console.log("\n2. Memeriksa 9 Kategori Fasilitas Resmi...");
assert.strictEqual(KATEGORI_FASILITAS.length, 9, "Jumlah kategori harus 9");
const kategoriIds = KATEGORI_FASILITAS.map((k) => k.id);
const kategoriWajib = ["ac", "kipas", "lampu", "meja", "proyektor", "komputer", "pintu", "toilet", "lain"];
for (const id of kategoriWajib) {
  assert.ok(kategoriIds.includes(id), `Kategori '${id}' harus ada`);
}
console.log("   Semua 9 kategori terdaftar dengan benar -> OK");

// 3. Uji Status Laporan Sesuai Database
console.log("\n3. Memeriksa Status Laporan Sesuai Enum Database...");
const statusKunci = Object.keys(STATUS_LAPORAN);
assert.deepStrictEqual(
  statusKunci.sort(),
  ["menunggu_verifikasi", "diproses", "selesai", "ditolak"].sort(),
  "Status harus sesuai enum report_status Supabase"
);
console.log("   Status laporan terdaftar:", statusKunci.join(", "), "-> OK");

// 4. Uji Skala Prioritas
console.log("\n4. Memeriksa Skala Prioritas...");
assert.ok(PRIORITAS_LAPORAN.rendah);
assert.ok(PRIORITAS_LAPORAN.sedang);
assert.ok(PRIORITAS_LAPORAN.tinggi);
console.log("   Skala prioritas terverifikasi -> OK");

// 5. Uji Navigasi Rute
console.log("\n5. Memeriksa Peta Rute Navigasi Hash...");
assert.strictEqual(PANDUAN_NAVIGASI.beranda.rute, "#/");
assert.strictEqual((PANDUAN_NAVIGASI.lapor?.rute || PANDUAN_NAVIGASI.buatLaporan?.rute), "#/lapor");
assert.strictEqual(PANDUAN_NAVIGASI.daftarLaporan.rute, "#/daftar-laporan");
assert.strictEqual(PANDUAN_NAVIGASI.lacak.rute, "#/lacak");
assert.strictEqual(PANDUAN_NAVIGASI.masuk.rute, "#/masuk");
assert.strictEqual(PANDUAN_NAVIGASI.daftar.rute, "#/daftar");
assert.strictEqual(PANDUAN_NAVIGASI.dasborPetugas.rute, "#/petugas");
console.log("   Rute navigasi valid -> OK");

// 6. Uji Guardrails dan Keamanan di Base Prompt
console.log("\n6. Memeriksa Batasan Keamanan & Guardrails...");
assert.ok(TANGGAPAI_BASE_PROMPT.includes("TanggapAI"), "Harus menyebutkan identitas TanggapAI");
assert.ok(TANGGAPAI_BASE_PROMPT.includes("SMK Telkom Purwokerto"), "Harus mencakup konteks sekolah");
assert.ok(TANGGAPAI_BASE_PROMPT.includes("Anti Prompt Injection"), "Harus memiliki klausul anti injection");
assert.ok(TANGGAPAI_BASE_PROMPT.includes("Jujur & Tidak Halusinasi"), "Harus memiliki klausul anti halusinasi");
assert.ok(TANGGAPAI_BASE_PROMPT.includes("Kerahasiaan Sistem"), "Harus melarang pembocoran rahasia");
assert.ok(!TANGGAPAI_BASE_PROMPT.includes("AIzaSy"), "Tidak boleh ada API key asli");
console.log("   Guardrails keamanan lengkap -> OK");

// 7. Uji Builder Prompt Dinamis per Peran
console.log("\n7. Menguji buildSystemPrompt() per Peran...");

// 7a. Peran Tamu / Pengunjung Umum
const promptTamu = buildSystemPrompt({ role: "tamu" });
assert.ok(promptTamu.includes("PENGUNJUNG UMUM"));
assert.ok(promptTamu.includes("#/masuk"));
assert.ok(promptTamu.includes("#/daftar"));

// 7b. Peran Siswa
const promptSiswa = buildSystemPrompt({ role: "siswa", name: "Budi Santoso" });
assert.ok(promptSiswa.includes("SISWA (Budi Santoso)"));
assert.ok(promptSiswa.includes("#/lapor"));
assert.ok(promptSiswa.includes("#/laporan"));

// 7c. Peran Petugas
const promptPetugas = buildSystemPrompt({ role: "petugas", name: "Pak Sarana" });
assert.ok(promptPetugas.includes("PETUGAS SARANA PRASARANA (Pak Sarana)"));
assert.ok(promptPetugas.includes("#/petugas"));
assert.ok(promptPetugas.includes("#/petugas/rekap"));

// 7d. Sanitasi Peran Ilegal (Fallback Aman ke Tamu)
const promptIlegal = buildSystemPrompt({ role: "hacker_admin", name: "Evil" });
assert.ok(promptIlegal.includes("PENGUNJUNG UMUM"), "Peran tidak valid harus fallback ke 'tamu'");

console.log("   Dukungan dinamis peran terverifikasi dengan aman -> OK");

console.log("\n========================================================");
console.log("SEMUA PENGUJIAN TAHAP 1 SYSTEM PROMPT LOLOS (100% SUKSES)");
console.log("========================================================");
