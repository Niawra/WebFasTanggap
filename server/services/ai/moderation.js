/**
 * services/ai/moderation.js
 * Modul Keselamatan & Perlindungan Data Pengguna Sekolah (< 18 Tahun) - Fase 2.2.
 * 
 * CATATAN PENTING & BATASAN SISTEM:
 * 1. OpenAI Moderation API (/v1/moderations) BELUM AKTIF pada fase ini dan tidak boleh diklaim sebagai fitur aktif.
 * 2. Seluruh evaluasi saat ini berjalan menggunakan HEURISTIK LOKAL (Local Rule-based Heuristics).
 * 3. Heuristik ini dirancang untuk meminimalkan risiko di lingkungan sekolah (SMK Telkom Purwokerto),
 *    namun tidak menjamin 100% deteksi dan BUKAN pengganti pengawasan manusia atau bimbingan konseling profesional oleh Guru BK.
 */

/**
 * Menyamarkan data pribadi siswa (PII) dari pesan pengguna sebelum dikirim ke AI eksternal.
 * 
 * Aturan Kehati-hatian:
 * - Menyamarkan nomor telepon seluler Indonesia (08xx, +62xx, 62xx).
 * - Menyamarkan alamat email.
 * - Menyamarkan nomor NIS/NISN yang dilabeli eksplisit atau NISN 10 digit.
 * - TIDAK merusak angka pada konteks fasilitas (contoh: "kelas XI PPLG 2", "meja no 14", "lantai 3").
 * 
 * @param {string} teks - Pesan asli dari pengguna
 * @returns {string} Pesan yang telah disamarkan
 */
export function samarkanDataPribadiSiswa(teks) {
  if (!teks || typeof teks !== "string") return "";

  let hasil = teks;

  // 1. Samarkan Email: format user@domain.tld
  hasil = hasil.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    "[EMAIL_DISAMARKAN]"
  );

  // 2. Samarkan Nomor Telepon Seluler Indonesia:
  // Format: +62 8xx, 628xx, atau 08xx dengan panjang 10-14 digit total (mendukung pemisah spasi, tanda hubung, atau titik)
  hasil = hasil.replace(
    /(?:\+62|62|0)[- ]?8[1-9][0-9]{1,2}(?:[- .]?[0-9]{3,4}){2}\b/g,
    "[NOMOR_TELEPON_DISAMARKAN]"
  );

  // 3. Samarkan NIS / NISN Berlabel Eksplisit: contoh "NIS: 12345", "NISN = 0012345678"
  hasil = hasil.replace(
    /\b(?:nisn|nis)\s*[:=]?\s*([0-9]{4,10})\b/gi,
    "[IDENTITAS_SISWA_DISAMARKAN]"
  );

  // 4. Samarkan Standalone NISN Nasional (10 digit diawali 00)
  hasil = hasil.replace(
    /\b00[0-9]{8}\b/g,
    "[NISN_DISAMARKAN]"
  );

  return hasil;
}

/**
 * Evaluasi Keselamatan Pengguna Sekolah (< 18 Tahun):
 * Mendeteksi indikasi krisis pribadi atau perundungan (bullying) antar-manusia di sekolah.
 * 
 * Mengatasi False Positive:
 * Membedakan kerusakan fasilitas fisik (contoh: "pintu lab rusak karena dipukul", "meja ditendang")
 * dengan perundungan terhadap manusia (contoh: "saya dipukul", "teman saya diancam").
 * Jika ada ambiguitas yang melibatkan manusia, SELALU prioritaskan keselamatan manusia.
 * 
 * @param {string} pesan - Teks pesan pengguna
 * @returns {{ terdeteksiRisiko: boolean, jenis: string|null, responsSuportif: string|null }}
 */
