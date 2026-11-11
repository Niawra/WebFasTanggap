/*
 * store.js
 * Penyimpanan data FasTanggap.
 * Semua data disimpan di localStorage browser, belum ada server.
 */

const KUNCI = "fastanggap.v1";

const KATEGORI_AWAL = [
  { id: "ac", nama: "AC dan pendingin", contoh: "AC tidak dingin, bocor, atau berisik" },
  { id: "kipas", nama: "Kipas angin", contoh: "Baling-baling macet atau bergetar" },
  { id: "lampu", nama: "Lampu dan listrik", contoh: "Lampu mati, saklar rusak, stopkontak longgar" },
  { id: "meja", nama: "Meja dan kursi", contoh: "Kaki patah, permukaan retak, baut lepas" },
  { id: "proyektor", nama: "Proyektor dan layar", contoh: "Proyektor redup, kabel HDMI rusak" },
  { id: "komputer", nama: "Komputer dan jaringan", contoh: "PC lab tidak menyala, jaringan putus" },
  { id: "pintu", nama: "Pintu dan jendela", contoh: "Engsel lepas, kaca retak, kunci macet" },
  { id: "toilet", nama: "Toilet dan air", contoh: "Kran bocor, flush tidak jalan, saluran mampet" },
  { id: "lain", nama: "Fasilitas lain", contoh: "Papan tulis, gorden, tempat sampah" },
];

const LOKASI_AWAL = [
  "Ruang kelas XI PPLG 4",
  "Lab Komputer 1",
  "Lab Komputer 2",
  "Ruang guru",
  "Perpustakaan",
  "Toilet lantai 2",
  "Kantin",
  "Aula",
  "Lapangan",
];

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

function dataAwal() {
  return {
    pengguna: [
      { id: "u-siswa", nama: "Siswa Demo", namaPengguna: "siswa", sandi: "siswa123", peran: "siswa", kelas: "XI PPLG 4" },
      { id: "u-petugas", nama: "Petugas Sarana", namaPengguna: "petugas", sandi: "petugas123", peran: "petugas", kelas: "" },
    ],
    laporan: [],
    kategori: KATEGORI_AWAL.map((k) => ({ ...k })),
    lokasi: [...LOKASI_AWAL],
    urutan: 0,
  };
}

let db = null;

function muat() {
  if (db) return db;
  try {
    const mentah = localStorage.getItem(KUNCI);
    db = mentah ? JSON.parse(mentah) : dataAwal();
  } catch (galat) {
    db = dataAwal();
  }
  if (!Array.isArray(db.laporan)) db = dataAwal();
  return db;
}

function simpan() {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(db));
    return true;
  } catch (galat) {
    // Kuota penuh biasanya karena foto terlalu besar.
    return false;
  }
}

function kodeBaru() {
  const d = new Date();
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  db.urutan = (db.urutan || 0) + 1;
  return `FT-${String(d.getFullYear()).slice(2)}${bulan}-${String(db.urutan).padStart(3, "0")}`;
}

