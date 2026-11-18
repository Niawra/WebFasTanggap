/*
 * aplikasi-demo.js
 * Slide beranda "Lewat aplikasi": mockup HP aplikasi Android FasTanggap.
 * Saat digulir, jari mengetuk alur lapor di aplikasi:
 *   kategori -> lokasi -> keterangan + foto -> cek -> terkirim.
 * Muncul setelah slide kapsul (isi 3 kolom) dan naik menutupinya di layar lebar.
 */
(function () {
  "use strict";

  const IKON = {
    ac: '<path d="M3 6h18v7H3z"/><path d="M7 17c0 1.5-1 2-1 3M12 17v3M17 17c0 1.5 1 2 1 3"/><path d="M6 10h12"/>',
    lampu: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    meja: '<path d="M3 8h18M5 8v11M19 8v11M8 8v6h8V8"/>',
    proyektor: '<rect x="3" y="8" width="18" height="9" rx="2"/><circle cx="15" cy="12.5" r="2.5"/><path d="M6 17v2M18 17v2"/>',
    toilet: '<path d="M7 3h6v7H7z"/><path d="M5 10h12a0 0 0 0 1 0 0 6 6 0 0 1-6 6H9a4 4 0 0 1-4-4v-2z"/><path d="M9 16l-1 5h6l-1-5"/>',
    komputer: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    cari: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    kamera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  };
  const svg = (k) =>
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKON[k]}</svg>`;

  const LANGKAH = [
    ["Pilih yang rusak", "Satu ketukan di ubin kategori."],
    ["Pilih tempatnya", "Cari ruang, lab, atau toilet."],
    ["Tulis singkat + foto", "Foto bantu petugas bawa alat yang tepat."],
    ["Cek, lalu kirim", "Nomor laporan langsung keluar."],
  ];

  window.htmlAplikasi = function () {
    const kat = [
      ["ac", "AC"],
      ["lampu", "Lampu"],
      ["meja", "Meja"],
      ["proyektor", "Proyektor"],
      ["toilet", "Toilet"],
      ["komputer", "Komputer"],
    ];
    const lok = ["Lab RPL 1", "Ruang kelas XI PPLG 4", "Perpustakaan", "Toilet lantai 2", "Aula"];
    return `
    <section class="aplikasi" id="aplikasi" aria-label="Lapor lewat aplikasi Android">
      <div class="aplikasi__panggung" id="aplikasiPanggung">
        <div class="aplikasi__teks">
          <p class="aplikasi__label"><span class="simpul"></span>Aplikasi Android FasTanggap</p>
          <h2>Atau lewat aplikasi.<br />Empat ketukan.</h2>
          <ol class="aplikasi__langkah">
            ${LANGKAH.map(
              ([j, k], i) => `<li data-i="${i}"><span>${i + 1}</span><div><b>${j}</b><small>${k}</small></div></li>`
            ).join("")}
          </ol>
        </div>
        <div class="hp" aria-hidden="true">
          <div class="hp__poni"></div>
          <div class="hp__layar">
            <div class="hp__kepala">
              <span class="hp__kembali">&#8592;</span>
              <span class="hp__progres"><i></i><i></i><i></i><i></i></span>
              <span class="hp__nomor" id="hpNomor">1/4</span>
            </div>
            <div class="hp__jendela">
              <div class="hp__geser" id="hpGeser">
                <section class="hp__hal">
                  <h4>Apa yang rusak?</h4>
                  <div class="hp__kisi">
                    ${kat.map(([k, n]) => `<span class="hp__ubin" data-hp="${k}">${svg(k)}<b>${n}</b></span>`).join("")}
                  </div>
                </section>
                <section class="hp__hal">
                  <h4>Di mana?</h4>
                  <span class="hp__cari">${svg("cari")}Cari ruang, lab, toilet&hellip;</span>
                  ${lok
                    .map((n) => `<span class="hp__baris" data-hp="${n === "Ruang kelas XI PPLG 4" ? "lok" : ""}">${svg("pin")}${n}</span>`)
                    .join("")}
                </section>
                <section class="hp__hal">
                  <h4>Ceritakan sedikit</h4>
                  <span class="hp__isian"><span id="hpJudul"></span><i class="hp__kursor"></i></span>
                  <span class="hp__isian hp__isian--tinggi"><span id="hpKet"></span></span>
                  <span class="hp__foto" id="hpFoto">${svg("kamera")}<small>Tambah foto</small></span>
                  <span class="hp__tombol" data-hp="lanjut">Lanjut</span>
                </section>
                <section class="hp__hal">
                  <h4>Cek sebelum kirim</h4>
                  <span class="hp__ringkas"><small>KATEGORI</small><b>AC dan pendingin</b></span>
                  <span class="hp__ringkas"><small>LOKASI</small><b>Ruang kelas XI PPLG 4</b></span>
                  <span class="hp__ringkas"><small>KETERANGAN</small><b>AC tidak dingin. Menetes ke meja depan sejak Senin.</b></span>
                  <span class="hp__tombol" data-hp="kirim">Kirim laporan</span>
                </section>
              </div>
            </div>
            <div class="hp__terkirim" id="hpTerkirim">
              <span class="hp__centang">&#10003;</span>
              <b>Laporan terkirim</b>
              <span class="hp__kode">FT-2611-014</span>
              <small>Petugas sarana langsung dapat kabar.</small>
            </div>
          </div>
          <span class="hp__jari" id="hpJari"></span>
        </div>
      </div>
    </section>`;
  };

  let pendengar = null;

  window.pasangAplikasi = function () {
    const bagian = document.querySelector("#aplikasi");
    if (!bagian) return;
    const panggung = bagian.querySelector("#aplikasiPanggung");
    const hp = bagian.querySelector(".hp");
    const geser = bagian.querySelector("#hpGeser");
    const nomor = bagian.querySelector("#hpNomor");
    const progres = [...bagian.querySelectorAll(".hp__progres i")];
    const langkah = [...bagian.querySelectorAll(".aplikasi__langkah li")];
    const judul = bagian.querySelector("#hpJudul");
    const ket = bagian.querySelector("#hpKet");
    const foto = bagian.querySelector("#hpFoto");
    const terkirim = bagian.querySelector("#hpTerkirim");
    const jari = bagian.querySelector("#hpJari");
    const target = {
      ac: bagian.querySelector('[data-hp="ac"]'),
      lok: bagian.querySelector('[data-hp="lok"]'),
      lanjut: bagian.querySelector('[data-hp="lanjut"]'),
      kirim: bagian.querySelector('[data-hp="kirim"]'),
    };
    const hemat = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const jepit = (n) => Math.min(1, Math.max(0, n));
    const antara = (p, a, b) => jepit((p - a) / (b - a));
    const halus = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const ketik = (node, teks, t) => {
      node.textContent = teks.slice(0, Math.round(teks.length * jepit(t)));
    };
    const JUDUL = "AC tidak dingin";
    const KET = "Menetes ke meja depan sejak Senin.";

    // Titik ketuk (dalam progres 0..1) dan halaman tempat tombolnya berada.
    const KETUK = [
      { p: 0.14, el: target.ac, hal: 0 },
      { p: 0.34, el: target.lok, hal: 1 },
      { p: 0.62, el: target.lanjut, hal: 2 },
      { p: 0.82, el: target.kirim, hal: 3 },
    ];

    const perbarui = () => {
      if (!bagian.isConnected) {
        removeEventListener("scroll", pendengar);
        return;
      }
      const atas = bagian.getBoundingClientRect().top;
      const jarak = Math.max(1, bagian.offsetHeight - panggung.offsetHeight);
      const p = hemat ? 0.7 : jepit(-atas / jarak);

      // Pindah halaman sedikit setelah tiap ketukan.
      const posisi = halus(antara(p, 0.16, 0.21)) + halus(antara(p, 0.36, 0.41)) + halus(antara(p, 0.64, 0.69));
      const hal = Math.round(posisi);
      geser.style.transform = `translateX(${-posisi * 25}%)`;
      nomor.textContent = `${Math.min(4, hal + 1)}/4`;
      progres.forEach((b, i) => b.classList.toggle("isi", i <= hal));
      langkah.forEach((li, i) => {
        li.classList.toggle("aktif", i === hal && p < 0.86);
        li.classList.toggle("lewat", i < hal || p >= 0.86);
      });

      ketik(judul, JUDUL, antara(p, 0.43, 0.5));
      ketik(ket, KET, antara(p, 0.5, 0.58));
      foto.classList.toggle("ada", p > 0.59);
      KETUK.forEach((k) => k.el && k.el.classList.toggle("pilih", p >= k.p));
      terkirim.classList.toggle("tampil", p >= 0.86);

      // Jari menuju tombol berikutnya; "mengetuk" saat dekat titik ketuk.
      const k = KETUK.find((x) => p < x.p + 0.03) || KETUK[KETUK.length - 1];
      if (k.el) {
        const skala = hp.getBoundingClientRect().width / hp.offsetWidth || 1;
        const kh = hp.getBoundingClientRect();
        const kt = k.el.getBoundingClientRect();
        // Tombol yang halamannya belum tergeser masuk: koreksi geseran supaya jari menunggu di posisinya.
        const lebarHal = geser.parentElement.getBoundingClientRect().width;
        const koreksi = (posisi - k.hal) * lebarHal;
        const x = (kt.left - kh.left + koreksi) / skala + kt.width / skala / 2;
        const y = (kt.top - kh.top) / skala + kt.height / skala / 2;
        jari.style.transform = `translate(${x}px, ${y}px)`;
        jari.classList.toggle("ketuk", Math.abs(p - k.p) < 0.018);
      }
      jari.style.opacity = p < 0.04 || p >= 0.85 ? 0 : 1;
    };

    if (pendengar) removeEventListener("scroll", pendengar);
    let antre = false;
    pendengar = () => {
      if (antre) return;
      antre = true;
      requestAnimationFrame(() => {
        antre = false;
        perbarui();
      });
    };
    addEventListener("scroll", pendengar, { passive: true });
    addEventListener("resize", pendengar);
    perbarui();
  };
})();
