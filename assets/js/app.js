/*
 * app.js
 * Tampilan dan navigasi FasTanggap.
 */

const akar = document.querySelector("#konten");
const navigasi = document.querySelector("#navigasi");
const navigasiAksi = document.querySelector("#navigasiAksi");
const menuTombol = document.querySelector("#menuTombol");
const toastEl = document.querySelector("#toast");

let waktuToast = 0;

/* ---------- Bantuan kecil ------------------------------------------------ */

function esc(nilai) {
  return String(nilai == null ? "" : nilai)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tanggal(iso, denganJam) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const opsi = { day: "numeric", month: "short", year: "numeric" };
  if (denganJam) {
    opsi.hour = "2-digit";
    opsi.minute = "2-digit";
  }
  return d.toLocaleDateString("id-ID", opsi).replace(/\./g, ":");
}

function relatif(iso) {
  const selisih = Date.now() - new Date(iso).getTime();
  const menit = Math.round(selisih / 60000);
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.round(jam / 24);
  if (hari < 30) return `${hari} hari lalu`;
  return tanggal(iso);
}

function namaKategori(id) {
  const k = Store.kategori().find((item) => item.id === id);
  return k ? k.nama : "Kategori lain";
}

function statusPil(status) {
  const s = STATUS[status] || STATUS.menunggu;
  return `<span class="status" data-nada="${s.nada}">${esc(s.label)}</span>`;
}

function toast(pesan, jenis) {
  toastEl.textContent = pesan;
  toastEl.dataset.jenis = jenis || "info";
  toastEl.classList.add("tampil");
  clearTimeout(waktuToast);
  waktuToast = setTimeout(() => toastEl.classList.remove("tampil"), 4200);
}

/* ---------- Bilah atas --------------------------------------------------- */

function gambarAksi() {
  const sesi = Store.sesi();
  if (!sesi) {
    navigasiAksi.innerHTML = `
      <a class="tombol tombol--garis tombol--kecil" href="#/daftar">Daftar</a>
      <a class="tombol tombol--utama tombol--kecil" href="#/masuk">Masuk</a>`;
    return;
  }
  const tujuan = sesi.peran === "petugas" ? "#/petugas" : "#/laporan";
  const label = sesi.peran === "petugas" ? "Dasbor petugas" : "Laporan saya";
  navigasiAksi.innerHTML = `
    <span class="navigasi__siapa" title="${esc(sesi.nama)}">${esc(sesi.nama)}</span>
    <a class="tombol tombol--garis tombol--kecil" href="${tujuan}">${label}</a>
    <button class="tombol tombol--teks tombol--kecil" type="button" id="keluarTombol">Keluar</button>`;
  document.querySelector("#keluarTombol").addEventListener("click", () => {
    Store.keluar();
    gambarAksi();
    toast("Kamu sudah keluar.");
    location.hash = "#/";
  });
}

