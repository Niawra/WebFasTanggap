/*
 * build.mjs
 * Membangun figur isometrik "meja triage laporan" untuk halaman cara kerja.
 * Jalankan: node build.mjs   (tambahkan --light untuk tema terang)
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import { kitScript } from "./scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const WIDTH = 660;
const HEIGHT = 420;

/* ---------- Ukuran dunia ------------------------------------------------- */

const PLATE = { x: -158, y: -72, w: 316, d: 144, r: 12 };
const PLATE_H = 12;
const FOOT_H = 5;

const RAIL_Y = [-16, 16];
const RAIL_X = [-120, 128];
const RAIL_H = 3;

const CARR = { x: -28, y: -22, w: 56, d: 44, r: 3 };
const CARR_Z = RAIL_H;
const CARR_TOP = 9;

const CARD = { x: -20, y: -16, w: 40, d: 32, r: 1.5 };
const CARD_T = 1.6;

const STOP = [-92, -10, 78];
const REACH = [STOP[0] - 26, STOP[2] + 24];

const SCAN_X = -92;
const SCAN_TOP = 46;
const DIAL = [-10, -4];
const DIAL_R = 17;
const DIAL_Z = 57;
const DIAL_H = 9;
const DIAL_TOP = DIAL_Z + DIAL_H;

const STAMP_X = 78;
const ARM_Z = 44;
const HEAD_UP = 34;
const HEAD_DOWN = 14;
const HEAD_T = 7;

const BOX = { x: -152, y: -66, w: 46, d: 26, r: 2 };
const BOX_H = 24;

const TRAY = { x: 34, y: 44, w: 64, d: 26, r: 2 };

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [SCAN_X, -38, SCAN_TOP + 7],
    [DIAL[0], DIAL[1], DIAL_TOP + 2],
    [STAMP_X, -38, ARM_Z + 6],
  ],
  WIDTH,
  HEIGHT,
  { pad: 34, azimuth: 40 }
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

/* ---------- Bagian: alas ------------------------------------------------- */

