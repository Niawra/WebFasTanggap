package id.fastanggap.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Close
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
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.fastanggap.app.AppViewModel
import id.fastanggap.app.data.DrafLaporan
import id.fastanggap.app.data.GiliranAi
import id.fastanggap.app.data.Peran
import id.fastanggap.app.data.TanggapAi
import kotlinx.coroutines.launch

private data class PesanAi(
    val dariAi: Boolean,
    val teks: String,
    val galat: Boolean = false,
    val draf: DrafLaporan? = null,
    val id: Long = System.nanoTime(),
)

/** Tombol bulat mengambang untuk membuka TanggapAI. */
@Composable
fun TombolTanggapAi(buka: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(54.dp)
            .clip(CircleShape)
            .background(Warna.Tinta)
            .clickable(onClick = buka),
        contentAlignment = Alignment.Center,
    ) { Icon(Icons.Rounded.AutoAwesome, "Tanya TanggapAI", tint = Color.White) }
}

/** Layar penuh obrolan dengan asisten AI TanggapAI (backend yang sama dengan website). */
@Composable
fun TanggapAiLayar(vm: AppViewModel, tutup: () -> Unit) {
    val siswa = vm.sesi?.peran == Peran.SISWA
    // Status tombol Kirim per draf: kosong = belum, "..." = mengirim, teks lain = hasil
    val statusDraf = remember { mutableStateMapOf<Long, String>() }
    val pesan = remember {
        mutableStateListOf(
            PesanAi(true, "Halo! Saya **TanggapAI**. Saya bisa bantu menyusun laporan kerusakan, memilih kategori, atau menjelaskan status laporan. Mau tanya apa?"),
        )
    }
    val riwayat = remember { mutableStateListOf<GiliranAi>() }
    var tulis by remember { mutableStateOf("") }
    var menunggu by remember { mutableStateOf(false) }
    val lingkup = rememberCoroutineScope()
    val daftar = rememberLazyListState()

    LaunchedEffect(pesan.size, menunggu) {
        if (pesan.isNotEmpty()) daftar.animateScrollToItem(pesan.size - 1 + if (menunggu) 1 else 0)
    }

    fun kirim() {
        val isi = tulis.trim()
        if (isi.isEmpty() || menunggu) return
        tulis = ""
        pesan.add(PesanAi(false, isi))
        menunggu = true
        lingkup.launch {
            runCatching {
                TanggapAi.tanya(
                    isi,
                    riwayat.toList(),
                    kategori = if (siswa) vm.kategori.map { it.name } else emptyList(),
                    lokasi = if (siswa) vm.lokasi.map { it.name } else emptyList(),
                )
            }
                .onSuccess { balasan ->
                    riwayat.add(GiliranAi("user", isi))
                    riwayat.add(GiliranAi("model", balasan.teks))
                    pesan.add(PesanAi(true, balasan.teks, draf = balasan.draf))
                }
                .onFailure { pesan.add(PesanAi(true, it.message ?: "Terjadi kendala.", galat = true)) }
            menunggu = false
        }
    }

    Column(Modifier.fillMaxSize().background(Warna.Latar).statusBarsPadding().navigationBarsPadding().imePadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(Warna.Merah), contentAlignment = Alignment.Center) {
                Icon(Icons.Rounded.AutoAwesome, null, tint = Color.White, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text("TanggapAI", style = MaterialTheme.typography.titleMedium)
                Text(if (menunggu) "Sedang mengetik..." else "Asisten pelaporan fasilitas", color = Warna.TintaLembut, fontSize = 12.sp)
            }
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(Color.White).clickable(onClick = tutup),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Rounded.Close, "Tutup", tint = Warna.Tinta) }
        }

        LazyColumn(
            state = daftar,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(pesan, key = { it.id }) { p ->
                Column {
                    GelembungAi(p)
                    p.draf?.let { d ->
                        KartuDraf(d, statusDraf[p.id]) {
                            val kat = vm.kategori.firstOrNull { it.name == d.kategori }
                            val lok = vm.lokasi.firstOrNull { it.name == d.lokasi }
                            if (kat == null || lok == null) {
                                statusDraf[p.id] = "Kategori/lokasi tidak dikenal"
                            } else {
                                statusDraf[p.id] = "..."
                                lingkup.launch {
                                    vm.kirimLaporan(kat.id, lok.id, d.judul, d.deskripsi, null)
                                        .onSuccess { kode ->
                                            statusDraf[p.id] = "Terkirim · $kode"
                                            pesan.add(PesanAi(true, "Laporan **$kode** terkirim ke petugas. Pantau di tab Laporan."))
                                        }
                                        .onFailure { e ->
                                            val asal = e.message.orEmpty().contains("ditolak otomatis")
                                            statusDraf[p.id] = if (asal) "Ditolak otomatis" else ""
                                            pesan.add(PesanAi(true, e.message ?: "Laporan gagal dikirim.", galat = true))
                                        }
                                }
                            }
                        }
                    }
                }
            }
            if (menunggu) item { GelembungAi(PesanAi(true, "...")) }
        }

        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = tulis,
                onValueChange = { if (it.length <= 500) tulis = it },
                placeholder = { Text("Tanya TanggapAI...") },
                shape = RoundedCornerShape(50),
                maxLines = 4,
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Warna.Merah, cursorColor = Warna.Merah),
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.size(8.dp))
            val bisa = tulis.isNotBlank() && !menunggu
            Box(
                Modifier
                    .size(50.dp)
                    .clip(CircleShape)
                    .background(if (bisa) Warna.Merah else Warna.Merah.copy(alpha = 0.35f))
                    .clickable(enabled = bisa) { kirim() },
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.AutoMirrored.Rounded.Send, "Kirim", tint = Color.White) }
        }
    }
}