function tandaiRute(rute) {
  document.querySelectorAll(".navigasi > a[data-rute]").forEach((a) => {
    if (a.dataset.rute === rute) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function tutupMenu() {
  navigasi.classList.remove("terbuka");
  menuTombol.setAttribute("aria-expanded", "false");
  menuTombol.setAttribute("aria-label", "Buka menu");
}

menuTombol.addEventListener("click", () => {
  const terbuka = navigasi.classList.toggle("terbuka");
  menuTombol.setAttribute("aria-expanded", String(terbuka));
  menuTombol.setAttribute("aria-label", terbuka ? "Tutup menu" : "Buka menu");
});

navigasi.addEventListener("click", (e) => {
  if (e.target.closest("a")) tutupMenu();
});

/* ---------- Ikon garis sederhana --------------------------------------- */

const IKON = {
  ac: '<rect x="3" y="5" width="18" height="8" rx="2"/><path d="M6 10h12M7 17v2M12 17v3M17 17v2"/>',
  kipas: '<circle cx="12" cy="10" r="1.6"/><path d="M12 8.4c-.3-3.6 3.6-4.6 3.8-2.2.2 2-2 3.1-3.8 3.8M13.4 11c3.3 1.6 2.3 5.4.1 4.3-1.8-.9-1.6-3.4-1.5-5.3M10.6 10.7c-3.3 1.5-5.6-1.7-3.4-3 1.8-1 3.5.9 4.8 2.3M12 12v8M8 20h8"/>',
  lampu: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  meja: '<path d="M3 9h18M5 9v11M19 9v11M3 14h18M8 9V5h8v4"/>',
  proyektor: '<rect x="2" y="8" width="20" height="9" rx="2"/><circle cx="16" cy="12.5" r="2.5"/><path d="M6 12h4M5 20h2M17 20h2"/>',
  komputer: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  pintu: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="14.5" cy="12" r="1"/>',
  toilet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  lain: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  tulis: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 12v6M9 15h6"/>',
  cari: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  daftar: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  perisai: '<path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
};

function ikon(nama, kelas) {
  return `<svg class="${kelas || "ikon"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKON[nama] || IKON.lain}</svg>`;
}

/* ---------- Halaman: beranda -------------------------------------------- */

const FAQ = [
  ["Siapa saja yang bisa membuat laporan?", "Semua siswa yang punya akun FasTanggap. Kalau belum punya, kamu bisa mendaftar sendiri lewat halaman Daftar dengan nama dan kelasmu."],
  ["Apakah foto wajib dilampirkan?", "Tidak. Foto membantu petugas memahami kerusakan lebih cepat, tetapi laporan tetap bisa dikirim tanpa foto. Foto otomatis diperkecil sebelum disimpan."],
  ["Bagaimana cara mengetahui laporanku sudah ditangani?", "Setiap laporan mendapat nomor seperti FT-2611-001. Masukkan nomor itu di halaman Lacak laporan, atau buka menu Laporan saya setelah masuk."],
  ["Kenapa laporanku ditolak?", "Petugas menolak laporan yang tidak sesuai dengan kondisi di lokasi atau sudah tercatat di laporan lain. Alasan penolakan selalu tertulis di riwayat laporan."],
  ["Berapa lama laporan diproses?", "Tergantung prioritas dan jenis kerusakan. Prioritas ditetapkan petugas setelah memeriksa laporan, dan setiap perubahan status tercatat lengkap dengan waktunya."],
];

const LANGKAH = [
  { judul: "Kirim laporan", isi: "Pilih kategori, tulis lokasi dan keterangan, lampirkan foto bila ada. Nomor laporan langsung keluar.", status: "menunggu", catatan: "Laporan dikirim dan menunggu pemeriksaan petugas." },
  { judul: "Diverifikasi petugas", isi: "Petugas sarana mencocokkan laporan dengan kondisi di lokasi, lalu menetapkan prioritas.", status: "menunggu", catatan: "Laporan diperiksa. Prioritas: tinggi." },
  { judul: "Diproses teknisi", isi: "Teknisi dijadwalkan ke lokasi. Laporan yang tidak sesuai ditolak beserta alasannya.", status: "diproses", catatan: "Teknisi dijadwalkan Kamis pagi." },
  { judul: "Selesai & tercatat", isi: "Laporan ditutup. Riwayat dan catatan petugas tetap bisa kamu baca kapan saja.", status: "selesai", catatan: "Freon diisi ulang, AC diuji kembali." },
];

const KELUHAN = ["AC kelas tidak dingin?", "Lampu lab mati?", "Kran toilet bocor?", "Proyektor redup?", "Kaki meja patah?", "Wi-Fi lab putus?"];

const CONTOH_PAPAN = [
  { kode: "FT-2611-012", judul: "AC ruang kelas tidak dingin", lokasi: "Ruang kelas XI PPLG 4", kategoriId: "ac", status: "diproses" },
  { kode: "FT-2611-011", judul: "Lampu lorong lantai 2 berkedip", lokasi: "Lorong lantai 2", kategoriId: "lampu", status: "menunggu" },
  { kode: "FT-2611-010", judul: "Kran wastafel bocor terus", lokasi: "Toilet lantai 2", kategoriId: "toilet", status: "selesai" },
  { kode: "FT-2611-009", judul: "PC nomor 14 tidak menyala", lokasi: "Lab Komputer 1", kategoriId: "komputer", status: "diproses" },
  { kode: "FT-2611-008", judul: "Engsel pintu perpustakaan lepas", lokasi: "Perpustakaan", kategoriId: "pintu", status: "selesai" },
];

let pemutarBeranda = [];

function hentikanPemutar() {
  pemutarBeranda.forEach((id) => clearInterval(id));
  pemutarBeranda = [];
}

function barisPapan(l) {
  return `
    <li class="papan-langsung__baris">
      <span class="papan-langsung__ikon">${ikon(l.kategoriId)}</span>
      <span class="papan-langsung__teks">
        <b>${esc(l.judul)}</b>
        <small>${esc(l.kode)} · ${esc(l.lokasi)}</small>
      </span>
      ${statusPil(l.status)}
    </li>`;
}

function halamanBeranda(parameter) {
  hentikanPemutar();
  const hemat = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const r = Store.ringkasan();
  const sesi = Store.sesi();
  const kategori = Store.kategori();
  const semua = Store.semuaLaporan();
  const terbaru = semua.slice(0, 5);
  const jumlahPer = {};
  semua.forEach((l) => {
    jumlahPer[l.kategoriId] = (jumlahPer[l.kategoriId] || 0) + 1;
  });
  const papan = semua.length >= 3 ? semua.slice(0, 6) : CONTOH_PAPAN;
  const papanContoh = semua.length < 3;
  const persen = (n) => (r.total ? (n / r.total) * 100 : 0);
  const akun = sesi ? (sesi.peran === "petugas" ? "#/petugas" : "#/laporan") : "#/daftar";

  akar.innerHTML = `
    <section class="pembuka">
      <div class="bungkus pembuka__isi">
        <div class="pembuka__kiri">
          <p class="pembuka__sekolah" data-muncul><span class="simpul"></span>SMK Telkom Purwokerto</p>
          <h1 class="pembuka__judul" aria-label="Fasilitas rusak? Laporkan lewat FasTanggap.">
            <span class="pembuka__ketik" aria-hidden="true"><span id="ketik">${esc(KELUHAN[0])}</span><i class="kursor"></i></span>
            <span class="pembuka__tetap" aria-hidden="true">Laporkan lewat <span class="tanda">FasTanggap</span>.</span>
          </h1>
          <p class="pembuka__pimpin" data-muncul style="--tunda:.15s">
            Laporan diterima petugas sarana, diberi nomor, dan bisa kamu pantau sampai selesai diperbaiki.
            Tidak perlu lagi mengeluh di grup kelas.
          </p>
          <div class="pembuka__aksi" data-muncul style="--tunda:.25s">
            <a class="tombol tombol--utama tombol--besar" href="#/lapor">${ikon("tulis")} Buat laporan</a>
            <a class="tombol tombol--garis tombol--besar" href="${akun}">${sesi ? "Buka akun saya" : "Daftar akun siswa"}</a>
          </div>
          <form class="lacak-baris" id="lacakCepat" novalidate data-muncul style="--tunda:.35s">
            <label for="kodeCepat">Sudah punya nomor laporan?</label>
            <div class="lacak-baris__kolom">
              ${ikon("cari")}
              <input type="text" id="kodeCepat" name="kode" placeholder="FT-2611-001" autocomplete="off" />
              <button class="tombol tombol--tinta tombol--kecil" type="submit">Lacak</button>
            </div>
            <p class="medan__galat" id="galatCepat" role="alert"></p>
            <div class="lacak-hasil" id="hasilCepat" aria-live="polite"></div>
          </form>
        </div>

        <div class="pembuka__kanan" data-muncul="kanan" style="--tunda:.2s">
          <div class="papan-langsung">
            <div class="papan-langsung__kepala">
              <span class="papan-langsung__nyala"><i></i>${papanContoh ? "Contoh papan" : "Laporan masuk"}</span>
              <span class="papan-langsung__jam" id="jamPapan"></span>
            </div>
            <ul class="papan-langsung__daftar" id="papanDaftar">
              ${papan.slice(0, 4).map(barisPapan).join("")}
            </ul>
            <div class="papan-langsung__kaki">
              <span>${papanContoh ? "Data contoh, belum ada laporan" : `${r.total} laporan tercatat`}</span>
              <a href="#/lacak">Lacak &rarr;</a>
            </div>
          </div>
          <div class="pembuka__stiker" aria-hidden="true">
            <b>${r.total ? Math.round(persen(r.selesai)) : 0}%</b>
            <span>laporan selesai</span>
          </div>
        </div>
      </div>
    </section>

    <section class="angka-pita" aria-label="Ringkasan laporan">
      <div class="bungkus">
        <div class="angka-pita__grid">
          ${[
            ["Laporan masuk", r.total, ""],
            ["Menunggu", r.menunggu, "tunggu"],
            ["Diproses", r.diproses, "proses"],
            ["Selesai", r.selesai, "selesai"],
          ]
            .map(
              ([label, n, nada], i) => `
            <div class="angka-pita__sel" data-nada="${nada}" data-muncul style="--tunda:${i * 0.08}s">
              <b data-hitung="${n}">0</b><span>${label}</span>
            </div>`
            )
            .join("")}
        </div>
        <div class="sebaran" data-muncul aria-hidden="true">
          ${r.total
            ? [
                ["tunggu", r.menunggu],
                ["proses", r.diproses],
                ["selesai", r.selesai],
                ["tolak", r.ditolak],
              ]
                .filter(([, n]) => n)
                .map(([nada, n], i) => `<i data-nada="${nada}" style="flex:${n};--tunda:${0.2 + i * 0.12}s"></i>`)
                .join("")
            : `<i data-nada="kosong" style="flex:1"></i>`}
        </div>
      </div>
    </section>

    <section class="bagian">
      <div class="bungkus">
        <div class="judul-bagian2" data-muncul>
          <h2>Apa yang rusak?</h2>
          <p>Pilih kategori, formulir laporan langsung terisi.</p>
        </div>
        <div class="kategori-grid">
          ${kategori
            .map(
              (k, i) => `
            <a class="kategori-kartu" href="#/lapor?kategori=${encodeURIComponent(k.id)}" data-muncul style="--tunda:${(i % 3) * 0.07 + Math.floor(i / 3) * 0.05}s">
              <span class="kategori-kartu__ikon">${ikon(k.id, "ikon ikon--gambar")}</span>
              <span class="kategori-kartu__teks">
                <b>${esc(k.nama)}</b>
                <small>${esc(k.contoh)}</small>
              </span>
              <span class="kategori-kartu__jumlah">${jumlahPer[k.id] || 0}<small> laporan</small></span>
              <span class="kategori-kartu__panah" aria-hidden="true">&rarr;</span>
            </a>`
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="bagian bagian--hangat">
      <div class="bungkus">
        <div class="judul-bagian2" data-muncul>
          <h2>Perjalanan satu laporan</h2>
          <p>Empat tahap yang dilalui setiap laporan, dari HP kamu sampai selesai diperbaiki.</p>
        </div>
        <div class="tahapan" id="tahapan">
          <ol class="tahapan__daftar" role="tablist" aria-label="Tahap penanganan">
            ${LANGKAH.map(
              (l, i) => `
              <li>
                <button type="button" role="tab" class="tahapan__tombol${i === 0 ? " aktif" : ""}" data-tahap="${i}" aria-selected="${i === 0}">
                  <span class="tahapan__no">${i + 1}</span>
                  <span class="tahapan__teks"><b>${l.judul}</b><small>${l.isi}</small></span>
                  <span class="tahapan__waktu"><i></i></span>
                </button>
              </li>`
            ).join("")}
          </ol>
          <div class="tahapan__layar" data-muncul="kanan">
            <article class="slip-demo" id="slipDemo" aria-live="polite">
              <header>
                <span class="slip-demo__kode">FT-2611-012</span>
                <span id="slipStatus">${statusPil("menunggu")}</span>
              </header>
              <h3>AC ruang kelas tidak dingin</h3>
              <p class="slip-demo__meta">AC dan pendingin · Ruang kelas XI PPLG 4</p>
              <div class="slip-demo__jejak" id="slipJejak" style="--maju:0">
                <span>Dikirim</span><span>Diperiksa</span><span>Diproses</span><span>Selesai</span>
              </div>
              <div class="slip-demo__catatan">
                <small>Catatan terakhir</small>
                <p id="slipCatatan">${LANGKAH[0].catatan}</p>
              </div>
              <div class="slip-demo__cap" id="slipCap" aria-hidden="true">SELESAI</div>
            </article>
          </div>
        </div>
        <details class="figur-lipat" data-muncul>
          <summary>Lihat alurnya sebagai figur isometrik</summary>
          <div class="alur-figur">
            <iframe
              src="figure/triage.html"
              title="Figur isometrik: kartu laporan bergerak melewati pos pemeriksaan, penentu prioritas, dan cap selesai."
              loading="lazy"
              scrolling="no"
            ></iframe>
          </div>
        </details>
      </div>
    </section>

    <section class="bagian">
      <div class="bungkus">
        <div class="judul-bagian2 judul-bagian2--baris" data-muncul>
          <div>
            <h2>Laporan terbaru</h2>
            <p>Kerusakan yang baru dilaporkan dan posisinya sekarang.</p>
          </div>
          <a class="tautan-panah" href="#/lacak">Lacak laporan lain <span aria-hidden="true">&rarr;</span></a>
        </div>
        ${
          terbaru.length
            ? `<div class="daftar-terbaru">${terbaru.map((l) => kartuHasilLacak(l)).join("")}</div>`
            : `<div class="kosong" data-muncul>
                <h3>Belum ada laporan</h3>
                <p>Laporan yang dikirim siswa akan tampil di sini.</p>
                <a class="tombol tombol--utama" href="#/lapor">Kirim laporan pertama</a>
              </div>`
        }
      </div>
    </section>

    <section class="bagian bagian--hangat" id="faq">
      <div class="bungkus faq">
        <div class="judul-bagian2" data-muncul>
          <h2>Pertanyaan yang sering diajukan</h2>
          <p>Belum menemukan jawabannya? Temui petugas sarana dan prasarana di sekolah.</p>
        </div>
        <div class="faq__daftar">
          ${FAQ.map(
            ([t, j], i) => `
            <details class="faq__item" data-muncul style="--tunda:${i * 0.05}s" ${i === 0 ? "open" : ""}>
              <summary>${t}</summary>
              <p>${j}</p>
            </details>`
          ).join("")}
        </div>
      </div>
    </section>

    <section class="ajakan-merah">
      <div class="bungkus ajakan-merah__isi" data-muncul>
        <h2>Lihat yang rusak hari ini?<br />Butuh dua menit untuk melaporkannya.</h2>
        <a class="tombol tombol--putih tombol--besar" href="#/lapor">Buat laporan ${ikon("tulis")}</a>
      </div>
    </section>`;

  /* --- Lacak cepat --- */
  document.querySelector("#lacakCepat").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.querySelector("#kodeCepat");
    const kode = input.value.trim();
    const galat = document.querySelector("#galatCepat");
    const hasil = document.querySelector("#hasilCepat");
    if (!kode) {
      galat.textContent = "Isi nomor laporan dulu.";
      galat.classList.add("tampil");
      input.setAttribute("aria-invalid", "true");
      input.focus();
      hasil.innerHTML = "";
      return;
    }
    galat.classList.remove("tampil");
    input.removeAttribute("aria-invalid");
    hasil.innerHTML = `<div class="memuat" role="status" aria-label="Mencari laporan"><span></span><span></span></div>`;
    const laporan = await Store.cariKodeJauh(kode);
    hasil.innerHTML = laporan
      ? kartuHasilLacak(laporan)
      : `<div class="galat-kotak">Nomor <strong>${esc(kode.toUpperCase())}</strong> tidak ditemukan.</div>`;
  });

  /* --- Jam papan --- */
  const jam = document.querySelector("#jamPapan");
  const tulisJam = () => {
    if (!jam.isConnected) return hentikanPemutar();
    jam.textContent = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };
  tulisJam();
  pemutarBeranda.push(setInterval(tulisJam, 15000));

  if (!hemat) {
    /* --- Judul mengetik: keluhan bergantian --- */
    const ketik = document.querySelector("#ketik");
    let iKeluhan = 0;
    let huruf = KELUHAN[0].length;
    let mundur = false;
    let jeda = 22;
    pemutarBeranda.push(
      setInterval(() => {
        if (!ketik.isConnected) return hentikanPemutar();
        if (jeda > 0) return jeda--;
        const kata = KELUHAN[iKeluhan];
        if (mundur) {
          huruf--;
          if (huruf <= 0) {
            mundur = false;
            iKeluhan = (iKeluhan + 1) % KELUHAN.length;
          }
        } else {
          huruf++;
          if (huruf >= KELUHAN[iKeluhan].length) {
            mundur = true;
            jeda = 26;
          }
        }
        ketik.textContent = (mundur ? kata : KELUHAN[iKeluhan]).slice(0, huruf) || " ";
      }, 70)
    );

    /* --- Papan laporan: baris baru masuk dari atas --- */
    if (papan.length > 4) {
      const daftar = document.querySelector("#papanDaftar");
      let berikut = 4;
      pemutarBeranda.push(
        setInterval(() => {
          if (!daftar.isConnected) return hentikanPemutar();
          const tmp = document.createElement("ul");
          tmp.innerHTML = barisPapan(papan[berikut % papan.length]);
          const baru = tmp.firstElementChild;
          baru.classList.add("baru");
          daftar.prepend(baru);
          const akhir = daftar.lastElementChild;
          akhir.classList.add("keluar");
          setTimeout(() => akhir.remove(), 500);
          berikut++;
        }, 3200)
      );
    }
  }

  /* --- Tahapan: berganti otomatis, bisa diklik --- */
  const tombolTahap = [...document.querySelectorAll(".tahapan__tombol")];
  const slipStatus = document.querySelector("#slipStatus");
  const slipCatatan = document.querySelector("#slipCatatan");
  const slipJejak = document.querySelector("#slipJejak");
  const slipCap = document.querySelector("#slipCap");
  const slip = document.querySelector("#slipDemo");
  let tahap = 0;
  const pilihTahap = (i) => {
    tahap = i;
    tombolTahap.forEach((b, j) => {
      b.classList.toggle("aktif", j === i);
      b.classList.toggle("lewat", j < i);
      b.setAttribute("aria-selected", String(j === i));
    });
    slipStatus.innerHTML = statusPil(LANGKAH[i].status);
    slipCatatan.textContent = LANGKAH[i].catatan;
    slipJejak.style.setProperty("--maju", i / 3);
    slipCap.classList.toggle("tampil", i === 3);
    slip.classList.remove("getar");
    void slip.offsetWidth;
    slip.classList.add("getar");
  };
  let lanjutOtomatis = !hemat;
  tombolTahap.forEach((b, i) =>
    b.addEventListener("click", () => {
      lanjutOtomatis = false;
      document.querySelector("#tahapan").classList.add("manual");
      pilihTahap(i);
    })
  );
  // Mulai berputar hanya setelah bagian ini terlihat.
  const pengamatTahap = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    pengamatTahap.disconnect();
    pilihTahap(0);
    pemutarBeranda.push(
      setInterval(() => {
        if (!slip.isConnected) return hentikanPemutar();
        if (lanjutOtomatis) pilihTahap((tahap + 1) % LANGKAH.length);
      }, 3800)
    );
  }, { threshold: 0.4 });
  pengamatTahap.observe(document.querySelector("#tahapan"));

  if (parameter && parameter.get("ke") === "faq") {
    setTimeout(() => document.querySelector("#faq").scrollIntoView({ behavior: "smooth" }), 60);
  }
}

