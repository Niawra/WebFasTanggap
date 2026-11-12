@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package id.fastanggap.app.ui.petugas

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Block
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Inbox
import androidx.compose.material.icons.rounded.Logout
import androidx.compose.material.icons.rounded.PanTool
import androidx.compose.material.icons.rounded.Phone
import androidx.compose.material.icons.rounded.TaskAlt
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.fastanggap.app.AppViewModel
import id.fastanggap.app.data.Laporan
import id.fastanggap.app.data.Peran
import id.fastanggap.app.data.Status
import id.fastanggap.app.ui.AngkaBerhitung
import id.fastanggap.app.ui.Isian
import id.fastanggap.app.ui.JudulBesar
import id.fastanggap.app.ui.Kartu
import id.fastanggap.app.ui.Kosong
import id.fastanggap.app.ui.TombolSekunder
import id.fastanggap.app.ui.TombolUtama
import id.fastanggap.app.ui.Warna
import id.fastanggap.app.ui.siswa.KartuLaporan
import id.fastanggap.app.ui.siswa.RuangBilah
import id.fastanggap.app.ui.warnaStatus
import kotlinx.coroutines.launch

private fun terbuka(l: Laporan) = Status.dari(l.status).let { it == Status.MENUNGGU || it == Status.DIPROSES }

/** Tugas yang belum diambil siapa pun. Siapa cepat dia dapat. */
@Composable
fun DaftarTugas(vm: AppViewModel, buka: (Laporan) -> Unit) {
    val tugas = vm.laporan.filter { terbuka(it) && it.assignedTo == null }
    val lingkup = rememberCoroutineScope()
    PullToRefreshBox(isRefreshing = vm.menyegarkan, onRefresh = { lingkup.launch { vm.segarkan() } }) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = RuangBilah)) {
            item { JudulBesar("Tugas masuk", sub = "Petugas sarana") }
            item { DenyutLangsung(tugas.size) }
            if (vm.sesi?.telepon.isNullOrBlank()) {
                item { PengingatWa() }
            }
            if (tugas.isEmpty()) {
                item { Kosong("Semua beres", "Tidak ada tugas yang menunggu. Tugas baru akan muncul otomatis.", Icons.Rounded.TaskAlt) }
            }
            items(tugas, key = { it.id }) { l ->
                var sibuk by remember { mutableStateOf(false) }
                KartuLaporan(
                    l,
                    { buka(l) },
                    Modifier.animateItem().padding(horizontal = 18.dp, vertical = 6.dp),
                ) {
                    TombolUtama(
                        "Ambil tugas",
                        ikon = Icons.Rounded.PanTool,
                        sibuk = sibuk,
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            sibuk = true
                            lingkup.launch {
                                vm.kabari(vm.ambil(l))
                                sibuk = false
                            }
                        },
                    )
                }
            }
        }
    }
}

/** Titik hijau berdenyut: menandakan daftar tersambung realtime. */
@Composable
private fun DenyutLangsung(jumlah: Int) {
    val t = rememberInfiniteTransition(label = "denyut")
    val s by t.animateFloat(1f, 2.4f, infiniteRepeatable(tween(1400), RepeatMode.Restart), label = "s")
    val a by t.animateFloat(0.5f, 0f, infiniteRepeatable(tween(1400), RepeatMode.Restart), label = "a")
    Row(Modifier.padding(horizontal = 22.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(contentAlignment = Alignment.Center) {
            Box(Modifier.size(10.dp).graphicsLayer { scaleX = s; scaleY = s; alpha = a }.clip(CircleShape).background(Warna.Selesai))
            Box(Modifier.size(10.dp).clip(CircleShape).background(Warna.Selesai))
        }
        Spacer(Modifier.width(10.dp))
        Text("Langsung · $jumlah menunggu diambil", color = Warna.TintaLembut, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun PengingatWa() {
    Kartu(Modifier.padding(horizontal = 18.dp, vertical = 8.dp).fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(Color(0xFFE3F6EA)),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Rounded.Phone, null, tint = Color(0xFF1FA855)) }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text("Isi nomor WhatsApp", fontWeight = FontWeight.SemiBold)
                Text("Buka tab Akun supaya kamu dapat kabar tugas baru di WA.", color = Warna.TintaLembut, fontSize = 13.sp)
            }
        }
    }
}

