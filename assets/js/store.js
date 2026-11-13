/*
 * store.js
 * Data FasTanggap dari Supabase.
 *
 * Tabel yang dipakai (sudah ada di project Supabase):
 *   profiles, reports, categories, locations,
 *   report_status_history, report_notes, storage "report-photos".
 * Ditambah lewat supabase/migrasi-website.sql:
 *   kolom reports.code, fungsi lacak_laporan() dan ringkasan_publik().
 *
 * Bacaan bersifat sinkron dari cache (cepat untuk menggambar halaman);
 * penulisan bersifat async dan memperbarui cache setelah berhasil.
 */

const STATUS = {
  menunggu: { label: "Menunggu verifikasi", nada: "tunggu", urut: 0 },
  diproses: { label: "Diproses", nada: "proses", urut: 1 },
  selesai: { label: "Selesai", nada: "selesai", urut: 2 },
  ditolak: { label: "Ditolak", nada: "tolak", urut: 3 },
};

const PRIORITAS = {
  rendah: { label: "Rendah", urut: 0 },
  sedang: { label: "Sedang", urut: 1 },
  tinggi: { label: "Tinggi", urut: 2 },
};

const KE_DB = { menunggu: "menunggu_verifikasi", diproses: "diproses", selesai: "selesai", ditolak: "ditolak" };
const dariDb = (s) => (s === "menunggu_verifikasi" ? "menunggu" : s);

// Contoh kerusakan per kategori (tabel categories belum punya kolom ini).
const CONTOH_KATEGORI = {
  ac: "AC tidak dingin, bocor, atau berisik",
  "kipas angin": "Baling-baling macet atau bergetar",
  lampu: "Lampu mati, berkedip, saklar rusak",
  meja: "Kaki patah, permukaan retak, baut lepas",
  kursi: "Sandaran patah, kaki goyang",
  proyektor: "Proyektor redup, kabel HDMI rusak",
  "papan tulis": "Permukaan rusak, sulit dihapus",
  "pintu / jendela": "Engsel lepas, kaca retak, kunci macet",
  toilet: "Kran bocor, flush tidak jalan, saluran mampet",
  lainnya: "Fasilitas lain di lingkungan sekolah",
};

const KONFIG = window.FASTANGGAP_SUPABASE || {};
const sb = window.supabase.createClient(KONFIG.url, KONFIG.anonKey);
const BUCKET = "report-photos";

let sesi = null;
const cache = {
  kategori: [], // {id, nama, contoh, aktif}
  lokasi: [], // {id, nama, aktif}
  laporan: [],
  publik: null,
  referensiSiap: false,
};

/* ---------- Pemuat ------------------------------------------------------- */

async function muatSesi() {
  const { data } = await sb.auth.getSession();
  const user = data.session && data.session.user;
  if (!user) {
    sesi = null;
    return;
  }
  const { data: profil } = await sb.from("profiles").select("id, full_name, role, class_name").eq("id", user.id).maybeSingle();
  sesi = {
    id: user.id,
    email: user.email,
    nama: (profil && profil.full_name) || user.email.split("@")[0],
    peran: (profil && profil.role) || "siswa",
    kelas: (profil && profil.class_name) || "",
  };
}

async function muatReferensi() {
  // Pengunjung belum login tidak bisa membaca tabel, jadi pakai daftar dari ringkasan publik.
  if (!sesi) {
    const pub = cache.publik || (await muatPublik());
    cache.kategori = ((pub && pub.kategori) || []).map((k) => ({
      id: k.id,
      nama: k.name,
      contoh: CONTOH_KATEGORI[k.name.toLowerCase()] || "",
      aktif: true,
    }));
    cache.lokasi = [];
    return;
  }
  const [kat, lok] = await Promise.all([
    sb.from("categories").select("id, name, is_active").order("name"),
    sb.from("locations").select("id, name, is_active").order("name"),
  ]);
  cache.kategori = (kat.data || []).map((k) => ({
    id: k.id,
    nama: k.name,
    contoh: CONTOH_KATEGORI[k.name.toLowerCase()] || "Belum ada contoh",
    aktif: k.is_active,
  }));
  cache.lokasi = (lok.data || []).map((l) => ({ id: l.id, nama: l.name, aktif: l.is_active }));
  cache.referensiSiap = true;
}

async function muatPublik() {
  const { data, error } = await sb.rpc("ringkasan_publik");
  if (error) {
    console.warn("[FasTanggap] ringkasan publik gagal", error);
    return cache.publik;
  }
  cache.publik = data;
  return data;
}

