/*
 * gerak.js
 * Animasi ringan FasTanggap: elemen muncul saat digulir, angka berhitung,
 * bilah progres gulir, dan bayangan kepala halaman.
 * Semua dimatikan kalau pengguna memilih "kurangi gerakan".
 */
(() => {
  const hemat = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const konten = document.querySelector("#konten");
  const bilah = document.querySelector("#bilah");

  // Elemen di halaman dalam yang otomatis ikut muncul saat digulir.
  const OTOMATIS = [".formulir", ".kartu", ".baris-laporan", ".kosong", ".ringkas__sel", "table tbody tr"].join(",");

  const progres = document.createElement("div");
  progres.className = "progres-gulir";
  progres.setAttribute("aria-hidden", "true");
  document.body.appendChild(progres);

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
    { threshold: 0.12, rootMargin: "0px 0px -5% 0px" }
  );

  function hitung(el) {
    if (el.dataset.dihitung) return;
    el.dataset.dihitung = "1";
    const akhir = Number(el.dataset.hitung) || 0;
    if (hemat || akhir === 0) {
      el.textContent = akhir;
      return;
    }
    const lama = 1000;
    const mulai = performance.now();
    const langkah = (t) => {
      const p = Math.min(1, (t - mulai) / lama);
      el.textContent = Math.round(akhir * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(langkah);
    };
    requestAnimationFrame(langkah);
  }

  function siapkanHalaman() {
    konten.classList.remove("masuk");
    void konten.offsetWidth;
    konten.classList.add("masuk");

    konten.querySelectorAll(OTOMATIS).forEach((el, i) => {
      if (el.closest("[data-muncul]") || el.hasAttribute("data-muncul")) return;
      el.setAttribute("data-muncul", "");
      el.style.setProperty("--tunda", `${Math.min(i, 8) * 0.04}s`);
    });
    konten.querySelectorAll("[data-muncul]:not(.tampak)").forEach((el) => {
      if (hemat) el.classList.add("tampak");
      else pengamat.observe(el);
    });
    konten.querySelectorAll("[data-hitung]").forEach((el) => {
      if (!el.closest("[data-muncul]")) pengamat.observe(el);
    });
  }

  // Kartu kategori: warna merah menyebar dari titik kursor masuk.
  konten.addEventListener("pointerover", (e) => {
    const kartu = e.target.closest(".kategori-kartu");
    if (!kartu || kartu.contains(e.relatedTarget)) return;
    const r = kartu.getBoundingClientRect();
    kartu.style.setProperty("--x", `${e.clientX - r.left}px`);
    kartu.style.setProperty("--y", `${e.clientY - r.top}px`);
  });

  new MutationObserver(siapkanHalaman).observe(konten, { childList: true });
  siapkanHalaman();

  let antre = false;
  function saatGulir() {
    antre = false;
    const y = scrollY;
    const tinggi = document.documentElement.scrollHeight - innerHeight;
    progres.style.transform = `scaleX(${tinggi > 0 ? y / tinggi : 0})`;
    bilah.classList.toggle("bilah--gulir", y > 40);
  }
  addEventListener(
    "scroll",
    () => {
      if (!antre) {
        antre = true;
        requestAnimationFrame(saatGulir);
      }
    },
    { passive: true }
  );
  saatGulir();
})();
