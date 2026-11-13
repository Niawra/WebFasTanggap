package id.fastanggap.app.ui

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.fastanggap.app.AppViewModel
import id.fastanggap.app.data.Laporan
import id.fastanggap.app.data.Pesan
import id.fastanggap.app.data.Peran
import id.fastanggap.app.data.Profil
import id.fastanggap.app.data.Repo
import id.fastanggap.app.data.Status
import kotlinx.coroutines.launch

/**
 * Obrolan pelapor <-> petugas untuk satu laporan. Tabelnya sama dengan website
 * (report_messages), dan pesan terhapus otomatis saat laporan ditutup.
 */
@Composable
fun KartuChat(vm: AppViewModel, l: Laporan, modifier: Modifier = Modifier) {
    val sesi = vm.sesi ?: return
    val status = Status.dari(l.status)
    val tutup = status == Status.SELESAI || status == Status.DITOLAK
    val pesan = remember(l.id) { mutableStateListOf<Pesan>() }
    val profil = remember(l.id) { mutableStateMapOf<String, Profil>() }
    var memuat by remember(l.id) { mutableStateOf(true) }
    var tulis by remember(l.id) { mutableStateOf("") }
    var mengirim by remember { mutableStateOf(false) }
    val lingkup = rememberCoroutineScope()

    suspend fun lengkapiNama(ids: Collection<String>) {
        val kurang = ids.filter { it !in profil }
        if (kurang.isNotEmpty()) runCatching { profil.putAll(Repo.namaPengguna(kurang)) }
    }

    LaunchedEffect(l.id) {
        val awal = runCatching { Repo.muatChat(l.id) }.getOrDefault(emptyList())
        lengkapiNama(awal.map { it.senderId }.toSet())
        pesan.clear()
        pesan.addAll(awal)
        memuat = false
        if (!tutup) {
            runCatching {
                Repo.chatMasuk(l.id).collect { p ->
                    if (pesan.none { it.id == p.id }) {
                        lengkapiNama(listOf(p.senderId))
                        pesan.add(p)
                    }
                }
            }
        }
    }

    Kartu(modifier.fillMaxWidth()) {
        Column(Modifier.animateContentSize()) {
            Text(
                if (sesi.peran == Peran.PETUGAS) "Obrolan dengan pelapor" else "Obrolan dengan petugas",
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                if (tutup) "Laporan sudah ditutup" else "Pesan terhapus otomatis saat laporan ditutup",
                color = Warna.TintaLembut,
                fontSize = 12.sp,
            )
            Spacer(Modifier.height(12.dp))
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Warna.Latar).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                when {
                    memuat -> Text("Memuat pesan...", color = Warna.TintaLembut, fontSize = 14.sp, modifier = Modifier.align(Alignment.CenterHorizontally))
                    pesan.isEmpty() -> Text(
                        if (tutup) "Tidak ada obrolan." else "Belum ada pesan.",
                        color = Warna.TintaLembut,
                        fontSize = 14.sp,
                        modifier = Modifier.align(Alignment.CenterHorizontally),
                    )
                    else -> pesan.forEach { p -> Gelembung(p, p.senderId == sesi.id, profil[p.senderId]) }
                }
            }
            if (!tutup) {
                Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = tulis,
                        onValueChange = { if (it.length <= 1000) tulis = it },
                        placeholder = { Text("Tulis pesan...") },
                        shape = RoundedCornerShape(50),
                        maxLines = 4,
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Warna.Merah, cursorColor = Warna.Merah),
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.size(8.dp))
                    val bisa = tulis.isNotBlank() && !mengirim
                    Box(
                        Modifier
                            .size(50.dp)
                            .clip(CircleShape)
                            .background(if (bisa) Warna.Merah else Warna.Merah.copy(alpha = 0.35f))
                            .clickable(enabled = bisa) {
                                val isi = tulis.trim()
                                mengirim = true
                                lingkup.launch {
                                    runCatching { Repo.kirimChat(l.id, sesi.id, isi) }
                                        .onSuccess { tulis = "" }
                                        .onFailure { vm.kabari("Pesan gagal dikirim") }
                                    mengirim = false
                                }
                            },
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.AutoMirrored.Rounded.Send, "Kirim", tint = Color.White) }
                }
            }
        }
    }
}

@Composable
private fun Gelembung(p: Pesan, milikku: Boolean, profil: Profil?) {
    Box(Modifier.fillMaxWidth(), contentAlignment = if (milikku) Alignment.CenterEnd else Alignment.CenterStart) {
        Column(
            Modifier
                .widthIn(max = 280.dp)
                .clip(
                    if (milikku) RoundedCornerShape(18.dp, 18.dp, 4.dp, 18.dp)
                    else RoundedCornerShape(18.dp, 18.dp, 18.dp, 4.dp),
                )
                .background(if (milikku) Warna.Merah else Color.White)
                .padding(horizontal = 13.dp, vertical = 8.dp),
        ) {
            val warna = if (milikku) Color.White else Warna.Tinta
            val nama = if (milikku) "Kamu" else (profil?.nama ?: "Pengguna") + if (profil?.role == "petugas") " · petugas" else ""
            Text(nama, color = warna.copy(alpha = 0.8f), fontSize = 11.sp)
            Text(p.body, color = warna, fontSize = 15.sp)
            Text(sejak(p.createdAt), color = warna.copy(alpha = 0.6f), fontSize = 10.sp, modifier = Modifier.align(Alignment.End))
        }
    }
}
