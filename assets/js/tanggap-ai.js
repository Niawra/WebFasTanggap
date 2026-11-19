/**
 * tanggap-ai.js
 * Modul Frontend Asisten Virtual TanggapAI untuk FasTanggap.
 * 
 * Mengelola widget floating button, panel percakapan, integrasi API backend (localhost:5001),
 * otentikasi token Supabase (Siswa/Petugas/Tamu), quick prompt, keyboard handling,
 * rendering aman bebas XSS (anti-innerHTML), ketahanan navigasi SPA, status koneksi adaptif,
 * serta manajemen riwayat & retry bebas duplikasi.
 */

(function () {
  "use strict";

  // 1. Konfigurasi Endpoint Backend TanggapAI
  const BACKEND_URL =
    (window.FASTANGGAP_TANGGAPAI && window.FASTANGGAP_TANGGAPAI.apiUrl) ||
    "http://localhost:5001/api/chat";

  // Endpoint Pemeriksaan Kesehatan Backend (Health Check)
  const HEALTH_URL = BACKEND_URL.replace(/\/api\/chat\/?$/, "/api/health");

  // Batasan Panjang Karakter
  const MAX_CHAR_LENGTH = 500;

  // 2. State Aplikasi Chatbot
  const state = {
    isOpen: false,
    isLoading: false,
    connectionStatus: "checking", // "checking" | "online" | "offline"
    messages: [], // Array: { id, role: 'user'|'model', text, time, error: boolean }
    history: [],  // Array: { role: 'user'|'model', text } (hanya giliran yang selesai)
    lastFailedMessage: null,
    currentError: null, // { message: string, code: string } | null
  };

  // Daftar Quick Prompts Bawaan
  const QUICK_PROMPTS = [
    "Bagaimana cara melaporkan fasilitas rusak?",
    "Apa saja informasi yang harus disiapkan saat membuat laporan?",
    "Bagaimana cara mengetahui status laporan?",
    "Bagaimana cara menentukan prioritas kerusakan?",
  ];

  // 3. Helper Pengambilan Token Autentikasi Supabase
  async function ambilTokenSupabase() {
    try {
      let client = null;
      if (typeof sb !== "undefined" && sb?.auth) {
        client = sb;
      } else if (window.supabase && window.FASTANGGAP_SUPABASE?.url && window.FASTANGGAP_SUPABASE?.anonKey) {
        if (!window._fastanggapSb) {
          window._fastanggapSb = window.supabase.createClient(
            window.FASTANGGAP_SUPABASE.url,
            window.FASTANGGAP_SUPABASE.anonKey
          );
        }
        client = window._fastanggapSb;
      }

      if (!client) return null;

      const { data, error } = await client.auth.getSession();
      if (error || !data?.session) return null;
      return data.session.access_token || null;
    } catch {
      return null;
    }
  }

  // Helper Format Waktu Sekarang (HH:MM)
  function formatWaktuSekarang() {
    const now = new Date();
    const jam = String(now.getHours()).padStart(2, "0");
    const menit = String(now.getMinutes()).padStart(2, "0");
    return `${jam}:${menit}`;
  }

  // 4. Parser Rendering Aman Bebas XSS (Anti-innerHTML untuk teks pengguna & AI)
  function parseFormattingAman(text) {
    const fragment = document.createDocumentFragment();
    // Regex memecah bold (**teks**), inline code (`teks`), dan rute hash (#/rute)
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|#\/[a-zA-Z0-9\-_/]+)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Teks biasa sebelum match
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }

      const raw = match[0];
      if (raw.startsWith("**") && raw.endsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = raw.slice(2, -2);
        fragment.appendChild(strong);
      } else if (raw.startsWith("`") && raw.endsWith("`")) {
        const code = document.createElement("code");
        code.textContent = raw.slice(1, -1);
        fragment.appendChild(code);
      } else if (raw.startsWith("#/")) {
        const a = document.createElement("a");
        a.href = raw;
        a.textContent = raw;
        a.addEventListener("click", () => {
          // Navigasi rute hash SPA
          window.location.hash = raw;
        });
        fragment.appendChild(a);
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    return fragment;
  }

  // Merender pesan ke dalam elemen DOM container secara aman
  function renderKontenPesanAman(container, rawText) {
    container.replaceChildren(); // Bersihkan container dengan aman
    const baris = String(rawText || "").split("\n");
    let currentUl = null;
    let currentOl = null;

    for (let i = 0; i < baris.length; i++) {
      const line = baris[i].trimEnd();

      // Cek apakah item list tidak berurutan (- atau *)
      const matchBullet = line.match(/^[-*]\s+(.*)$/);
      if (matchBullet) {
        if (!currentUl) {
          currentUl = document.createElement("ul");
          container.appendChild(currentUl);
        }
        const li = document.createElement("li");
        li.appendChild(parseFormattingAman(matchBullet[1]));
        currentUl.appendChild(li);
        continue;
      }
      currentUl = null;

      // Cek apakah item list berurutan (1. 2. dst)
      const matchNumber = line.match(/^(\d+)\.\s+(.*)$/);
      if (matchNumber) {
        if (!currentOl) {
          currentOl = document.createElement("ol");
          container.appendChild(currentOl);
        }
        const li = document.createElement("li");
        li.appendChild(parseFormattingAman(matchNumber[2]));
        currentOl.appendChild(li);
        continue;
      }
      currentOl = null;

      // Paragraf biasa atau baris kosong
      if (line.trim() === "") {
        continue;
      }

      const p = document.createElement("p");
      p.appendChild(parseFormattingAman(line));
      container.appendChild(p);
    }
  }

  // 5. Manajemen Status Koneksi Backend
  function perbaruiStatusKoneksi(status, dom) {
    state.connectionStatus = status;
    const dotEl = dom?.headerDot || document.getElementById("tanggapAiStatusDot");
    const subtitleEl = dom?.headerSubtitle || document.getElementById("tanggapAiSubtitle");

    if (dotEl) {
      dotEl.classList.remove(
        "tanggap-ai-header__dot--online",
        "tanggap-ai-header__dot--offline",
        "tanggap-ai-header__dot--checking"
      );

      if (status === "online") {
        dotEl.classList.add("tanggap-ai-header__dot--online");
        dotEl.setAttribute("title", "TanggapAI Aktif (Online)");
        dotEl.setAttribute("aria-label", "TanggapAI Aktif (Online)");
        if (subtitleEl) subtitleEl.textContent = "Asisten Fasilitas FasTanggap";
      } else if (status === "offline") {
        dotEl.classList.add("tanggap-ai-header__dot--offline");
        dotEl.setAttribute("title", "Backend TanggapAI Belum Terhubung (Offline)");
        dotEl.setAttribute("aria-label", "Backend TanggapAI Belum Terhubung (Offline)");
        if (subtitleEl) subtitleEl.textContent = "Mode Offline (Server belum aktif)";
      } else {
        dotEl.classList.add("tanggap-ai-header__dot--checking");
        dotEl.setAttribute("title", "Menghubungkan ke layanan TanggapAI...");
        dotEl.setAttribute("aria-label", "Menghubungkan ke layanan TanggapAI...");
        if (subtitleEl) subtitleEl.textContent = "Menghubungkan asisten...";
      }
    }
  }

  let lastHealthCheckTime = 0;
  async function periksaKoneksiBackend(dom, force = false) {
    const now = Date.now();
    // Throttle 30 detik agar tidak membebani server
    if (!force && now - lastHealthCheckTime < 30000 && state.connectionStatus !== "checking") {
      return;
    }
    lastHealthCheckTime = now;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(HEALTH_URL, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        perbaruiStatusKoneksi("online", dom);
      } else {
        perbaruiStatusKoneksi("offline", dom);
      }
    } catch {
      perbaruiStatusKoneksi("offline", dom);
    }
  }

  // 6. Inisialisasi Elemen UI Chatbot
  function buatWidgetUI() {
    let root = document.getElementById("tanggapAiRoot");
    if (!root) {
      // Buat container root otomatis jika belum ada di HTML
      root = document.createElement("div");
      root.id = "tanggapAiRoot";
      document.body.appendChild(root);
    }

    // Hindari duplikasi DOM saat navigasi hash routing SPA
    const existingFab = root.querySelector(".tanggap-ai-fab");
    const existingPanel = root.querySelector(".tanggap-ai-panel");
    if (existingFab && existingPanel) {
      return {
        fab: existingFab,
        panel: existingPanel,
        headerDot: existingPanel.querySelector("#tanggapAiStatusDot"),
        headerSubtitle: existingPanel.querySelector("#tanggapAiSubtitle"),
        messagesContainer: existingPanel.querySelector("#tanggapAiMessages"),
        inputArea: existingPanel.querySelector(".tanggap-ai-input-area"),
      };
    }

    root.replaceChildren(); // Bersihkan isi root

    // Floating Action Button (FAB)
    const fab = document.createElement("button");
    fab.className = "tanggap-ai-fab";
    fab.setAttribute("aria-label", "Buka Chatbot TanggapAI");
    fab.setAttribute("aria-haspopup", "dialog");
    fab.setAttribute("aria-expanded", "false");
    fab.innerHTML = `
      <svg class="tanggap-ai-fab__icon tanggap-ai-fab__icon--open" viewBox="0 0 24 24">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.72V7h2a5 5 0 0 1 5 5v1h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v1a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-1H2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h1v-1a5 5 0 0 1 5-5h2V5.72A2 2 0 0 1 10 4a2 2 0 0 1 2-2m-3 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-6 5h6v1.5H9z"/>
      </svg>
      <svg class="tanggap-ai-fab__icon tanggap-ai-fab__icon--close" viewBox="0 0 24 24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
      <span class="tanggap-ai-fab__badge">Tanya TanggapAI</span>
    `;

    // Panel Chatbot
    const panel = document.createElement("div");
    panel.className = "tanggap-ai-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Asisten Virtual TanggapAI");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-hidden", "true");

    // Header Panel
    const header = document.createElement("div");
    header.className = "tanggap-ai-header";
    header.innerHTML = `
      <div class="tanggap-ai-header__brand">
        <div class="tanggap-ai-header__avatar">
          <svg viewBox="0 0 24 24">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.72V7h2a5 5 0 0 1 5 5v1h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v1a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-1H2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h1v-1a5 5 0 0 1 5-5h2V5.72A2 2 0 0 1 10 4a2 2 0 0 1 2-2m-3 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-6 5h6v1.5H9z"/>
          </svg>
          <span class="tanggap-ai-header__dot tanggap-ai-header__dot--checking" id="tanggapAiStatusDot" title="Menghubungkan asisten..." aria-label="Status koneksi TanggapAI"></span>
        </div>
        <div class="tanggap-ai-header__info">
          <h3>TanggapAI</h3>
          <p id="tanggapAiSubtitle">Asisten Fasilitas FasTanggap</p>
        </div>
      </div>
      <div class="tanggap-ai-header__actions">
        <button class="tanggap-ai-header__btn" id="tanggapAiResetBtn" title="Mulai Ulang Percakapan" aria-label="Mulai Ulang Percakapan">
          <svg viewBox="0 0 24 24">
            <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"/>
          </svg>
        </button>
        <button class="tanggap-ai-header__btn" id="tanggapAiCloseBtn" title="Tutup Chatbot" aria-label="Tutup Chatbot">
          <svg viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    `;

    // Messages Container
    const messagesContainer = document.createElement("div");
    messagesContainer.className = "tanggap-ai-messages";
    messagesContainer.id = "tanggapAiMessages";

    // Input Area
    const inputArea = document.createElement("div");
    inputArea.className = "tanggap-ai-input-area";
    inputArea.innerHTML = `
      <div class="tanggap-ai-input-box">
        <textarea
          class="tanggap-ai-textarea"
          id="tanggapAiInput"
          placeholder="Tanya fasilitas sekolah atau kendala..."
          rows="1"
          maxlength="${MAX_CHAR_LENGTH}"
          aria-label="Ketik pesan untuk TanggapAI"
        ></textarea>
        <button class="tanggap-ai-send-btn" id="tanggapAiSendBtn" aria-label="Kirim Pesan" disabled>
          <svg viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
      <div class="tanggap-ai-input-meta">
        <span>Tekan Enter untuk kirim, Shift+Enter untuk baris baru</span>
        <span id="tanggapAiCharCount">0/${MAX_CHAR_LENGTH}</span>
      </div>
    `;

    panel.appendChild(header);
    panel.appendChild(messagesContainer);
    panel.appendChild(inputArea);

    root.appendChild(fab);
    root.appendChild(panel);

    const headerDot = header.querySelector("#tanggapAiStatusDot");
    const headerSubtitle = header.querySelector("#tanggapAiSubtitle");

    return { fab, panel, headerDot, headerSubtitle, messagesContainer, inputArea };
  }

  // 7. Fungsi Render Tampilan Percakapan
  function renderTampilanChat(dom) {
    const { messagesContainer } = dom;
    if (!messagesContainer) return;
    messagesContainer.replaceChildren();

    // Jika belum ada pesan, tampilkan Empty State & Quick Prompts
    if (state.messages.length === 0) {
      const emptyBox = document.createElement("div");
      emptyBox.className = "tanggap-ai-empty";

      const card = document.createElement("div");
      card.className = "tanggap-ai-empty__card";
      card.innerHTML = `
        <h4>Halo! Saya TanggapAI</h4>
        <p>Asisten resmi pelaporan fasilitas sekolah FasTanggap. Saya siap membantu kamu membuat laporan kerusakan, mengecek status perbaikan, atau memahami fasilitas sekolah.</p>
      `;

      const promptWrap = document.createElement("div");
      promptWrap.className = "tanggap-ai-prompts";

      const promptLabel = document.createElement("div");
      promptLabel.className = "tanggap-ai-prompts__label";
      promptLabel.textContent = "Pertanyaan Populer:";
      promptWrap.appendChild(promptLabel);

      QUICK_PROMPTS.forEach((teksPrompt) => {
        const chip = document.createElement("button");
        chip.className = "tanggap-ai-prompt-chip";
        chip.setAttribute("type", "button");
        chip.innerHTML = `
          <span>${teksPrompt}</span>
          <svg viewBox="0 0 24 24">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
          </svg>
        `;
        chip.addEventListener("click", () => {
          if (!state.isLoading) {
            kirimPesan(teksPrompt, dom, false);
          }
        });
        promptWrap.appendChild(chip);
      });

      emptyBox.appendChild(card);
      emptyBox.appendChild(promptWrap);
      messagesContainer.appendChild(emptyBox);
      return;
    }

    // Render daftar pesan
    state.messages.forEach((msg) => {
      const msgWrap = document.createElement("div");
      msgWrap.className = `tanggap-ai-msg tanggap-ai-msg--${msg.role === "user" ? "user" : "ai"}`;

      const content = document.createElement("div");
      content.className = "tanggap-ai-msg__content";

      // Render teks dengan aman
      renderKontenPesanAman(content, msg.text);

      const time = document.createElement("span");
      time.className = "tanggap-ai-msg__time";
      time.textContent = msg.time || formatWaktuSekarang();

      msgWrap.appendChild(content);
      if (msg.draf) msgWrap.appendChild(buatKartuDraf(msg, dom));
      msgWrap.appendChild(time);
      messagesContainer.appendChild(msgWrap);
    });

    // Jika AI sedang memproses respons (loading indicator)
    if (state.isLoading) {
      const typing = document.createElement("div");
      typing.className = "tanggap-ai-typing";
      typing.setAttribute("role", "status");
      typing.setAttribute("aria-live", "polite");
      typing.setAttribute("aria-label", "TanggapAI sedang mengetik balasan...");
      typing.innerHTML = `
        <span class="tanggap-ai-typing__dot"></span>
        <span class="tanggap-ai-typing__dot"></span>
        <span class="tanggap-ai-typing__dot"></span>
      `;
      messagesContainer.appendChild(typing);
    }

    // Jika terjadi kendala/error, tampilkan banner error beserta tombol aksi
    if (state.currentError) {
      tampilkanErrorBanner(state.currentError.message, state.currentError.code, dom);
    }

    // Scroll otomatis ke bawah
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // 8. Render Banner Error dengan Opsi Tindakan
  function tampilkanErrorBanner(pesanError, kodeError, dom) {
    const { messagesContainer } = dom;
    if (!messagesContainer) return;

    const banner = document.createElement("div");
    banner.className = "tanggap-ai-error-banner";
    banner.setAttribute("role", "alert");
    banner.setAttribute("aria-live", "assertive");

    let labelAksi = "Coba Lagi";
    let handlerAksi = () => {
      if (state.lastFailedMessage && !state.isLoading) {
        state.currentError = null;
        kirimPesan(state.lastFailedMessage, dom, true); // isRetry = true
      }
    };

    if (kodeError === "AUTH_TOKEN_INVALID" || kodeError === "AUTH_TOKEN_EXPIRED") {
      labelAksi = "Masuk Akun (#/masuk)";
      handlerAksi = () => {
        window.location.hash = "#/masuk";
      };
    }

    const header = document.createElement("div");
    header.className = "tanggap-ai-error-banner__header";
    header.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
      <span>Kendala Layanan TanggapAI</span>
    `;

    const desc = document.createElement("div");
    desc.className = "tanggap-ai-error-banner__msg";
    desc.textContent = pesanError;

    const btn = document.createElement("button");
    btn.className = "tanggap-ai-error-banner__action";
    btn.id = "tanggapAiRetryBtn";
    btn.setAttribute("type", "button");
    btn.textContent = labelAksi;
    btn.addEventListener("click", () => {
      if (state.isLoading) return;
      btn.disabled = true;
      handlerAksi();
    });

    banner.appendChild(header);
    banner.appendChild(desc);
    banner.appendChild(btn);

    messagesContainer.appendChild(banner);
  }

  // 9. Logika Pengiriman Pesan ke Backend
  /* ---------- Lapor lewat TanggapAI -------------------------------------- */

  // Siswa yang login: kirim nama kategori & lokasi dari database supaya AI bisa menyusun draf laporan.
  function daftarReferensiLaporan() {
    try {
      const sesi = typeof Store !== "undefined" && Store.sesi();
      if (!sesi || sesi.peran !== "siswa") return {};
      return { kategori: Store.kategori().map((k) => k.nama), lokasi: Store.lokasi() };
    } catch {
      return {};
    }
  }

  // Kartu draf laporan + tombol Kirim (semua teks lewat textContent, aman dari XSS).
  function buatKartuDraf(msg, dom) {
    const d = msg.draf;
    const kartu = document.createElement("div");
    kartu.style.cssText =
      "margin-top:8px;padding:12px;border-radius:14px;background:#fff;border:1px solid rgba(0,0,0,.1);color:#1d1b1b;font-size:13px;line-height:1.45";
    const baris = (label, nilai, tebal) => {
      const el = document.createElement("div");
      el.style.marginBottom = "6px";
      const l = document.createElement("div");
      l.textContent = label;
      l.style.cssText = "font-size:11px;color:#6e6766";
      const v = document.createElement("div");
      v.textContent = nilai;
      if (tebal) v.style.fontWeight = "600";
      el.appendChild(l);
      el.appendChild(v);
      return el;
    };
    kartu.appendChild(baris("Judul", d.judul, true));
    kartu.appendChild(baris("Kategori · Lokasi", `${d.kategori} · ${d.lokasi}`));
    kartu.appendChild(baris("Deskripsi", d.deskripsi));

    const tombol = document.createElement("button");
    tombol.type = "button";
    tombol.style.cssText =
      "margin-top:4px;width:100%;padding:9px 12px;border:0;border-radius:99px;background:#dd3333;color:#fff;font-weight:600;cursor:pointer";
    if (msg.terkirim) {
      tombol.textContent = msg.terkirim;
      tombol.disabled = true;
      tombol.style.opacity = "0.6";
      tombol.style.cursor = "default";
    } else {
      tombol.textContent = "Kirim laporan";
      tombol.addEventListener("click", () => kirimDraf(msg, tombol, dom));
    }
    kartu.appendChild(tombol);
    return kartu;
  }

  async function kirimDraf(msg, tombol, dom) {
    const d = msg.draf;
    const kat = Store.kategori().find((k) => k.nama === d.kategori);
    if (!kat || !Store.lokasi().includes(d.lokasi)) {
      tombol.textContent = "Kategori/lokasi tidak dikenal";
      return;
    }
    tombol.disabled = true;
    tombol.textContent = "Mengirim...";
    const hasil = await Store.tambahLaporan({ kategoriId: kat.id, lokasi: d.lokasi, judul: d.judul, deskripsi: d.deskripsi, foto: null });
    let balasan;
    if (!hasil.ok) {
      tombol.disabled = false;
      tombol.textContent = "Coba kirim lagi";
      balasan = `Laporan gagal dikirim: ${hasil.pesan}`;
    } else if (hasil.verifikasi && hasil.verifikasi.verdict === "asal") {
      msg.terkirim = "Ditolak otomatis";
      balasan = `Laporan ditolak otomatis: ${hasil.verifikasi.alasan}. Coba tulis ulang dengan jelas apa yang rusak dan di mana.`;
    } else {
      msg.terkirim = `Terkirim · ${hasil.laporan.kode}`;
      balasan = `Laporan **${hasil.laporan.kode}** terkirim ke petugas. Pantau statusnya di #/laporan.`;
    }
    state.messages.push({ id: "msg-" + Date.now(), role: "model", text: balasan, time: formatWaktuSekarang() });
    renderTampilanChat(dom);
  }

  async function kirimPesan(teksPesan, dom, isRetry = false) {
    const inputEl = document.getElementById("tanggapAiInput");
    const sendBtn = document.getElementById("tanggapAiSendBtn");
    const charCountEl = document.getElementById("tanggapAiCharCount");

    const pesanBersih = String(teksPesan || "").trim();
    if (!pesanBersih || state.isLoading) return;

    if (pesanBersih.length > MAX_CHAR_LENGTH) {
      alert(`Pesan terlalu panjang (maksimal ${MAX_CHAR_LENGTH} karakter).`);
      return;
    }

    // Bersihkan input teks jika bukan retry
    if (!isRetry) {
      if (inputEl) {
        inputEl.value = "";
        inputEl.style.height = "auto";
      }
      if (charCountEl) {
        charCountEl.textContent = `0/${MAX_CHAR_LENGTH}`;
        charCountEl.classList.remove("is-limit");
      }
    }

    // Kunci tombol kirim dan input textarea selama pemrosesan aktif
    if (inputEl) {
      inputEl.disabled = true;
    }
    if (sendBtn) {
      sendBtn.disabled = true;
    }

    // Catat pesan untuk keperluan retry jika gagal
    state.lastFailedMessage = pesanBersih;
    state.currentError = null;

    // Jika bukan retry, tambahkan bubble pesan pengguna ke tampilan
    // Jika retry, bubble pengguna sebelumnya dipertahankan agar tidak terduplikasi
    if (!isRetry) {
      state.messages.push({
        id: "msg-" + Date.now(),
        role: "user",
        text: pesanBersih,
        time: formatWaktuSekarang(),
      });
    }

    // Catatan Keamanan & Arsitektur Gemini API:
    // Riwayat (state.history) HANYA mencatat pasangan giliran yang telah selesai (user + model).
    // Pesan saat ini TIDAK dimasukkan ke state.history sebelum ada balasan sukses dari backend,
    // untuk mencegah giliran ilegal/beruntun dari role 'user' serta memastikan retry bebas duplikasi.

    state.isLoading = true;
    renderTampilanChat(dom);

    // Ambil Token Autentikasi Supabase secara aman (jika sudah login)
    const token = await ambilTokenSupabase();

    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: pesanBersih,
          history: state.history.slice(-4), // Maksimal 4 pesan riwayat (2 pasangan giliran yang telah selesai)!
          ...daftarReferensiLaporan(),
        }),
      });

      const resJson = await response.json().catch(() => null);

      if (response.ok && resJson && resJson.success) {
        state.lastFailedMessage = null;
        state.currentError = null;
        const balasanAI = resJson.reply || "Mohon maaf, TanggapAI tidak dapat memproses jawaban saat ini.";

        // Catat pasangan giliran yang berhasil ke riwayat percakapan
        state.history.push({
          role: "user",
          text: pesanBersih,
        });
        state.history.push({
          role: "model",
          text: balasanAI,
        });

        // Tambahkan bubble balasan AI ke daftar pesan
        state.messages.push({
          id: "msg-" + Date.now(),
          role: "model",
          text: balasanAI,
          time: formatWaktuSekarang(),
          draf: resJson.draft || null,
        });

        perbaruiStatusKoneksi("online", dom);
      } else {
        // Tangani Beragam Status Error Backend
        const kodeError = resJson?.error?.code || `HTTP_${response.status}`;
        let pesanUser = resJson?.error?.message || "Terjadi kendala pada server TanggapAI.";

        if (response.status === 401) {
          pesanUser = "Sesi login Anda telah berakhir atau token tidak valid. Silakan masuk kembali.";
        } else if (response.status === 429) {
          pesanUser = "Batas penggunaan pesan tercapai (maksimal 10 pesan per 15 menit). Silakan coba lagi beberapa saat.";
        } else if (response.status === 504) {
          pesanUser = "Permintaan ke TanggapAI melebihi batas waktu (timeout 25 detik). Silakan coba kirim ulang.";
        } else if (response.status === 503) {
          pesanUser = "Layanan kecerdasan buatan TanggapAI belum siap atau sedang mengalami gangguan jaringan.";
        }

        state.currentError = { message: pesanUser, code: kodeError };
      }
    } catch {
      // Galat Jaringan (Server Backend Tidak Menyala / Terputus)
      perbaruiStatusKoneksi("offline", dom);
      state.currentError = {
        message: "Gagal terhubung ke backend TanggapAI (port 5001). Pastikan server backend sedang aktif.",
        code: "NETWORK_DISCONNECTED",
      };
    } finally {
      state.isLoading = false;
      renderTampilanChat(dom);
      if (inputEl) {
        inputEl.disabled = false;
        inputEl.focus();
      }
      if (sendBtn) {
        sendBtn.disabled = inputEl ? inputEl.value.trim().length === 0 : true;
      }
    }
  }

  // 10. Setup Event Listeners & Kontrol Aksesibilitas
  function pasangEventHandlers(dom) {
    const { fab, panel } = dom;
    if (!fab || !panel) return;

    // Cegah duplikasi pendaftaran listener pada SPA route switch
    if (fab.dataset.listenerAttached === "true") return;
    fab.dataset.listenerAttached = "true";

    const inputEl = document.getElementById("tanggapAiInput");
    const sendBtn = document.getElementById("tanggapAiSendBtn");
    const closeBtn = document.getElementById("tanggapAiCloseBtn");
    const resetBtn = document.getElementById("tanggapAiResetBtn");
    const charCountEl = document.getElementById("tanggapAiCharCount");

    // Toggle Buka/Tutup Panel Chatbot
    function bukaChatbot() {
      state.isOpen = true;
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      fab.classList.add("is-active");
      fab.setAttribute("aria-expanded", "true");
      renderTampilanChat(dom);
      // Periksa koneksi backend saat panel dibuka
      periksaKoneksiBackend(dom);
      setTimeout(() => {
        if (inputEl && !inputEl.disabled) inputEl.focus();
      }, 100);
    }

    function tutupChatbot() {
      state.isOpen = false;
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      fab.classList.remove("is-active");
      fab.setAttribute("aria-expanded", "false");
      // Aksesibilitas WCAG: Kembalikan fokus ke tombol pemicu (FAB)
      if (fab) {
        fab.focus();
      }
    }

    fab.addEventListener("click", () => {
      if (state.isOpen) {
        tutupChatbot();
      } else {
        bukaChatbot();
      }
    });

    closeBtn?.addEventListener("click", tutupChatbot);

    // Reset / Hapus Percakapan
    resetBtn?.addEventListener("click", () => {
      if (state.isLoading) return;
      state.messages = [];
      state.history = [];
      state.lastFailedMessage = null;
      state.currentError = null;
      renderTampilanChat(dom);
      if (inputEl) inputEl.focus();
    });

    // Menutup dengan tombol Escape (tanpa menghilangkan draft teks)
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.isOpen) {
        tutupChatbot();
      }
    });

    // Siklus Fokus Keyboard (Focus Trap) di dalam Dialog
    panel.addEventListener("keydown", (e) => {
      if (e.key !== "Tab" || !state.isOpen) return;

      const focusables = panel.querySelectorAll(
        'button:not([disabled]):not([aria-hidden="true"]), textarea:not([disabled]), a[href]'
      );
      if (focusables.length === 0) return;

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    });

    // Validasi Input & Auto-Resize Textarea
    if (inputEl) {
      inputEl.addEventListener("input", () => {
        const val = inputEl.value;
        const len = val.length;

        // Update counter
        if (charCountEl) {
          charCountEl.textContent = `${len}/${MAX_CHAR_LENGTH}`;
          if (len >= MAX_CHAR_LENGTH) {
            charCountEl.classList.add("is-limit");
          } else {
            charCountEl.classList.remove("is-limit");
          }
        }

        // Update status send button
        if (sendBtn) {
          sendBtn.disabled = val.trim().length === 0 || state.isLoading;
        }

        // Auto-resize tinggi textarea
        inputEl.style.height = "auto";
        inputEl.style.height = Math.min(inputEl.scrollHeight, 110) + "px";
      });

      // Keyboard Handler (Enter untuk kirim, Shift+Enter untuk baris baru)
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (sendBtn && !sendBtn.disabled && !state.isLoading) {
            kirimPesan(inputEl.value, dom, false);
          }
        }
      });
    }

    // Tombol Kirim
    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        if (!sendBtn.disabled && !state.isLoading && inputEl) {
          kirimPesan(inputEl.value, dom, false);
        }
      });
    }
  }

  // 11. Inisialisasi Saat DOM Siap
  function inisialisasi() {
    try {
      const dom = buatWidgetUI();
      if (!dom) return;

      pasangEventHandlers(dom);
      renderTampilanChat(dom);
    } catch (err) {
      console.error("[TanggapAI] Inisialisasi widget gagal:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inisialisasi);
  } else {
    inisialisasi();
  }

  // Backup listener jika DOMContentLoaded telah terlewat
  window.addEventListener("load", inisialisasi);
})();