/** Tugas yang sedang kupegang. */
@Composable
fun TugasSaya(vm: AppViewModel, buka: (Laporan) -> Unit) {
    val sesi = vm.sesi ?: return
    val milik = vm.laporan.filter { it.assignedTo == sesi.id }
    val aktif = milik.filter { terbuka(it) }
    val tuntas = milik.filterNot { terbuka(it) }
    val lingkup = rememberCoroutineScope()
    PullToRefreshBox(isRefreshing = vm.menyegarkan, onRefresh = { lingkup.launch { vm.segarkan() } }) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = RuangBilah)) {
            item { JudulBesar("Tugasku") }
            if (aktif.isEmpty()) {
                item { Kosong("Belum ada tugas", "Ambil tugas dari tab Tugas. Yang kamu ambil muncul di sini.", Icons.Rounded.Inbox) }
            }
            items(aktif, key = { it.id }) { l ->
                KartuLaporan(l, { buka(l) }, Modifier.animateItem().padding(horizontal = 18.dp, vertical = 6.dp)) {
                    AksiPetugas(vm, l)
                }
            }
            if (tuntas.isNotEmpty()) {
                item {
                    Text("Sudah selesai", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(start = 22.dp, top = 20.dp, bottom = 4.dp))
                }
                items(tuntas, key = { it.id }) { l ->
                    KartuLaporan(l, { buka(l) }, Modifier.animateItem().padding(horizontal = 18.dp, vertical = 6.dp))
                }
            }
        }
    }
}

/**
 * Tombol aksi petugas untuk satu laporan. Dipakai di kartu Tugasku dan di layar detail:
 * belum diambil → "Ambil tugas"; milikku → "Tandai selesai" / "Tolak" dengan catatan.
 */
@Composable
fun AksiPetugas(vm: AppViewModel, l: Laporan) {
    val sesi = vm.sesi ?: return
    if (sesi.peran != Peran.PETUGAS || !terbuka(l)) return
    val lingkup = rememberCoroutineScope()
    var sibuk by remember { mutableStateOf(false) }
    var mode by remember(l.id) { mutableStateOf<Status?>(null) }
    var catatan by remember(l.id) { mutableStateOf("") }

    when {
        l.assignedTo == null -> TombolUtama(
            "Ambil tugas",
            ikon = Icons.Rounded.PanTool,
            sibuk = sibuk,
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                sibuk = true
                lingkup.launch { vm.kabari(vm.ambil(l)); sibuk = false }
            },
        )
        l.assignedTo != sesi.id -> Text("Ditangani ${vm.namaDari(l.assignedTo)}", color = Warna.TintaLembut, fontWeight = FontWeight.Medium)
        else -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            AnimatedVisibility(mode != null, enter = expandVertically() + fadeIn(), exit = shrinkVertically()) {
                Isian(
                    catatan,
                    { catatan = it },
                    if (mode == Status.DITOLAK) "Alasan menolak (wajib)" else "Apa yang diperbaiki? (opsional)",
                    baris = 3,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TombolUtama(
                    if (mode == Status.SELESAI) "Simpan selesai" else "Tandai selesai",
                    ikon = Icons.Rounded.CheckCircle,
                    warna = Warna.Selesai,
                    sibuk = sibuk && mode == Status.SELESAI,
                    modifier = Modifier.weight(1f),
                    onClick = {
                        if (mode != Status.SELESAI) {
                            mode = Status.SELESAI
                        } else {
                            sibuk = true
                            lingkup.launch {
                                val ok = vm.ubahStatus(l, Status.SELESAI, catatan.ifBlank { "Perbaikan selesai." })
                                vm.kabari(if (ok) "${l.kode} ditandai selesai" else "Gagal menyimpan. Coba lagi.")
                                sibuk = false
                                mode = null
                            }
                        }
                    },
                )
                TombolSekunder(
                    if (mode == Status.DITOLAK) "Kirim" else "Tolak",
                    ikon = Icons.Rounded.Block,
                    onClick = {
                        if (mode != Status.DITOLAK) {
                            mode = Status.DITOLAK
                        } else if (catatan.isBlank()) {
                            vm.kabari("Tulis alasan menolak dulu")
                        } else {
                            lingkup.launch {
                                val ok = vm.ubahStatus(l, Status.DITOLAK, catatan)
                                vm.kabari(if (ok) "${l.kode} ditolak" else "Gagal menyimpan. Coba lagi.")
                                mode = null
                            }
                        }
                    },
                )
            }
        }
    }
}

