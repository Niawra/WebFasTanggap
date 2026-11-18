/**
 * services/supabase.js
 * Modul Autentikasi dan Verifikasi Peran Pengguna FasTanggap via Supabase Auth & REST API.
 * 
 * Memverifikasi integritas JWT Access Token pengguna langsung ke server Supabase Auth (/auth/v1/user)
 * dan mengambil data profil/role dari tabel profiles (/rest/v1/profiles) dengan menghormati RLS.
 */

/**
 * Custom Error Class untuk Galat Autentikasi Supabase
 */
export class SupabaseAuthError extends Error {
  constructor(message, code = "AUTH_ERROR", statusCode = 401) {
    super(message);
    this.name = "SupabaseAuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Mengambil konfigurasi URL dan Anon Key Supabase dari variabel lingkungan.
 * @returns {{ url: string, anonKey: string }}
 */
export function getSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL;
  const url = rawUrl ? String(rawUrl).trim().replace(/\/$/, "") : "";
  const anonKey = process.env.SUPABASE_ANON_KEY ? String(process.env.SUPABASE_ANON_KEY).trim() : "";
  return { url, anonKey };
}

/**
 * Memeriksa apakah konfigurasi Supabase (URL dan Anon Key) telah diisi dengan benar.
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(
    url &&
    url.trim() !== "" &&
    anonKey &&
    anonKey.trim() !== "" &&
    anonKey !== "your_supabase_anon_key_here" &&
    anonKey !== "placeholder_supabase_anon_key"
  );
}

/**
 * Memverifikasi access token ke Supabase Auth dan mengambil profil pengguna.
 * 
 * Alur:
 * 1. Memanggil GET /auth/v1/user dengan header apikey dan Authorization: Bearer <token>.
 *    Jika token tidak valid/kedaluwarsa, Supabase mengembalikan 400/401 -> lempar SupabaseAuthError (401).
 * 2. Jika valid, memanggil GET /rest/v1/profiles?id=eq.<user.id>&select=id,full_name,role,class_name.
 * 3. Menentukan role berdasarkan data tabel profiles (hanya 'siswa' dan 'petugas' yang diakui).
 * 4. Jika profil tidak ditemukan atau role tidak dikenal, fallback aman ke role 'tamu'.
 * 
 * @param {string} token - Supabase JWT Access Token
 * @param {Object} [options]
 * @param {Function} [options.fetchFn] - Custom fetch function untuk keperluan testing/mocking
 * @param {number} [options.timeoutMs=10000] - Batas waktu request ke Supabase (default 10 detik)
 * @returns {Promise<{ user: Object, profile: Object|null, role: "siswa"|"petugas"|"tamu", userName: string }>}
 */
export async function verifikasiTokenSupabase(token, { fetchFn = fetch, timeoutMs = 10000 } = {}) {
  if (!token || typeof token !== "string" || !token.trim()) {
    throw new SupabaseAuthError(
      "Access token Supabase tidak disediakan.",
      "AUTH_TOKEN_MISSING",
      401
    );
  }

  const tokenBersih = token.trim();
  const { url, anonKey } = getSupabaseConfig();

  // Validasi ketat konfigurasi backend: SUPABASE_URL dan SUPABASE_ANON_KEY wajib tersedia
  if (!url || !anonKey || anonKey === "your_supabase_anon_key_here" || anonKey === "placeholder_supabase_anon_key") {
    throw new SupabaseAuthError(
      "Konfigurasi SUPABASE_URL atau SUPABASE_ANON_KEY belum dikonfigurasi dengan benar pada server backend.",
      "AUTH_CONFIG_MISSING",
      503
    );
  }

  // 1. Verifikasi Token Langsung ke Supabase Auth Endpoint
  let dataUser = null;
  try {
    const userRes = await fetchFn(`${url}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${tokenBersih}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (userRes.status === 401 || userRes.status === 400) {
      throw new SupabaseAuthError(
        "Token autentikasi tidak valid atau telah kedaluwarsa. Silakan masuk kembali.",
        "AUTH_TOKEN_INVALID",
        401
      );
    }

    if (!userRes.ok) {
      throw new SupabaseAuthError(
        `Server autentikasi Supabase mengembalikan status ${userRes.status}.`,
        "AUTH_SERVICE_UNAVAILABLE",
        503
      );
    }

    dataUser = await userRes.json();
  } catch (error) {
    if (error instanceof SupabaseAuthError) throw error;

    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new SupabaseAuthError(
        "Koneksi ke server autentikasi Supabase melebihi batas waktu (timeout).",
        "AUTH_TIMEOUT",
        504
      );
    }

    throw new SupabaseAuthError(
      "Gagal menghubungi server autentikasi Supabase. Periksa koneksi internet server.",
      "AUTH_NETWORK_ERROR",
      503
    );
  }

  if (!dataUser || !dataUser.id) {
    throw new SupabaseAuthError(
      "Identitas pengguna tidak ditemukan pada respons Supabase Auth.",
      "AUTH_USER_NOT_FOUND",
      401
    );
  }

  // 2. Ambil Profil Pengguna dari Tabel 'profiles' via Supabase REST API
  // Menggunakan access token pengguna yang sama untuk menghormati Row Level Security (RLS)
  let profilPengguna = null;
  try {
    const profileRes = await fetchFn(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(dataUser.id)}&select=id,full_name,role,class_name`,
      {
        method: "GET",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${tokenBersih}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
      }
    );

    if (profileRes.ok) {
      const daftarProfil = await profileRes.json();
      if (Array.isArray(daftarProfil) && daftarProfil.length > 0) {
        profilPengguna = daftarProfil[0];
      }
    }
  } catch (errProfile) {
    // Jika pengambilan profil gagal karena alasan jaringan, jangan crash, perlakukan sebagai tamu
    console.warn("[Supabase Auth] Gagal memuat profil pengguna:", errProfile.message);
  }

  // 3. Evaluasi dan Normalisasi Role
  let roleHasil = "tamu";
  let namaPengguna = "";

  if (profilPengguna) {
    const rawRole = String(profilPengguna.role || "").toLowerCase().trim();
    if (rawRole === "siswa" || rawRole === "petugas") {
      roleHasil = rawRole;
    } else {
      // Role tidak dikenal: jangan memberikan akses role khusus
      roleHasil = "tamu";
    }

    namaPengguna = String(profilPengguna.full_name || "").trim();
  } else {
    // Profil tidak ditemukan: tangani secara aman tanpa memberikan hak istimewa
    roleHasil = "tamu";
    namaPengguna = dataUser.email ? dataUser.email.split("@")[0] : "";
  }

  return {
    user: dataUser,
    profile: profilPengguna,
    role: roleHasil,
    userName: namaPengguna,
  };
}

/**
 * Middleware Autentikasi Pengguna untuk Express
 * 
 * Memeriksa header 'Authorization: Bearer <token>'.
 * - Jika tidak ada header: set req.userAuth = { role: 'tamu', userName: '' } dan lanjutkan (guest chat diizinkan).
 * - Jika format header salah: kembalikan 401 AUTH_HEADER_INVALID.
 * - Jika token tidak valid / kedaluwarsa: kembalikan 401 AUTH_TOKEN_INVALID (JANGAN turunkan ke tamu).
 * - Jika token valid: set req.userAuth sesuai data profil dan lanjutkan.
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];

  // 1. Pengguna Tanpa Token -> Role 'tamu' (Guest Chat Tetap Berfungsi)
  if (!authHeader || typeof authHeader !== "string" || !authHeader.trim()) {
    req.userAuth = {
      isAuth: false,
      role: "tamu",
      userName: "",
      user: null,
      profile: null,
    };
    return next();
  }

  // 2. Validasi Format Header 'Bearer <token>'
  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer" || !parts[1].trim()) {
    return res.status(401).json({
      success: false,
      reply: null,
      error: {
        code: "AUTH_HEADER_INVALID",
        message: "Format Authorization header tidak valid. Gunakan format 'Bearer <token>'.",
      },
    });
  }

  const token = parts[1].trim();

  // 3. Verifikasi Token melalui Supabase
  try {
    // Mendukung mock verifier via req.app?.locals?.supabaseVerifier untuk unit testing
    const verifier = req.app?.locals?.supabaseVerifier || verifikasiTokenSupabase;
    const authResult = await verifier(token);

    req.userAuth = {
      isAuth: true,
      role: authResult.role,
      userName: authResult.userName,
      user: authResult.user,
      profile: authResult.profile,
    };
    return next();
  } catch (error) {
    if (error instanceof SupabaseAuthError) {
      return res.status(error.statusCode).json({
        success: false,
        reply: null,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    console.error("[Supabase Auth Middleware Error]", error.message);
    return res.status(500).json({
      success: false,
      reply: null,
      error: {
        code: "AUTH_INTERNAL_ERROR",
        message: "Terjadi kesalahan internal saat memverifikasi identitas pengguna.",
      },
    });
  }
}
