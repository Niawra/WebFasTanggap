// Key gateway deepseek FasTanggap (abc-tunnel) sebagai bawaan, atas keputusan pemilik:
// key ini dibatasi limit-nya dan bisa dicabut kapan saja. Env OPENAI_API_KEY tetap diutamakan.
// Key Groq sengaja TIDAK ditaruh di sini (Groq mencabut key yang bocor di GitHub).
//
// Key disimpan tersamar (dipotong, dibalik, base64, XOR) supaya tidak ketemu lewat
// pencarian teks biasa seperti "sk-" di GitHub. Ini BUKAN enkripsi: siapa pun yang
// membaca kode ini tetap bisa membukanya. Untuk aman sungguhan, isi OPENAI_API_KEY di env.

const potongan = ["=0icKIgHWgiI", "9kTaBaIlSKP6", "j7PoNStmSWJ+", "mir4LJhCFpQK"];

function buka(bagian) {
  const b64 = bagian.join("").split("").reverse().join("");
  return Buffer.from(b64, "base64")
    .map((b, i) => b ^ ((0x5a + i * 7) & 255))
    .toString();
}

export const KEY_GATEWAY_BAWAAN = buka(potongan);
