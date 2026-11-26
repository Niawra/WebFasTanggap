/*
 * portal-app.js
 * Halaman siswa & petugas di website dengan tampilan seperti aplikasi Android FasTanggap.
 * Menggantikan halamanLaporanSaya, halamanLapor, dan halamanPetugas dari app.js
 * (fungsi global dengan nama sama; dimuat setelah app.js). Data & aksi tetap lewat Store.
 */

const PIN =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>';

const LABEL_STATUS = { menunggu: "Menunggu", diproses: "Diproses", selesai: "Selesai", ditolak: "Ditolak" };

function pilApp(status) {
  return `<span class="ap-pil" data-s="${esc(status)}">${esc(LABEL_STATUS[status] || status)}</span>`;
}

function kueriHash() {
  return new URLSearchParams((location.hash.split("?")[1] || ""));
}

/** Kartu laporan seperti KartuLaporan di aplikasi. `aksi` = HTML tombol di bawah kartu. */
function kartuApp(l, aksi, ekstra) {
  return `
    <div class="ap-kartu ap-lap" data-buka="${esc(l.kode)}" role="link" tabindex="0" aria-label="Buka ${esc(l.judul)}">
      <div class="ap-lap__atas">
        <span class="ap-lap__kode">${esc(l.kode)}</span><span>· ${esc(relatif(l.dibuat))}</span>
        ${pilApp(l.status)}
      </div>
      <h3>${esc(l.judul)}</h3>
      <div class="ap-lap__tempat">${PIN}<span>${esc(l.lokasi)} · ${esc(namaKategori(l.kategoriId))}</span></div>
      ${ekstra || ""}
      ${aksi ? `<div class="ap-lap__aksi">${aksi}</div>` : ""}
    </div>`;
}

function kosongApp(judul, teks, emoji) {
  return `<div class="ap-kosong"><span>${emoji || "📭"}</span><b>${esc(judul)}</b><p>${esc(teks)}</p></div>`;
}

/** Klik kartu -> detail laporan; klik tombol di dalam kartu tidak ikut membuka. */
function pasangBukaKartu() {
  akar.querySelectorAll("[data-buka]").forEach((k) => {
    const buka = (e) => {
      if (e.target.closest("button, a, textarea, input")) return;
      location.hash = `#/laporan/${encodeURIComponent(k.dataset.buka)}`;
    };
    k.addEventListener("click", buka);
    k.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target === k) buka(e);
    });
  });
}

/* ---------- Siswa: beranda + laporan saya -------------------------------- */

let saringSiswa = "semua";

function halamanLaporanSaya() {
  const sesi = Store.sesi();
  if (!sesi) {
    location.hash = "#/masuk";
    return;
  }
  if (sesi.peran === "petugas") {
    location.hash = "#/petugas";
    return;
  }
  const milik = Store.laporanMilik(sesi.id);
  const hitung = (s) => milik.filter((l) => l.status === s).length;
  const tampil = saringSiswa === "semua" ? milik : milik.filter((l) => l.status === saringSiswa);
  const chip = [
    ["semua", "Semua", milik.length],
    ["menunggu", "Menunggu", hitung("menunggu")],
    ["diproses", "Diproses", hitung("diproses")],
    ["selesai", "Selesai", hitung("selesai")],
    ["ditolak", "Ditolak", hitung("ditolak")],
  ];

  akar.innerHTML = `
    <section class="ap">
      <div class="ap__isi">
        <div class="ap-judul">
          <h1>Halo, ${esc(sesi.nama.split(" ")[0])}</h1>
          <p>${esc(sesi.kelas || "Siswa")}</p>
        </div>
        ${bannerPeringatan(sesi)}
        <a class="ap-ajak" href="#/lapor">
          <span class="ap-ajak__plus" aria-hidden="true">+</span>
          <h2>Ada yang rusak?</h2>
          <p>Foto, pilih lokasi, kirim.<br />Petugas langsung dapat kabar.</p>
          <span class="ap-ajak__tombol">Buat laporan</span>
        </a>
        <div class="ap-angka">
          ${[
            ["menunggu", "#b7791f"],
            ["diproses", "#2f6fdb"],
            ["selesai", "#1f8a55"],
          ]
            .map(
              ([s, w]) => `
            <div class="ap-kartu"><i style="background:${w}"></i><b>${hitung(s)}</b><span>${LABEL_STATUS[s]}</span></div>`
            )
            .join("")}
        </div>
        <h2 class="ap-subjudul">Laporan saya</h2>
        <div class="ap-chip" role="group" aria-label="Saring laporan">
          ${chip.map(([n, label, j]) => `<button type="button" data-saring="${n}" aria-pressed="${saringSiswa === n}">${label}<b>${j}</b></button>`).join("")}
        </div>
        ${
          tampil.length
            ? `<div class="ap-daftar">${tampil.map((l) => kartuApp(l)).join("")}</div>`
            : kosongApp(
                milik.length ? "Tidak ada laporan" : "Belum ada laporan",
                milik.length ? "Belum ada laporan dengan status ini." : "Laporan yang kamu kirim akan muncul di sini.",
                "📭"
              )
        }
      </div>
    </section>`;

  akar.querySelectorAll("[data-saring]").forEach((b) =>
    b.addEventListener("click", () => {
      saringSiswa = b.dataset.saring;
      halamanLaporanSaya();
    })
  );
  pasangBukaKartu();
}

