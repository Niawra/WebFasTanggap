package id.fastanggap.app.data

import id.fastanggap.app.BuildConfig
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import java.net.HttpURLConnection
import java.net.URL

/** Satu giliran obrolan TanggapAI. role: "user" atau "model" (sama dengan website). */
data class GiliranAi(val role: String, val text: String)

/** Draf laporan yang disusun TanggapAI; kategori & lokasi memakai nama persis dari database. */
data class DrafLaporan(val judul: String, val kategori: String, val lokasi: String, val deskripsi: String)

data class BalasanAi(val teks: String, val draf: DrafLaporan?)

/**
 * Klien backend TanggapAI (server/ di repo ini). Kunci AI hanya ada di server;
 * aplikasi cukup mengirim pesan + token login Supabase agar peran siswa/petugas dikenali.
 */
object TanggapAi {
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Minta backend menilai laporan yang baru dikirim. Hasil: Pair(verdict, alasan), verdict valid|ragu|asal.
     * null = verifikasi tidak tersedia (laporan tetap menunggu petugas, tidak ada hukuman).
     */
    suspend fun verifikasi(idLaporan: String): Pair<String, String>? = withContext(Dispatchers.IO) {
        runCatching {
            val alamat = BuildConfig.TANGGAPAI_URL.replace(Regex("/api/chat/?$"), "/api/verifikasi-laporan")
            val token = Repo.supabase.auth.currentAccessTokenOrNull() ?: return@runCatching null
            val koneksi = (URL(alamat).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15_000
                readTimeout = 35_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
            }
            try {
                koneksi.outputStream.use { it.write(buildJsonObject { put("reportId", idLaporan) }.toString().toByteArray()) }
                if (koneksi.responseCode !in 200..299) return@runCatching null
                val hasil = json.parseToJsonElement(koneksi.inputStream.bufferedReader().use { it.readText() }).jsonObject
                val verdict = hasil["verdict"]?.jsonPrimitive?.contentOrNull ?: return@runCatching null
                verdict to (hasil["alasan"]?.jsonPrimitive?.contentOrNull ?: "")
            } finally {
                koneksi.disconnect()
            }
        }.getOrNull()
    }

    /** Mengembalikan balasan AI, atau melempar Exception berisi pesan yang aman ditampilkan. */
    suspend fun tanya(
        pesan: String,
        riwayat: List<GiliranAi>,
        kategori: List<String> = emptyList(),
        lokasi: List<String> = emptyList(),
    ): BalasanAi = withContext(Dispatchers.IO) {
        val badan = buildJsonObject {
            put("message", pesan)
            if (kategori.isNotEmpty() && lokasi.isNotEmpty()) {
                putJsonArray("kategori") { kategori.forEach { add(JsonPrimitive(it)) } }
                putJsonArray("lokasi") { lokasi.forEach { add(JsonPrimitive(it)) } }
            }
            putJsonArray("history") {
                riwayat.takeLast(4).forEach { g ->
                    addJsonObject { put("role", g.role); put("text", g.text) }
                }
            }
        }.toString()

        val koneksi = (URL(BuildConfig.TANGGAPAI_URL).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 35_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            Repo.supabase.auth.currentAccessTokenOrNull()?.let { setRequestProperty("Authorization", "Bearer $it") }
        }

        try {
            koneksi.outputStream.use { it.write(badan.toByteArray()) }
            val kode = koneksi.responseCode
            val teks = (if (kode in 200..299) koneksi.inputStream else koneksi.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            val hasil = runCatching { json.parseToJsonElement(teks).jsonObject }.getOrNull()
            val balasan = hasil?.get("reply")?.jsonPrimitive?.contentOrNull
            if (kode in 200..299 && !balasan.isNullOrBlank()) {
                val d = hasil["draft"] as? JsonObject
                val draf = d?.let { o ->
                    fun t(k: String) = o[k]?.jsonPrimitive?.contentOrNull.orEmpty()
                    DrafLaporan(t("judul"), t("kategori"), t("lokasi"), t("deskripsi"))
                }?.takeIf { it.judul.isNotBlank() && it.kategori.isNotBlank() && it.lokasi.isNotBlank() }
                return@withContext BalasanAi(balasan, draf)
            }

            val galat = (hasil?.get("error") as? JsonObject)?.get("message")?.jsonPrimitive?.contentOrNull
                ?: hasil?.get("error")?.let { runCatching { it.jsonPrimitive.contentOrNull }.getOrNull() }
            throw Exception(galat ?: "TanggapAI sedang tidak bisa dihubungi (kode $kode).")
        } catch (e: java.io.IOException) {
            throw Exception("Gagal terhubung ke server TanggapAI. Pastikan server dan tunnel di laptop sedang aktif.")
        } finally {
            koneksi.disconnect()
        }
    }
}