/* ---------- Halaman: daftar akun siswa ---------------------------------- */

function halamanDaftar() {
  if (Store.sesi()) {
    location.hash = "#/laporan";
    return;
  }
  akar.innerHTML = `
    <section class="halaman">
      <div class="bungkus dua-kolom">
        <div>
          <div class="halaman__kepala">
            <div>
              <h1>Daftar akun siswa</h1>
              <p>Akun dipakai untuk mengirim laporan dan memantau statusnya. Akun petugas dibuat oleh sekolah.</p>
            </div>
          </div>
          <form class="formulir" id="formDaftar" novalidate>
            <div class="medan__baris">
              <div class="medan">
                <label for="dNama">Nama lengkap <span class="medan__wajib">(wajib)</span></label>
                <input type="text" id="dNama" autocomplete="name" maxlength="60" />
                <p class="medan__galat" id="gNama" role="alert"></p>
              </div>
              <div class="medan">
                <label for="dKelas">Kelas <span class="medan__wajib">(wajib)</span></label>
                <input type="text" id="dKelas" placeholder="Contoh: XI PPLG 4" maxlength="20" />
                <p class="medan__galat" id="gKelas" role="alert"></p>
              </div>
            </div>
            <div class="medan">
              <label for="dPengguna">Nama pengguna <span class="medan__wajib">(wajib)</span></label>
              <input type="text" id="dPengguna" autocomplete="username" maxlength="30" />
              <p class="medan__bantuan">Huruf kecil, angka, titik, atau garis bawah. Minimal 3 karakter.</p>
              <p class="medan__galat" id="gPengguna" role="alert"></p>
            </div>
            <div class="medan__baris">
              <div class="medan">
                <label for="dSandi">Kata sandi <span class="medan__wajib">(wajib)</span></label>
                <input type="password" id="dSandi" autocomplete="new-password" />
                <p class="medan__bantuan">Minimal 6 karakter.</p>
                <p class="medan__galat" id="gSandi" role="alert"></p>
              </div>
              <div class="medan">
                <label for="dUlang">Ulangi kata sandi <span class="medan__wajib">(wajib)</span></label>
                <input type="password" id="dUlang" autocomplete="new-password" />
                <p class="medan__galat" id="gUlang" role="alert"></p>
              </div>
            </div>
            <p class="galat-kotak" id="gDaftar" role="alert" hidden></p>
            <div class="formulir__aksi">
              <button class="tombol tombol--utama" type="submit">Buat akun</button>
              <a class="tombol tombol--teks" href="#/masuk">Sudah punya akun? Masuk</a>
            </div>
          </form>
        </div>
        <aside class="kartu kartu-isi">
          <h2>Kenapa perlu akun?</h2>
          <ul class="daftar-centang">
            <li>Semua laporanmu tersimpan di satu tempat.</li>
            <li>Kamu bisa membaca catatan tindak lanjut dari petugas.</li>
            <li>Petugas tahu siapa yang melapor bila perlu konfirmasi.</li>
          </ul>
        </aside>
      </div>
    </section>`;

  document.querySelector("#formDaftar").addEventListener("submit", (e) => {
    e.preventDefault();
    const nilai = (id) => document.querySelector(id).value;
    const galat = {};
    if (nilai("#dNama").trim().length < 3) galat.gNama = "Nama minimal 3 karakter.";
    if (!nilai("#dKelas").trim()) galat.gKelas = "Kelas belum diisi.";
    if (!/^[a-z0-9._]{3,30}$/.test(nilai("#dPengguna").trim().toLowerCase())) galat.gPengguna = "Nama pengguna tidak valid.";
    if (nilai("#dSandi").length < 6) galat.gSandi = "Kata sandi minimal 6 karakter.";
    if (nilai("#dUlang") !== nilai("#dSandi")) galat.gUlang = "Kata sandi tidak sama.";

    const peta = { gNama: "#dNama", gKelas: "#dKelas", gPengguna: "#dPengguna", gSandi: "#dSandi", gUlang: "#dUlang" };
    Object.entries(peta).forEach(([g, input]) => {
      const el = document.querySelector(`#${g}`);
      el.textContent = galat[g] || "";
      el.classList.toggle("tampil", Boolean(galat[g]));
      if (galat[g]) document.querySelector(input).setAttribute("aria-invalid", "true");
      else document.querySelector(input).removeAttribute("aria-invalid");
    });
    const pertama = Object.keys(peta).find((g) => galat[g]);
    if (pertama) {
      document.querySelector(peta[pertama]).focus();
      return;
    }

    const hasil = Store.daftar({
      nama: nilai("#dNama"),
      kelas: nilai("#dKelas"),
      namaPengguna: nilai("#dPengguna"),
      sandi: nilai("#dSandi"),
    });
    if (!hasil.ok) {
      const kotak = document.querySelector("#gDaftar");
      kotak.textContent = hasil.pesan;
      kotak.hidden = false;
      return;
    }
    gambarAksi();
    toast(`Akun dibuat. Selamat datang, ${hasil.pengguna.nama}.`);
    location.hash = "#/lapor";
  });
}

