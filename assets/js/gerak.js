/*
 * gerak.js
 * Lapisan animasi FasTanggap: muncul saat digulir, angka berhitung,
 * tiket miring mengikuti kursor, tombol magnet, dan langkah alur.
 * Semua dimatikan kalau pengguna memilih "kurangi gerakan".
 */
(() => {
  const hemat = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const kursorHalus = matchMedia("(pointer: fine)").matches;
  const konten = document.querySelector("#konten");
  const bilah = document.querySelector("#bilah");

  // Elemen di halaman lain yang otomatis ikut muncul saat digulir.
  const OTOMATIS = [
    ".halaman__kepala",
    ".formulir",
    ".baris-laporan",
    ".kartu",
    ".ringkas__sel",
    ".detail__kolom > *",
    ".rekap__kartu",
    ".kelola__kolom",
    "table tbody tr",
  ].join(",");

  /* ---------- Bilah progres gulir -------------------------------------- */
  const progres = document.createElement("div");
  progres.className = "progres-gulir";
  progres.setAttribute("aria-hidden", "true");
  document.body.appendChild(progres);

  /* ---------- Kursor simpul (desktop) ---------------------------------- */
  let simpul = null;
  if (kursorHalus && !hemat) {
    simpul = document.createElement("div");
    simpul.className = "kursor-simpul";
    simpul.setAttribute("aria-hidden", "true");
    document.body.appendChild(simpul);
    let tx = -100, ty = -100, x = tx, y = ty;
    addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      const target = e.target.closest("a, button, input, select, textarea, label, [data-miring]");
      simpul.classList.toggle("besar", Boolean(target));
    });
    document.addEventListener("pointerleave", () => { tx = ty = -100; });
    const jalan = () => {
      x += (tx - x) * 0.2;
      y += (ty - y) * 0.2;
      simpul.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(jalan);
    };
    jalan();
  }

  /* ---------- Muncul saat digulir -------------------------------------- */
  const pengamat = new IntersectionObserver(
    (entri) => {
      entri.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("tampak");
        e.target.querySelectorAll("[data-hitung]").forEach(hitung);
        if (e.target.matches("[data-hitung]")) hitung(e.target);
        pengamat.unobserve(e.target);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
  );

  function hitung(el) {
    if (el.dataset.dihitung) return;
    el.dataset.dihitung = "1";
    const akhir = Number(el.dataset.hitung) || 0;
    if (hemat || akhir === 0) {
      el.textContent = akhir;
      return;
    }
    const lama = 900 + Math.min(akhir, 50) * 10;
    const mulai = performance.now();
    const langkah = (t) => {
      const p = Math.min(1, (t - mulai) / lama);
      el.textContent = Math.round(akhir * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(langkah);
    };
    requestAnimationFrame(langkah);
  }

  /* ---------- Tiket & layar miring mengikuti kursor -------------------- */
  function pasangMiring(el) {
    if (hemat || !kursorHalus) return;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--ry", `${px * 10}deg`);
      el.style.setProperty("--rx", `${-py * 8}deg`);
      el.style.setProperty("--kx", `${(px + 0.5) * 100}%`);
      el.style.setProperty("--ky", `${(py + 0.5) * 100}%`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--rx", "0deg");
    });
  }

  /* ---------- Tombol magnet -------------------------------------------- */
  function pasangMagnet(el) {
    if (hemat || !kursorHalus) return;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28}px)`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
    });
  }

  /* ---------- Langkah alur yang ikut digulir --------------------------- */
  let pengamatAlur = null;
  function pasangAlur() {
    const daftar = document.querySelector("#alurLangkah");
    if (!daftar) return;
    const item = [...daftar.querySelectorAll(".alur__item")];
    const angka = document.querySelector("#alurAngka");
    if (pengamatAlur) pengamatAlur.disconnect();
    pengamatAlur = new IntersectionObserver(
      (entri) => {
        entri.forEach((e) => {
          if (!e.isIntersecting) return;
          const i = Number(e.target.dataset.langkah);
          item.forEach((el, j) => {
            el.classList.toggle("aktif", j === i);
            el.classList.toggle("lewat", j < i);
          });
          daftar.style.setProperty("--maju", (i + 1) / item.length);
          if (angka) {
            angka.classList.remove("ganti");
            void angka.offsetWidth;
            angka.textContent = String(i + 1).padStart(2, "0");
            angka.classList.add("ganti");
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    item.forEach((el) => pengamatAlur.observe(el));
  }

  /* ---------- Saat tiap halaman digambar ulang ------------------------- */
  function siapkanHalaman() {
    konten.classList.remove("masuk");
    void konten.offsetWidth;
    konten.classList.add("masuk");

    konten.querySelectorAll(OTOMATIS).forEach((el, i) => {
      if (!el.hasAttribute("data-muncul")) {
        el.setAttribute("data-muncul", "");
        el.style.setProperty("--tunda", `${Math.min(i, 8) * 0.04}s`);
      }
    });

    konten.querySelectorAll("[data-muncul]").forEach((el) => {
      if (hemat) el.classList.add("tampak");
      else pengamat.observe(el);
    });
    konten.querySelectorAll("[data-hitung]").forEach((el) => {
      if (!el.closest("[data-muncul]")) pengamat.observe(el);
    });
    konten.querySelectorAll("[data-miring]").forEach(pasangMiring);
    konten.querySelectorAll("[data-magnet]").forEach(pasangMagnet);
    pasangAlur();

    // Judul pembuka: baris naik satu per satu.
    const judul = konten.querySelector(".pembuka__judul");
    if (judul) requestAnimationFrame(() => judul.classList.add("tampak"));
  }

  new MutationObserver((ubah) => {
    if (ubah.some((u) => u.target === konten)) siapkanHalaman();
  }).observe(konten, { childList: true });
  siapkanHalaman();

  /* ---------- Gulir: progres, bilah, paralaks --------------------------- */
  let antre = false;
  function saatGulir() {
    antre = false;
    const y = scrollY;
    const tinggi = document.documentElement.scrollHeight - innerHeight;
    progres.style.transform = `scaleX(${tinggi > 0 ? y / tinggi : 0})`;
    bilah.classList.toggle("bilah--gulir", y > 12);
    if (hemat) return;
    const latar = konten.querySelector(".pembuka__latar");
    if (latar && y < innerHeight * 1.2) latar.style.setProperty("--gulir", y);
    const pita = konten.querySelector(".pita__jalur");
    if (pita) pita.style.setProperty("--geser", `${-y * 0.25}px`);
  }
  addEventListener("scroll", () => {
    if (!antre) {
      antre = true;
      requestAnimationFrame(saatGulir);
    }
  }, { passive: true });
  saatGulir();
})();