/* ---------- Siswa: alur lapor 4 langkah (sama dengan aplikasi) ---------- */

const JUDUL_LANGKAH = ["Apa yang rusak?", "Di mana?", "Ceritakan sedikit", "Cek sebelum kirim"];

function halamanLapor() {
  const sesi = Store.sesi();
  if (!sesi) {
    akar.innerHTML = `
      <section class="ap"><div class="ap__isi ap__sempit">
        ${kosongApp("Masuk dulu untuk melapor", "Laporan perlu terhubung ke akun supaya kamu bisa memantau statusnya.", "🔐")}
        <div class="ap-lapor__kaki" style="position:static">
          <a class="ap-tombol" href="#/masuk">Masuk</a>
          <a class="ap-tombol ap-tombol--putih" href="#/daftar">Daftar akun siswa</a>
        </div>
      </div></section>`;
    return;
  }
  if (sesi.peran === "petugas") {
    location.hash = "#/petugas";
    return;
  }

  const awal = kueriHash().get("kategori");
  const st = {
    langkah: awal && Store.kategori().some((k) => k.id === awal) ? 1 : 0,
    kategori: Store.kategori().find((k) => k.id === awal) || null,
    lokasi: "",
    judul: "",
    ket: "",
    foto: "",
    cari: "",
    arah: 1,
    kode: null,
    sibuk: false,
  };

  const gambar = () => {
    if (st.kode) return gambarTerkirim();
    const l = st.langkah;
    akar.innerHTML = `
      <section class="ap ap-lapor">
        <div class="ap__isi ap__sempit">
          <div class="ap-lapor__kepala">
            <button class="ap-lapor__kembali" type="button" id="apKembali" aria-label="${l ? "Kembali" : "Tutup"}">${l ? "&#8592;" : "&#10005;"}</button>
            <div class="ap-lapor__progres">${[0, 1, 2, 3].map((i) => `<i class="${i <= l ? "isi" : ""}"></i>`).join("")}</div>
            <span class="ap-lapor__nomor">${l + 1}/4</span>
          </div>
          <div class="ap-lapor__langkah ${st.arah < 0 ? "mundur" : ""}">
            <h1>${JUDUL_LANGKAH[l]}</h1>
            ${[isiKategori, isiLokasi, isiKeterangan, isiRingkas][l]()}
          </div>
          ${
            l >= 2
              ? `<div class="ap-lapor__kaki"><button class="ap-tombol" type="button" id="apLanjut" ${st.sibuk ? "disabled" : ""}>${
                  l === 2 ? "Lanjut" : st.sibuk ? "Mengirim..." : "Kirim laporan"
                }</button></div>`
              : ""
          }
        </div>
      </section>`;
    pasang();
  };

  const isiKategori = () => `
    <div class="ap-kisi">
      ${Store.kategori()
        .map(
          (k) => `
        <button class="ap-ubin" type="button" data-kat="${esc(k.id)}" aria-pressed="${st.kategori && st.kategori.id === k.id}">
          ${ikon(kunciIkon(k.id))}<b>${esc(k.nama)}</b>${k.contoh ? `<small>${esc(k.contoh)}</small>` : ""}
        </button>`
        )
        .join("")}
    </div>`;

  const isiLokasi = () => {
    const q = st.cari.trim().toLowerCase();
    const daftar = Store.lokasi().filter((n) => !q || n.toLowerCase().includes(q));
    return `
      <label class="ap-cari">${ikon("cari")}<input id="apCari" type="search" placeholder="Cari ruang, lab, toilet…" value="${esc(st.cari)}" autocomplete="off" /></label>
      <div class="ap-pilihan" id="apDaftarLok">
        ${
          daftar.length
            ? daftar.map((n) => `<button type="button" data-lok="${esc(n)}" aria-pressed="${st.lokasi === n}">${PIN}${esc(n)}</button>`).join("")
            : `<p class="ap-galat" style="color:var(--ap-lembut)">Lokasi tidak ditemukan.</p>`
        }
      </div>`;
  };

  const isiKeterangan = () => `
    <input class="ap-isian" id="apJudul" maxlength="90" placeholder="Judul singkat, mis. AC tidak dingin" value="${esc(st.judul)}" />
    <p class="ap-galat" id="apGalatJudul"></p>
    <textarea class="ap-isian" id="apKet" rows="4" maxlength="800" placeholder="Sejak kapan? Seberapa parah? Masih bisa dipakai?">${esc(st.ket)}</textarea>
    <p class="ap-galat" id="apGalatKet"></p>
    <label class="ap-foto">
      <input type="file" id="apFoto" accept="image/*" />
      ${
        st.foto
          ? `<img src="${st.foto}" alt="Pratinjau foto kerusakan" /><small>Ketuk untuk ganti foto</small>`
          : `${ikon("tulis")}<b>Tambah foto</b><small>Foto membantu petugas membawa alat yang tepat.</small>`
      }
    </label>`;

  const isiRingkas = () => `
    <div class="ap-ringkas"><small>KATEGORI</small><b>${esc(st.kategori ? st.kategori.nama : "-")}</b></div>
    <div class="ap-ringkas"><small>LOKASI</small><b>${esc(st.lokasi)}</b></div>
    <div class="ap-ringkas"><small>JUDUL</small><b>${esc(st.judul)}</b></div>
    <div class="ap-ringkas"><small>KETERANGAN</small><b>${esc(st.ket)}</b>${st.foto ? `<img src="${st.foto}" alt="" />` : ""}</div>`;

  const ke = (n) => {
    st.arah = n > st.langkah ? 1 : -1;
    st.langkah = n;
    gambar();
    window.gulirKe(0, { langsung: true });
  };

  const pasang = () => {
    akar.querySelector("#apKembali").addEventListener("click", () => {
      if (st.langkah > 0) ke(st.langkah - 1);
      else location.hash = "#/laporan";
    });
    akar.querySelectorAll("[data-kat]").forEach((b) =>
      b.addEventListener("click", () => {
        st.kategori = Store.kategori().find((k) => k.id === b.dataset.kat);
        b.setAttribute("aria-pressed", "true");
        setTimeout(() => ke(1), 160);
      })
    );
    const pasangLok = () =>
      akar.querySelectorAll("[data-lok]").forEach((b) =>
        b.addEventListener("click", () => {
          st.lokasi = b.dataset.lok;
          b.setAttribute("aria-pressed", "true");
          setTimeout(() => ke(2), 160);
        })
      );
    pasangLok();
    const cari = akar.querySelector("#apCari");
    if (cari) {
      cari.addEventListener("input", () => {
        st.cari = cari.value;
        const wadah = akar.querySelector("#apDaftarLok");
        const sementara = document.createElement("div");
        sementara.innerHTML = isiLokasi();
        wadah.replaceWith(sementara.querySelector("#apDaftarLok"));
        pasangLok();
      });
    }
    const judul = akar.querySelector("#apJudul");
    const ket = akar.querySelector("#apKet");
    if (judul) judul.addEventListener("input", () => (st.judul = judul.value));
    if (ket) ket.addEventListener("input", () => (st.ket = ket.value));
    const foto = akar.querySelector("#apFoto");
    if (foto) {
      foto.addEventListener("change", async () => {
        const berkas = foto.files && foto.files[0];
        if (!berkas) return;
        if (!berkas.type.startsWith("image/")) return toast("Berkas itu bukan gambar.", "galat");
        try {
          st.foto = await perkecilGambar(berkas);
          gambar();
        } catch {
          toast("Foto gagal dibaca. Coba pilih file lain.", "galat");
        }
      });
    }
    const lanjut = akar.querySelector("#apLanjut");
    if (lanjut) {
      lanjut.addEventListener("click", () => {
        if (st.langkah === 2) {
          const gJ = akar.querySelector("#apGalatJudul");
          const gK = akar.querySelector("#apGalatKet");
          gJ.textContent = st.judul.trim().length < 6 ? "Judul minimal 6 karakter." : "";
          gK.textContent = st.ket.trim().length < 15 ? "Ceritakan minimal 15 karakter supaya petugas paham." : "";
          if (gJ.textContent || gK.textContent) return;
          ke(3);
        } else {
          kirim();
        }
      });
    }
  };

  const kirim = async () => {
    st.sibuk = true;
    gambar();
    const hasil = await Store.tambahLaporan({
      kategoriId: st.kategori.id,
      lokasi: st.lokasi,
      judul: st.judul,
      deskripsi: st.ket,
      foto: st.foto,
    });
    st.sibuk = false;
    if (!hasil.ok) {
      gambar();
      return toast(hasil.pesan, "galat");
    }
    const v = hasil.verifikasi;
    if (v && v.verdict === "asal") {
      toast(`Laporan ditolak otomatis oleh TanggapAI: ${v.alasan}`, "galat");
      location.hash = "#/laporan";
      return;
    }
    st.kode = hasil.laporan.kode;
    gambar();
  };

  const gambarTerkirim = () => {
    akar.innerHTML = `
      <section class="ap">
        <div class="ap__isi ap__sempit">
          <div class="ap-terkirim">
            <span class="ap-terkirim__centang">&#10003;</span>
            <h1>Laporan terkirim</h1>
            <span class="ap-terkirim__kode">${esc(st.kode)}</span>
            <p>Petugas sarana sudah dapat kabar. Pantau statusnya dari halaman Laporan saya.</p>
            <div class="ap-lapor__kaki">
              <a class="ap-tombol" href="#/laporan/${encodeURIComponent(st.kode)}">Lihat laporan</a>
              <a class="ap-tombol ap-tombol--putih" href="#/laporan">Selesai</a>
            </div>
          </div>
        </div>
      </section>`;
  };

  gambar();
}