function kartuHasilLacak(laporan) {
  return `
    <a class="baris-laporan" href="#/laporan/${encodeURIComponent(laporan.kode)}">
      <div>
        <div class="baris-laporan__kode">${esc(laporan.kode)} · ${esc(relatif(laporan.dibuat))}</div>
        <div class="baris-laporan__judul">${esc(laporan.judul)}</div>
        <div class="baris-laporan__meta">
          <span>${esc(namaKategori(laporan.kategoriId))}</span>
          <span>${esc(laporan.lokasi)}</span>
        </div>
      </div>
      <div class="baris-laporan__kanan">${statusPil(laporan.status)}</div>
    </a>`;
}

/* ---------- Halaman: lacak ---------------------------------------------- */

function halamanLacak() {
  akar.innerHTML = `
    <section class="halaman">
      <div class="bungkus sempit">
        <div class="halaman__kepala">
          <div>
            <h1>Lacak laporan</h1>
            <p>Masukkan nomor laporan yang kamu terima setelah mengirim. Tidak perlu masuk.</p>
          </div>
        </div>
        <form class="formulir" id="formLacak" novalidate>
          <div class="medan">
            <label for="kode">Nomor laporan <span class="medan__wajib">(wajib)</span></label>
            <input type="text" id="kode" name="kode" placeholder="FT-2611-001" autocomplete="off" autofocus />
            <p class="medan__bantuan">Formatnya FT, diikuti tahun dan bulan, lalu nomor urut. Contoh: FT-2611-003.</p>
            <p class="medan__galat" id="galatKode" role="alert"></p>
          </div>
          <div class="formulir__aksi">
            <button class="tombol tombol--utama" type="submit">Cek status laporan</button>
            <a class="tombol tombol--teks" href="#/">Kembali ke beranda</a>
          </div>
        </form>
        <div class="lacak-hasil" id="hasil" aria-live="polite"></div>
      </div>
    </section>`;

  document.querySelector("#formLacak").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.querySelector("#kode");
    const galat = document.querySelector("#galatKode");
    const hasil = document.querySelector("#hasil");
    const nilai = input.value.trim();
    if (!nilai) {
      galat.textContent = "Nomor laporan belum diisi.";
      galat.classList.add("tampil");
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    galat.classList.remove("tampil");
    input.removeAttribute("aria-invalid");
    hasil.innerHTML = `<div class="memuat" role="status" aria-label="Mencari laporan"><span></span><span></span></div>`;
    Store.cariKodeJauh(nilai).then((laporan) => {
      hasil.innerHTML = laporan
        ? kartuHasilLacak(laporan)
        : `<div class="galat-kotak">Tidak ada laporan dengan nomor <strong>${esc(nilai.toUpperCase())}</strong>. Coba periksa lagi, atau hubungi petugas sarana kalau nomornya yakin benar.</div>`;
    });
  });
}

/* ---------- Halaman: masuk ---------------------------------------------- */

function halamanMasuk() {
  if (Store.sesi()) {
    location.hash = Store.sesi().peran === "petugas" ? "#/petugas" : "#/laporan";
    return;
  }
  akar.innerHTML = `
    <section class="halaman">
      <div class="bungkus dua-kolom">
        <div>
          <div class="halaman__kepala">
            <div>
              <h1>Masuk ke FasTanggap</h1>
              <p>Siswa memakai akun untuk mengirim laporan. Petugas memakai akun untuk memeriksa dan menindaklanjuti.</p>
            </div>
          </div>
          <form class="formulir" id="formMasuk" novalidate>
            <div class="medan">
              <label for="namaPengguna">Nama pengguna</label>
              <input type="text" id="namaPengguna" name="namaPengguna" autocomplete="username" />
              <p class="medan__galat" id="galatNama" role="alert"></p>
            </div>
            <div class="medan">
              <label for="sandi">Kata sandi</label>
              <input type="password" id="sandi" name="sandi" autocomplete="current-password" />
              <p class="medan__galat" id="galatSandi" role="alert"></p>
            </div>
            <p class="galat-kotak" id="galatMasuk" role="alert" hidden></p>
            <div class="formulir__aksi">
              <button class="tombol tombol--utama" type="submit">Masuk</button>
              <a class="tombol tombol--teks" href="#/daftar">Belum punya akun? Daftar</a>
            </div>
          </form>
        </div>
        <aside class="kartu kartu-isi">
          <h2>Akun demo</h2>
          <p>Halaman ini belum memakai server. Akun di bawah hanya untuk mencoba alur, dan datanya tersimpan di browser ini.</p>
          <dl class="detail__meta" style="margin-top:0;padding-top:0;border-top:0">
            <dt>Siswa</dt><dd><b>siswa</b> / siswa123</dd>
            <dt>Petugas</dt><dd><b>petugas</b> / petugas123</dd>
          </dl>
          <p style="margin-top:18px">
            <button class="tombol tombol--garis tombol--kecil" type="button" id="isiSiswa">Isi akun siswa</button>
            <button class="tombol tombol--garis tombol--kecil" type="button" id="isiPetugas">Isi akun petugas</button>
          </p>
        </aside>
      </div>
    </section>`;

  const isi = (u, s) => {
    document.querySelector("#namaPengguna").value = u;
    document.querySelector("#sandi").value = s;
    document.querySelector("#namaPengguna").focus();
  };
  document.querySelector("#isiSiswa").addEventListener("click", () => isi("siswa", "siswa123"));
  document.querySelector("#isiPetugas").addEventListener("click", () => isi("petugas", "petugas123"));

  document.querySelector("#formMasuk").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = document.querySelector("#namaPengguna");
    const s = document.querySelector("#sandi");
    const galatMasuk = document.querySelector("#galatMasuk");
    [u, s].forEach((el) => el.removeAttribute("aria-invalid"));
    document.querySelectorAll(".medan__galat").forEach((el) => el.classList.remove("tampil"));
    galatMasuk.hidden = true;

    if (!u.value.trim() || !s.value) {
      if (!u.value.trim()) {
        document.querySelector("#galatNama").textContent = "Nama pengguna belum diisi.";
        document.querySelector("#galatNama").classList.add("tampil");
        u.setAttribute("aria-invalid", "true");
        u.focus();
      } else {
        document.querySelector("#galatSandi").textContent = "Kata sandi belum diisi.";
        document.querySelector("#galatSandi").classList.add("tampil");
        s.setAttribute("aria-invalid", "true");
        s.focus();
      }
      return;
    }

    const hasil = Store.masuk(u.value, s.value);
    if (!hasil.ok) {
      galatMasuk.textContent = hasil.pesan;
      galatMasuk.hidden = false;
      s.setAttribute("aria-invalid", "true");
      s.focus();
      return;
    }
    gambarAksi();
    toast(`Selamat datang, ${hasil.pengguna.nama}.`);
    location.hash = hasil.pengguna.peran === "petugas" ? "#/petugas" : "#/laporan";
  });
}

/* ---------- Halaman: buat laporan --------------------------------------- */