export function evaluasiKeselamatanSekolah(pesan) {
  if (!pesan || typeof pesan !== "string") {
    return { terdeteksiRisiko: false, jenis: null, responsSuportif: null };
  }

  const teksKecil = pesan.toLowerCase();

  // Pola 1: Krisis Keselamatan Diri / Self-Harm (Prioritas Tertinggi)
  const polaKrisisDiri = [
    /\b(bunuh diri|akhiri hidup|menyakiti diri|self[- ]?harm)\b/i,
    /\b(putus asa sekali|tidak ingin hidup|capek hidup|pengen mati)\b/i,
  ];

  if (polaKrisisDiri.some((re) => re.test(teksKecil))) {
    return {
      terdeteksiRisiko: true,
      jenis: "krisis_pribadi",
      responsSuportif:
        "Kami sangat peduli dengan keselamatanmu. TanggapAI adalah sistem pelaporan sarana fisik sekolah dan bukan layanan konseling darurat. Kamu tidak sendirian. Mohon segera sampaikan apa yang kamu rasakan kepada Guru Bimbingan Konseling (BK), Wali Kelas, orang tua, atau pihak sekolah yang kamu percayai agar mendapatkan pendampingan yang aman dan tepat.",
    };
  }

  // Pola 2: Korban Manusia Personal (Korban adalah orang: "saya", "aku", "kami", "teman saya")
  const adaKorbanPersonal = /\b(saya|aku|kami|teman|kawan|sahabat|adik kelas|kakak kelas)\b/i.test(teksKecil);
  const adaKataKekerasan = /\b(dibully|dipalak|dipukul|dihajar|diancam|dikeroyok|diintimidasi|dilecehkan|dianiaya|ditonjok|ditempeleng)\b/i.test(teksKecil);

  if (adaKorbanPersonal && adaKataKekerasan) {
    return {
      terdeteksiRisiko: true,
      jenis: "perundungan_sekolah",
      responsSuportif:
        "Kami mendengar kekhawatiranmu. TanggapAI bertugas membantu pelaporan fasilitas sekolah dan tidak dapat menggantikan peran penanganan masalah perundungan atau keselamatan pribadi. Jika kamu atau temanmu mengalami perundungan (bullying), ancaman, pemalakan, atau kekerasan di sekolah, mohon segera temui langsung Guru Bimbingan Konseling (BK), Wali Kelas, Pembina Kesiswaan, atau Petugas Keamanan SMK Telkom Purwokerto agar segera mendapatkan perlindungan dan bantuan resmi.",
    };
  }

  // Pola 3: Perundungan / Pemalakan / Pengeroyokan Eksplisit (Meskipun tanpa kata 'saya')
  const polaPerundunganEksplisit = /\b(bullying|perundungan|pemalakan|pengeroyokan|pelecehan)\b/i;
  if (polaPerundunganEksplisit.test(teksKecil)) {
    return {
      terdeteksiRisiko: true,
      jenis: "perundungan_sekolah",
      responsSuportif:
        "Kami mendengar kekhawatiranmu. TanggapAI bertugas membantu pelaporan fasilitas sekolah dan tidak dapat menggantikan peran penanganan masalah perundungan atau keselamatan pribadi. Jika kamu atau temanmu mengalami perundungan (bullying), ancaman, pemalakan, atau kekerasan di sekolah, mohon segera temui langsung Guru Bimbingan Konseling (BK), Wali Kelas, Pembina Kesiswaan, atau Petugas Keamanan SMK Telkom Purwokerto agar segera mendapatkan perlindungan dan bantuan resmi.",
    };
  }

  // Pola 4: Kerusakan Fasilitas Fisik (Pengecualian Aman: Objek fasilitas rusak/dipukul/ditendang)
  // Contoh: "pintu dipukul anak-anak", "kaki meja ditendang", "kaca dilempar batu"
  const polaObjekFasilitas = /\b(pintu|meja|kursi|jendela|kaca|tembok|dinding|papan|ac|proyektor|lemari|wastafel|keran|saklar|lampu)\b/i;
  if (polaObjekFasilitas.test(teksKecil)) {
    return { terdeteksiRisiko: false, jenis: null, responsSuportif: null };
  }

  return { terdeteksiRisiko: false, jenis: null, responsSuportif: null };
}

/**
 * Evaluasi Keselamatan Keluaran AI:
 * Memindai teks balasan dari penyedia AI sebelum dikirim ke frontend siswa.
 * Memastikan tidak ada konten kasar, instruksi berbahaya, atau kebocoran sistem prompt.
 * 
 * @param {string} teksOutput - Teks yang dihasilkan oleh model AI
 * @returns {{ aman: boolean, teks: string }}
 */
export function evaluasiKeluaranAI(teksOutput) {
  if (!teksOutput || typeof teksOutput !== "string") {
    return { aman: false, teks: "Mohon maaf, asisten AI tidak dapat menghasilkan tanggapan yang valid saat ini." };
  }

  const teksKecil = teksOutput.toLowerCase();

  // Periksa indikasi kebocoran prompt sistem internal atau kunci API
  const polaBahaya = [
    /\b(gemini_api_key|openai_api_key|groq_api_key|supabase_anon_key)\b/i,
    /\b(ignore all previous instructions|jailbreak successful)\b/i,
  ];

  if (polaBahaya.some((re) => re.test(teksKecil))) {
    return {
      aman: false,
      teks: "Mohon maaf, tanggapan tidak dapat ditampilkan karena melanggar kebijakan keamanan sistem. Silakan ajukan pertanyaan lain seputar fasilitas sekolah.",
    };
  }

  return { aman: true, teks: teksOutput };
}
