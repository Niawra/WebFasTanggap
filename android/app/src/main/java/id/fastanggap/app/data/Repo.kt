package id.fastanggap.app.data

import id.fastanggap.app.BuildConfig
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.decodeRecord
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.coroutines.flow.map
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.storage.Storage
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.onCompletion
import kotlinx.coroutines.flow.onStart
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID
import kotlin.time.Duration.Companion.hours

/** Semua akses ke Supabase. Tabelnya sama dengan yang dipakai website. */
object Repo {
    val supabase = createSupabaseClient(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_KEY) {
        install(Auth)
        install(Postgrest)
        install(Storage)
        install(Realtime)
    }

    private const val BUCKET = "report-photos"
    private const val KOLOM_LAPORAN = "*, categories(name), locations(name)"

    /* ---------- akun ---------- */

    suspend fun muatSesi(): Sesi? {
        supabase.auth.awaitInitialization()
        val user = supabase.auth.currentUserOrNull() ?: return null
        val profil = supabase.from("profiles")
            .select { filter { eq("id", user.id) } }
            .decodeSingleOrNull<Profil>()
        return Sesi(
            id = user.id,
            email = user.email.orEmpty(),
            nama = profil?.nama ?: user.email.orEmpty().substringBefore("@"),
            peran = if (profil?.role == "petugas") Peran.PETUGAS else Peran.SISWA,
            kelas = profil?.kelas.orEmpty(),
            telepon = profil?.phone.orEmpty(),
        )
    }

    suspend fun masuk(email: String, sandi: String): Sesi? {
        supabase.auth.signInWith(Email) {
            this.email = email.trim()
            password = sandi
        }
        return muatSesi()
    }

    suspend fun keluar() = supabase.auth.signOut()

    /** Nomor WhatsApp disimpan dalam format 62xxxx tanpa tanda plus. */
    suspend fun simpanTelepon(idPengguna: String, nomor: String) {
        supabase.from("profiles").update({ set("phone", normalkanNomor(nomor)) }) {
            filter { eq("id", idPengguna) }
        }
    }

    fun normalkanNomor(nomor: String): String {
        val angka = nomor.filter { it.isDigit() }
        return when {
            angka.startsWith("0") -> "62" + angka.drop(1)
            angka.startsWith("8") -> "62$angka"
            else -> angka
        }
    }

    /* ---------- referensi ---------- */

    suspend fun kategori(): List<Ref> =
        supabase.from("categories").select { order("name", Order.ASCENDING) }
            .decodeList<Ref>().filter { it.aktif }

    suspend fun lokasi(): List<Ref> =
        supabase.from("locations").select { order("name", Order.ASCENDING) }
            .decodeList<Ref>().filter { it.aktif }

    /* ---------- laporan ---------- */

    /** RLS di Supabase yang menentukan isinya: siswa hanya miliknya, petugas semuanya. */
    suspend fun laporan(): List<Laporan> =
        supabase.from("reports").select(Columns.raw(KOLOM_LAPORAN)) {
            order("created_at", Order.DESCENDING)
        }.decodeList<Laporan>()

    suspend fun profil(): Map<String, Profil> =
        supabase.from("profiles").select().decodeList<Profil>().associateBy { it.id }

    suspend fun kirimLaporan(
        idPengguna: String,
        kategoriId: String,
        lokasiId: String,
        judul: String,
        deskripsi: String,
        fotoJpeg: ByteArray?,
    ): String {
        val jalur = fotoJpeg?.let {
            val path = "$idPengguna/${UUID.randomUUID()}.jpg"
            supabase.storage.from(BUCKET).upload(path, it)
            path
        }
        return supabase.from("reports").insert(
            LaporanBaru(idPengguna, kategoriId, lokasiId, judul.trim(), deskripsi.trim(), jalur),
        ) { select(Columns.list("code")) }.decodeSingle<HasilKode>().code
    }

    suspend fun urlFoto(jalur: String): String =
        supabase.storage.from(BUCKET).createSignedUrl(jalur, 1.hours)

    /** Petugas mengambil tugas. Database hanya menerima petugas pertama. */
    suspend fun ambilTugas(idLaporan: String): HasilAmbil =
        supabase.postgrest.rpc("ambil_tugas", buildJsonObject { put("p_id", idLaporan) })
            .decodeAs<HasilAmbil>()

    suspend fun ubahStatus(laporan: Laporan, status: Status, catatan: String, idPetugas: String) {
        supabase.from("reports").update({
            set("status", status.db)
            if (status == Status.DITOLAK) set("rejection_reason", catatan.trim())
        }) { filter { eq("id", laporan.id) } }
        if (status != Status.DITOLAK && catatan.isNotBlank()) {
            supabase.from("report_notes").insert(Catatan(laporan.id, idPetugas, catatan.trim()))
        }
    }

    /** Nomor WA petugas yang menangani laporan milik pelapor ini (lihat migrasi-aplikasi.sql). */
    suspend fun kontakPetugas(idLaporan: String): String? {
        val mentah = supabase.postgrest.rpc("kontak_petugas", buildJsonObject { put("p_id", idLaporan) }).data
        val isi = Json.parseToJsonElement(mentah.ifBlank { "null" })
        return (isi as? JsonPrimitive)?.takeIf { it.isString }?.content
    }

    /** Mengalir setiap kali tabel reports berubah, supaya daftar tugas selalu segar. */
    fun perubahanLaporan(): Flow<PostgresAction> {
        val kanal = supabase.channel("laporan-${UUID.randomUUID()}")
        return kanal.postgresChangeFlow<PostgresAction>(schema = "public") { table = "reports" }
            .onStart { kanal.subscribe() }
            .onCompletion { supabase.realtime.removeChannel(kanal) }
    }

    /* ---------- chat per laporan ---------- */

    suspend fun muatChat(idLaporan: String): List<Pesan> =
        supabase.from("report_messages").select {
            filter { eq("report_id", idLaporan) }
            order("created_at", Order.ASCENDING)
        }.decodeList<Pesan>()

    suspend fun kirimChat(idLaporan: String, idPengirim: String, isi: String) {
        supabase.from("report_messages").insert(PesanBaru(idLaporan, idPengirim, isi.trim()))
    }

    suspend fun namaPengguna(ids: Collection<String>): Map<String, Profil> =
        if (ids.isEmpty()) emptyMap()
        else supabase.from("profiles").select { filter { isIn("id", ids.toList()) } }
            .decodeList<Profil>().associateBy { it.id }

    /** Pesan baru di laporan ini, langsung dari realtime. */
    fun chatMasuk(idLaporan: String): Flow<Pesan> {
        val kanal = supabase.channel("chat-$idLaporan-${UUID.randomUUID()}")
        return kanal.postgresChangeFlow<PostgresAction.Insert>(schema = "public") {
            table = "report_messages"
            filter("report_id", FilterOperator.EQ, idLaporan)
        }.map { it.decodeRecord<Pesan>() }
            .onStart { kanal.subscribe() }
            .onCompletion { supabase.realtime.removeChannel(kanal) }
    }
}
