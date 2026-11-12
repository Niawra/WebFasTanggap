@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package id.fastanggap.app.ui.siswa

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Inbox
import androidx.compose.material.icons.rounded.Place
import androidx.compose.material.icons.rounded.AddCircle
import androidx.compose.material.icons.rounded.Chat
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import id.fastanggap.app.AppViewModel
import id.fastanggap.app.data.Laporan
import id.fastanggap.app.data.Repo
import id.fastanggap.app.data.Status
import id.fastanggap.app.ui.AngkaBerhitung
import id.fastanggap.app.ui.JudulBesar
import id.fastanggap.app.ui.Kartu
import id.fastanggap.app.ui.Kosong
import id.fastanggap.app.ui.PilStatus
import id.fastanggap.app.ui.TombolUtama
import id.fastanggap.app.ui.Warna
import id.fastanggap.app.ui.sejak
import id.fastanggap.app.ui.tanggal
import id.fastanggap.app.ui.warnaStatus
import kotlinx.coroutines.launch

/** Ruang kosong di bawah daftar supaya tidak tertutup bilah kaca. */
val RuangBilah = 120.dp

@Composable
fun BerandaSiswa(vm: AppViewModel, buka: (Laporan) -> Unit, lapor: () -> Unit, semua: () -> Unit) {
    val sesi = vm.sesi ?: return
    val milik = vm.laporan.filter { it.reporterId == sesi.id }
    val lingkup = rememberCoroutineScope()
    PullToRefreshBox(isRefreshing = vm.menyegarkan, onRefresh = { lingkup.launch { vm.segarkan() } }) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = RuangBilah)) {
            item { JudulBesar("Halo, ${sesi.nama.substringBefore(" ")}", sub = sesi.kelas.ifBlank { "Siswa" }) }
            item {
                // Kartu ajakan melapor: merah penuh, bisa ditekan.
                Kartu(Modifier.padding(horizontal = 18.dp, vertical = 8.dp).fillMaxWidth(), onClick = lapor, padding = PaddingValues(0.dp)) {
                    Box(Modifier.fillMaxWidth().background(Warna.Merah).padding(22.dp)) {
                        Box(
                            Modifier.align(Alignment.TopEnd).size(64.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.16f)),
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.Rounded.AddCircle, null, tint = Color.White, modifier = Modifier.size(34.dp)) }
                        Column {
                            Text("Ada yang rusak?", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(6.dp))
                            Text("Foto, pilih lokasi, kirim.\nPetugas langsung dapat kabar.", color = Color.White.copy(alpha = 0.85f), fontSize = 14.sp)
                            Spacer(Modifier.height(16.dp))
                            Box(Modifier.clip(RoundedCornerShape(50)).background(Color.White).padding(horizontal = 16.dp, vertical = 9.dp)) {
                                Text("Buat laporan", color = Warna.MerahTua, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            }
                        }
                    }
                }
            }
            item {
                Row(Modifier.padding(horizontal = 18.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    listOf(Status.MENUNGGU, Status.DIPROSES, Status.SELESAI).forEach { s ->
                        val (depan, latar) = warnaStatus(s)
                        Kartu(Modifier.weight(1f), padding = PaddingValues(14.dp)) {
                            Column {
                                Box(Modifier.size(8.dp).clip(CircleShape).background(depan))
                                Spacer(Modifier.height(10.dp))
                                AngkaBerhitung(milik.count { Status.dari(it.status) == s }, ukuran = 28.dp)
                                Text(s.label, color = Warna.TintaLembut, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
            item {
                Row(
                    Modifier.fillMaxWidth().padding(start = 22.dp, end = 12.dp, top = 18.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Terbaru", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                    if (milik.isNotEmpty()) {
                        Text("Lihat semua", color = Warna.Merah, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                            modifier = Modifier.clip(RoundedCornerShape(50)).clickable(onClick = semua).padding(10.dp))
                    }
                }
            }
            if (milik.isEmpty()) {
                item { Kosong("Belum ada laporan", "Laporan yang kamu kirim akan muncul di sini.", Icons.Rounded.Inbox) }
            }
            items(milik.take(4), key = { it.id }) { l ->
                KartuLaporan(l, { buka(l) }, Modifier.animateItem().padding(horizontal = 18.dp, vertical = 6.dp))
            }
        }
    }
}

@Composable
fun LaporanSaya(vm: AppViewModel, buka: (Laporan) -> Unit) {
    val sesi = vm.sesi ?: return
    var saring by remember { mutableStateOf<Status?>(null) }
    val milik = vm.laporan.filter { it.reporterId == sesi.id && (saring == null || Status.dari(it.status) == saring) }
    val lingkup = rememberCoroutineScope()
    PullToRefreshBox(isRefreshing = vm.menyegarkan, onRefresh = { lingkup.launch { vm.segarkan() } }) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = RuangBilah)) {
            item { JudulBesar("Laporan saya") }
            item { Saringan(saring) { saring = it } }
            if (milik.isEmpty()) {
                item { Kosong("Tidak ada laporan", "Belum ada laporan dengan status ini.", Icons.Rounded.Inbox) }
            }
            items(milik, key = { it.id }) { l ->
                KartuLaporan(l, { buka(l) }, Modifier.animateItem().padding(horizontal = 18.dp, vertical = 6.dp))
            }
        }
    }
}

@Composable
fun Saringan(terpilih: Status?, pilih: (Status?) -> Unit) {
    Row(
        Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        (listOf<Status?>(null) + Status.entries).forEach { s ->
            val aktif = s == terpilih
            Text(
                s?.label ?: "Semua",
                color = if (aktif) Color.White else Warna.Tinta,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(if (aktif) Warna.Tinta else Color.White)
                    .clickable { pilih(s) }
                    .padding(horizontal = 16.dp, vertical = 9.dp),
            )
        }
    }
}

@Composable
fun KartuLaporan(l: Laporan, onClick: () -> Unit, modifier: Modifier = Modifier, ekor: @Composable (() -> Unit)? = null) {
    Kartu(modifier.fillMaxWidth(), onClick = onClick) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(l.kode, color = Warna.TintaLembut, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.5.sp)
                Spacer(Modifier.width(8.dp))
                Text("· ${sejak(l.createdAt)}", color = Warna.TintaLembut, fontSize = 12.sp)
                Spacer(Modifier.weight(1f))
                PilStatus(Status.dari(l.status))
            }
            Spacer(Modifier.height(10.dp))
            Text(l.title, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.Place, null, tint = Warna.Merah, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(4.dp))
                Text("${l.lokasi} · ${l.kategori}", color = Warna.TintaLembut, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                if (ekor == null) Icon(Icons.Rounded.ChevronRight, null, tint = Warna.TintaLembut)
            }
            if (ekor != null) {
                Spacer(Modifier.height(14.dp))
                ekor()
            }
        }
    }
}