/* ---------- Petugas: Tugas masuk / Tugasku / Semua ---------------------- */

let saringPetugas = "semua";

function halamanPetugas() {
  const sesi = Store.sesi();
  if (!sesi) {
    location.hash = "#/masuk";
    return;
  }
  if (sesi.peran !== "petugas") {
    location.hash = "#/laporan";
    return;
  }
  const tab = ["masuk", "saya", "semua"].includes(kueriHash().get("tab")) ? kueriHash().get("tab") : "masuk";
  const semua = Store.semuaLaporan();
  const terbuka = (l) => l.status === "menunggu" || l.status === "diproses";
  const masuk = semua.filter((l) => terbuka(l) && !l.ditanganiId);
  const milikku = semua.filter((l) => l.ditanganiId === sesi.id);
  const aktif = milikku.filter(terbuka);
  const tuntas = milikku.filter((l) => !terbuka(l));
  const tersembunyi = Store.laporanTersembunyi();

  const tandaRagu = (l) =>
    l.aiVerdict === "ragu" ? `<div class="ap-lap__oleh"><span class="ap-pil" data-s="ragu">Perlu dicek (AI)</span> ${esc(l.aiAlasan)}</div>` : "";
  const oleh = (l) => (l.ditanganiId && l.ditanganiId !== sesi.id ? `<div class="ap-lap__oleh">Ditangani ${esc(l.ditanganiNama)}</div>` : "");

  let isi = "";
  if (tab === "masuk") {
    isi = `
      <div class="ap-baris"><span class="ap-langsung"><i></i>Langsung · ${masuk.length} menunggu diambil</span></div>
      ${
        masuk.length
          ? `<div class="ap-daftar">${masuk
              .map((l) =>
                kartuApp(
                  l,
                  `<button class="ap-tombol" type="button" data-ambil="${esc(l.kode)}">✋ Ambil tugas</button>
                   <button class="ap-tombol ap-tombol--putih ap-tombol--kecil" type="button" data-periksa="${esc(l.kode)}">Periksa</button>`,
                  tandaRagu(l)
                )
              )
              .join("")}</div>`
          : kosongApp("Semua beres", "Tidak ada tugas yang menunggu. Tugas baru muncul di sini.", "✅")
      }`;
  } else if (tab === "saya") {
    isi = `
      ${
        aktif.length
          ? `<div class="ap-daftar">${aktif
              .map((l) =>
                kartuApp(
                  l,
                  `<button class="ap-tombol ap-tombol--hijau" type="button" data-mode="selesai" data-kode="${esc(l.kode)}">✓ Tandai selesai</button>
                   <button class="ap-tombol ap-tombol--lembut ap-tombol--kecil" type="button" data-mode="ditolak" data-kode="${esc(l.kode)}">Tolak</button>
                   <div class="ap-catatan" id="catatan-${esc(l.kode)}" hidden>
                     <textarea class="ap-isian" rows="2" maxlength="400" placeholder=""></textarea>
                     <button class="ap-tombol" type="button" data-simpan="${esc(l.kode)}">Simpan</button>
                   </div>`,
                  tandaRagu(l)
                )
              )
              .join("")}</div>`
          : kosongApp("Belum ada tugas", "Ambil tugas dari tab Tugas masuk. Yang kamu ambil muncul di sini.", "📥")
      }
      ${tuntas.length ? `<h2 class="ap-subjudul">Sudah selesai</h2><div class="ap-daftar">${tuntas.map((l) => kartuApp(l)).join("")}</div>` : ""}`;
  } else {
    const hitung = (s) => semua.filter((l) => l.status === s).length;
    const chip = [
      ["semua", "Semua", semua.length],
      ["menunggu", "Menunggu", hitung("menunggu")],
      ["diproses", "Diproses", hitung("diproses")],
      ["selesai", "Selesai", hitung("selesai")],
      ["ditolak", "Ditolak", hitung("ditolak")],
    ];
    const daftar =
      saringPetugas === "semua" ? semua : semua.filter((l) => l.status === saringPetugas);
    isi = `
      <div class="ap-chip" role="group" aria-label="Saring laporan">
        ${chip.map(([n, label, j]) => `<button type="button" data-saring="${n}" aria-pressed="${saringPetugas === n}">${label}<b>${j}</b></button>`).join("")}
      </div>
      ${
        daftar.length
          ? `<div class="ap-daftar">${daftar
              .map((l) =>
                kartuApp(
                  l,
                  l.tersembunyi
                    ? `<button class="ap-tombol ap-tombol--putih" type="button" data-pulihkan="${esc(l.kode)}">Pulihkan</button>`
                    : `<button class="ap-tombol ap-tombol--putih" type="button" data-periksa="${esc(l.kode)}">Periksa</button>`,
                  (l.tersembunyi ? `<div class="ap-lap__oleh">${esc(l.aiAlasan || "")}</div>` : tandaRagu(l)) + oleh(l)
                )
              )
              .join("")}</div>`
          : kosongApp(
              semua.length ? "Tidak ada laporan di saringan ini" : "Belum ada laporan masuk",
              semua.length ? "Coba pilih saringan lain." : "Begitu siswa mengirim laporan, datanya muncul di sini.",
              "🗂️"
            )
      }
      ${semua.length === 0 ? `<button class="ap-tombol ap-tombol--putih" type="button" id="muatContoh">Muat 5 laporan contoh</button>` : ""}`;
  }

  const r = Store.ringkasan();
  akar.innerHTML = `
    <section class="ap">
      <div class="ap__isi">
        <div class="ap-baris">
          <div class="ap-judul">
            <h1>${{ masuk: "Tugas masuk", saya: "Tugasku", semua: "Semua laporan" }[tab]}</h1>
            <p>Petugas sarana · ${esc(sesi.nama)}</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a class="ap-tombol ap-tombol--putih ap-tombol--kecil" href="#/petugas/rekap">Ringkasan</a>
            <a class="ap-tombol ap-tombol--putih ap-tombol--kecil" href="#/petugas/kategori">Kategori &amp; lokasi</a>
          </div>
        </div>
        <div class="ap-angka ap-angka--4">
          ${[
            ["Menunggu", r.menunggu, "#b7791f"],
            ["Diproses", r.diproses, "#2f6fdb"],
            ["Selesai", r.selesai, "#1f8a55"],
            ["Ditolak", r.ditolak, "#6e6766"],
          ]
            .map(([label, n, w]) => `<div class="ap-kartu"><i style="background:${w}"></i><b>${n}</b><span>${label}</span></div>`)
            .join("")}
        </div>
        <nav class="ap-chip" aria-label="Tab petugas">
          <a href="#/petugas?tab=masuk"${tab === "masuk" ? ' aria-current="page"' : ""}>Tugas masuk<b>${masuk.length}</b></a>
          <a href="#/petugas?tab=saya"${tab === "saya" ? ' aria-current="page"' : ""}>Tugasku<b>${aktif.length}</b></a>
          <a href="#/petugas?tab=semua"${tab === "semua" ? ' aria-current="page"' : ""}>Semua<b>${semua.length}</b></a>
        </nav>
        ${isi}
      </div>
    </section>`;

  pasangBukaKartu();
  const segar = () => halamanPetugas();

  akar.querySelectorAll("[data-ambil]").forEach((b) =>
    b.addEventListener("click", async () => {
      b.disabled = true;
      b.textContent = "Mengambil...";
      const hasil = await Store.ambilTugas(b.dataset.ambil);
      toast(hasil.ok ? `Tugas ${b.dataset.ambil} jadi milikmu.` : hasil.pesan, hasil.ok ? "info" : "galat");
      segar();
    })
  );
  akar.querySelectorAll("[data-periksa]").forEach((b) => b.addEventListener("click", () => bukaTindakan(b.dataset.periksa)));
  akar.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      const kotak = akar.querySelector(`#catatan-${CSS.escape(b.dataset.kode)}`);
      const ta = kotak.querySelector("textarea");
      kotak.hidden = false;
      kotak.dataset.mode = b.dataset.mode;
      ta.placeholder = b.dataset.mode === "ditolak" ? "Alasan menolak (wajib)" : "Apa yang diperbaiki? (opsional)";
      kotak.querySelector("[data-simpan]").textContent = b.dataset.mode === "ditolak" ? "Kirim penolakan" : "Simpan selesai";
      ta.focus();
    })
  );
  akar.querySelectorAll("[data-simpan]").forEach((b) =>
    b.addEventListener("click", async () => {
      const kotak = b.closest(".ap-catatan");
      const mode = kotak.dataset.mode;
      let catatan = kotak.querySelector("textarea").value.trim();
      if (mode === "ditolak" && catatan.length < 5) return toast("Tulis alasan menolak minimal 5 karakter.", "galat");
      if (!catatan) catatan = "Perbaikan selesai.";
      b.disabled = true;
      const hasil = await Store.ubahStatus(b.dataset.simpan, mode, catatan);
      toast(hasil.ok ? `${b.dataset.simpan} ${mode === "selesai" ? "ditandai selesai" : "ditolak"}.` : hasil.pesan, hasil.ok ? "info" : "galat");
      segar();
    })
  );
  akar.querySelectorAll("[data-saring]").forEach((b) =>
    b.addEventListener("click", () => {
      saringPetugas = b.dataset.saring;
      segar();
    })
  );
  akar.querySelectorAll("[data-pulihkan]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Pulihkan laporan ini dan cabut peringatan pelapornya?")) return;
      b.disabled = true;
      const hasil = await Store.pulihkan(b.dataset.pulihkan);
      toast(hasil.ok ? "Laporan dipulihkan dan peringatan dicabut." : hasil.pesan, hasil.ok ? "info" : "galat");
      segar();
    })
  );
  const contoh = akar.querySelector("#muatContoh");
  if (contoh) {
    contoh.addEventListener("click", async () => {
      contoh.disabled = true;
      const hasil = await Store.muatContoh();
      toast(hasil.ok ? "5 laporan contoh dimuat." : hasil.pesan, hasil.ok ? "info" : "galat");
      segar();
    });
  }
}

