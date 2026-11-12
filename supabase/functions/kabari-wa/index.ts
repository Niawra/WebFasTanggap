// Edge Function "kabari-wa": dipanggil database (trigger reports_kabari_wa),
// lalu mengirim pesan WhatsApp lewat OpenWA.
//
//   baru     → semua petugas yang punya nomor: "Tugas baru, siapa cepat dia dapat"
//   diambil  → petugas lainnya: "FT-xxx sudah diambil Pak X" (biar tidak tabrakan)
//   selesai  → pelapor (kalau mengisi nomor): "Laporanmu sudah selesai"
//
// Secrets yang perlu diisi (supabase secrets set ...):
//   OPENWA_URL     mis. https://openwa-fastanggap.trycloudflare.com (tanpa / di akhir)
//   OPENWA_KEY     API key OpenWA (header X-API-Key)
//   OPENWA_SESI    id sesi WhatsApp di OpenWA
//   RAHASIA_WA     sama dengan kolom rahasia di tabel konfigurasi_wa
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const OPENWA_URL = (Deno.env.get("OPENWA_URL") ?? "").replace(/\/$/, "");
const OPENWA_KEY = Deno.env.get("OPENWA_KEY") ?? "";
const OPENWA_SESI = Deno.env.get("OPENWA_SESI") ?? "";
const RAHASIA = Deno.env.get("RAHASIA_WA") ?? "";

type Profil = { id: string; full_name: string | null; phone: string | null };

async function kirim(nomor: string, teks: string) {
  const res = await fetch(`${OPENWA_URL}/api/sessions/${OPENWA_SESI}/messages/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": OPENWA_KEY },
    body: JSON.stringify({ chatId: `${nomor}@c.us`, text: teks }),
  });
  if (!res.ok) console.error("OpenWA gagal", nomor, res.status, await res.text());
}

// Jeda kecil antar pesan supaya nomor bot tidak dianggap spam.
const jeda = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function kirimBanyak(tujuan: Profil[], teks: (p: Profil) => string) {
  for (const p of tujuan) {
    if (!p.phone) continue;
    await kirim(p.phone, teks(p));
    await jeda(1200);
  }
}

Deno.serve(async (req) => {
  if (!RAHASIA || req.headers.get("x-rahasia") !== RAHASIA) {
    return new Response("tidak diizinkan", { status: 401 });
  }
  const { jenis, report_id } = await req.json();

  const { data: r, error } = await sb
    .from("reports")
    .select("id, code, title, assigned_to, reporter_id, categories(name), locations(name)")
    .eq("id", report_id)
    .single();
  if (error || !r) return new Response("laporan tidak ditemukan", { status: 404 });

  const kode = r.code ?? r.id.slice(0, 8).toUpperCase();
  // deno-lint-ignore no-explicit-any
  const lokasi = (r.locations as any)?.name ?? "-";
  // deno-lint-ignore no-explicit-any
  const kategori = (r.categories as any)?.name ?? "-";

  const { data: petugas } = await sb
    .from("profiles")
    .select("id, full_name, phone")
    .eq("role", "petugas")
    .not("phone", "is", null);
  const daftarPetugas = (petugas ?? []) as Profil[];

  if (jenis === "baru") {
    await kirimBanyak(daftarPetugas, (p) =>
      [
        `🔧 *Tugas baru · ${kode}*`,
        r.title,
        `📍 ${lokasi} · ${kategori}`,
        "",
        `Halo ${p.full_name ?? "petugas"}, buka aplikasi FasTanggap lalu tekan *Ambil tugas*.`,
        "Petugas pertama yang mengambil akan menanganinya.",
      ].join("\n"),
    );
  } else if (jenis === "diambil") {
    const pengambil = daftarPetugas.find((p) => p.id === r.assigned_to);
    const nama = pengambil?.full_name ?? "petugas lain";
    await kirimBanyak(
      daftarPetugas.filter((p) => p.id !== r.assigned_to),
      () => `✅ *${kode} sudah diambil ${nama}.*\n${r.title}\n\nTidak perlu ditangani lagi.`,
    );
    if (pengambil?.phone) {
      await kirim(pengambil.phone, `👍 ${kode} sekarang tugasmu.\n${r.title}\n📍 ${lokasi}\n\nTandai selesai di aplikasi setelah diperbaiki.`);
    }
  } else if (jenis === "selesai") {
    const { data: pelapor } = await sb.from("profiles").select("id, full_name, phone").eq("id", r.reporter_id).single();
    if (pelapor?.phone) {
      await kirim(pelapor.phone, `🎉 Laporan *${kode}* sudah selesai ditangani.\n${r.title}\n\nTerima kasih sudah melapor lewat FasTanggap!`);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});
