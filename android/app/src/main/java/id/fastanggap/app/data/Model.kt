package id.fastanggap.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Baris tabel `reports` beserta nama kategori dan lokasinya. */
@Serializable
data class Laporan(
    val id: String,
    val code: String? = null,
    val title: String = "",
    val description: String = "",
    val status: String = "menunggu_verifikasi",
    val priority: String? = null,
    @SerialName("photo_path") val photoPath: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("reporter_id") val reporterId: String? = null,
    @SerialName("assigned_to") val assignedTo: String? = null,
    @SerialName("assigned_at") val assignedAt: String? = null,
    @SerialName("rejection_reason") val alasanTolak: String? = null,
    val categories: Nama? = null,
    val locations: Nama? = null,
) {
    val kode: String get() = code ?: id.take(8).uppercase()
    val kategori: String get() = categories?.name.orEmpty()
    val lokasi: String get() = locations?.name.orEmpty()
}

@Serializable
data class Nama(val name: String = "")

@Serializable
data class Profil(
    val id: String,
    @SerialName("full_name") val nama: String? = null,
    val role: String? = null,
    @SerialName("class_name") val kelas: String? = null,
    val phone: String? = null,
)

/** Kategori atau lokasi. */
@Serializable
data class Ref(
    val id: String,
    val name: String,
    @SerialName("is_active") val aktif: Boolean = true,
)

@Serializable
data class LaporanBaru(
    @SerialName("reporter_id") val reporterId: String,
    @SerialName("category_id") val kategoriId: String,
    @SerialName("location_id") val lokasiId: String,
    val title: String,
    val description: String,
    @SerialName("photo_path") val photoPath: String? = null,
)

@Serializable
data class HasilKode(val code: String)

@Serializable
data class HasilAmbil(
    val ok: Boolean,
    val pesan: String = "",
    val oleh: String? = null,
)

@Serializable
data class Catatan(
    @SerialName("report_id") val reportId: String,
    @SerialName("author_id") val authorId: String,
    val note: String,
)

enum class Peran { SISWA, PETUGAS }

data class Sesi(
    val id: String,
    val email: String,
    val nama: String,
    val peran: Peran,
    val kelas: String,
    val telepon: String,
)

/** Status di database → label dan warna yang dipakai di aplikasi. */
enum class Status(val db: String, val label: String) {
    MENUNGGU("menunggu_verifikasi", "Menunggu"),
    DIPROSES("diproses", "Diproses"),
    SELESAI("selesai", "Selesai"),
    DITOLAK("ditolak", "Ditolak");

    companion object {
        fun dari(db: String) = entries.firstOrNull { it.db == db } ?: MENUNGGU
    }
}
