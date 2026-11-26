package id.fastanggap.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.fastanggap.app.data.ContohData
import id.fastanggap.app.data.Laporan
import id.fastanggap.app.data.Peran
import id.fastanggap.app.data.Profil
import id.fastanggap.app.data.Ref
import id.fastanggap.app.data.Repo
import id.fastanggap.app.data.Sesi
import id.fastanggap.app.data.Status
import id.fastanggap.app.data.TanggapAi
import io.github.jan.supabase.realtime.PostgresAction
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive

class AppViewModel private constructor(contoh: Boolean) : ViewModel() {
    constructor() : this(false)

    var memuat by mutableStateOf(true)
        private set
    var sesi by mutableStateOf<Sesi?>(null)
        private set
    /** Untuk petugas: tanpa laporan yang disembunyikan (asal-asalan). Untuk siswa: semua miliknya. */
    var laporan by mutableStateOf<List<Laporan>>(emptyList())
        private set
    /** Laporan asal-asalan yang disembunyikan (hanya terisi untuk petugas). */
    var tersembunyi by mutableStateOf<List<Laporan>>(emptyList())
        private set
    var profil by mutableStateOf<Map<String, Profil>>(emptyMap())
        private set
    var kategori by mutableStateOf<List<Ref>>(emptyList())
        private set
    var lokasi by mutableStateOf<List<Ref>>(emptyList())
        private set
    var menyegarkan by mutableStateOf(false)
        private set

    private val _pesan = MutableSharedFlow<String>(extraBufferCapacity = 4)
    /** Pesan singkat untuk ditampilkan sebagai notifikasi di dalam aplikasi. */
    val pesan = _pesan.asSharedFlow()

    private var pantau: Job? = null

    init {
        if (!contoh) viewModelScope.launch {
            sesi = runCatching { Repo.muatSesi() }.getOrNull()
            if (sesi != null) mulaiSesi()
            memuat = false
        }
    }

    companion object {
        /** Hanya untuk @Preview: ViewModel berisi data palsu, tanpa menyentuh jaringan. */
        fun contoh(peran: Peran = Peran.SISWA, masuk: Boolean = true, memuat: Boolean = false): AppViewModel = AppViewModel(true).apply {
            this.memuat = memuat
            if (!masuk) return@apply
            val petugas = peran == Peran.PETUGAS
            sesi = if (petugas) ContohData.petugas else ContohData.siswa
            laporan = ContohData.laporan
            profil = ContohData.profil
            kategori = ContohData.kategori
            lokasi = ContohData.lokasi
        }
    }

    fun kabari(teks: String) {
        _pesan.tryEmit(teks)
    }

    suspend fun masuk(email: String, sandi: String): String? {
        return try {
            val baru = Repo.masuk(email, sandi)
            if (baru != null && baru.peran != Peran.PETUGAS && !Repo.emailSiswaValid(baru.email)) {
                runCatching { Repo.keluar() }
                return Repo.PESAN_EMAIL_SISWA
            }
            sesi = baru
            mulaiSesi()
            null
        } catch (e: Exception) {
            "Email atau kata sandi tidak cocok."
        }
    }

    suspend fun daftar(nama: String, kelas: String, email: String, sandi: String): String? {
        if (!Repo.emailSiswaValid(email)) return Repo.PESAN_EMAIL_SISWA
        return try {
            sesi = Repo.daftar(nama, kelas, email, sandi)
            if (sesi == null) return "Akun dibuat, tetapi belum bisa masuk. Coba dari halaman Masuk."
            mulaiSesi()
            null
        } catch (e: Exception) {
            val m = e.message.orEmpty()
            if (Regex("registered|exists", RegexOption.IGNORE_CASE).containsMatchIn(m)) "Email itu sudah terdaftar. Coba masuk."
            else if (Regex("database error saving new user|EMAIL_BUKAN_SEKOLAH", RegexOption.IGNORE_CASE).containsMatchIn(m)) Repo.PESAN_EMAIL_SISWA
            else "Pendaftaran gagal. Periksa data dan koneksi internet."
        }
    }

    suspend fun hapus(l: Laporan): Boolean =
        runCatching { Repo.hapusLaporan(l.id) }
            .onSuccess { segarkan() }
            .isSuccess

    fun keluar() {
        viewModelScope.launch {
            pantau?.cancel()
            runCatching { Repo.keluar() }
            sesi = null
            laporan = emptyList()
        }
    }

    private suspend fun mulaiSesi() {
        segarkan()
        runCatching {
            kategori = Repo.kategori()
            lokasi = Repo.lokasi()
        }
        pantauPerubahan()
    }

    fun segarkanAsync() {
        viewModelScope.launch { segarkan() }
    }