function halamanLapor() {
  const sesi = Store.sesi();
  if (!sesi) {
    akar.innerHTML = `
      <section class="halaman">
        <div class="bungkus sempit">
          <div class="halaman__kepala">
            <div>
              <h1>Masuk dulu untuk mengirim laporan</h1>
              <p>Laporan perlu terhubung ke akun supaya kamu bisa memantau statusnya dan petugas tahu siapa yang melapor.</p>
            </div>
          </div>
          <div class="kosong">
            <h3>Belum masuk</h3>
            <p>Gunakan akun siswa. Kalau belum punya, kamu bisa mendaftar sendiri.</p>
            <div class="kosong__aksi">
              <a class="tombol tombol--utama" href="#/masuk">Masuk ke akun</a>
              <a class="tombol tombol--garis" href="#/daftar">Daftar akun siswa</a>
            </div>
          </div>
        </div>
      </section>`;
    return;
  }
  if (sesi.peran === "petugas") {
    akar.innerHTML = `
      <section class="halaman">
        <div class="bungkus sempit">
          <div class="halaman__kepala"><div><h1>Akun petugas tidak mengirim laporan</h1></div></div>
          <div class="kosong">
            <h3>Kamu masuk sebagai petugas</h3>
            <p>Laporan dibuat oleh siswa. Dari akun petugas, kamu memeriksa dan menindaklanjuti laporan yang masuk.</p>
            <a class="tombol tombol--utama" href="#/petugas">Buka dasbor petugas</a>
          </div>
        </div>
      </section>`;
    return;
  }

  akar.innerHTML = `
    <section class="halaman">
      <div class="bungkus dua-kolom">
        <div>
          <div class="halaman__kepala">
            <div>
              <h1>Buat laporan kerusakan</h1>
              <p>Tulis apa yang rusak dan di mana. Foto membantu petugas, tetapi tidak wajib.</p>
            </div>
          </div>
          <form class="formulir" id="formLapor" novalidate>
            <div class="medan__baris">
              <div class="medan">
                <label for="kategori">Kategori fasilitas <span class="medan__wajib">(wajib)</span></label>
                <select id="kategori" name="kategori">
                  <option value="">Pilih kategori</option>
                  ${Store.kategori().map((k) => `<option value="${esc(k.id)}">${esc(k.nama)}</option>`).join("")}
                </select>
                <p class="medan__galat" id="galatKategori" role="alert"></p>
              </div>
              <div class="medan">
                <label for="lokasi">Lokasi <span class="medan__wajib">(wajib)</span></label>
                <input type="text" id="lokasi" name="lokasi" list="daftarLokasi" placeholder="Contoh: Lab Komputer 1" />
                <datalist id="daftarLokasi">
                  ${Store.lokasi().map((l) => `<option value="${esc(l)}"></option>`).join("")}
                </datalist>
                <p class="medan__galat" id="galatLokasi" role="alert"></p>
              </div>
            </div>

            <div class="medan">
              <label for="judul">Judul laporan <span class="medan__wajib">(wajib)</span></label>
              <input type="text" id="judul" name="judul" maxlength="90" placeholder="Contoh: AC ruang kelas tidak dingin" />
              <p class="medan__bantuan">Satu kalimat singkat. Maksimal 90 karakter.</p>
              <p class="medan__galat" id="galatJudul" role="alert"></p>
            </div>

            <div class="medan">
              <label for="deskripsi">Deskripsi kerusakan <span class="medan__wajib">(wajib)</span></label>
              <textarea id="deskripsi" name="deskripsi" maxlength="800" placeholder="Ceritakan kondisinya: sejak kapan, apa yang terlihat, dan apakah masih bisa dipakai."></textarea>
              <p class="medan__bantuan"><span id="hitungDeskripsi">0</span> dari 800 karakter.</p>
              <p class="medan__galat" id="galatDeskripsi" role="alert"></p>
            </div>

            <div class="medan">
              <span class="medan__label">Foto kerusakan <span class="medan__bantuan">(opsional)</span></span>
              <div class="unggah">
                <input type="file" id="foto" accept="image/*" aria-describedby="infoFoto" />
                <p class="unggah__info" id="infoFoto">JPG atau PNG. Foto akan diperkecil otomatis sebelum disimpan.</p>
                <img class="unggah__pratinjau" id="pratinjauFoto" alt="" hidden />
                <button class="tombol tombol--teks tombol--kecil" type="button" id="hapusFoto" hidden>Hapus foto</button>
              </div>
            </div>

            <div class="formulir__aksi">
              <button class="tombol tombol--utama" type="submit" id="kirimLaporan">Kirim laporan</button>
              <a class="tombol tombol--teks" href="#/laporan">Lihat laporan saya</a>
            </div>
          </form>
        </div>
        <aside class="kartu kartu-isi">
          <h2>Yang terjadi setelah dikirim</h2>
          <p>Laporan langsung masuk ke daftar petugas dengan status Menunggu verifikasi.</p>
          <ol class="tahap">
            <li><div><h3>Nomor laporan dibuat</h3><p>Kamu menerima nomor seperti FT-2611-001 untuk melacak.</p></div></li>
            <li><div><h3>Petugas memeriksa</h3><p>Laporan dibaca dan dicocokkan dengan kondisi di lokasi.</p></div></li>
            <li><div><h3>Status diperbarui</h3><p>Setiap perubahan status tercatat beserta catatan petugas.</p></div></li>
          </ol>
        </aside>
      </div>
    </section>`;

  let fotoData = "";
  const inputFoto = document.querySelector("#foto");
  const pratinjau = document.querySelector("#pratinjauFoto");
  const hapusFoto = document.querySelector("#hapusFoto");

  document.querySelector("#deskripsi").addEventListener("input", (e) => {
    document.querySelector("#hitungDeskripsi").textContent = e.target.value.length;
  });

  inputFoto.addEventListener("change", async () => {
    const berkas = inputFoto.files && inputFoto.files[0];
    if (!berkas) return;
    if (!berkas.type.startsWith("image/")) {
      toast("Berkas itu bukan gambar.", "galat");
      inputFoto.value = "";
      return;
    }
    try {
      fotoData = await perkecilGambar(berkas);
      pratinjau.src = fotoData;
      pratinjau.hidden = false;
      hapusFoto.hidden = false;
      document.querySelector("#infoFoto").textContent = "Foto siap dikirim. Ukurannya sudah diperkecil.";
    } catch (galat) {
      toast("Foto gagal dibaca. Coba pilih file lain.", "galat");
      inputFoto.value = "";
    }
  });

  hapusFoto.addEventListener("click", () => {
    fotoData = "";
    inputFoto.value = "";
    pratinjau.hidden = true;
    pratinjau.removeAttribute("src");
    hapusFoto.hidden = true;
    document.querySelector("#infoFoto").textContent = "JPG atau PNG. Foto akan diperkecil otomatis sebelum disimpan.";
  });

  document.querySelector("#formLapor").addEventListener("submit", (e) => {
    e.preventDefault();
    const kategori = document.querySelector("#kategori");
    const lokasi = document.querySelector("#lokasi");
    const judul = document.querySelector("#judul");
    const deskripsi = document.querySelector("#deskripsi");
    const pasangan = [
      [kategori, "galatKategori", "Pilih kategori fasilitas dulu.", (v) => v !== ""],
      [lokasi, "galatLokasi", "Lokasi belum diisi.", (v) => v.trim().length >= 3],
      [judul, "galatJudul", "Judul minimal 6 karakter.", (v) => v.trim().length >= 6],
      [deskripsi, "galatDeskripsi", "Deskripsi minimal 15 karakter.", (v) => v.trim().length >= 15],
    ];
    let pertamaSalah = null;
    pasangan.forEach(([el, idGalat, pesan, sah]) => {
      const galat = document.querySelector(`#${idGalat}`);
      if (!sah(el.value)) {
        galat.textContent = pesan;
        galat.classList.add("tampil");
        el.setAttribute("aria-invalid", "true");
        if (!pertamaSalah) pertamaSalah = el;
      } else {
        galat.classList.remove("tampil");
        el.removeAttribute("aria-invalid");
      }
    });
    if (pertamaSalah) {
      pertamaSalah.focus();
      toast("Masih ada isian yang perlu diperbaiki.", "galat");
      return;
    }

    const tombol = document.querySelector("#kirimLaporan");
    tombol.disabled = true;
    tombol.textContent = "Mengirim...";

    setTimeout(() => {
      const hasil = Store.tambahLaporan(
        { kategoriId: kategori.value, lokasi: lokasi.value, judul: judul.value, deskripsi: deskripsi.value, foto: fotoData },
        Store.sesi()
      );
      tombol.disabled = false;
      tombol.textContent = "Kirim laporan";
      if (!hasil.ok) {
        toast(hasil.pesan, "galat");
        return;
      }
      toast(`Laporan ${hasil.laporan.kode} terkirim.`);
      location.hash = `#/laporan/${encodeURIComponent(hasil.laporan.kode)}?baru=1`;
    }, 480);
  });
}

function perkecilGambar(berkas) {
  return new Promise((selesai, gagal) => {
    const pembaca = new FileReader();
    pembaca.onerror = () => gagal(new Error("gagal baca"));
    pembaca.onload = () => {
      const gambar = new Image();
      gambar.onerror = () => gagal(new Error("gagal muat"));
      gambar.onload = () => {
        const maks = 1000;
        const skala = Math.min(1, maks / Math.max(gambar.width, gambar.height));
        const kanvas = document.createElement("canvas");
        kanvas.width = Math.round(gambar.width * skala);
        kanvas.height = Math.round(gambar.height * skala);
        const konteks = kanvas.getContext("2d");
        konteks.drawImage(gambar, 0, 0, kanvas.width, kanvas.height);
        selesai(kanvas.toDataURL("image/jpeg", 0.75));
      };
      gambar.src = pembaca.result;
    };
    pembaca.readAsDataURL(berkas);
  });
}

