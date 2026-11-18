/*
 * config.js
 * Isi kunci Supabase di sini. Kalau anonKey dikosongkan,
 * FasTanggap tetap jalan memakai localStorage saja.
 * anonKey ada di Supabase: Project Settings > API > "anon public".
 */
window.FASTANGGAP_SUPABASE = {
  url: "https://gaxykcqqhsdigeviqosl.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdheHlrY3FxaHNkaWdldmlxb3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyODE5NTksImV4cCI6MjEwOTg1Nzk1OX0.qFpUGu_tixr8E8hLm_lS_4he9tAeY43kzuXCMzzfHOY",
};

/*
 * Konfigurasi Endpoint Backend TanggapAI Chatbot
 */
window.FASTANGGAP_TANGGAPAI = {
  // Dibuka lewat server statis lokal terpisah (8000/5500/3000) atau file:// -> backend localhost:5001.
  // Dibuka lewat backend sendiri / tunnel publik -> alamat relatif (satu origin).
  apiUrl:
    location.protocol === "file:" || ["8000", "5500", "3000"].includes(location.port)
      ? "http://localhost:5001/api/chat"
      : "/api/chat",
};