/** Detail laporan layar penuh. Siswa bisa langsung chat petugas penanganan di WhatsApp. */
@Composable
fun DetailLaporan(vm: AppViewModel, l: Laporan, tutup: () -> Unit, aksi: @Composable (() -> Unit)? = null) {
    val konteks = LocalContext.current
    val lingkup = rememberCoroutineScope()
    var foto by remember(l.photoPath) { mutableStateOf<String?>(null) }
    LaunchedEffect(l.photoPath) {
        foto = l.photoPath?.let { runCatching { Repo.urlFoto(it) }.getOrNull() }
    }
    val status = Status.dari(l.status)
    val milikSaya = l.reporterId == vm.sesi?.id

    Column(
        Modifier
            .fillMaxSize()
            .background(Warna.Latar)
            .verticalScroll(rememberScrollState())
            .statusBarsPadding(),
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(l.kode, color = Warna.TintaLembut, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 8.dp).weight(1f))
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(Color.White).clickable(onClick = tutup),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Rounded.Close, "Tutup", tint = Warna.Tinta) }
        }
        Column(Modifier.padding(horizontal = 22.dp)) {
            PilStatus(status)
            Spacer(Modifier.height(12.dp))
            Text(l.title, style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(6.dp))
            Text("${l.lokasi} · ${l.kategori} · ${tanggal(l.createdAt)}", color = Warna.TintaLembut, fontSize = 14.sp)
        }
        if (foto != null) {
            AsyncImage(
                model = foto,
                contentDescription = "Foto kerusakan",
                contentScale = ContentScale.Crop,
                modifier = Modifier.padding(18.dp).fillMaxWidth().aspectRatio(4f / 3f).clip(RoundedCornerShape(24.dp)),
            )
        } else {
            Spacer(Modifier.height(18.dp))
        }
        Kartu(Modifier.padding(horizontal = 18.dp).fillMaxWidth()) {
            Column {
                Text("Keterangan", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(6.dp))
                Text(l.description.ifBlank { "Tidak ada keterangan." }, color = Warna.TintaLembut)
                if (!l.alasanTolak.isNullOrBlank()) {
                    Spacer(Modifier.height(14.dp))
                    Text("Alasan ditolak", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(6.dp))
                    Text(l.alasanTolak, color = Warna.TintaLembut)
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Garis(l, vm)
        Spacer(Modifier.height(18.dp))
        Column(Modifier.padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            aksi?.invoke()
            if (milikSaya && l.assignedTo != null && status != Status.SELESAI) {
                TombolUtama(
                    "Chat petugas di WhatsApp",
                    ikon = Icons.Rounded.Chat,
                    warna = Color(0xFF1FA855),
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        lingkup.launch {
                            val nomor = runCatching { Repo.kontakPetugas(l.id) }.getOrNull()
                            if (nomor.isNullOrBlank()) {
                                vm.kabari("Petugas belum mengisi nomor WhatsApp")
                            } else {
                                val teks = Uri.encode("Halo, saya pelapor ${l.kode} (${l.title}).")
                                konteks.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$nomor?text=$teks")))
                            }
                        }
                    },
                )
            }
        }
        Spacer(Modifier.navigationBarsPadding().height(30.dp))
    }
}

