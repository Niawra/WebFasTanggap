package id.fastanggap.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.fastanggap.app.data.Laporan
import id.fastanggap.app.data.Peran
import id.fastanggap.app.data.Profil
import id.fastanggap.app.data.Ref
import id.fastanggap.app.data.Repo
import id.fastanggap.app.data.Sesi
import id.fastanggap.app.data.Status
import io.github.jan.supabase.realtime.PostgresAction
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive

class AppViewModel : ViewModel() {
    var memuat by mutableStateOf(true)
        private set
    var sesi by mutableStateOf<Sesi?>(null)
        private set
    var laporan by mutableStateOf<List<Laporan>>(emptyList())
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
        viewModelScope.launch {
            sesi = runCatching { Repo.muatSesi() }.getOrNull()
            if (sesi != null) mulaiSesi()
            memuat = false
        }
    }

    fun kabari(teks: String) {
        _pesan.tryEmit(teks)
    }

    suspend fun masuk(email: String, sandi: String): String? {
        return try {
            sesi = Repo.masuk(email, sandi)
            mulaiSesi()
            null
        } catch (e: Exception) {
            "Email atau kata sandi tidak cocok."
        }
    }

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
            laporan = Repo.laporan()
            if (sesi?.peran == Peran.PETUGAS) profil = Repo.profil()
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
        return runCatching { Repo.kirimLaporan(s.id, kategoriId, lokasiId, judul, deskripsi, foto) }
            .onSuccess { segarkan() }
    }

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

    suspend fun simpanTelepon(nomor: String): Boolean {
        val s = sesi ?: return false
        return runCatching { Repo.simpanTelepon(s.id, nomor) }
            .onSuccess { sesi = s.copy(telepon = Repo.normalkanNomor(nomor)) }
            .isSuccess
    }
}