function susunRiwayat(dibuat, pelaporNama, riwayat, catatan, namaDari) {
  const hasil = [{ waktu: dibuat, status: "menunggu", catatan: "Laporan dikirim dan menunggu pemeriksaan petugas.", oleh: pelaporNama || "Pelapor" }];
  const sisaCatatan = catatan.slice();
  riwayat.forEach((h) => {
    const waktu = new Date(h.created_at).getTime();
    // Catatan yang ditulis bersamaan dengan perubahan status digabung ke baris yang sama.
    const i = sisaCatatan.findIndex((c) => Math.abs(new Date(c.created_at).getTime() - waktu) < 15000);
    const pasangan = i >= 0 ? sisaCatatan.splice(i, 1)[0] : null;
    hasil.push({
      waktu: h.created_at,
      status: dariDb(h.new_status),
      catatan: (pasangan && pasangan.note) || h.note || `Status diubah menjadi ${STATUS[dariDb(h.new_status)].label}.`,
      oleh: namaDari(h.changed_by),
    });
  });
  sisaCatatan.forEach((c) => {
    const sebelum = hasil.filter((r) => new Date(r.waktu) <= new Date(c.created_at)).pop();
    hasil.push({ waktu: c.created_at, status: sebelum ? sebelum.status : "menunggu", catatan: c.note, oleh: namaDari(c.author_id) });
  });
  return hasil.sort((a, b) => new Date(a.waktu) - new Date(b.waktu));
}

async function muatLaporan() {
  if (!sesi) {
    cache.laporan = [];
    return;
  }
  const { data: baris, error } = await sb
    .from("reports")
    .select("*, categories(name), locations(name)")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[FasTanggap] gagal memuat laporan", error);
    return;
  }
  const ids = baris.map((r) => r.id);
  const [riw, cat, prof, foto] = await Promise.all([
    ids.length ? sb.from("report_status_history").select("*").in("report_id", ids).order("created_at") : { data: [] },
    ids.length ? sb.from("report_notes").select("*").in("report_id", ids).order("created_at") : { data: [] },
    sb.from("profiles").select("id, full_name, class_name, role"),
    (async () => {
      const jalur = baris.map((r) => r.photo_path).filter(Boolean);
      if (!jalur.length) return {};
      const { data } = await sb.storage.from(BUCKET).createSignedUrls(jalur, 3600);
      const peta = {};
      (data || []).forEach((d) => {
        if (d.signedUrl) peta[d.path] = d.signedUrl;
      });
      return peta;
    })(),
  ]);
  const profil = {};
  (prof.data || []).forEach((p) => (profil[p.id] = p));
  const namaDari = (id) => (profil[id] && profil[id].full_name) || "Petugas sarana";

  cache.laporan = baris.map((r) => {
    const pelapor = profil[r.reporter_id];
    const pelaporNama = (pelapor && pelapor.full_name) || (sesi && sesi.id === r.reporter_id ? sesi.nama : "Siswa");
    return {
      id: r.id,
      kode: r.code || r.id.slice(0, 8).toUpperCase(),
      judul: r.title,
      kategoriId: r.category_id,
      lokasiId: r.location_id,
      lokasi: (r.locations && r.locations.name) || "",
      deskripsi: r.description,
      foto: (r.photo_path && foto[r.photo_path]) || "",
      prioritas: r.priority || "",
      status: dariDb(r.status),
      dibuat: r.created_at,
      pelaporId: r.reporter_id,
      pelaporNama,
      pelaporKelas: (pelapor && pelapor.class_name) || "",
      riwayat: susunRiwayat(
        r.created_at,
        pelaporNama,
        (riw.data || []).filter((h) => h.report_id === r.id),
        (cat.data || []).filter((c) => c.report_id === r.id),
        namaDari
      ),
    };
  });
}

function dataUrlKeBlob(dataUrl) {
  const [kepala, isi] = dataUrl.split(",");
  const tipe = kepala.match(/:(.*?);/)[1];
  const biner = atob(isi);
  const larik = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) larik[i] = biner.charCodeAt(i);
  return new Blob([larik], { type: tipe });
}

const pesanGalat = (g, cadangan) => {
  if (!g) return cadangan;
  if (g.code === "23503") return "Data ini masih dipakai laporan yang ada.";
  if (g.code === "23505") return "Data dengan nama itu sudah ada.";
  if (g.code === "42501") return "Akunmu tidak punya izin untuk tindakan ini.";
  return cadangan;
};

