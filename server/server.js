import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import healthRouter from "./routes/health.js";
import chatRouter from "./routes/chat.js";

// Muat variabel lingkungan dari file .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const NODE_ENV = process.env.NODE_ENV || "development";

// 1. Keamanan Header HTTP
app.use(
  helmet({
    contentSecurityPolicy: false, // Memungkinkan frontend beroperasi fleksibel saat mengakses resource
    crossOriginEmbedderPolicy: false,
  })
);
app.disable("x-powered-by");

// 2. Pembatasan Laju Permintaan (Rate Limiting)
// Melindungi server dan health check, sementara endpoint /api/chat diproteksi secara khusus oleh chatRateLimiter
const pembatasUmum = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100, // Maksimal 100 request per IP per 15 menit
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/api/chat" || req.path === "/chat",
  message: {
    status: 429,
    error: "Terlalu banyak permintaan. Silakan coba lagi beberapa saat.",
  },
});
app.use(pembatasUmum);

// 3. Konfigurasi CORS (Cross-Origin Resource Sharing)
const asalFrontendKonfigurasi = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((s) => s.trim().replace(/\/$/, ""))
  : [];

const asalFrontendDefault = [
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const daftarAsalDiizinkan = new Set([...asalFrontendDefault, ...asalFrontendKonfigurasi]);

const opsiCors = {
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (seperti curl, mobile app, Postman, atau health check lokal)
    if (!origin) return callback(null, true);

    const bersih = origin.replace(/\/$/, "");
    if (daftarAsalDiizinkan.has(bersih)) {
      callback(null, true);
    } else {
      callback(new Error(`Akses CORS ditolak untuk origin: ${origin}`));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400, // Cache pre-flight 24 jam
};

app.use(cors(opsiCors));

// 4. Parser Body JSON
app.use(express.json({ limit: "1mb" }));

// 5. Mount Routes
app.use("/api", healthRouter);
app.use("/api", chatRouter);

// 6. Penanganan Rute Tidak Ditemukan (404)
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    error: "Rute API tidak ditemukan.",
    path: req.originalUrl,
  });
});

// 7. Penanganan Galat Terpusat (Centralized Error Handler)
app.use((err, req, res, next) => {
  // Tangani galat CORS secara ramah
  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({
      status: 403,
      error: err.message,
    });
  }

  const kode = err.status || 500;

  // Format respons konsisten khusus untuk endpoint /api/chat
  if (req.path && req.path.startsWith("/api/chat")) {
    return res.status(kode).json({
      success: false,
      reply: null,
      error: {
        code: kode === 400 ? "INVALID_JSON_BODY" : "INTERNAL_SERVER_ERROR",
        message: kode === 400 ? "Format JSON pada request body tidak valid." : "Terjadi kesalahan pada server.",
      },
    });
  }

  res.status(kode).json({
    status: kode,
    error: NODE_ENV === "production" ? "Terjadi kesalahan pada server." : err.message || "Internal Server Error",
  });
});

// 8. Menjalankan Server dengan Fallback Otomatis
function mulaiServer(portAwal) {
  const server = app.listen(portAwal, () => {
    console.log(`\n[TanggapAI Server] Berhasil berjalan pada port ${portAwal} (mode: ${NODE_ENV})`);
    console.log(`[TanggapAI Server] Endpoint kesehatan: http://localhost:${portAwal}/api/health`);
    console.log(`[TanggapAI Server] Origin frontend diizinkan:`, Array.from(daftarAsalDiizinkan).join(", "));
  });

  server.on("error", (err) => {
    if ((err.code === "EACCES" || err.code === "EADDRINUSE") && portAwal === Number(PORT)) {
      const portCadangan = portAwal === 5000 ? 5001 : 5050;
      console.warn(`\n[TanggapAI Server] Peringatan: Port ${portAwal} tidak dapat dipakai (${err.code}).`);
      console.warn(`[TanggapAI Server] Mencoba beralih otomatis ke port cadangan ${portCadangan}...`);
      mulaiServer(portCadangan);
    } else {
      console.error(`\n[TanggapAI Server Error] Gagal menjalankan server pada port ${portAwal}:`, err.message);
      process.exit(1);
    }
  });

  function hentikan(sinyal) {
    console.log(`\n[TanggapAI Server] Menerima sinyal ${sinyal}. Menutup koneksi server...`);
    server.close(() => {
      console.log("[TanggapAI Server] Server berhasil dihentikan.");
      process.exit(0);
    });
  }

  process.on("SIGINT", () => hentikan("SIGINT"));
  process.on("SIGTERM", () => hentikan("SIGTERM"));

  return server;
}

mulaiServer(Number(PORT) || 5001);

export default app;
