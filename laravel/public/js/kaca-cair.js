/*
 * Kaca cair (liquid glass) untuk FasTanggap.
 *
 * Teknik terinspirasi dari iyinchao/liquid-glass-studio (MIT): refraksi di tepi
 * kaca berbentuk rounded-rect, sorotan specular, dan sedikit chromatic aberration.
 * Implementasi ini ditulis ulang dan jauh lebih ringan: bukan WebGL, melainkan
 * peta displacement yang dihitung sekali di <canvas> lalu dipakai oleh filter SVG
 * (feDisplacementMap) lewat `backdrop-filter: url(#...)`.
 *
 * Hanya browser Chromium yang mendukung SVG filter di backdrop-filter. Browser lain
 * (Safari, Firefox) dan pengguna prefers-reduced-motion / perangkat lemah tetap
 * mendapat kaca buram biasa dari CSS (lihat kaca-cair.css).
 *
 * Pakai: beri elemen atribut data-kaca. Opsional: data-kaca-tepi="18" (lebar bezel px),
 * data-kaca-kuat="28" (kekuatan refraksi px).
 */
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const akar = document.documentElement;

  // ?kaca=paksa : abaikan preferensi sistem (untuk demo/verifikasi saja).
  const paksa = /[?&]kaca=paksa(&|$)/.test(location.search);
  if (paksa) akar.classList.add("kaca-paksa");

  function didukung() {
    const ua = navigator.userAgent;
    // Hanya Chromium yang merender url() di backdrop-filter. Safari/Firefox menerima
    // properti itu di CSS.supports tapi hasilnya kosong, jadi deteksi lewat UA.
    const chromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\//.test(ua);
    if (!chromium) return false;
    if (!CSS.supports("backdrop-filter", "blur(1px)")) return false;
    if (paksa) return true;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (matchMedia("(prefers-reduced-transparency: reduce)").matches) return false;
    // HP sangat lemah: lewati efek mahal.
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
    return true;
  }

  if (!didukung()) return;
  akar.classList.add("kaca-svg");

  const wadah = document.createElementNS(SVG_NS, "svg");
  wadah.setAttribute("aria-hidden", "true");
  wadah.setAttribute("width", "0");
  wadah.setAttribute("height", "0");
  wadah.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  const defs = document.createElementNS(SVG_NS, "defs");
  wadah.appendChild(defs);
  (document.body || akar).appendChild(wadah);

  /**
   * Peta displacement: R = geser X, G = geser Y (128 = diam).
   * Di dalam bezel selebar `tepi`, piksel didorong ke arah dalam mengikuti normal SDF
   * rounded-rect, dengan profil kuadrat (kuat di tepi, nol di tengah) seperti lensa cembung.
   * Peta dibuat di resolusi setengah supaya murah; filter SVG menskalakannya.
   */
  function buatPeta(w, h, radius, tepi) {
    const skala = 0.5;
    const cw = Math.max(2, Math.round(w * skala));
    const ch = Math.max(2, Math.round(h * skala));
    const kanvas = document.createElement("canvas");
    kanvas.width = cw;
    kanvas.height = ch;
    const ctx = kanvas.getContext("2d");
    const data = ctx.createImageData(cw, ch);
    const px = data.data;
    const r = Math.min(radius, w / 2, h / 2);
    const hx = w / 2;
    const hy = h / 2;

    for (let j = 0; j < ch; j++) {
      const y = (j + 0.5) / skala - hy;
      for (let i = 0; i < cw; i++) {
        const x = (i + 0.5) / skala - hx;
        // SDF rounded-rect (negatif di dalam).
        const qx = Math.abs(x) - (hx - r);
        const qy = Math.abs(y) - (hy - r);
        const ox = Math.max(qx, 0);
        const oy = Math.max(qy, 0);
        const luar = Math.hypot(ox, oy);
        const sdf = luar + Math.min(Math.max(qx, qy), 0) - r;
        const dalam = -sdf; // jarak ke tepi, positif di dalam

        let dx = 0;
        let dy = 0;
        if (dalam > 0 && dalam < tepi) {
          // Normal keluar dari SDF.
          let nx, ny;
          if (luar > 0) {
            nx = (ox / luar) * Math.sign(x);
            ny = (oy / luar) * Math.sign(y);
          } else if (qx > qy) {
            nx = Math.sign(x);
            ny = 0;
          } else {
            nx = 0;
            ny = Math.sign(y);
          }
          const t = 1 - dalam / tepi;
          const kuat = t * t;
          // Ambil sampel dari arah dalam: kaca "melipat" isi di tepinya.
          dx = -nx * kuat;
          dy = -ny * kuat;
        }
        const k = (j * cw + i) * 4;
        px[k] = 128 + dx * 127;
        px[k + 1] = 128 + dy * 127;
        px[k + 2] = 128;
        px[k + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    return kanvas.toDataURL();
  }

  function el(nama, attr) {
    const n = document.createElementNS(SVG_NS, nama);
    for (const k in attr) n.setAttribute(k, attr[k]);
    return n;
  }

  /** Filter: blur ringan -> 3 displacement (R,G,B beda skala = chromatic aberration) -> gabung. */
  function buatFilter(id, w, h, peta, kuat) {
    const f = el("filter", {
      id,
      x: "0",
      y: "0",
      width: w,
      height: h,
      filterUnits: "userSpaceOnUse",
      "color-interpolation-filters": "sRGB",
    });
    f.appendChild(el("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "3", result: "buram" }));
    const img = el("feImage", { x: "0", y: "0", width: w, height: h, preserveAspectRatio: "none", result: "peta" });
    img.setAttribute("href", peta);
    f.appendChild(img);

    const kanal = [
      ["merah", kuat * 1.0, "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"],
      ["hijau", kuat * 0.94, "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"],
      ["biru", kuat * 0.88, "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"],
    ];
    for (const [nama, s, matriks] of kanal) {
      f.appendChild(
        el("feDisplacementMap", {
          in: "buram",
          in2: "peta",
          scale: s.toFixed(1),
          xChannelSelector: "R",
          yChannelSelector: "G",
          result: "d-" + nama,
        })
      );
      f.appendChild(el("feColorMatrix", { in: "d-" + nama, type: "matrix", values: matriks, result: "c-" + nama }));
    }
    f.appendChild(el("feBlend", { in: "c-merah", in2: "c-hijau", mode: "screen", result: "rg" }));
    f.appendChild(el("feBlend", { in: "rg", in2: "c-biru", mode: "screen", result: "rgb" }));
    // Sedikit lebih jenuh supaya warna di balik kaca terasa "hidup".
    f.appendChild(el("feColorMatrix", { in: "rgb", type: "saturate", values: "1.5" }));
    return f;
  }

  let nomor = 0;
  const daftar = new Map();

  function perbarui(target) {
    const st = daftar.get(target);
    const kotak = target.getBoundingClientRect();
    const w = Math.round(kotak.width);
    const h = Math.round(kotak.height);
    if (w < 8 || h < 8) return;
    if (st.w === w && st.h === h) return;
    st.w = w;
    st.h = h;
    const gaya = getComputedStyle(target);
    const radius = parseFloat(gaya.borderTopLeftRadius) || 0;
    const tepi = parseFloat(target.dataset.kacaTepi) || Math.min(20, h * 0.4);
    const kuat = parseFloat(target.dataset.kacaKuat) || 26;
    const baru = buatFilter(st.id, w, h, buatPeta(w, h, radius, tepi), kuat);
    if (st.filter) st.filter.replaceWith(baru);
    else defs.appendChild(baru);
    st.filter = baru;
    // Ganti nilai untuk memaksa browser memuat ulang filter yang berubah ukuran.
    target.style.setProperty("--kaca-filter", "url(#" + st.id + ")");
    target.classList.add("kaca-aktif");
  }

  let antre = new Set();
  let bingkai = 0;
  function jadwalkan(target) {
    antre.add(target);
    if (bingkai) return;
    // Tunggu transisi ukuran selesai sebelum menghitung ulang peta.
    bingkai = setTimeout(() => {
      bingkai = 0;
      const set = antre;
      antre = new Set();
      set.forEach(perbarui);
    }, 160);
  }

  const pengamat = new ResizeObserver((entri) => entri.forEach((e) => jadwalkan(e.target)));

  function pasang(target) {
    if (daftar.has(target)) return;
    daftar.set(target, { id: "kaca-cair-" + ++nomor, w: 0, h: 0, filter: null });
    pengamat.observe(target);
    perbarui(target);
  }

  function pindai(akarCari) {
    (akarCari || document).querySelectorAll("[data-kaca]").forEach(pasang);
  }

  window.KacaCair = { pasang, pindai };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => pindai());
  else pindai();
})();