/** Ringkasan beranimasi: cincin progres + batang per kategori yang tumbuh. */
@Composable
fun RingkasanPetugas(vm: AppViewModel) {
    val semua = vm.laporan
    val jumlah = Status.entries.associateWith { s -> semua.count { Status.dari(it.status) == s } }
    val total = semua.size.coerceAtLeast(1)
    val selesaiRasio = (jumlah[Status.SELESAI] ?: 0) / total.toFloat()
    val perKategori = semua.groupingBy { it.kategori }.eachCount().toList().sortedByDescending { it.second }.take(6)
    val maks = (perKategori.maxOfOrNull { it.second } ?: 1).toFloat()

    val tumbuh = remember { Animatable(0f) }
    LaunchedEffect(semua.size) {
        tumbuh.snapTo(0f)
        tumbuh.animateTo(1f, tween(1100, easing = FastOutSlowInEasing))
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = RuangBilah)) {
        item { JudulBesar("Ringkasan") }
        item {
            Kartu(Modifier.padding(horizontal = 18.dp, vertical = 8.dp).fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(120.dp), contentAlignment = Alignment.Center) {
                        Canvas(Modifier.fillMaxSize()) {
                            val tebal = 14.dp.toPx()
                            drawArc(Color(0xFFF0EBE9), -90f, 360f, false, style = Stroke(tebal))
                            drawArc(Warna.Selesai, -90f, 360f * selesaiRasio * tumbuh.value, false, style = Stroke(tebal, cap = StrokeCap.Round))
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("${(selesaiRasio * 100 * tumbuh.value).toInt()}%", fontSize = 26.sp, fontWeight = FontWeight.Bold)
                            Text("selesai", color = Warna.TintaLembut, fontSize = 12.sp)
                        }
                    }
                    Spacer(Modifier.width(18.dp))
                    Column(Modifier.weight(1f)) {
                        AngkaBerhitung(semua.size, ukuran = 40.dp)
                        Text("laporan tercatat", color = Warna.TintaLembut)
                        Spacer(Modifier.height(8.dp))
                        val tunggu = semua.count { terbuka(it) && it.assignedTo == null }
                        Text("$tunggu belum diambil", color = if (tunggu > 0) Warna.Merah else Warna.TintaLembut, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    }
                }
            }
        }
        item {
            Row(Modifier.padding(horizontal = 18.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Status.entries.forEach { s ->
                    val (depan, latar) = warnaStatus(s)
                    Kartu(Modifier.weight(1f), padding = PaddingValues(12.dp)) {
                        Column {
                            Box(Modifier.size(26.dp).clip(CircleShape).background(latar), contentAlignment = Alignment.Center) {
                                Box(Modifier.size(8.dp).clip(CircleShape).background(depan))
                            }
                            Spacer(Modifier.height(8.dp))
                            AngkaBerhitung(jumlah[s] ?: 0, ukuran = 24.dp)
                            Text(s.label, color = Warna.TintaLembut, fontSize = 11.sp, maxLines = 1)
                        }
                    }
                }
            }
        }
        item {
            Kartu(Modifier.padding(horizontal = 18.dp, vertical = 8.dp).fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Paling sering rusak", style = MaterialTheme.typography.titleMedium)
                    if (perKategori.isEmpty()) Text("Belum ada data.", color = Warna.TintaLembut)
                    perKategori.forEachIndexed { i, (nama, n) ->
                        // Batang tumbuh bergiliran supaya terasa hidup.
                        val t = ((tumbuh.value * 1.4f) - i * 0.08f).coerceIn(0f, 1f)
                        Column {
                            Row {
                                Text(nama.ifBlank { "Lainnya" }, fontWeight = FontWeight.Medium, fontSize = 14.sp, modifier = Modifier.weight(1f))
                                Text("$n", color = Warna.TintaLembut, fontSize = 14.sp)
                            }
                            Spacer(Modifier.height(6.dp))
                            Box(Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(50)).background(Color(0xFFF3EFED))) {
                                Box(
                                    Modifier.fillMaxWidth((n / maks) * t).height(10.dp).clip(RoundedCornerShape(50))
                                        .background(if (i == 0) Warna.Merah else Warna.Merah.copy(alpha = 0.55f)),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Akun: dipakai siswa dan petugas. Nomor WA dipakai untuk notifikasi OpenWA. */
@Composable
fun AkunLayar(vm: AppViewModel) {
    val sesi = vm.sesi ?: return
    val lingkup = rememberCoroutineScope()
    var nomor by remember(sesi.telepon) { mutableStateOf(sesi.telepon) }
    var sibuk by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = RuangBilah)) {
        item { JudulBesar("Akun") }
        item {
            Kartu(Modifier.padding(horizontal = 18.dp, vertical = 8.dp).fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(58.dp).clip(CircleShape).background(Warna.Merah),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            sesi.nama.split(" ").take(2).joinToString("") { it.take(1) }.uppercase(),
                            color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp,
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(sesi.nama, style = MaterialTheme.typography.titleMedium)
                        Text(
                            if (sesi.peran == Peran.PETUGAS) "Petugas sarana" else "Siswa${if (sesi.kelas.isNotBlank()) " · ${sesi.kelas}" else ""}",
                            color = Warna.TintaLembut, fontSize = 14.sp,
                        )
                        Text(sesi.email, color = Warna.TintaLembut, fontSize = 13.sp)
                    }
                }
            }
        }
        item {
            Kartu(Modifier.padding(horizontal = 18.dp, vertical = 8.dp).fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Nomor WhatsApp", style = MaterialTheme.typography.titleMedium)
                    Text(
                        if (sesi.peran == Peran.PETUGAS) {
                            "Tugas baru dan kabar \"tugas sudah diambil\" dikirim ke nomor ini."
                        } else {
                            "Kabar saat laporanmu selesai dikirim ke nomor ini."
                        },
                        color = Warna.TintaLembut, fontSize = 13.sp,
                    )
                    Isian(nomor, { nomor = it }, "08xxxxxxxxxx", Icons.Rounded.Phone, KeyboardType.Phone)
                    TombolUtama(
                        "Simpan nomor",
                        modifier = Modifier.fillMaxWidth(),
                        aktif = nomor.count { it.isDigit() } >= 9,
                        sibuk = sibuk,
                        onClick = {
                            sibuk = true
                            lingkup.launch {
                                vm.kabari(if (vm.simpanTelepon(nomor)) "Nomor WhatsApp tersimpan" else "Gagal menyimpan nomor")
                                sibuk = false
                            }
                        },
                    )
                }
            }
        }
        item {
            TombolSekunder(
                "Keluar",
                ikon = Icons.Rounded.Logout,
                onClick = { vm.keluar() },
                modifier = Modifier.padding(horizontal = 18.dp, vertical = 12.dp).fillMaxWidth(),
            )
        }
    }
}