    suspend fun segarkan() {
        menyegarkan = true
        runCatching {
            val semua = Repo.laporan()
            if (sesi?.peran == Peran.PETUGAS) {
                laporan = semua.filterNot { it.tersembunyi }
                tersembunyi = semua.filter { it.tersembunyi }
                profil = Repo.profil()
            } else {
                laporan = semua
            }
        }.onFailure { kabari("Gagal memuat data. Periksa koneksi internet.") }
        menyegarkan = false
    }

    /** Realtime: tugas baru atau tugas yang diambil petugas lain langsung terlihat. */
    private fun pantauPerubahan() {
        pantau?.cancel()
        val s = sesi ?: return
        pantau = viewModelScope.launch {
            Repo.perubahanLaporan()
                .catch { }
                .collect { aksi ->
                    val lama = laporan.associateBy { it.id }
                    segarkan()
                    if (s.peran != Peran.PETUGAS) return@collect
                    when (aksi) {
                        is PostgresAction.Insert -> kabari("Tugas baru masuk")
                        is PostgresAction.Update -> {
                            val baru = laporan.firstOrNull { it.id == (aksi.record["id"] as? JsonPrimitive)?.content }
                            val sebelum = baru?.let { lama[it.id] }
                            if (baru != null && sebelum?.assignedTo == null && baru.assignedTo != null && baru.assignedTo != s.id) {
                                kabari("${baru.kode} sudah diambil ${namaDari(baru.assignedTo)}")
                            }
                        }
                        else -> Unit
                    }
                }
        }
    }

    fun namaDari(id: String?): String = id?.let { profil[it]?.nama } ?: "petugas lain"

    suspend fun kirimLaporan(kategoriId: String, lokasiId: String, judul: String, deskripsi: String, foto: ByteArray?): Result<String> {
        val s = sesi ?: return Result.failure(IllegalStateException("Belum masuk"))
        val hasil = runCatching { Repo.kirimLaporan(s.id, kategoriId, lokasiId, judul, deskripsi, foto) }
            .getOrElse { e ->
                val pesan = e.message.orEmpty()
                return Result.failure(
                    Exception(
                        if (pesan.contains("AKUN_DIBLOKIR")) "Laporan gagal dikirim. Minta petugas menjalankan migrasi-tolak-otomatis.sql di Supabase."
                        else "Laporan gagal dikirim. Coba lagi.",
                    ),
                )
            }
        val cek = TanggapAi.verifikasi(hasil.id)
        runCatching { Repo.muatSesi() }.getOrNull()?.let { sesi = it }
        segarkan()
        if (cek?.first == "asal") {
            return Result.failure(Exception("Laporan ditolak otomatis oleh TanggapAI: ${cek.second}"))
        }
        return Result.success(hasil.code)
    }

    suspend fun tandaiAsal(l: Laporan, alasan: String): Boolean =
        runCatching { Repo.tandaiAsal(l.id, alasan.ifBlank { "Isi laporan tidak jelas atau tidak sesuai." }) }
            .onSuccess { segarkan() }
            .isSuccess

    suspend fun pulihkan(l: Laporan): Boolean =
        runCatching { Repo.pulihkan(l.id) }
            .onSuccess { segarkan() }
            .isSuccess

    suspend fun ambil(l: Laporan): String {
        val hasil = runCatching { Repo.ambilTugas(l.id) }.getOrElse { return "Gagal mengambil tugas. Coba lagi." }
        segarkan()
        return if (hasil.ok) "Tugas ${l.kode} jadi milikmu" else hasil.pesan
    }

    suspend fun ubahStatus(l: Laporan, status: Status, catatan: String): Boolean {
        val s = sesi ?: return false
        return runCatching { Repo.ubahStatus(l, status, catatan, s.id) }
            .onSuccess { segarkan() }
            .isSuccess
    }

    /** null = berhasil; selain itu pesan galat untuk ditampilkan. */
    suspend fun simpanPanggilan(panggilan: String): String? {
        val s = sesi ?: return "Belum masuk."
        val bersih = panggilan.trim().take(30)
        if (bersih.isEmpty()) return "Nama panggilan belum diisi."
        return runCatching { Repo.simpanPanggilan(s.id, bersih) }
            .fold(
                onSuccess = { sesi = s.copy(panggilan = bersih); null },
                onFailure = { e ->
                    if (e.message.orEmpty().contains("nickname")) "Database belum siap. Minta admin menjalankan migrasi-nama-panggilan.sql di Supabase."
                    else "Gagal menyimpan. Periksa koneksi internet."
                },
            )
    }

    suspend fun simpanTelepon(nomor: String): Boolean {
        val s = sesi ?: return false
        return runCatching { Repo.simpanTelepon(s.id, nomor) }
            .onSuccess { sesi = s.copy(telepon = Repo.normalkanNomor(nomor)) }
            .isSuccess
    }
}