/* ---------- API untuk app.js -------------------------------------------- */

const Store = {
  terhubung: true,

  // Dipanggil sekali saat halaman dibuka.
  async siapkan() {
    await muatSesi();
    await Promise.all([muatPublik(), muatLaporan()]);
    await muatReferensi();
    return true;
  },

  // Dipanggil setiap pindah halaman supaya data selalu terbaru.
  async segarkan(jalur) {
    const tugas = [];
    if (jalur === "/" || !sesi) tugas.push(muatPublik());
    if (sesi) tugas.push(muatLaporan());
    if (sesi && (!cache.referensiSiap || jalur === "/petugas/kategori")) tugas.push(muatReferensi());
    await Promise.all(tugas);
    if (!sesi) await muatReferensi();
  },

  /* --- baca --- */
  sesi() {
    return sesi;
  },
  semuaLaporan() {
    return cache.laporan.slice();
  },
  laporanMilik(idPengguna) {
    return cache.laporan.filter((l) => l.pelaporId === idPengguna);
  },
  cariKode(kode) {
    const bersih = String(kode || "").trim().toUpperCase();
    return cache.laporan.find((l) => l.kode === bersih) || null;
  },
  kategori() {
    return cache.kategori.filter((k) => k.aktif);
  },
  lokasi() {
    return cache.lokasi.filter((l) => l.aktif).map((l) => l.nama);
  },
  ringkasan() {
    if (sesi && sesi.peran === "petugas") {
      const s = cache.laporan;
      return {
        total: s.length,
        menunggu: s.filter((l) => l.status === "menunggu").length,
        diproses: s.filter((l) => l.status === "diproses").length,
        selesai: s.filter((l) => l.status === "selesai").length,
        ditolak: s.filter((l) => l.status === "ditolak").length,
      };
    }
    const p = cache.publik || {};
    return { total: p.total || 0, menunggu: p.menunggu || 0, diproses: p.diproses || 0, selesai: p.selesai || 0, ditolak: p.ditolak || 0 };
  },
  // Data untuk beranda: dibaca dari fungsi publik, jadi tampil juga untuk pengunjung.
  beranda() {
    const p = cache.publik || {};
    return {
      r: this.ringkasan(),
      jumlahPer: p.per_kategori || {},
      terbaru: (p.terbaru || []).map((t) => ({
        kode: t.code,
        judul: t.title,
        kategoriId: t.category_id,
        lokasi: t.location,
        status: dariDb(t.status),
        dibuat: t.created_at,
      })),
    };
  },
  async cariKodeJauh(kode) {
    const lokal = this.cariKode(kode);
    if (lokal) return lokal;
    const { data, error } = await sb.rpc("lacak_laporan", { p_kode: String(kode || "") });
    if (error || !data) return null;
    const kat = cache.kategori.find((k) => k.nama === data.category);
    return {
      kode: data.code,
      judul: data.title,
      kategoriId: kat ? kat.id : "",
      kategoriNama: data.category,
      lokasi: data.location,
      deskripsi: data.description,
      foto: "",
      prioritas: data.priority || "",
      status: dariDb(data.status),
      dibuat: data.created_at,
      pelaporId: null,
      pelaporNama: "Disembunyikan",
      pelaporKelas: "",
      publik: true,
      riwayat: susunRiwayat(data.created_at, "Pelapor", data.history.map((h) => ({ ...h, new_status: h.status })), data.notes, () => "Petugas sarana"),
    };
  },

  /* --- akun --- */
  async masuk(email, sandi) {
    const { error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password: sandi });
    if (error) return { ok: false, pesan: "Email atau kata sandi tidak cocok." };
    await muatSesi();
    cache.referensiSiap = false;
    await Promise.all([muatLaporan(), muatReferensi()]);
    return { ok: true, pengguna: sesi };
  },
  async daftar({ nama, kelas, email, sandi }) {
    const { data, error } = await sb.auth.signUp({
      email: String(email).trim(),
      password: sandi,
      options: { data: { full_name: nama.trim() } },
    });
    if (error) {
      const sudah = /registered|exists/i.test(error.message);
      return { ok: false, pesan: sudah ? "Email itu sudah terdaftar. Coba masuk." : `Pendaftaran gagal: ${error.message}` };
    }
    if (!data.session) {
      const masuk = await sb.auth.signInWithPassword({ email: String(email).trim(), password: sandi });
      if (masuk.error) return { ok: false, pesan: "Akun dibuat, tetapi belum bisa masuk. Coba lagi dari halaman Masuk." };
    }
    const { data: u } = await sb.auth.getUser();
    await sb.from("profiles").update({ full_name: nama.trim(), class_name: kelas.trim() }).eq("id", u.user.id);
    await muatSesi();
    cache.referensiSiap = false;
    await Promise.all([muatLaporan(), muatReferensi()]);
    return { ok: true, pengguna: sesi };
  },
  /* ---- Chat per laporan ---- */
  async muatChat(laporanId) {
    const { data, error } = await sb
      .from("report_messages")
      .select("id, sender_id, body, created_at")
      .eq("report_id", laporanId)
      .order("created_at");
    if (error) return [];
    const ids = [...new Set(data.map((m) => m.sender_id))];
    const prof = ids.length ? await sb.from("profiles").select("id, full_name, role").in("id", ids) : { data: [] };
    const p = {};
    (prof.data || []).forEach((x) => (p[x.id] = x));
    return data.map((m) => Store.bentukPesan(m, p[m.sender_id]));
  },
  bentukPesan(m, profil) {
    return {
      id: m.id,
      milikku: sesi && m.sender_id === sesi.id,
      nama: (profil && profil.full_name) || (sesi && m.sender_id === sesi.id ? sesi.nama : "Petugas"),
      petugas: profil ? profil.role === "petugas" : false,
      isi: m.body,
      waktu: m.created_at,
    };
  },
  async kirimChat(laporanId, isi) {
    const { error } = await sb.from("report_messages").insert({ report_id: laporanId, sender_id: sesi.id, body: isi.trim() });
    if (error) throw new Error(pesanGalat(error));
  },
  dengarChat(laporanId, saatMasuk) {
    const kanal = sb
      .channel("chat-" + laporanId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "report_messages", filter: `report_id=eq.${laporanId}` }, async (e) => {
        const { data } = await sb.from("profiles").select("id, full_name, role").eq("id", e.new.sender_id).maybeSingle();
        saatMasuk(Store.bentukPesan(e.new, data));
      })
      .subscribe();
    return () => sb.removeChannel(kanal);
  },
  async keluar() {
    await sb.auth.signOut();
    sesi = null;
    cache.laporan = [];
    cache.referensiSiap = false;
    await muatReferensi();
  },

  /* --- laporan --- */
  async tambahLaporan(masukan) {
    if (!sesi) return { ok: false, pesan: "Masuk dulu untuk mengirim laporan." };
    const lok = cache.lokasi.find((l) => l.nama === masukan.lokasi);
    if (!lok) return { ok: false, pesan: "Lokasi tidak dikenal. Pilih dari daftar." };
    let photo_path = null;
    if (masukan.foto) {
      photo_path = `${sesi.id}/${crypto.randomUUID()}.jpg`;
      const unggah = await sb.storage.from(BUCKET).upload(photo_path, dataUrlKeBlob(masukan.foto), { contentType: "image/jpeg" });
      if (unggah.error) return { ok: false, pesan: "Foto gagal diunggah. Coba kirim tanpa foto." };
    }
    const { data, error } = await sb
      .from("reports")
      .insert({
        reporter_id: sesi.id,
        category_id: masukan.kategoriId,
        location_id: lok.id,
        title: masukan.judul.trim(),
        description: masukan.deskripsi.trim(),
        photo_path,
      })
      .select("code")
      .single();
    if (error) return { ok: false, pesan: pesanGalat(error, "Laporan gagal dikirim. Coba lagi.") };
    await Promise.all([muatLaporan(), muatPublik()]);
    return { ok: true, laporan: this.cariKode(data.code) || { kode: data.code } };
  },

  async ubahStatus(kode, status, catatan, prioritas) {
    const laporan = this.cariKode(kode);
    if (!laporan) return { ok: false, pesan: "Laporan tidak ditemukan." };
    if (status && !STATUS[status]) return { ok: false, pesan: "Status tidak dikenal." };
    const ubah = { priority: prioritas || laporan.prioritas || null };
    if (status) ubah.status = KE_DB[status];
    if (status === "ditolak") ubah.rejection_reason = catatan.trim();
    const { error } = await sb.from("reports").update(ubah).eq("id", laporan.id);
    if (error) return { ok: false, pesan: pesanGalat(error, "Gagal menyimpan perubahan.") };
    if (status !== "ditolak") {
      const n = await sb.from("report_notes").insert({ report_id: laporan.id, author_id: sesi.id, note: catatan.trim() });
      if (n.error) return { ok: false, pesan: pesanGalat(n.error, "Status tersimpan, tetapi catatan gagal disimpan.") };
    }
    await Promise.all([muatLaporan(), muatPublik()]);
    return { ok: true, laporan: this.cariKode(kode) };
  },

  /* --- kategori & lokasi (petugas) --- */
  async tambahKategori(nama) {
    const bersih = nama.trim();
    if (!bersih) return { ok: false, pesan: "Nama kategori belum diisi." };
    if (cache.kategori.some((k) => k.nama.toLowerCase() === bersih.toLowerCase())) return { ok: false, pesan: "Kategori itu sudah ada." };
    const { error } = await sb.from("categories").insert({ name: bersih });
    if (error) return { ok: false, pesan: pesanGalat(error, "Kategori gagal ditambahkan.") };
    await muatReferensi();
    return { ok: true };
  },
  async hapusKategori(id) {
    const { error } = await sb.from("categories").delete().eq("id", id);
    if (error) return { ok: false, pesan: pesanGalat(error, "Kategori gagal dihapus.") };
    await muatReferensi();
    return { ok: true };
  },
  async tambahLokasi(nama) {
    const bersih = nama.trim();
    if (!bersih) return { ok: false, pesan: "Nama lokasi belum diisi." };
    if (cache.lokasi.some((l) => l.nama.toLowerCase() === bersih.toLowerCase())) return { ok: false, pesan: "Lokasi itu sudah ada." };
    const { error } = await sb.from("locations").insert({ name: bersih });
    if (error) return { ok: false, pesan: pesanGalat(error, "Lokasi gagal ditambahkan.") };
    await muatReferensi();
    return { ok: true };
  },
  async hapusLokasi(nama) {
    const lok = cache.lokasi.find((l) => l.nama === nama);
    if (!lok) return { ok: false, pesan: "Lokasi tidak ditemukan." };
    const { error } = await sb.from("locations").delete().eq("id", lok.id);
    if (error) return { ok: false, pesan: pesanGalat(error, "Lokasi gagal dihapus.") };
    await muatReferensi();
    return { ok: true };
  },

  // Tombol demo di dasbor petugas: mengirim 5 laporan contoh atas nama petugas.
  async muatContoh() {
    if (!sesi) return { ok: false, pesan: "Masuk dulu." };
    const cariKat = (kata) => (cache.kategori.find((k) => k.nama.toLowerCase().includes(kata)) || cache.kategori[0]).id;
    const cariLok = (kata) => (cache.lokasi.find((l) => l.nama.toLowerCase().includes(kata)) || cache.lokasi[0]).id;
    const contoh = [
      ["AC ruang kelas tidak dingin sejak Senin", "AC menyala tetapi anginnya hangat. Suhu kelas naik menjelang siang.", "ac", "kelas", "diproses", "tinggi"],
      ["Dua kaki meja di baris belakang patah", "Meja goyang dan tidak bisa dipakai menulis. Salah satu kaki sudah lepas.", "meja", "kelas", null, null],
      ["Proyektor lab warnanya kemerahan", "Gambar proyektor didominasi warna merah walau kabel sudah diganti.", "proyektor", "lab", "selesai", "sedang"],
      ["Kran wastafel toilet bocor terus", "Air menetes tanpa henti walau kran sudah ditutup rapat.", "toilet", "toilet", null, null],
      ["Lampu perpustakaan mati satu baris", "Satu baris lampu di sisi jendela tidak menyala.", "lampu", "perpus", "ditolak", null],
    ];
    for (const [title, description, kat, lok, status, priority] of contoh) {
      const { data, error } = await sb
        .from("reports")
        .insert({ reporter_id: sesi.id, category_id: cariKat(kat), location_id: cariLok(lok), title, description })
        .select("id")
        .single();
      if (error) return { ok: false, pesan: pesanGalat(error, "Laporan contoh gagal dibuat.") };
      if (status) {
        await sb
          .from("reports")
          .update({ status, priority, rejection_reason: status === "ditolak" ? "Sudah dijadwalkan dalam pekerjaan perbaikan lain." : null })
          .eq("id", data.id);
      }
    }
    await Promise.all([muatLaporan(), muatPublik()]);
    return { ok: true };
  },
};

// Sesi login berubah di tab lain atau token diperbarui.
sb.auth.onAuthStateChange((peristiwa) => {
  if (peristiwa === "SIGNED_OUT") sesi = null;
});
