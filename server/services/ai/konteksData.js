/**
 * services/ai/konteksData.js
 * Memberi TanggapAI data nyata dari Supabase sebelum menjawab.
 * Semua query memakai token pengguna (atau anon untuk tamu), jadi RLS tetap berlaku:
 *   - tamu    : ringkasan publik + lacak kode laporan yang disebut
 *   - siswa   : laporan miliknya sendiri + lacak kode
 *   - petugas : antrean laporan terbaru, tugas yang ia pegang, ringkasan + lacak kode
 * Kalau Supabase gagal, chat tetap jalan tanpa konteks.
 */

import { getSupabaseConfig, isSupabaseConfigured } from "../supabase.js";

const STATUS = {
  menunggu_verifikasi: "menunggu verifikasi",
  diproses: "diproses",
  selesai: "selesai",
  ditolak: "ditolak",
};
const KODE = /\bFT-[A-Z0-9]{2,8}-[A-Z0-9]{2,8}\b/gi;
const tgl = (t) => (t ? new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-");
const st = (s) => STATUS[s] || s || "-";

async function ambil(path, { token, method = "GET", body } = {}) {
  const { url, anonKey } = getSupabaseConfig();
  const r = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token || anonKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

const barisLaporan = (r) =>
  `- ${r.code}: ${r.title} | ${r.locations?.name || r.location || "-"} | status ${st(r.status)} | ${tgl(r.created_at)}`;

async function lacakKode(pesan, token) {
  const kode = [...new Set((String(pesan).match(KODE) || []).map((k) => k.toUpperCase()))].slice(0, 3);
  const hasil = [];
  for (const k of kode) {
    try {
      const d = await ambil("/rest/v1/rpc/lacak_laporan", { token, method: "POST", body: { p_kode: k } });
      if (!d) {
        hasil.push(`- ${k}: tidak ditemukan.`);
        continue;
      }
      const akhir = (d.history || []).slice(-1)[0];
      const catatan = (d.notes || []).slice(-1)[0];
      hasil.push(
        `- ${d.code}: ${d.title} (${d.category}, ${d.location}) | status ${st(d.status)} | dibuat ${tgl(d.created_at)}` +
          (akhir?.note ? ` | catatan status terakhir: ${akhir.note}` : "") +
          (catatan?.note ? ` | catatan petugas: ${catatan.note}` : "")
      );
    } catch {
      /* lewati */
    }
  }
  return hasil.length ? `Hasil lacak kode yang disebut pengguna:\n${hasil.join("\n")}` : "";
}

async function ringkasan(token) {
  const d = await ambil("/rest/v1/rpc/ringkasan_publik", { token, method: "POST", body: {} });
  return `Ringkasan semua laporan: total ${d.total}, menunggu ${d.menunggu}, diproses ${d.diproses}, selesai ${d.selesai}, ditolak ${d.ditolak}.`;
}

/**
 * @param {{ token?: string, role: string, userId?: string, pesan: string }} p
 * @returns {Promise<string>} teks konteks untuk system prompt (kosong bila tidak ada)
 */
export async function ambilKonteksData({ token = "", role = "tamu", userId = "", pesan = "" } = {}) {
  if (!isSupabaseConfigured()) return "";
  const bagian = [];
  const pilih = "code,title,status,priority,created_at,locations(name)";

  const tugas = [
    lacakKode(pesan, token).then((t) => t && bagian.push(t)),
    ringkasan(token)
      .then((t) => bagian.push(t))
      .catch(() => {}),
  ];

  if (role === "siswa" && userId) {
    tugas.push(
      ambil(`/rest/v1/reports?select=${pilih}&reporter_id=eq.${userId}&order=created_at.desc&limit=10`, { token })
        .then((rows) =>
          bagian.push(
            rows.length
              ? `Laporan milik pengguna ini (terbaru dulu):\n${rows.map(barisLaporan).join("\n")}`
              : "Pengguna ini belum pernah membuat laporan."
          )
        )
        .catch(() => {})
    );
  }

  if (role === "petugas") {
    tugas.push(
      ambil(
        `/rest/v1/reports?select=${pilih}&is_hidden=eq.false&status=in.(menunggu_verifikasi,diproses)&order=created_at.desc&limit=15`,
        { token }
      )
        .then((rows) =>
          bagian.push(
            rows.length
              ? `Antrean laporan yang belum selesai (terbaru dulu):\n${rows.map(barisLaporan).join("\n")}`
              : "Tidak ada laporan yang menunggu atau diproses."
          )
        )
        .catch(() => {})
    );
    if (userId) {
      tugas.push(
        ambil(`/rest/v1/reports?select=${pilih}&assigned_to=eq.${userId}&status=eq.diproses&order=created_at.desc&limit=10`, {
          token,
        })
          .then((rows) => rows.length && bagian.push(`Tugas yang sedang dipegang petugas ini:\n${rows.map(barisLaporan).join("\n")}`))
          .catch(() => {})
      );
    }
  }

  await Promise.all(tugas);
  if (!bagian.length) return "";
  return [
    "DATA FASTANGGAP SAAT INI (dari database, pakai ini untuk menjawab; jangan mengarang data lain; jangan tampilkan nama atau data pribadi orang lain):",
    ...bagian,
  ].join("\n\n");
}