/** Garis waktu sederhana: dikirim → diambil petugas → status sekarang. */
@Composable
private fun Garis(l: Laporan, vm: AppViewModel) {
    val status = Status.dari(l.status)
    val langkah = buildList {
        add(Triple("Laporan dikirim", tanggal(l.createdAt), true))
        add(Triple(if (l.assignedTo != null) "Diambil ${vm.namaDari(l.assignedTo).takeIf { it != "petugas lain" } ?: "petugas"}" else "Menunggu petugas", l.assignedAt?.let { tanggal(it) } ?: "", l.assignedTo != null))
        when (status) {
            Status.SELESAI -> add(Triple("Selesai diperbaiki", "", true))
            Status.DITOLAK -> add(Triple("Ditolak", "", true))
            else -> add(Triple("Selesai diperbaiki", "", false))
        }
    }
    Kartu(Modifier.padding(horizontal = 18.dp).fillMaxWidth()) {
        Column {
            Text("Perjalanan laporan", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(12.dp))
            langkah.forEachIndexed { i, (judul, waktu, jadi) ->
                Row {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.size(14.dp).clip(CircleShape).background(if (jadi) Warna.Merah else Color(0xFFE4DEDB)))
                        if (i < langkah.lastIndex) {
                            Box(Modifier.width(2.dp).height(34.dp).background(if (langkah[i + 1].third) Warna.Merah else Color(0xFFE4DEDB)))
                        }
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.padding(bottom = 10.dp)) {
                        Text(judul, fontWeight = FontWeight.SemiBold, color = if (jadi) Warna.Tinta else Warna.TintaLembut, fontSize = 15.sp)
                        if (waktu.isNotBlank()) Text(waktu, color = Warna.TintaLembut, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
