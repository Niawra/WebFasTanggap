/*
 * cerita3d.js
 * Adegan 3D "Perjalanan satu laporan" di beranda FasTanggap.
 * Sudut kelas yang rusak (meja patah, kursi terguling, lampu mati, AC menetes)
 * diperbaiki sedikit demi sedikit mengikuti gulir halaman.
 *
 * Progres 0..4 dibaca dari window.progresCerita() (app.js), lalu dihaluskan.
 *   0 rusak · 1 dilaporkan · 2 diperiksa · 3 diproses · 4 selesai
 * Semua keadaan dihitung dari progres, jadi gulir mundur memutar balik adegan.
 */
import * as THREE from "three";

const HEMAT = matchMedia("(prefers-reduced-motion: reduce)").matches;
const WARNA = {
  merah: 0xdd3333,
  merahTua: 0xb82525,
  tunggu: 0xd99a1e,
  proses: 0x2f6fb3,
  selesai: 0x2f8a55,
  kayu: 0xc9996b,
  besi: 0x3a3434,
  dinding: 0xf4ece7,
  lantai: 0xe9ddd5,
};

const jepit = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const halus = (a, b, x) => {
  const t = jepit((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const redam = (kini, tuju, laju, dt) => lerp(kini, tuju, 1 - Math.exp(-laju * dt));
// Denyut 0..1..0 di sekitar titik pusat (untuk percikan las).
const denyut = (pusat, lebar, x) => Math.max(0, 1 - Math.abs(x - pusat) / lebar);

let aktif = null;

function bangun(kanvas) {
  const renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const adegan = new THREE.Scene();
  const latarRusak = new THREE.Color(0x1d1817);
  const latarBaik = new THREE.Color(0xfbf5f2);
  adegan.background = latarRusak.clone();
  adegan.fog = new THREE.Fog(latarRusak.clone(), 7, 16);

  const kamera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);

  /* ---------- cahaya ---------- */
  const langit = new THREE.HemisphereLight(0xfff4ec, 0x3a2c28, 0.3);
  adegan.add(langit);
  const matahari = new THREE.DirectionalLight(0xffe7d1, 0.4);
  matahari.position.set(4, 6, 3);
  matahari.castShadow = true;
  matahari.shadow.mapSize.set(1024, 1024);
  matahari.shadow.camera.left = -4;
  matahari.shadow.camera.right = 4;
  matahari.shadow.camera.top = 4;
  matahari.shadow.camera.bottom = -4;
  matahari.shadow.bias = -0.0008;
  adegan.add(matahari);
  const lampuTitik = new THREE.PointLight(0xffd9a8, 0, 7, 1.6);
  lampuTitik.position.set(0.1, 2.15, 0.1);
  lampuTitik.castShadow = true;
  lampuTitik.shadow.mapSize.set(512, 512);
  adegan.add(lampuTitik);
  const sorotMerah = new THREE.PointLight(WARNA.merah, 1.2, 5, 2);
  sorotMerah.position.set(0.8, 1.4, 1.4);
  adegan.add(sorotMerah);

  /* ---------- bahan ---------- */
  const bahan = (warna, kasar = 0.7, logam = 0) => new THREE.MeshStandardMaterial({ color: warna, roughness: kasar, metalness: logam });
  const kayu = bahan(WARNA.kayu, 0.55);
  const besi = bahan(WARNA.besi, 0.45, 0.4);
  const putih = bahan(0xffffff, 0.6);
  const kotak = (w, h, d, m) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  /* ---------- ruang ---------- */
  const lantai = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), bahan(WARNA.lantai, 0.9));
  lantai.rotation.x = -Math.PI / 2;
  lantai.receiveShadow = true;
  adegan.add(lantai);
  // garis ubin
  const ubin = new THREE.GridHelper(14, 28, 0xcbb9ae, 0xd8c9bf);
  ubin.position.y = 0.002;
  ubin.material.transparent = true;
  ubin.material.opacity = 0.5;
  adegan.add(ubin);
  const dinding = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), bahan(WARNA.dinding, 0.95));
  dinding.position.set(0, 3, -2.5);
  dinding.receiveShadow = true;
  adegan.add(dinding);
  const dindingSisi = dinding.clone();
  dindingSisi.rotation.y = Math.PI / 2;
  dindingSisi.position.set(-3.2, 3, 4.5);
  adegan.add(dindingSisi);
  // list merah di dinding, khas sekolah
  const list = kotak(14, 0.12, 0.02, bahan(WARNA.merah, 0.6));
  list.position.set(0, 0.95, -2.49);
  adegan.add(list);
  // papan tulis
  const papan = kotak(2.4, 1.1, 0.05, bahan(0x2c3b33, 0.85));
  papan.position.set(1.2, 1.85, -2.46);
  adegan.add(papan);
  const bingkaiPapan = kotak(2.5, 1.2, 0.03, bahan(0xd6c7bb, 0.7));
  bingkaiPapan.position.set(1.2, 1.85, -2.48);
  adegan.add(bingkaiPapan);

  /* ---------- meja ---------- */
  const meja = new THREE.Group();
  adegan.add(meja);
  const atasKiri = kotak(0.62, 0.05, 0.62, kayu);
  const atasKanan = kotak(0.62, 0.05, 0.62, kayu);
  meja.add(atasKiri, atasKanan);
  const kaki = [];
  for (const [x, z] of [[-0.56, -0.26], [0.56, -0.26], [-0.56, 0.26], [0.56, 0.26]]) {
    const k = kotak(0.05, 0.72, 0.05, besi);
    k.userData.baik = new THREE.Vector3(x, 0.36, z);
    k.position.copy(k.userData.baik);
    meja.add(k);
    kaki.push(k);
  }
  const palang = kotak(1.1, 0.04, 0.04, besi);
  palang.position.set(0, 0.2, -0.26);
  meja.add(palang);

  /* ---------- kursi (berporos di kaki belakang supaya bisa terguling) ---------- */
  const kursiPoros = new THREE.Group();
  kursiPoros.position.set(0.15, 0, 0.98);
  adegan.add(kursiPoros);
  const kursi = new THREE.Group();
  kursi.position.z = -0.2;
  kursiPoros.add(kursi);
  const dudukan = kotak(0.44, 0.04, 0.42, kayu);
  dudukan.position.set(0, 0.45, 0);
  const sandaran = kotak(0.44, 0.3, 0.03, kayu);
  sandaran.position.set(0, 0.72, 0.2);
  kursi.add(dudukan, sandaran);
  for (const [x, z, h] of [[-0.19, -0.18, 0.45], [0.19, -0.18, 0.45], [-0.19, 0.19, 0.86], [0.19, 0.19, 0.86]]) {
    const k = kotak(0.035, h, 0.035, besi);
    k.position.set(x, h / 2, z);
    kursi.add(k);
  }

  /* ---------- lampu gantung ---------- */
  const lampu = new THREE.Group();
  lampu.position.set(0.1, 3.4, 0.1);
  adegan.add(lampu);
  const tali = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.05), besi);
  tali.position.y = -0.52;
  lampu.add(tali);
  const kapLampu = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 32, 1, true), bahan(WARNA.merah, 0.5));
  kapLampu.material.side = THREE.DoubleSide;
  kapLampu.position.y = -1.12;
  kapLampu.castShadow = true;
  lampu.add(kapLampu);
  const bohlam = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xfff3dd, emissive: 0xffc77a, emissiveIntensity: 0, roughness: 0.3 })
  );
  bohlam.position.y = -1.22;
  lampu.add(bohlam);

  /* ---------- AC di dinding ---------- */
  const ac = new THREE.Group();
  ac.position.set(-1.55, 2.15, -2.36);
  adegan.add(ac);
  ac.add(kotak(1.0, 0.32, 0.22, putih));
  for (let i = 0; i < 5; i++) {
    const kisi = kotak(0.86, 0.012, 0.02, bahan(0xbdb5b0, 0.6));
    kisi.position.set(0, -0.12 + i * 0.012, 0.11);
    ac.add(kisi);
  }
  const lampuAc = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshBasicMaterial({ color: WARNA.merah }));
  lampuAc.position.set(0.4, 0.08, 0.115);
  ac.add(lampuAc);
  // tetesan air
  const TETES = 7;
  const tetes = [];
  const bahanTetes = new THREE.MeshStandardMaterial({ color: 0x7fb5e6, roughness: 0.1, transparent: true, opacity: 0.85 });
  for (let i = 0; i < TETES; i++) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), bahanTetes);
    t.scale.y = 1.5;
    t.userData.fase = i / TETES;
    adegan.add(t);
    tetes.push(t);
  }
  const genangan = new THREE.Mesh(new THREE.CircleGeometry(0.32, 32), new THREE.MeshStandardMaterial({ color: 0x8cb8e0, transparent: true, opacity: 0.5, roughness: 0.05 }));
  genangan.rotation.x = -Math.PI / 2;
  genangan.position.set(-1.45, 0.004, -2.05);
  adegan.add(genangan);

  /* ---------- penanda kerusakan ---------- */
  const titikRusak = [
    { pos: new THREE.Vector3(0.62, 1.25, 0.15), mulai: 2.55 }, // meja
    { pos: new THREE.Vector3(0.3, 0.95, 1.35), mulai: 2.95 }, // kursi
    { pos: new THREE.Vector3(0.1, 2.55, 0.1), mulai: 3.25 }, // lampu
    { pos: new THREE.Vector3(-1.55, 2.6, -2.2), mulai: 3.5 }, // AC
  ];
  const penanda = titikRusak.map((d) => {
    const g = new THREE.Group();
    g.position.copy(d.pos);
    const bahanPin = new THREE.MeshBasicMaterial({ color: WARNA.merah, transparent: true });
    const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), bahanPin);
    const ujung = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 16), bahanPin);
    ujung.rotation.x = Math.PI;
    ujung.position.y = -0.1;
    const cincin = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 32), new THREE.MeshBasicMaterial({ color: WARNA.merah, transparent: true, side: THREE.DoubleSide }));
    g.add(kepala, ujung, cincin);
    adegan.add(g);
    return { g, bahanPin, cincin, ...d };
  });

  // cincin pindai (bab diperiksa)
  const pindai = new THREE.Mesh(
    new THREE.RingGeometry(0.96, 1, 96),
    new THREE.MeshBasicMaterial({ color: WARNA.tunggu, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  pindai.rotation.x = -Math.PI / 2;
  pindai.position.set(-0.3, 0.01, 0);
  adegan.add(pindai);

  // percikan las (bab diproses)
  const JUMLAH = 140;
  const posPercik = new Float32Array(JUMLAH * 3);
  const arahPercik = [];
  for (let i = 0; i < JUMLAH; i++) {
    arahPercik.push(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(0.25 + Math.random() * 0.4));
  }
  const geoPercik = new THREE.BufferGeometry();
  geoPercik.setAttribute("position", new THREE.BufferAttribute(posPercik, 3));
  const percik = new THREE.Points(
    geoPercik,
    new THREE.PointsMaterial({ color: 0xffc46b, size: 0.035, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  adegan.add(percik);
  const sambungan = [
    { pos: new THREE.Vector3(0.56, 0.7, 0.26), pusat: 2.85 },
    { pos: new THREE.Vector3(0, 0.76, 0), pusat: 3.1 },
    { pos: new THREE.Vector3(0.15, 0.05, 0.98), pusat: 3.4 },
    { pos: new THREE.Vector3(0.1, 2.2, 0.1), pusat: 3.62 },
  ];

  // kilau "selesai": centang hijau mengambang di tiap titik
  const centang = titikRusak.map((d) => {
    const bentuk = new THREE.Shape();
    bentuk.moveTo(-0.07, 0);
    bentuk.lineTo(-0.025, -0.045);
    bentuk.lineTo(0.075, 0.055);
    bentuk.lineTo(0.06, 0.07);
    bentuk.lineTo(-0.025, -0.015);
    bentuk.lineTo(-0.055, 0.015);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(bentuk), new THREE.MeshBasicMaterial({ color: WARNA.selesai, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    const latar = new THREE.Mesh(new THREE.CircleGeometry(0.12, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    latar.position.z = -0.002;
    const g = new THREE.Group();
    g.add(latar, m);
    g.position.copy(d.pos);
    adegan.add(g);
    return { g, m, latar };
  });

  /* ---------- kamera per bab ---------- */
  const KAM = [
    { p: [3.4, 2.5, 4.0], t: [-0.1, 0.9, -0.2] },
    { p: [2.3, 1.7, 2.9], t: [0.25, 0.75, 0.25] },
    { p: [-0.2, 2.4, 3.4], t: [-0.6, 1.3, -0.6] },
    { p: [1.7, 1.25, 2.3], t: [0.2, 0.7, 0.35] },
    { p: [3.8, 2.3, 4.6], t: [-0.3, 1.1, -0.4] },
  ];
  const kp = new THREE.Vector3();
  const kt = new THREE.Vector3();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  function aturKamera(p, mx, my) {
    const i = Math.min(KAM.length - 2, Math.floor(p));
    const f = halus(0, 1, p - i);
    tmpA.fromArray(KAM[i].p);
    tmpB.fromArray(KAM[i + 1].p);
    kp.lerpVectors(tmpA, tmpB, f);
    tmpA.fromArray(KAM[i].t);
    tmpB.fromArray(KAM[i + 1].t);
    kt.lerpVectors(tmpA, tmpB, f);
    kamera.position.set(kp.x + mx * 0.35, kp.y - my * 0.2, kp.z);
    kamera.lookAt(kt);
    // layar tegak: mundurkan kamera supaya adegan tetap muat
    const tegak = kamera.aspect < 1;
    if (tegak) kamera.position.addScaledVector(tmpA.subVectors(kamera.position, kt).normalize(), 1.6);
  }

  /* ---------- keadaan per progres ---------- */
  const qBaik = new THREE.Quaternion();
  const qRusak = new THREE.Quaternion();
  const e = new THREE.Euler();
  const warnaPin = new THREE.Color();
  const cTunggu = new THREE.Color(WARNA.tunggu);
  const cMerah = new THREE.Color(WARNA.merah);
  const cProses = new THREE.Color(WARNA.proses);

  function terapkan(p, waktu) {
    // faktor perbaikan tiap benda (0 rusak, 1 baik)
    const fKaki = halus(2.6, 3.0, p);
    const fAtas = halus(2.9, 3.3, p);
    const fKursi = halus(3.15, 3.6, p);
    const fLampu = halus(3.4, 3.8, p);
    const fAc = halus(3.55, 3.95, p);
    const fSelesai = halus(3.7, 4, p);

    // meja: dua papan atas patah, satu kaki tergeletak
    atasKiri.position.set(lerp(-0.34, -0.3, fAtas), lerp(0.73, 0.745, fAtas), 0);
    atasKiri.rotation.z = lerp(0.07, 0, fAtas);
    atasKanan.position.set(lerp(0.42, 0.3, fAtas), lerp(0.6, 0.745, fAtas), lerp(0.04, 0, fAtas));
    atasKanan.rotation.set(lerp(0.12, 0, fAtas), 0, lerp(-0.38, 0, fAtas));
    const kakiPatah = kaki[3];
    kakiPatah.position.set(
      lerp(0.95, kakiPatah.userData.baik.x, fKaki),
      lerp(0.03, 0.36, fKaki) + Math.sin(fKaki * Math.PI) * 0.35,
      lerp(0.62, kakiPatah.userData.baik.z, fKaki)
    );
    e.set(0, 0.7, Math.PI / 2);
    qRusak.setFromEuler(e);
    qBaik.identity();
    kakiPatah.quaternion.slerpQuaternions(qRusak, qBaik, fKaki);

    // kursi terguling ke belakang
    kursiPoros.rotation.set(lerp(1.38, 0, fKursi), lerp(0.5, 0, fKursi), 0);
    kursiPoros.position.y = Math.sin(fKursi * Math.PI) * 0.12;

    // lampu: kap miring dan bohlam mati, sesekali berkedip
    lampu.rotation.z = lerp(0.42, 0, fLampu) + (HEMAT ? 0 : Math.sin(waktu * 1.3) * 0.03 * (1 - fLampu));
    const kedip = !HEMAT && p < 3.3 && Math.sin(waktu * 23) > 0.93 && Math.sin(waktu * 3.1) > 0.4 ? 0.6 : 0;
    bohlam.material.emissiveIntensity = Math.max(kedip, fLampu * 2.2);
    lampuTitik.intensity = Math.max(kedip * 2, fLampu * 9);

    // AC menetes sampai diperbaiki
    const deras = 1 - fAc;
    tetes.forEach((t) => {
      const siklus = (waktu * 0.9 + t.userData.fase) % 1;
      t.position.set(-1.45 + Math.sin(t.userData.fase * 9) * 0.03, lerp(1.95, 0.02, siklus * siklus), -2.1);
      t.visible = deras > 0.02;
      t.material.opacity = 0.85 * deras;
    });
    genangan.scale.setScalar(lerp(1, 0.001, fAc));
    genangan.material.opacity = 0.5 * deras;
    lampuAc.material.color.set(fAc > 0.5 ? WARNA.selesai : WARNA.merah);

    // cahaya: kelas gelap & merah → terang & hangat
    const terang = halus(2.6, 4, p);
    langit.intensity = lerp(0.3, 1.1, terang);
    matahari.intensity = lerp(0.4, 2.2, terang);
    sorotMerah.intensity = lerp(1.2, 0, halus(2.4, 3.4, p)) * (HEMAT ? 1 : 0.85 + Math.sin(waktu * 2.4) * 0.15);
    adegan.background.lerpColors(latarRusak, latarBaik, terang);
    adegan.fog.color.copy(adegan.background);

    // penanda: tampil setelah dilaporkan, warnanya ikut status, hilang saat diperbaiki
    const muncul = halus(0.55, 1.1, p);
    penanda.forEach((d, i) => {
      const hilang = halus(d.mulai + 0.15, d.mulai + 0.45, p);
      const skala = muncul * (1 - hilang);
      d.g.visible = skala > 0.01;
      d.g.scale.setScalar(Math.max(0.001, skala));
      d.g.position.y = d.pos.y + (HEMAT ? 0 : Math.sin(waktu * 2 + i) * 0.04);
      d.g.quaternion.copy(kamera.quaternion);
      if (p < 1.5) warnaPin.copy(cMerah);
      else if (p < 2.5) warnaPin.lerpColors(cMerah, cTunggu, halus(1.5, 2, p));
      else warnaPin.lerpColors(cTunggu, cProses, halus(2.5, 2.8, p));
      d.bahanPin.color.copy(warnaPin);
      d.cincin.material.color.copy(warnaPin);
      const t = HEMAT ? 0.5 : (waktu * 0.8 + i * 0.25) % 1;
      d.cincin.scale.setScalar(1 + t * 1.6);
      d.cincin.material.opacity = 0.8 * (1 - t);
    });

    // cincin pindai melebar di bab diperiksa
    const fPindai = jepit((p - 1.55) / 0.9);
    pindai.material.opacity = Math.sin(fPindai * Math.PI) * 0.75;
    pindai.scale.setScalar(0.2 + fPindai * 4.2);

    // percikan las di setiap sambungan saat diperbaiki
    let kuat = 0;
    let titik = sambungan[0];
    sambungan.forEach((s) => {
      const d = denyut(s.pusat, 0.16, p);
      if (d > kuat) {
        kuat = d;
        titik = s;
      }
    });
    percik.material.opacity = kuat;
    if (kuat > 0) {
      const umur = HEMAT ? 0.5 : (waktu * 2.2) % 1;
      for (let i = 0; i < JUMLAH; i++) {
        const fase = (umur + i / JUMLAH) % 1;
        const a = arahPercik[i];
        posPercik[i * 3] = titik.pos.x + a.x * fase;
        posPercik[i * 3 + 1] = titik.pos.y + a.y * fase - 0.6 * fase * fase;
        posPercik[i * 3 + 2] = titik.pos.z + a.z * fase;
      }
      geoPercik.attributes.position.needsUpdate = true;
    }

    // centang hijau saat selesai
    centang.forEach((c, i) => {
      const f = halus(3.72 + i * 0.05, 3.95 + i * 0.03, p);
      c.g.visible = f > 0.01;
      c.g.scale.setScalar(Math.max(0.001, f * (1 + Math.sin(f * Math.PI) * 0.25)));
      c.g.quaternion.copy(kamera.quaternion);
      c.g.position.y = titikRusak[i].pos.y + (HEMAT ? 0 : Math.sin(waktu * 1.6 + i) * 0.03);
      c.m.material.opacity = f;
      c.latar.material.opacity = f * 0.95;
    });

    ubin.material.opacity = lerp(0.25, 0.5, fSelesai);
  }

  /* ---------- siklus ---------- */
  const keadaan = { p: 0, mx: 0, my: 0, tmx: 0, tmy: 0 };
  const gerakMouse = (ev) => {
    keadaan.tmx = (ev.clientX / innerWidth - 0.5) * 2;
    keadaan.tmy = (ev.clientY / innerHeight - 0.5) * 2;
  };
  addEventListener("pointermove", gerakMouse, { passive: true });

  function ukur() {
    const w = kanvas.clientWidth;
    const h = kanvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    kamera.aspect = w / h;
    kamera.fov = kamera.aspect < 1 ? 50 : 38;
    kamera.updateProjectionMatrix();
  }
  const pengukur = new ResizeObserver(ukur);
  pengukur.observe(kanvas);
  ukur();

  let terlihat = true;
  const pengamat = new IntersectionObserver(([en]) => (terlihat = en.isIntersecting), { rootMargin: "100px" });
  pengamat.observe(kanvas);

  let id = 0;
  let lalu = performance.now();
  let waktu = 0;
  function bingkai(kini) {
    id = requestAnimationFrame(bingkai);
    const dt = Math.min(0.05, (kini - lalu) / 1000);
    lalu = kini;
    if (!terlihat) return;
    waktu += dt;
    const tuju = window.progresCerita ? window.progresCerita() : 0;
    keadaan.p = HEMAT ? tuju : redam(keadaan.p, tuju, 6, dt);
    keadaan.mx = redam(keadaan.mx, HEMAT ? 0 : keadaan.tmx, 2.5, dt);
    keadaan.my = redam(keadaan.my, HEMAT ? 0 : keadaan.tmy, 2.5, dt);
    aturKamera(keadaan.p, keadaan.mx, keadaan.my);
    terapkan(keadaan.p, waktu);
    renderer.render(adegan, kamera);
  }
  id = requestAnimationFrame(bingkai);
  kanvas.closest(".cerita__panggung").classList.add("siap3d");

  return {
    kanvas,
    lepas() {
      cancelAnimationFrame(id);
      removeEventListener("pointermove", gerakMouse);
      pengukur.disconnect();
      pengamat.disconnect();
      adegan.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      renderer.dispose();
    },
  };
}

function periksa() {
  const kanvas = document.querySelector("#ceritaKanvas");
  if (aktif && aktif.kanvas !== kanvas) {
    aktif.lepas();
    aktif = null;
  }
  if (kanvas && !aktif) {
    try {
      aktif = bangun(kanvas);
    } catch (galat) {
      console.warn("[FasTanggap] WebGL tidak tersedia, adegan 3D dilewati.", galat);
    }
  }
}

new MutationObserver(periksa).observe(document.querySelector("#konten"), { childList: true });
periksa();