@Composable
private fun KartuDraf(d: DrafLaporan, status: String?, kirim: () -> Unit) {
    Column(
        Modifier
            .padding(top = 6.dp)
            .widthIn(max = 300.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("Draf laporan", color = Warna.TintaLembut, fontSize = 11.sp)
        Text(d.judul, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        Text("${d.kategori} · ${d.lokasi}", color = Warna.TintaLembut, fontSize = 12.sp)
        Text(d.deskripsi, fontSize = 14.sp, lineHeight = 19.sp)
        val bisa = status.isNullOrEmpty()
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(50))
                .background(if (bisa) Warna.Merah else Warna.Merah.copy(alpha = 0.4f))
                .clickable(enabled = bisa, onClick = kirim)
                .padding(vertical = 10.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                when {
                    status == "..." -> "Mengirim..."
                    status.isNullOrEmpty() -> "Kirim laporan"
                    else -> status
                },
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun GelembungAi(p: PesanAi) {
    val milikku = !p.dariAi
    Box(Modifier.fillMaxWidth(), contentAlignment = if (milikku) Alignment.CenterEnd else Alignment.CenterStart) {
        Box(
            Modifier
                .widthIn(max = 300.dp)
                .clip(
                    if (milikku) RoundedCornerShape(18.dp, 18.dp, 4.dp, 18.dp)
                    else RoundedCornerShape(18.dp, 18.dp, 18.dp, 4.dp),
                )
                .background(
                    when {
                        milikku -> Warna.Merah
                        p.galat -> Warna.MerahLembut
                        else -> Color.White
                    },
                )
                .padding(horizontal = 13.dp, vertical = 9.dp),
        ) {
            Text(
                markdownSederhana(p.teks),
                color = if (milikku) Color.White else Warna.Tinta,
                fontSize = 15.sp,
                lineHeight = 21.sp,
            )
        }
    }
}

/** Menampilkan **tebal** dan membuang tanda `kode` dari balasan AI. */
private fun markdownSederhana(teks: String): AnnotatedString = buildAnnotatedString {
    val bersih = teks.replace("`", "")
    val bagian = bersih.split("**")
    bagian.forEachIndexed { i, s ->
        if (i % 2 == 1) withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(s) } else append(s)
    }
}

@androidx.compose.ui.tooling.preview.Preview(name = "TanggapAI · Gelembung & draf", showBackground = true)
@Composable
private fun PreviewGelembungAi() {
    TemaFasTanggap {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            GelembungAi(PesanAi(dariAi = false, teks = "Lampu kelasku mati"))
            GelembungAi(PesanAi(dariAi = true, teks = "Baik, aku siapkan **draf laporan** untukmu."))
            KartuDraf(id.fastanggap.app.data.ContohData.draf, status = null, kirim = {})
        }
    }
}