const Store = {
  semuaLaporan() {
    return muat().laporan.slice().sort((a, b) => new Date(b.dibuat) - new Date(a.dibuat));
  },

  laporanMilik(idPengguna) {
    return this.semuaLaporan().filter((l) => l.pelaporId === idPengguna);
  },

  cariKode(kode) {
    const bersih = String(kode || "").trim().toUpperCase();
    return muat().laporan.find((l) => l.kode === bersih) || null;
  },

  kategori() {
    return muat().kategori;
  },

  lokasi() {
    return muat().lokasi;
  },

  tambahLaporan(masukan, pengguna) {
    const laporan = {
      kode: kodeBaru(),
      judul: masukan.judul.trim(),
      kategoriId: masukan.kategoriId,
      lokasi: masukan.lokasi,
      deskripsi: masukan.deskripsi.trim(),
      foto: masukan.foto || "",
      prioritas: "",
      status: "menunggu",
      dibuat: new Date().toISOString(),
      pelaporId: pengguna.id,
      pelaporNama: pengguna.nama,
      pelaporKelas: pengguna.kelas,
      riwayat: [
        {
          waktu: new Date().toISOString(),
          status: "menunggu",
          catatan: "Laporan dikirim dan menunggu pemeriksaan petugas.",
          oleh: pengguna.nama,
        },
      ],
    };
    db.laporan.unshift(laporan);
    if (!simpan()) {
      db.laporan.shift();
      return { ok: false, pesan: "Penyimpanan browser penuh. Coba kirim tanpa foto atau dengan foto yang lebih kecil." };
    }
    return { ok: true, laporan };
  },

  ubahStatus(kode, status, catatan, prioritas, oleh) {
    const laporan = muat().laporan.find((l) => l.kode === kode);
    if (!laporan) return { ok: false, pesan: "Laporan tidak ditemukan." };
    if (status && !STATUS[status]) return { ok: false, pesan: "Status tidak dikenal." };
    if (status) laporan.status = status;
    if (prioritas) laporan.prioritas = prioritas;
    laporan.riwayat.push({
      waktu: new Date().toISOString(),
      status: laporan.status,
      catatan: catatan.trim(),
      oleh,
    });
    if (!simpan()) return { ok: false, pesan: "Gagal menyimpan perubahan." };
    return { ok: true, laporan };
  },

  tambahKategori(nama, contoh) {
    const bersih = nama.trim();
    if (!bersih) return { ok: false, pesan: "Nama kategori belum diisi." };
    const ada = muat().kategori.some((k) => k.nama.toLowerCase() === bersih.toLowerCase());
    if (ada) return { ok: false, pesan: "Kategori itu sudah ada." };
    db.kategori.push({ id: `k-${Date.now()}`, nama: bersih, contoh: (contoh || "").trim() || "Belum ada contoh" });
    simpan();
    return { ok: true };
  },

  hapusKategori(id) {
    const dipakai = muat().laporan.some((l) => l.kategoriId === id);
    if (dipakai) return { ok: false, pesan: "Kategori ini masih dipakai laporan yang ada." };
    db.kategori = db.kategori.filter((k) => k.id !== id);
    simpan();
    return { ok: true };
  },

  tambahLokasi(nama) {
    const bersih = nama.trim();
    if (!bersih) return { ok: false, pesan: "Nama lokasi belum diisi." };
    if (muat().lokasi.some((l) => l.toLowerCase() === bersih.toLowerCase())) {
      return { ok: false, pesan: "Lokasi itu sudah ada." };
    }
    db.lokasi.push(bersih);
    simpan();
    return { ok: true };
  },

  hapusLokasi(nama) {
    const dipakai = muat().laporan.some((l) => l.lokasi === nama);
    if (dipakai) return { ok: false, pesan: "Lokasi ini masih dipakai laporan yang ada." };
    db.lokasi = db.lokasi.filter((l) => l !== nama);
    simpan();
    return { ok: true };
  },

  masuk(namaPengguna, sandi) {
    const orang = muat().pengguna.find(
      (p) => p.namaPengguna.toLowerCase() === String(namaPengguna).trim().toLowerCase() && p.sandi === sandi
    );
    if (!orang) return { ok: false, pesan: "Nama pengguna atau kata sandi tidak cocok." };
    sesi = { id: orang.id, nama: orang.nama, peran: orang.peran, kelas: orang.kelas, namaPengguna: orang.namaPengguna };
    try {
      localStorage.setItem(`${KUNCI}.sesi`, JSON.stringify(sesi));
    } catch (galat) {
      /* sesi tetap jalan di memori */
    }
    return { ok: true, pengguna: sesi };
  },

  keluar() {
    sesi = null;
    localStorage.removeItem(`${KUNCI}.sesi`);
  },

  sesi() {
    return sesi;
  },

  ringkasan() {
    const semua = muat().laporan;
    return {
      total: semua.length,
      menunggu: semua.filter((l) => l.status === "menunggu").length,
      diproses: semua.filter((l) => l.status === "diproses").length,
      selesai: semua.filter((l) => l.status === "selesai").length,
      ditolak: semua.filter((l) => l.status === "ditolak").length,
    };
  },

  muatContoh() {
    const contoh = [
      {
        judul: "AC ruang kelas tidak dingin sejak Senin",
        kategoriId: "ac",
        lokasi: "Ruang kelas XI PPLG 4",
        deskripsi: "AC menyala tetapi anginnya hangat. Suhu kelas naik menjelang siang dan siswa kepanasan saat pelajaran produktif.",
        status: "diproses",
        prioritas: "tinggi",
        hari: 3,
      },
      {
        judul: "Dua kaki meja di baris belakang patah",
        kategoriId: "meja",
        lokasi: "Ruang kelas XI PPLG 4",
        deskripsi: "Meja goyang dan tidak bisa dipakai menulis. Salah satu kaki sudah lepas dari rangkanya.",
        status: "menunggu",
        prioritas: "",
        hari: 1,
      },
      {
        judul: "Proyektor Lab Komputer 1 warnanya kemerahan",
        kategoriId: "proyektor",
        lokasi: "Lab Komputer 1",
        deskripsi: "Gambar proyektor didominasi warna merah. Kabel sudah diganti tetapi hasilnya sama.",
        status: "selesai",
        prioritas: "sedang",
        hari: 9,
      },
      {
        judul: "Kran wastafel toilet lantai 2 bocor terus",
        kategoriId: "toilet",
        lokasi: "Toilet lantai 2",
        deskripsi: "Air menetes tanpa henti walau kran sudah ditutup rapat. Lantai sekitar wastafel selalu basah.",
        status: "menunggu",
        prioritas: "",
        hari: 0,
      },
      {
        judul: "Lampu ruang perpustakaan mati satu baris",
        kategoriId: "lampu",
        lokasi: "Perpustakaan",
        deskripsi: "Satu baris lampu di sisi jendela tidak menyala. Bagian meja baca jadi gelap pada sore hari.",
        status: "ditolak",
        prioritas: "",
        hari: 6,
      },
    ];
    const siswa = muat().pengguna.find((p) => p.peran === "siswa");
    const petugas = muat().pengguna.find((p) => p.peran === "petugas");
    contoh.forEach((c) => {
      const waktu = new Date(Date.now() - c.hari * 86400000).toISOString();
      db.urutan = (db.urutan || 0) + 1;
      const d = new Date(waktu);
      const laporan = {
        kode: `FT-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-${String(db.urutan).padStart(3, "0")}`,
        judul: c.judul,
        kategoriId: c.kategoriId,
        lokasi: c.lokasi,
        deskripsi: c.deskripsi,
        foto: "",
        prioritas: c.prioritas,
        status: c.status,
        dibuat: waktu,
        pelaporId: siswa.id,
        pelaporNama: siswa.nama,
        pelaporKelas: siswa.kelas,
        riwayat: [
          { waktu, status: "menunggu", catatan: "Laporan dikirim dan menunggu pemeriksaan petugas.", oleh: siswa.nama },
        ],
      };
      if (c.status !== "menunggu") {
        laporan.riwayat.push({
          waktu: new Date(new Date(waktu).getTime() + 3600000).toISOString(),
          status: c.status,
          catatan:
            c.status === "ditolak"
              ? "Lampu sudah dijadwalkan diganti minggu lalu, laporan ini digabung ke pekerjaan yang sama."
              : c.status === "selesai"
              ? "Komponen sudah diganti dan alat diuji kembali."
              : "Laporan diperiksa, kerusakan sesuai. Teknisi dijadwalkan ke lokasi.",
          oleh: petugas.nama,
        });
      }
      db.laporan.push(laporan);
    });
    simpan();
    return { ok: true };
  },

  reset() {
    db = dataAwal();
    simpan();
  },
};

let sesi = null;
try {
  const tersimpan = localStorage.getItem(`${KUNCI}.sesi`);
  if (tersimpan) sesi = JSON.parse(tersimpan);
} catch (galat) {
  sesi = null;
}