function alas() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];

  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }

  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));

  const sekrup = k.corners(PLATE, 10);
  out.push(L(sekrup.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(sekrup.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

  // Pita penggaris di tepi depan
  const pita = { x: -120, y: 60, w: 140, d: 8, r: 1 };
  out.push(S(k.slabOf(pita, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  const tick = k.topTicks(pita.x + 4, pita.x + pita.w - 4, 4, 5, pita.y + 0.8, 0.7, [2, 3.8], P);
  out.push(L(tick.minor, { tone: "lo" }), L(tick.major, { tone: "mid" }));
  out.push(D([at([pita.x + 2, pita.y + 4, 0.7]), at([pita.x + pita.w - 2, pita.y + 4, 0.7])], { size: 0.45 }));

  // Plat nama
  const nama = { x: -152, y: 34, w: 52, d: 22, r: 1.5 };
  out.push(S(k.slabOf(nama, 0, 0.9, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(nama, 2), 0.9, P, 3), { tone: "faint" }));
  out.push(
    L(
      [38, 42, 46, 50].map((y) => k.lineOnTop([nama.x + 5, y], [nama.x + 5 + (y === 38 ? 30 : y === 42 ? 38 : 24), y], 0.9, P)).join(""),
      { tone: "lo" }
    )
  );

  return out.join("");
}

/* ---------- Bagian: bak laporan ditolak (reses di alas) ------------------ */

function bakTolak() {
  const out = [];
  out.push(S(k.slabOf(TRAY, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(TRAY, 1.6), 0.8, P, 4), { tone: "faint" }));

  // bibir rendah pada tiga sisi
  const bibir = [
    { x: TRAY.x, y: TRAY.y, w: TRAY.w, d: 2.2 },
    { x: TRAY.x, y: TRAY.y, w: 2.2, d: TRAY.d },
    { x: TRAY.x + TRAY.w - 2.2, y: TRAY.y, w: 2.2, d: TRAY.d },
  ];
  for (const sisi of bibir) out.push(S(k.slabOf({ ...sisi, r: 0.8 }, 0.8, 3, P, 3, 0.4), { tone: "mid" }));

  // dasar bak dibuat lebih gelap supaya terbaca sebagai wadah
  out.push(S(k.slabOf(k.insetPlan(TRAY, 2.6), 0.8, 0.4, P, 3), { tone: "lo", crease: "none" }));
  out.push(D([at([TRAY.x + 8, TRAY.y + 8, 1.2]), at([TRAY.x + TRAY.w - 8, TRAY.y + TRAY.d - 8, 1.2])], { size: 0.4 }));

  return out.join("");
}

/* ---------- Bagian: rel -------------------------------------------------- */

function rel() {
  const out = [];
  for (const y of RAIL_Y) {
    out.push(S(k.slabOf({ x: RAIL_X[0], y, w: RAIL_X[1] - RAIL_X[0], d: 5, r: 1 }, 0, RAIL_H, P, 3, 0.4), { tone: "mid" }));
    out.push(D([RAIL_X[0] + 8, RAIL_X[1] - 8].map((x) => at([x, y + 2.5, RAIL_H])), { size: 0.4 }));
  }
  for (const x of [RAIL_X[0] - 6, RAIL_X[1]]) {
    out.push(S(k.slabOf({ x, y: -23, w: 6, d: 46, r: 1.2 }, 0, 7, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 3, -18, 7]), at([x + 3, 18, 7])], { size: 0.45 }));
  }
  return out.join("");
}

/* ---------- Bagian: kotak kendali --------------------------------------- */

function kotak() {
  const out = [];
  out.push(S(k.slabOf(BOX, 0, BOX_H, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BOX, 3), BOX_H, P, 4), { tone: "faint" }));
  out.push(L(k.sideSeam(BOX, BOX_H - 3, P, 4), { tone: "faint" }));

  const tombol = [
    [BOX.x + 12, BOX.y + 9],
    [BOX.x + 24, BOX.y + 9],
  ];
  for (const [x, y] of tombol) {
    out.push(S(k.cylinder(x, y, 3.4, BOX_H, 2, P, 20), { tone: "hi" }));
    out.push(L(k.knurl(x, y, 3.4, BOX_H + 1, BOX_H + 2, 18, P), { tone: "lo" }));
  }
  out.push(D([at([BOX.x + 36, BOX.y + 9, BOX_H])], { size: 1.1, tone: "hi" }));
  out.push(L(k.ring(BOX.x + 36, BOX.y + 9, 2.2, BOX_H, P, 14), { tone: "lo" }));
  out.push(D([at([BOX.x + 8, BOX.y + 18, BOX_H]), at([BOX.x + BOX.w - 8, BOX.y + 18, BOX_H])], { size: 0.45 }));
  return out.join("");
}

/* ---------- Bagian: gerbang pemeriksaan --------------------------------- */

function tiangGerbang(y) {
  const out = [];
  const kaki = { x: SCAN_X - 7, y: y - 7, w: 14, d: 14, r: 2.5 };
  out.push(S(k.slabOf(kaki, 0, 3, P, 4, 0.5), { tone: "mid" }));
  out.push(D([at([SCAN_X, y, 3])], { size: 0.5 }));
  out.push(S(k.cylinder(SCAN_X, y, 4, 3, SCAN_TOP - 3, P, 28), { tone: "mid", crease: "none" }));
  out.push(L([16, 30].map((z) => k.sideArc(SCAN_X, y, 4, z, P, 16)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(SCAN_X, y, 4.8, SCAN_TOP, 2.4, P, 28), { tone: "mid" }));
  out.push(L(k.ring(SCAN_X, y, 3.2, SCAN_TOP + 2.4, P, 20), { tone: "lo" }));
  return out.join("");
}

function gerbang() {
  const out = [];
  out.push(S(k.slabOf({ x: SCAN_X - 6, y: -38, w: 12, d: 76, r: 2 }, SCAN_TOP + 2.4, 7, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan({ x: SCAN_X - 6, y: -38, w: 12, d: 76, r: 2 }, 2.4), SCAN_TOP + 9.4, P, 4), { tone: "faint" }));
  out.push(D([at([SCAN_X, -33, SCAN_TOP + 9.4]), at([SCAN_X, 33, SCAN_TOP + 9.4])], { size: 0.45 }));
  // bilah lampu di bawah balok
  out.push(S(k.slabOf({ x: SCAN_X - 4, y: -21, w: 8, d: 42, r: 1.4 }, SCAN_TOP - 2, 2, P, 3, 0.3), { tone: "hi", className: "lampu" }));
  return out.join("");
}

/* ---------- Bagian: dial prioritas -------------------------------------- */

function tiangDial() {
  const out = [];
  const kaki = { x: DIAL[0] - 7, y: -38 - 7, w: 14, d: 14, r: 2.5 };
  out.push(S(k.slabOf(kaki, 0, 3, P, 4, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(DIAL[0], -38, 4, 3, 46, P, 28), { tone: "mid", crease: "none" }));
  out.push(L([14, 26, 38].map((z) => k.sideArc(DIAL[0], -38, 4, z, P, 16)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(DIAL[0], -38, 4.8, 49, 2.4, P, 28), { tone: "mid" }));
  out.push(S(k.slabOf({ x: DIAL[0] - 5, y: -34, w: 10, d: 34, r: 2 }, 51, 5, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([DIAL[0], -30, 56]), at([DIAL[0], -6, 56])], { size: 0.45 }));
  return out.join("");
}

function dial() {
  const out = [];
  const [x, y] = DIAL;
  out.push(S(k.cylinder(x, y, 3, 56, 3, P, 20), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, DIAL_R + 1.6, DIAL_Z - 2, 2.4, P, 64, 0.6), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, DIAL_R, DIAL_Z, DIAL_H, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_Z + DIAL_H - 3.2, DIAL_Z + DIAL_H, 84, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(x, y, DIAL_R - 2.2, DIAL_TOP, P, 64), { tone: "lo" }));
  const tick = k.radialTicks(x, y, DIAL_R - 3, 30, 5, DIAL_TOP, [1.2, 2.6], P, -2.4, 4.8);
  out.push(L(tick.minor, { tone: "lo" }), L(tick.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.7, DIAL_TOP, P, 16), { tone: "mid" }));
  out.push(D([at([x, y, DIAL_TOP])], { size: 0.55, tone: "hi" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 12], DIAL_TOP, P, "x"), "prioritas", { size: 2.6, tone: "lo", anchor: "middle" }));
  return out.join("");
}

/* ---------- Bagian: cap selesai ----------------------------------------- */

function tiangCap() {
  const out = [];
  const kaki = { x: STAMP_X - 7, y: -38 - 7, w: 14, d: 14, r: 2.5 };
  out.push(S(k.slabOf(kaki, 0, 3, P, 4, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(STAMP_X, -38, 4.6, 3, ARM_Z - 3, P, 28), { tone: "mid", crease: "none" }));
  out.push(L([16, 28, 40].map((z) => k.sideArc(STAMP_X, -38, 4.6, z, P, 16)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(STAMP_X, -38, 5.4, ARM_Z, 2.4, P, 28), { tone: "mid" }));
  out.push(S(k.slabOf({ x: STAMP_X - 5, y: -36, w: 10, d: 40, r: 2 }, ARM_Z + 2.4, 6, P, 3, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan({ x: STAMP_X - 5, y: -36, w: 10, d: 40, r: 2 }, 2.4), ARM_Z + 8.4, P, 3), { tone: "faint" }));
  out.push(D([at([STAMP_X, -32, ARM_Z + 8.4]), at([STAMP_X, 0, ARM_Z + 8.4])], { size: 0.45 }));
  // selongsong tetap tempat poros cap meluncur
  out.push(S(k.cylinder(STAMP_X, -6, 4.6, 30, ARM_Z + 2.4 - 30, P, 24), { tone: "mid", crease: "none" }));
  out.push(L(k.sideArc(STAMP_X, -6, 4.6, 34, P, 20), { tone: "faint" }));
  return out.join("");
}

function kepalaCap() {
  const out = [];
  const badan = { x: STAMP_X - 16, y: -13, w: 32, d: 26, r: 3 };
  out.push(S(k.slabOf(badan, 0, HEAD_T, P, 4, 0.6), { tone: "hi" }));
  out.push(L(k.planOutline(k.insetPlan(badan, 3), HEAD_T, P, 4), { tone: "faint" }));
  out.push(S(k.cylinder(STAMP_X, 0, 6.5, HEAD_T, 3.4, P, 28), { tone: "mid" }));
  out.push(L(k.knurl(STAMP_X, 0, 6.5, HEAD_T + 2.4, HEAD_T + 3.4, 26, P, 0.3), { tone: "lo" }));
  // poros yang masuk ke selongsong
  out.push(S(k.cylinder(STAMP_X, 0, 2.4, HEAD_T + 3.4, 10, P, 20), { tone: "lo", crease: "none" }));
  // bantalan karet di bawah
  out.push(S(k.slabOf(k.insetPlan(badan, 3.5), -1.6, 1.6, P, 3), { tone: "lo", crease: "none" }));
  return out.join("");
}

/* ---------- Bagian: kereta dan kartu ------------------------------------ */

function kereta() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CARR, 4), CARR_Z, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(CARR, CARR_Z, CARR_TOP - CARR_Z, P, 5, 0.6), { tone: "mid" }));
  out.push(D([-22, -8, 8, 22].map((x) => at([x, CARR.y + CARR.d - 2.6, CARR_TOP])), { size: 0.4, tone: "lo" }));
  out.push(L(k.lineOnTop([CARR.x, -15], [CARR.x + CARR.w, -15], CARR_TOP, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([CARR.x, 15], [CARR.x + CARR.w, 15], CARR_TOP, P), { tone: "faint" }));

  const pegangan = [CARR.x + CARR.w - 8, CARR.y + CARR.d + 3];
  out.push(S(k.slabOf({ x: pegangan[0] - 2, y: CARR.y + CARR.d - 1, w: 4, d: 4, r: 1 }, CARR_Z + 1, 3, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(pegangan[0], pegangan[1] + 1, 3, CARR_Z, 5, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(pegangan[0], pegangan[1] + 1, 3, CARR_Z, CARR_Z + 5, 18, P), { tone: "lo" }));

  // kartu laporan, bagian yang harus diperhatikan
  out.push(`<path class="iso-halo" d="${k.haloOf(CARD, CARR_TOP, 0.1, P)}" style="filter:blur(3px);opacity:.6"/>`);
  out.push(S(k.slabOf(CARD, CARR_TOP, CARD_T, P, 4, 0.35), { tone: "hi", lit: true, className: "kartu-lapor" }));
  out.push(L(k.planOutline(k.insetPlan(CARD, 2.4), CARR_TOP + CARD_T, P, 4), { tone: "faint" }));
  const baris = [6, 11, 16, 21];
  out.push(
    L(
      baris.map((y) => k.lineOnTop([CARD.x + 4, y], [CARD.x + 4 + (y === 6 ? 26 : y === 11 ? 30 : y === 16 ? 22 : 16), y], CARR_TOP + CARD_T, P)).join(""),
      { tone: "lo", className: "garis-kartu" }
    )
  );
  return out.join("");
}

/* ---------- Kabel ------------------------------------------------------- */

function kabel() {
  const out = [];
  out.push(
    k.wireSvg(at([BOX.x + BOX.w - 2, BOX.y + 6, BOX_H - 6]), at([SCAN_X - 2, -30, 4]), {
      via: [at([-108, -44, 10]), at([-98, -36, 5])],
      tone: "lo",
      size: 1,
    })
  );
  out.push(
    k.wireSvg(at([BOX.x + BOX.w - 6, BOX.y + 2, 8]), at([DIAL[0] - 2, -40, 4]), {
      via: [at([-96, -56, 3]), at([-44, -60, 3]), at([-14, -50, 3])],
      tone: "lo",
      size: 1,
    })
  );
  return out.join("");
}

/* ---------- Rakit ------------------------------------------------------- */

const needleAt = (turn) => {
  const angle = -2.4 + turn * 4.8;
  const [x, y] = DIAL;
  return k.lineOnTop(
    [x + Math.sin(angle) * 2.6, y - Math.cos(angle) * 2.6],
    [x + Math.sin(angle) * (DIAL_R - 4.4), y - Math.cos(angle) * (DIAL_R - 4.4)],
    DIAL_TOP + 0.2,
    P
  );
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Meja triage laporan isometrik. Satu kartu laporan duduk di atas kereta yang berjalan di sepanjang dua rel. Kartu melewati gerbang pemeriksaan, berhenti di bawah dial penentu prioritas, lalu ditekan cap selesai. Laporan yang tidak lolos disisihkan ke bak di sudut kanan depan.",
  body: [
    alas(),
    bakTolak(),
    rel(),
    kotak(),
    tiangGerbang(-32),
    tiangDial(),
    tiangCap(),
    kabel(),
    `<g data-part="carriage" transform="${k.translateAlong(P, [STOP[0], 0, 0])}">${kereta()}</g>`,
    tiangGerbang(32),
    gerbang(),
    dial(),
    `<path data-part="needle" class="iso-line" data-tone="hi" data-free="start" d="${needleAt(0)}" style="stroke-width:1"/>`,
    `<g data-part="head" transform="${k.translateAlong(P, [0, 0, HEAD_UP])}">${kepalaCap()}</g>`,
  ],
});

/* ---------- Perilaku ---------------------------------------------------- */

const live = `
const P = ${JSON.stringify(P)};
const STOPS = ${JSON.stringify(STOP)};
const REACH = ${JSON.stringify(REACH)};
const DIAL = ${JSON.stringify(DIAL)};
const DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const HEAD_UP = ${HEAD_UP}, HEAD_DOWN = ${HEAD_DOWN};
const PRIORITAS = [0, 0.62, 0.62];

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const carriage = svg.querySelector('[data-part="carriage"]');
const head = svg.querySelector('[data-part="head"]');
const needle = svg.querySelector('[data-part="needle"]');
const lamp = svg.querySelector(".lampu");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const needleAt = ${needleAt.toString().replace(/k\.lineOnTop/g, "lineOnTop")};

let x = STOPS[0], target = x, press = 0, pressTarget = 0, lampOn = 0;
let frame = 0, last = 0, clock = 0, touring = true, visible = false, idleTimer = 0;

const tahap = (v) => {
  const jarak = STOPS.map((s) => Math.abs(s - v));
  const dekat = jarak.indexOf(Math.min(...jarak));
  return dekat;
};
const prioritasDi = (v) => {
  const i = tahap(v);
  return PRIORITAS[i];
};

function draw() {
  carriage.setAttribute("transform", translateAlong(P, [x, 0, 0]));
  const naik = HEAD_UP + (HEAD_DOWN - HEAD_UP) * press;
  head.setAttribute("transform", translateAlong(P, [0, 0, naik]));
  needle.setAttribute("d", needleAt(prioritasDi(x)));
  lamp.setAttribute("opacity", lampOn.toFixed(3));

  const i = tahap(x);
  const label = ["di gerbang pemeriksaan", "di penentu prioritas", "di pos cap selesai"][i];
  const nilai = ["belum dibaca", "sedang", "sedang"][i];
  const teks = label + " · prioritas " + nilai;
  if (readout.textContent !== teks) readout.textContent = teks;
  stage.setAttribute("aria-valuenow", String(i + 1));
  stage.setAttribute("aria-valuetext", "Kartu " + label + ", prioritas " + nilai);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const tenang = still.matches;

  if (touring) {
    clock += dt;
    const urut = [STOPS[0], STOPS[1], STOPS[2], STOPS[2], STOPS[1]];
    target = urut[Math.floor(clock / 2.4) % urut.length];
  }
  x = tenang ? target : x + (target - x) * (1 - Math.exp(-dt / 0.3));
  if (Math.abs(target - x) < 0.05) x = target;

  const mauTekan = clamp((x - 44) / 34, 0, 1);
  pressTarget = mauTekan;
  press = tenang ? pressTarget : press + (pressTarget - press) * (1 - Math.exp(-dt / 0.16));
  if (Math.abs(pressTarget - press) < 0.002) press = pressTarget;

  const mauLampu = tahap(x) === 0 ? 1 : 0;
  lampOn = tenang ? mauLampu : lampOn + (mauLampu - lampOn) * (1 - Math.exp(-dt / 0.12));

  draw();
  const selesai = !touring && x === target && press === pressTarget;
  frame = visible && !selesai ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };

const steer = (next) => {
  touring = false;
  target = clamp(next, REACH[0], REACH[1]);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4200);
  run();
};

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

if (still.matches) touring = false;

stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.18) / 0.64, 0, 1);
  steer(REACH[0] + share * (REACH[1] - REACH[0]));
});

stage.addEventListener("pointerleave", () => steer(target));

stage.addEventListener("keydown", (event) => {
  const sini = tahap(target);
  let ke = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") ke = Math.min(STOPS.length - 1, sini + 1);
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") ke = Math.max(0, sini - 1);
  if (event.key === "Home") ke = 0;
  if (event.key === "End") ke = STOPS.length - 1;
  if (ke === null) return;
  event.preventDefault();
  steer(STOPS[ke]);
});

draw();
`;

const body = k.plateHtml({
  fig: "Gambar 1",
  title: "Meja triage laporan",
  hint: "Geser kartu dengan panah atau kursor",
  readout: "di gerbang pemeriksaan · prioritas belum dibaca",
  keys: [
    { mark: "lit", label: "Kartu laporan: satu-satunya bagian yang bergerak" },
    { mark: "raised", label: "Gerbang periksa, dial prioritas, dan cap selesai" },
  ],
  caption:
    "Kartu berjalan dari gerbang pemeriksaan, berhenti di bawah dial yang menetapkan prioritas, lalu ditekan cap selesai. Laporan yang tidak lolos disisihkan ke bak di kanan depan, bukan dibuang.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Posisi kartu laporan pada meja triage: panah kiri dan kanan memindahkan kartu" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1">${svg}</div>`,
});

const tema = "light";
const halaman = k.pageHtml({
  title: "Meja triage laporan",
  theme: tema,
  body: `${body}<style>
    body { background: #fbf5f2; }
    .iso-page { width: 100%; max-width: none; margin: 0; }
    .iso-plate { background: #fbf5f2; box-shadow: none; border-radius: 0; padding: 40px 16px 8px; }
    .iso-svg { width: 100%; height: auto; }
    /* Keterangan gambar disediakan oleh halaman induk, bukan oleh kartu figur. */
    .iso-legend { display: none; }
    /* Ramp nada versi hangat: kertas situs ini tidak putih netral. */
    .iso[data-theme="light"] {
      --anatomy-paper: #fbf5f2;
      --anatomy-face: #ffffff;
      --anatomy-top: #ffffff;
      --anatomy-shade-0: #96897f;
      --anatomy-shade-1: #ac9f95;
      --anatomy-shade-2: #c2b7ac;
      --anatomy-shade-3: #d5cbc1;
      --anatomy-lit-top: #ffffff;
      --anatomy-lit-shade: #e8ded6;
      --anatomy-hi: #2b2725;
      --anatomy-mid: #6b625d;
      --anatomy-lo: #a2988f;
      --anatomy-faint: #cbc1b9;
      --anatomy-lit: #000000;
      --anatomy-dot: #2b2725;
      --anatomy-muted: #6b625d;
      --anatomy-text: #4a423d;
      --anatomy-halo: #6b625d;
      --anatomy-halo-opacity: .18;
    }
    .iso-solid.kartu-lapor > .iso-fill { fill: #dd3333; }
    .iso-solid.kartu-lapor > .iso-top { fill: #e64a44; }
    .iso-solid.kartu-lapor > .iso-shade { fill: #c22d2b; }
    .iso-solid.kartu-lapor > .iso-edge { stroke: #8f1d1c; stroke-width: 1.1px; }
    .garis-kartu { stroke: rgba(255, 255, 255, 0.82); }
  </style>`,
  script: kitScript() + live,
});

writeFileSync(join(HERE, "triage.html"), halaman);
console.log("wrote triage.html", halaman.length, "bytes");
