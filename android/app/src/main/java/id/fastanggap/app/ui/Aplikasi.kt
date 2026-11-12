package id.fastanggap.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AssignmentInd
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Inbox
import androidx.compose.material.icons.rounded.Insights
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.ReceiptLong
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource
import id.fastanggap.app.AppViewModel
import id.fastanggap.app.data.Laporan
import id.fastanggap.app.data.Peran
import id.fastanggap.app.ui.petugas.AksiPetugas
import id.fastanggap.app.ui.petugas.AkunLayar
import id.fastanggap.app.ui.petugas.DaftarTugas
import id.fastanggap.app.ui.petugas.RingkasanPetugas
import id.fastanggap.app.ui.petugas.TugasSaya
import id.fastanggap.app.ui.siswa.BerandaSiswa
import id.fastanggap.app.ui.siswa.DetailLaporan
import id.fastanggap.app.ui.siswa.LaporanSaya
import id.fastanggap.app.ui.siswa.LaporFlow
import kotlinx.coroutines.delay

@Composable
fun Aplikasi(vm: AppViewModel) {
    Box(Modifier.fillMaxSize().background(Warna.Latar)) {
        AnimatedContent(
            targetState = when {
                vm.memuat -> 0
                vm.sesi == null -> 1
                else -> 2
            },
            transitionSpec = { (fadeIn(tween(400)) + scaleIn(initialScale = 0.96f)) togetherWith fadeOut(tween(250)) },
            label = "akar",
        ) { tahap ->
            when (tahap) {
                0 -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Warna.Merah)
                }
                1 -> MasukLayar(vm)
                else -> Rangka(vm)
            }
        }
        NotifPulau(vm)
    }
}

/** Kerangka setelah masuk: isi tab + bilah kaca + lapisan layar penuh. */
@Composable
private fun Rangka(vm: AppViewModel) {
    val sesi = vm.sesi ?: return
    val petugas = sesi.peran == Peran.PETUGAS
    val kaca = remember { HazeState() }
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var lapor by remember { mutableStateOf(false) }
    var detail by remember { mutableStateOf<Laporan?>(null) }

    BackHandler(enabled = lapor || detail != null || tab != 0) {
        when {
            lapor -> lapor = false
            detail != null -> detail = null
            else -> tab = 0
        }
    }

    val item = if (petugas) {
        listOf(
            ItemNav("Tugas", Icons.Rounded.Inbox),
            ItemNav("Tugasku", Icons.Rounded.AssignmentInd),
            ItemNav("Ringkasan", Icons.Rounded.Insights),
            ItemNav("Akun", Icons.Rounded.Person),
        )
    } else {
        listOf(
            ItemNav("Beranda", Icons.Rounded.Home),
            ItemNav("Laporan", Icons.Rounded.ReceiptLong),
            ItemNav("Akun", Icons.Rounded.Person),
        )
    }

    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier
                .fillMaxSize()
                .hazeSource(kaca)
                .background(Warna.Latar)
                .statusBarsPadding(),
        ) {
            AnimatedContent(
                targetState = tab,
                transitionSpec = {
                    val arah = if (targetState > initialState) 1 else -1
                    (fadeIn(tween(260)) + slideInVertically(pegas()) { arah * it / 14 }) togetherWith fadeOut(tween(160))
                },
                label = "tab",
            ) { t ->
                val buka: (Laporan) -> Unit = { detail = it }
                if (petugas) {
                    when (t) {
                        0 -> DaftarTugas(vm, buka)
                        1 -> TugasSaya(vm, buka)
                        2 -> RingkasanPetugas(vm)
                        else -> AkunLayar(vm)
                    }
                } else {
                    when (t) {
                        0 -> BerandaSiswa(vm, buka, lapor = { lapor = true }, semua = { tab = 1 })
                        1 -> LaporanSaya(vm, buka)
                        else -> AkunLayar(vm)
                    }
                }
            }
        }

        BilahKaca(
            state = kaca,
            item = item,
            terpilih = tab,
            pilih = { tab = it },
            modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 10.dp),
            aksi = if (petugas) null else Icons.Rounded.Add,
            labelAksi = "Buat laporan",
            tekanAksi = { lapor = true },
        )

        AnimatedVisibility(
            visible = detail != null,
            enter = slideInVertically(pegas()) { it } + fadeIn(),
            exit = slideOutVertically(tween(260)) { it } + fadeOut(),
        ) {
            var terakhir by remember { mutableStateOf(detail) }
            if (detail != null) terakhir = detail
            terakhir?.let { l ->
                val segar = vm.laporan.firstOrNull { it.id == l.id } ?: l
                DetailLaporan(
                    vm,
                    segar,
                    tutup = { detail = null },
                    aksi = if (petugas) ({ AksiPetugas(vm, segar) }) else null,
                )
            }
        }

        AnimatedVisibility(
            visible = lapor,
            enter = slideInVertically(pegas()) { it } + fadeIn(),
            exit = slideOutVertically(tween(280)) { it } + fadeOut(),
        ) {
            LaporFlow(vm, tutup = { lapor = false }, lihat = { lapor = false; tab = 1 })
        }
    }
}

/** Notifikasi kecil yang turun dari atas seperti Dynamic Island. */
@Composable
private fun NotifPulau(vm: AppViewModel) {
    var teks by remember { mutableStateOf<String?>(null) }
    var tampil by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        vm.pesan.collect {
            teks = it
            tampil = true
            delay(2800)
            tampil = false
        }
    }
    Box(Modifier.fillMaxSize().statusBarsPadding().padding(top = 8.dp), contentAlignment = Alignment.TopCenter) {
        AnimatedVisibility(
            visible = tampil,
            enter = slideInVertically(pegas()) { -it * 2 } + scaleIn(initialScale = 0.6f) + fadeIn(),
            exit = slideOutVertically(tween(260)) { -it * 2 } + fadeOut(),
        ) {
            Row(
                Modifier
                    .clip(RoundedCornerShape(50))
                    .background(Color(0xF21D1B1B))
                    .padding(start = 8.dp, end = 18.dp, top = 8.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier.size(30.dp).clip(CircleShape).background(Warna.Merah),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Rounded.NotificationsActive, null, tint = Color.White, modifier = Modifier.size(17.dp)) }
                Spacer(Modifier.width(10.dp))
                Text(teks.orEmpty(), color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}