/* ---------- Halaman: laporan saya --------------------------------------- */

function halamanLaporanSaya() {
  const sesi = Store.sesi();
  if (!sesi) {
    location.hash = "#/masuk";
    return;
  }
  const daftar = Store.laporanMilik(sesi.id);

  akar.innerHTML = `
    <section class="halaman">
      <div class="bungkus">
        <div class="halaman__kepala">
          <div>
            <h1>Laporan saya</h1>
            <p>Semua laporan yang kamu kirim dari akun ${esc(sesi.nama)}.</p>
          </div>
          <a class="tombol tombol--utama" href="#/lapor">Buat laporan baru</a>
        </div>
        ${
          daftar.length === 0
            ? `<div class="kosong">
                 <h3>Belum ada laporan</h3>
                 <p>Kalau ada fasilitas yang rusak di sekitar kamu, laporkan lewat formulir. Petugas akan menerima laporannya langsung.</p>
                 <a class="tombol tombol--utama" href="#/lapor">Buat laporan pertama</a>
               </div>`
            : `<div class="daftar">
                 ${daftar
                   .map(
                     (l) => `
                   <a class="baris-laporan" href="#/laporan/${encodeURIComponent(l.kode)}">
                     <div>
                       <div class="baris-laporan__kode">${esc(l.kode)} · ${esc(relatif(l.dibuat))}</div>
                       <div class="baris-laporan__judul">${esc(l.judul)}</div>
                       <div class="baris-laporan__meta">
                         <span>${esc(namaKategori(l.kategoriId))}</span>
                         <span>${esc(l.lokasi)}</span>
                       </div>
                     </div>
                     <div class="baris-laporan__kanan">${statusPil(l.status)}</div>
                   </a>`
                   )
                   .join("")}
               </div>`
        }
      </div>
    </section>`;
}

/* ---------- Halaman: detail laporan ------------------------------------- */

function halamanDetail(kode, baru) {
  const sesi = Store.sesi();
  const laporan = Store.cariKode(kode);
  if (!laporan) {
    akar.innerHTML = `
      <section class="halaman">
        <div class="bungkus sempit">
          <div class="halaman__kepala"><div><h1>Laporan tidak ditemukan</h1></div></div>
          <div class="galat-kotak">Nomor <strong>${esc(kode)}</strong> tidak ada di perangkat ini. Mungkin laporan dibuat di browser lain.</div>
          <p style="margin-top:20px"><a class="tombol tombol--garis" href="#/lacak">Cari nomor lain</a></p>
        </div>
      </section>`;
    return;
  }
  const pemilik = sesi && sesi.id === laporan.pelaporId;
  const petugas = sesi && sesi.peran === "petugas";
  const bolehLihat = pemilik || petugas;
  const urutanStatus = ["menunggu", "diproses", "selesai"];
  const posisi = urutanStatus.indexOf(laporan.status);

  akar.innerHTML = `
    <section class="halaman">
      <div class="bungkus">
        <p style="margin-bottom:18px"><a href="${petugas ? "#/petugas" : "#/laporan"}">Kembali ke daftar</a></p>
        ${
          baru
            ? `<div class="galat-kotak" style="border-color:#c8e9d4;background:#f1faf4;color:#14603a;margin-bottom:26px">
                 Laporan berhasil dikirim. Simpan nomor <strong>${esc(laporan.kode)}</strong> untuk melacak statusnya.
               </div>`
            : ""
        }
        <div class="detail__kepala">
          <div>
            <div class="detail__kode">${esc(laporan.kode)} · dikirim ${esc(tanggal(laporan.dibuat, true))}</div>
            <h1 class="detail__judul">${esc(laporan.judul)}</h1>
            <p class="detail__deskripsi">${esc(laporan.deskripsi)}</p>
            ${
              laporan.foto
                ? `<div class="detail__foto"><img src="${laporan.foto}" alt="Foto kerusakan pada laporan ${esc(laporan.kode)}" /></div>`
                : `<p class="medan__bantuan" style="margin-top:20px">Laporan ini dikirim tanpa foto.</p>`
            }
            <dl class="detail__meta">
              <dt>Kategori</dt><dd>${esc(namaKategori(laporan.kategoriId))}</dd>
              <dt>Lokasi</dt><dd>${esc(laporan.lokasi)}</dd>
              <dt>Pelapor</dt><dd>${esc(laporan.pelaporNama)}${laporan.pelaporKelas ? ` · ${esc(laporan.pelaporKelas)}` : ""}</dd>
              <dt>Prioritas</dt><dd>${
                laporan.prioritas
                  ? `<span class="prioritas" data-tingkat="${esc(laporan.prioritas)}"><b>${esc(PRIORITAS[laporan.prioritas].label)}</b></span>`
                  : `<span style="color:var(--tinta-lembut)">Belum ditetapkan</span>`
              }</dd>
            </dl>
          </div>
          <aside class="kartu kartu-isi">
            <div style="margin-bottom:14px">${statusPil(laporan.status)}</div>
            <h2 style="font-size:16px">Riwayat penanganan</h2>
            <ol class="jejak" style="margin-top:16px">
              ${laporan.riwayat
                .slice()
                .reverse()
                .map(
                  (r, i) => `
                <li data-aktif="${i === 0 ? "ya" : "tidak"}">
                  <div>
                    <div class="jejak__waktu">${esc(tanggal(r.waktu, true))}</div>
                    <div class="jejak__teks">${esc(r.catatan)}</div>
                    <div class="jejak__oleh">${esc(r.oleh)}</div>
                  </div>
                </li>`
                )
                .join("")}
            </ol>
            ${
              petugas
                ? `<button class="tombol tombol--utama tombol--penuh" type="button" id="tindakLanjut" style="margin-top:8px">Tindak lanjuti laporan</button>`
                : ""
            }
            ${
              !bolehLihat
                ? `<p class="medan__bantuan" style="margin-top:14px">Kamu melihat halaman ini lewat pencarian nomor. Isi lengkap hanya terbuka untuk pelapor dan petugas.</p>`
                : ""
            }
          </aside>
        </div>
        ${
          posisi >= 0 && laporan.status !== "ditolak"
            ? `<div class="kartu kartu-isi" style="margin-top:34px">
                 <h2 style="font-size:16px">Posisi laporan</h2>
                 <div class="slip__jejak" style="padding:22px 0 4px;border-top:0" aria-hidden="true">
                   ${["Menunggu verifikasi", "Diproses", "Selesai"]
                     .map((teks, i) => `<span class="jejak__titik ${posisi === i ? "aktif" : posisi > i ? "selesai" : ""}"><i></i><span>${teks}</span></span>`)
                     .join("")}
                 </div>
               </div>`
            : ""
        }
      </div>
    </section>`;

  const tombolTindak = document.querySelector("#tindakLanjut");
  if (tombolTindak) tombolTindak.addEventListener("click", () => bukaTindakan(laporan.kode));
}

/* ---------- Modal tindakan petugas -------------------------------------- */

