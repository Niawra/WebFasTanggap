/*
 * gulir-halus.js
 * Gulir halus pakai Lenis (seperti situs AFTERTONE).
 * Dilewati kalau pengguna memilih "kurangi gerakan".
 * Instansinya disimpan di window.__lenis supaya skrip lain bisa memakainya.
 */
(() => {
  if (typeof Lenis === "undefined") return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
  window.__lenis = lenis;

  function putar(waktu) {
    lenis.raf(waktu);
    requestAnimationFrame(putar);
  }
  requestAnimationFrame(putar);
})();

/* Bantuan gulir: lewat Lenis kalau aktif, kalau tidak pakai bawaan browser. */
window.gulirKe = function (tujuan, opsi = {}) {
  const lenis = window.__lenis;
  if (lenis) {
    lenis.scrollTo(tujuan, { immediate: !!opsi.langsung, force: true });
    return;
  }
  const atas = typeof tujuan === "number" ? tujuan : tujuan.getBoundingClientRect().top + scrollY;
  const hemat = matchMedia("(prefers-reduced-motion: reduce)").matches;
  scrollTo({ top: atas, behavior: opsi.langsung || hemat ? "auto" : "smooth" });
};