function bukaTindakan(kode) {
  const laporan = Store.cariKode(kode);
  if (!laporan) return;
  const dialog = document.createElement("dialog");
  dialog.className = "sheet";
  dialog.innerHTML = `
    <div class="sheet__isi">
      <div class="sheet__kepala">
        <div>
          <h2>Tindak lanjuti ${esc(laporan.kode)}</h2>
          <p class="medan__bantuan">${esc(laporan.judul)}</p>
        </div>
        <button class="sheet__tutup" type="button" aria-label="Tutup">×</button>
      </div>
      <form class="formulir" id="formTindakan" novalidate style="margin-top:18px">
        <div class="medan">
          <label for="statusBaru">Status penanganan</label>
          <select id="statusBaru">
            ${Object.entries(STATUS)
              .filter(([k]) => k !== "menunggu")
              .map(([k, v]) => `<option value="${k}" ${laporan.status === k ? "selected" : ""}>${esc(v.label)}</option>`)
              .join("")}
          </select>
        </div>
        <div class="medan">
          <label for="prioritasBaru">Prioritas</label>
          <select id="prioritasBaru">
            <option value="">Belum ditetapkan</option>
            ${Object.entries(PRIORITAS)
              .map(([k, v]) => `<option value="${k}" ${laporan.prioritas === k ? "selected" : ""}>${esc(v.label)}</option>`)
              .join("")}
          </select>
        </div>
        <div class="medan">
          <label for="catatanBaru">Catatan tindak lanjut</label>
          <textarea id="catatanBaru" maxlength="400" placeholder="Contoh: kerusakan sesuai laporan, teknisi dijadwalkan Kamis."></textarea>
          <p class="medan__galat" id="galatCatatan" role="alert"></p>
        </div>
        <div class="sheet__aksi">
          <button class="tombol tombol--garis" type="button" id="batalTindakan">Batal</button>
          <button class="tombol tombol--utama" type="submit">Simpan perubahan</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(dialog);
  dialog.showModal();

  const tutup = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.querySelector(".sheet__tutup").addEventListener("click", tutup);
  dialog.querySelector("#batalTindakan").addEventListener("click", tutup);
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    tutup();
  });
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      tutup();
    }
  });

  dialog.querySelector("#formTindakan").addEventListener("submit", (e) => {
    e.preventDefault();
    const status = dialog.querySelector("#statusBaru").value;
    const prioritas = dialog.querySelector("#prioritasBaru").value;
    const catatan = dialog.querySelector("#catatanBaru");
    const galat = dialog.querySelector("#galatCatatan");
    if (catatan.value.trim().length < 5) {
      galat.textContent = "Tulis catatan minimal 5 karakter supaya pelapor tahu tindak lanjutnya.";
      galat.classList.add("tampil");
      catatan.setAttribute("aria-invalid", "true");
      catatan.focus();
      return;
    }
    const hasil = Store.ubahStatus(kode, status, catatan.value, prioritas, Store.sesi().nama);
    if (!hasil.ok) {
      toast(hasil.pesan, "galat");
      return;
    }
    tutup();
    toast("Status laporan diperbarui.");
    gambarRute();
  });
}

/* ---------- Halaman: dasbor petugas ------------------------------------- */

let saringAktif = "semua";

function halamanPetugas() {
  const sesi = Store.sesi();
  if (!sesi) {
    location.hash = "#/masuk";
    return;
  }
  if (sesi.peran !== "petugas") {
    akar.innerHTML = `
      <section class="halaman">
        <div class="bungkus sempit">
          <div class="halaman__kepala"><div><h1>Halaman ini untuk petugas</h1></div></div>
          <div class="kosong">
            <h3>Akun kamu terdaftar sebagai siswa</h3>
            <p>Dasbor pemeriksaan laporan hanya bisa dibuka akun petugas sekolah.</p>
            <a class="tombol tombol--utama" href="#/laporan">Buka laporan saya</a>
          </div>
        </div>
      </section>`;
    return;
  }

  const semua = Store.semuaLaporan();
  const r = Store.ringkasan();
  const saringan = [
    ["semua", "Semua", semua.length],
    ["menunggu", "Menunggu", r.menunggu],
    ["diproses", "Diproses", r.diproses],
    ["selesai", "Selesai", r.selesai],
    ["ditolak", "Ditolak", r.ditolak],
  ];
  const tampil = saringAktif === "semua" ? semua : semua.filter((l) => l.status === saringAktif);

  akar.innerHTML = `
    <section class="halaman">
      <div class="bungkus">
        <div class="halaman__kepala">
          <div>
            <h1>Dasbor petugas</h1>
            <p>Laporan masuk, diperiksa, lalu ditindaklanjuti. Semua perubahan tercatat di riwayat laporan.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a class="tombol tombol--garis tombol--kecil" href="#/petugas/rekap">Rekap laporan</a>
            <a class="tombol tombol--garis tombol--kecil" href="#/petugas/kategori">Kategori dan lokasi</a>
          </div>
        </div>

        <div class="rekap">
          <div class="rekap__sel"><b>${r.menunggu}</b><span>Menunggu verifikasi</span></div>
          <div class="rekap__sel"><b>${r.diproses}</b><span>Sedang diproses</span></div>
          <div class="rekap__sel"><b>${r.selesai}</b><span>Selesai</span></div>
          <div class="rekap__sel"><b>${r.ditolak}</b><span>Ditolak</span></div>
        </div>

        <div class="saring" role="group" aria-label="Saring laporan menurut status">
          ${saringan
            .map(
              ([nilai, label, jumlah]) => `
            <button type="button" data-saring="${nilai}" aria-pressed="${saringAktif === nilai}">${label}<b>${jumlah}</b></button>`
            )
            .join("")}
        </div>

        ${
          tampil.length === 0
            ? `<div class="kosong">
                 <h3>${semua.length === 0 ? "Belum ada laporan masuk" : "Tidak ada laporan pada saringan ini"}</h3>
                 <p>${
                   semua.length === 0
                     ? "Begitu siswa mengirim laporan, datanya muncul di sini dengan status Menunggu verifikasi."
                     : "Coba pilih saringan lain untuk melihat laporan dengan status berbeda."
                 }</p>
                 ${
                   semua.length === 0
                     ? `<button class="tombol tombol--garis" type="button" id="muatContoh">Muat 5 laporan contoh (demo)</button>`
                     : ""
                 }
               </div>`
            : `<div class="tabel-bungkus">
                 <table class="tabel">
                   <thead>
                     <tr>
                       <th scope="col">Nomor</th>
                       <th scope="col">Laporan</th>
                       <th scope="col">Lokasi</th>
                       <th scope="col">Prioritas</th>
                       <th scope="col">Status</th>
                       <th scope="col"><span class="visual-saja">Aksi</span></th>
                     </tr>
                   </thead>
                   <tbody>
                     ${tampil
                       .map(
                         (l) => `
                       <tr>
                         <td class="sel-kode">${esc(l.kode)}</td>
                         <td class="sel-judul">${esc(l.judul)}<small>${esc(namaKategori(l.kategoriId))} · ${esc(relatif(l.dibuat))}</small></td>
                         <td>${esc(l.lokasi)}</td>
                         <td>${
                           l.prioritas
                             ? `<span class="prioritas" data-tingkat="${esc(l.prioritas)}"><b>${esc(PRIORITAS[l.prioritas].label)}</b></span>`
                             : `<span style="color:var(--tinta-lembut)">-</span>`
                         }</td>
                         <td>${statusPil(l.status)}</td>
                         <td><button class="tombol tombol--garis tombol--kecil" type="button" data-tindak="${esc(l.kode)}">Periksa</button></td>
                       </tr>`
                       )
                       .join("")}
                   </tbody>
                 </table>
               </div>`
        }
      </div>
    </section>`;

  akar.querySelectorAll("[data-saring]").forEach((tombol) => {
    tombol.addEventListener("click", () => {
      saringAktif = tombol.dataset.saring;
      halamanPetugas();
    });
  });
  akar.querySelectorAll("[data-tindak]").forEach((tombol) => {
    tombol.addEventListener("click", () => bukaTindakan(tombol.dataset.tindak));
  });
  const muat = document.querySelector("#muatContoh");
  if (muat) {
    muat.addEventListener("click", () => {
      Store.muatContoh();
      toast("5 laporan contoh dimuat untuk demo.");
      halamanPetugas();
    });
  }
}

/* ---------- Halaman: rekap ---------------------------------------------- */

function halamanRekap() {
  const sesi = Store.sesi();
  if (!sesi || sesi.peran !== "petugas") {
    location.hash = "#/masuk";
    return;
  }
  const semua = Store.semuaLaporan();
  const r = Store.ringkasan();
  const perKategori = Store.kategori().map((k) => ({
    nama: k.nama,
    jumlah: semua.filter((l) => l.kategoriId === k.id).length,
  }));
  const perLokasi = {};
  semua.forEach((l) => {
    perLokasi[l.lokasi] = (perLokasi[l.lokasi] || 0) + 1;
  });
  const lokasiUrut = Object.entries(perLokasi).sort((a, b) => b[1] - a[1]);
  const maks = Math.max(1, ...perKategori.map((k) => k.jumlah), ...lokasiUrut.map((l) => l[1]));

  akar.innerHTML = `
    <section class="halaman">
      <div class="bungkus">
        <p style="margin-bottom:18px"><a href="#/petugas">Kembali ke dasbor</a></p>
        <div class="halaman__kepala">
          <div>
            <h1>Rekap laporan</h1>
            <p>Dihitung dari ${semua.length} laporan yang tersimpan di perangkat ini. Belum ada server, jadi angkanya mengikuti browser yang kamu pakai.</p>
          </div>
        </div>

        ${
          semua.length === 0
            ? `<div class="kosong">
                 <h3>Belum ada data untuk direkap</h3>
                 <p>Rekap akan terisi setelah ada laporan yang masuk.</p>
                 <a class="tombol tombol--garis" href="#/petugas">Kembali ke dasbor</a>
               </div>`
            : `
          <div class="rekap">
            <div class="rekap__sel"><b>${r.total}</b><span>Total laporan</span></div>
            <div class="rekap__sel"><b>${r.selesai}</b><span>Selesai</span></div>
            <div class="rekap__sel"><b>${r.diproses}</b><span>Diproses</span></div>
            <div class="rekap__sel"><b>${r.ditolak}</b><span>Ditolak</span></div>
          </div>

          <h2 style="font-size:19px;margin-bottom:16px">Laporan per kategori</h2>
          <div class="batang">
            ${perKategori
              .map(
                (k) => `
              <div class="batang__baris">
                <span>${esc(k.nama)}</span>
                <span class="batang__jalur"><span class="batang__isi" style="width:${Math.round((k.jumlah / maks) * 100)}%"></span></span>
                <span class="batang__angka">${k.jumlah}</span>
              </div>`
              )
              .join("")}
          </div>

          <h2 style="font-size:19px;margin:38px 0 16px">Laporan per lokasi</h2>
          ${
            lokasiUrut.length === 0
              ? `<p class="pimpin">Belum ada lokasi yang tercatat.</p>`
              : `<div class="batang">
                  ${lokasiUrut
                    .map(
                      ([nama, jumlah]) => `
                    <div class="batang__baris">
                      <span>${esc(nama)}</span>
                      <span class="batang__jalur"><span class="batang__isi" style="width:${Math.round((jumlah / maks) * 100)}%"></span></span>
                      <span class="batang__angka">${jumlah}</span>
                    </div>`
                    )
                    .join("")}
                 </div>`
          }`
        }
      </div>
    </section>`;
}

/* ---------- Halaman: kategori dan lokasi -------------------------------- */

function halamanKategori() {
  const sesi = Store.sesi();
  if (!sesi || sesi.peran !== "petugas") {
    location.hash = "#/masuk";
    return;
  }

  const gambar = () => {
    akar.innerHTML = `
      <section class="halaman">
        <div class="bungkus">
          <p style="margin-bottom:18px"><a href="#/petugas">Kembali ke dasbor</a></p>
          <div class="halaman__kepala">
            <div>
              <h1>Kategori dan lokasi</h1>
              <p>Dipakai sebagai pilihan saat siswa mengirim laporan. Kategori yang sudah dipakai laporan tidak bisa dihapus.</p>
            </div>
          </div>
          <div class="dua-kolom">
            <div>
              <h2 style="font-size:19px;margin-bottom:14px">Kategori fasilitas</h2>
              <div class="kategori">
                ${Store.kategori()
                  .map(
                    (k) => `
                  <div class="kategori__baris" style="grid-template-columns:minmax(0,1fr) auto">
                    <div>
                      <div class="kategori__nama">${esc(k.nama)}</div>
                      <div class="kategori__contoh">${esc(k.contoh)}</div>
                    </div>
                    <button class="tombol tombol--teks tombol--kecil" type="button" data-hapus-kategori="${esc(k.id)}">Hapus</button>
                  </div>`
                  )
                  .join("")}
              </div>
              <form class="formulir" id="formKategori" novalidate style="margin-top:24px">
                <div class="medan__baris">
                  <div class="medan">
                    <label for="namaKategori">Kategori baru</label>
                    <input type="text" id="namaKategori" maxlength="40" placeholder="Contoh: Gorden kelas" />
                    <p class="medan__galat" id="galatKategoriBaru" role="alert"></p>
                  </div>
                  <div class="medan">
                    <label for="contohKategori">Contoh kerusakan</label>
                    <input type="text" id="contohKategori" maxlength="80" placeholder="Contoh: rel lepas, kain sobek" />
                  </div>
                </div>
                <div class="formulir__aksi">
                  <button class="tombol tombol--utama tombol--kecil" type="submit">Tambah kategori</button>
                </div>
              </form>
            </div>
            <div>
              <h2 style="font-size:19px;margin-bottom:14px">Lokasi</h2>
              <div class="kategori">
                ${Store.lokasi()
                  .map(
                    (l) => `
                  <div class="kategori__baris" style="grid-template-columns:minmax(0,1fr) auto">
                    <div class="kategori__nama">${esc(l)}</div>
                    <button class="tombol tombol--teks tombol--kecil" type="button" data-hapus-lokasi="${esc(l)}">Hapus</button>
                  </div>`
                  )
                  .join("")}
              </div>
              <form class="formulir" id="formLokasi" novalidate style="margin-top:24px">
                <div class="medan">
                  <label for="namaLokasi">Lokasi baru</label>
                  <input type="text" id="namaLokasi" maxlength="50" placeholder="Contoh: Ruang OSIS" />
                  <p class="medan__galat" id="galatLokasiBaru" role="alert"></p>
                </div>
                <div class="formulir__aksi">
                  <button class="tombol tombol--utama tombol--kecil" type="submit">Tambah lokasi</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>`;

    akar.querySelectorAll("[data-hapus-kategori]").forEach((b) => {
      b.addEventListener("click", () => {
        const hasil = Store.hapusKategori(b.dataset.hapusKategori);
        if (!hasil.ok) {
          toast(hasil.pesan, "galat");
          return;
        }
        toast("Kategori dihapus.");
        gambar();
      });
    });
    akar.querySelectorAll("[data-hapus-lokasi]").forEach((b) => {
      b.addEventListener("click", () => {
        const hasil = Store.hapusLokasi(b.dataset.hapusLokasi);
        if (!hasil.ok) {
          toast(hasil.pesan, "galat");
          return;
        }
        toast("Lokasi dihapus.");
        gambar();
      });
    });

    document.querySelector("#formKategori").addEventListener("submit", (e) => {
      e.preventDefault();
      const nama = document.querySelector("#namaKategori");
      const contoh = document.querySelector("#contohKategori");
      const galat = document.querySelector("#galatKategoriBaru");
      if (nama.value.trim().length < 3) {
        galat.textContent = "Nama kategori minimal 3 karakter.";
        galat.classList.add("tampil");
        nama.setAttribute("aria-invalid", "true");
        nama.focus();
        return;
      }
      const hasil = Store.tambahKategori(nama.value, contoh.value);
      if (!hasil.ok) {
        galat.textContent = hasil.pesan;
        galat.classList.add("tampil");
        nama.setAttribute("aria-invalid", "true");
        nama.focus();
        return;
      }
      toast("Kategori ditambahkan.");
      gambar();
    });

    document.querySelector("#formLokasi").addEventListener("submit", (e) => {
      e.preventDefault();
      const nama = document.querySelector("#namaLokasi");
      const galat = document.querySelector("#galatLokasiBaru");
      if (nama.value.trim().length < 3) {
        galat.textContent = "Nama lokasi minimal 3 karakter.";
        galat.classList.add("tampil");
        nama.setAttribute("aria-invalid", "true");
        nama.focus();
        return;
      }
      const hasil = Store.tambahLokasi(nama.value);
      if (!hasil.ok) {
        galat.textContent = hasil.pesan;
        galat.classList.add("tampil");
        nama.setAttribute("aria-invalid", "true");
        nama.focus();
        return;
      }
      toast("Lokasi ditambahkan.");
      gambar();
    });
  };

  gambar();
}

/* ---------- Router ------------------------------------------------------- */

const judulHalaman = {
  "/": "FasTanggap · Pelaporan Kerusakan Fasilitas Sekolah",
  "/lacak": "Lacak laporan · FasTanggap",
  "/masuk": "Masuk · FasTanggap",
  "/daftar": "Daftar akun · FasTanggap",
  "/lapor": "Buat laporan · FasTanggap",
  "/laporan": "Laporan saya · FasTanggap",
  "/petugas": "Dasbor petugas · FasTanggap",
  "/petugas/rekap": "Rekap laporan · FasTanggap",
  "/petugas/kategori": "Kategori dan lokasi · FasTanggap",
};

function gambarRute() {
  const mentah = location.hash.replace(/^#/, "") || "/";
  const [jalur, kueri] = mentah.split("?");
  const bagian = jalur.split("/").filter(Boolean);
  const parameter = new URLSearchParams(kueri || "");

  if (bagian[0] === "laporan" && bagian[1]) {
    halamanDetail(decodeURIComponent(bagian[1]), parameter.get("baru") === "1");
    document.title = "Detail laporan · FasTanggap";
    tandaiRute("/laporan");
    return;
  }

  switch (jalur) {
    case "/":
      halamanBeranda(parameter);
      break;
    case "/daftar":
      halamanDaftar();
      break;
    case "/lacak":
      halamanLacak();
      break;
    case "/masuk":
      halamanMasuk();
      break;
    case "/lapor": {
      halamanLapor();
      const pilih = document.querySelector("#kategori");
      if (pilih && parameter.get("kategori")) pilih.value = parameter.get("kategori");
      break;
    }
    case "/laporan":
      halamanLaporanSaya();
      break;
    case "/petugas":
      halamanPetugas();
      break;
    case "/petugas/rekap":
      halamanRekap();
      break;
    case "/petugas/kategori":
      halamanKategori();
      break;
    default:
      halamanBeranda();
      document.title = judulHalaman["/"];
      tandaiRute("/");
      return;
  }
  document.title = judulHalaman[jalur] || judulHalaman["/"];
  tandaiRute(jalur);
}

/* Halaman dalam: judul dipindah ke spanduk merah dengan remah navigasi. */
function pasangSpanduk() {
  const bagian = akar.querySelector(".halaman");
  if (!bagian || bagian.querySelector(".spanduk-halaman")) return;
  const kepala = bagian.querySelector(".halaman__kepala");
  if (!kepala) return;
  const label = document.title.split(" · ")[0];
  const spanduk = document.createElement("div");
  spanduk.className = "spanduk-halaman";
  spanduk.innerHTML = `<div class="bungkus"><nav class="remah" aria-label="Lokasi halaman"><a href="#/">Beranda</a><span aria-hidden="true">/</span><span>${esc(label)}</span></nav></div>`;
  spanduk.querySelector(".bungkus").appendChild(kepala);
  bagian.prepend(spanduk);
}
new MutationObserver(pasangSpanduk).observe(akar, { childList: true });

window.addEventListener("hashchange", () => {
  gambarRute();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
});

gambarAksi();
gambarRute();
Store.siapkan().then((berubah) => {
  if (berubah) gambarRute();
});
