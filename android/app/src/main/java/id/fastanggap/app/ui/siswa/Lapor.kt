package id.fastanggap.app.ui.siswa

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AcUnit
import androidx.compose.material.icons.rounded.AddAPhoto
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Build
import androidx.compose.material.icons.rounded.Chair
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DeveloperBoard
import androidx.compose.material.icons.rounded.DoorFront
import androidx.compose.material.icons.rounded.Lightbulb
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.TableRestaurant
import androidx.compose.material.icons.rounded.Wc
import androidx.compose.material.icons.rounded.Air
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material.icons.rounded.Place
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.foundation.Image
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.fastanggap.app.AppViewModel
import id.fastanggap.app.data.Ref
import id.fastanggap.app.ui.Isian
import id.fastanggap.app.ui.Kartu
import id.fastanggap.app.ui.TombolSekunder
import id.fastanggap.app.ui.TombolUtama
import id.fastanggap.app.ui.Warna
import id.fastanggap.app.ui.pegas
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

fun ikonKategori(nama: String): ImageVector = when {
    nama.contains("ac", true) -> Icons.Rounded.AcUnit
    nama.contains("kipas", true) -> Icons.Rounded.Air
    nama.contains("lampu", true) -> Icons.Rounded.Lightbulb
    nama.contains("meja", true) -> Icons.Rounded.TableRestaurant
    nama.contains("kursi", true) -> Icons.Rounded.Chair
    nama.contains("proyektor", true) -> Icons.Rounded.Videocam
    nama.contains("papan", true) -> Icons.Rounded.DeveloperBoard
    nama.contains("pintu", true) || nama.contains("jendela", true) -> Icons.Rounded.DoorFront
    nama.contains("toilet", true) -> Icons.Rounded.Wc
    else -> Icons.Rounded.Build
}

private val JUDUL_LANGKAH = listOf("Apa yang rusak?", "Di mana?", "Ceritakan sedikit", "Cek sebelum kirim")

/**
 * Alur lapor 4 langkah, satu keputusan per layar:
 * kategori → lokasi → keterangan + foto → konfirmasi → terkirim.
 */
@Composable
fun LaporFlow(vm: AppViewModel, tutup: () -> Unit, lihat: () -> Unit) {
    var langkah by remember { mutableIntStateOf(0) }
    var kategori by remember { mutableStateOf<Ref?>(null) }
    var lokasi by remember { mutableStateOf<Ref?>(null) }
    var judul by remember { mutableStateOf("") }
    var keterangan by remember { mutableStateOf("") }
    var foto by remember { mutableStateOf<ByteArray?>(null) }
    var pratinjau by remember { mutableStateOf<ImageBitmap?>(null) }
    var sibuk by remember { mutableStateOf(false) }
    var kode by remember { mutableStateOf<String?>(null) }
    val lingkup = rememberCoroutineScope()

    BackHandler {
        if (langkah > 0 && kode == null) langkah-- else tutup()
    }

    Column(Modifier.fillMaxSize().background(Warna.Latar).statusBarsPadding().imePadding()) {
        if (kode != null) {
            Terkirim(kode!!, tutup, lihat)
            return@Column
        }
        // Kepala: tombol kembali/tutup + bilah progres.
        Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(Color.White).clickable { if (langkah > 0) langkah-- else tutup() },
                contentAlignment = Alignment.Center,
            ) { Icon(if (langkah > 0) Icons.Rounded.ArrowBack else Icons.Rounded.Close, "Kembali", tint = Warna.Tinta) }
            Spacer(Modifier.width(14.dp))
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                repeat(4) { i ->
                    val isi by animateFloatAsState(if (i <= langkah) 1f else 0f, pegas(), label = "progres")
                    Box(Modifier.weight(1f).height(5.dp).clip(RoundedCornerShape(50)).background(Color(0xFFE8E2DF))) {
                        Box(Modifier.fillMaxWidth(isi).height(5.dp).clip(RoundedCornerShape(50)).background(Warna.Merah))
                    }
                }
            }
            Spacer(Modifier.width(14.dp))
            Text("${langkah + 1}/4", color = Warna.TintaLembut, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
        }

        AnimatedContent(
            targetState = langkah,
            transitionSpec = {
                val maju = targetState > initialState
                (slideInHorizontally(pegas()) { if (maju) it / 3 else -it / 3 } + fadeIn(tween(220))) togetherWith
                    (slideOutHorizontally(tween(220)) { if (maju) -it / 4 else it / 4 } + fadeOut(tween(160)))
            },
            modifier = Modifier.weight(1f),
            label = "langkah",
        ) { l ->
            Column(Modifier.fillMaxSize()) {
                Text(
                    JUDUL_LANGKAH[l],
                    style = MaterialTheme.typography.displaySmall,
                    modifier = Modifier.padding(horizontal = 22.dp).padding(top = 10.dp, bottom = 14.dp),
                )
                when (l) {
                    0 -> PilihKategori(vm.kategori, kategori) { kategori = it; langkah = 1 }
                    1 -> PilihLokasi(vm.lokasi, lokasi) { lokasi = it; langkah = 2 }
                    2 -> IsiKeterangan(judul, { judul = it }, keterangan, { keterangan = it }, pratinjau) { byte, bmp ->
                        foto = byte
                        pratinjau = bmp
                    }
                    else -> Ringkas(kategori, lokasi, judul, keterangan, pratinjau)
                }
            }
        }

        if (langkah >= 2) {
            Box(Modifier.fillMaxWidth().navigationBarsPadding().padding(18.dp)) {
                TombolUtama(
                    if (langkah == 2) "Lanjut" else "Kirim laporan",
                    modifier = Modifier.fillMaxWidth(),
                    aktif = judul.trim().length >= 5 && kategori != null && lokasi != null,
                    sibuk = sibuk,
                    onClick = {
                        if (langkah == 2) {
                            langkah = 3
                        } else {
                            sibuk = true
                            lingkup.launch {
                                vm.kirimLaporan(kategori!!.id, lokasi!!.id, judul, keterangan, foto)
                                    .onSuccess { kode = it }
                                    .onFailure { vm.kabari("Laporan gagal dikirim. Coba lagi.") }
                                sibuk = false
                            }
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun PilihKategori(daftar: List<Ref>, terpilih: Ref?, pilih: (Ref) -> Unit) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        contentPadding = PaddingValues(start = 18.dp, end = 18.dp, bottom = 30.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(daftar, key = { it.id }) { k ->
            val aktif = k.id == terpilih?.id
            Kartu(
                Modifier.aspectRatio(1.15f).then(if (aktif) Modifier.border(2.dp, Warna.Merah, RoundedCornerShape(24.dp)) else Modifier),
                onClick = { pilih(k) },
            ) {
                Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
                    Box(
                        Modifier.size(46.dp).clip(RoundedCornerShape(15.dp)).background(Warna.MerahLembut),
                        contentAlignment = Alignment.Center,
                    ) { Icon(ikonKategori(k.name), null, tint = Warna.Merah, modifier = Modifier.size(25.dp)) }
                    Text(k.name, style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}

@Composable
private fun PilihLokasi(daftar: List<Ref>, terpilih: Ref?, pilih: (Ref) -> Unit) {
    var cari by remember { mutableStateOf("") }
    val hasil = daftar.filter { it.name.contains(cari.trim(), ignoreCase = true) }
    Column {
        Isian(cari, { cari = it }, "Cari ruang, lab, toilet…", Icons.Rounded.Search, modifier = Modifier.padding(horizontal = 18.dp))
        Spacer(Modifier.height(10.dp))
        LazyColumn(contentPadding = PaddingValues(start = 18.dp, end = 18.dp, bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(hasil, key = { it.id }) { l ->
                val aktif = l.id == terpilih?.id
                Row(
                    Modifier
                        .animateItem()
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(if (aktif) Warna.MerahLembut else Color.White)
                        .clickable { pilih(l) }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Rounded.Place, null, tint = Warna.Merah, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(12.dp))
                    Text(l.name, fontSize = 16.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

@Composable
private fun IsiKeterangan(
    judul: String,
    ubahJudul: (String) -> Unit,
    ket: String,
    ubahKet: (String) -> Unit,
    pratinjau: ImageBitmap?,
    setFoto: (ByteArray?, ImageBitmap?) -> Unit,
) {
    val konteks = LocalContext.current
    val lingkup = rememberCoroutineScope()
    val pemilih = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) lingkup.launch {
            val hasil = withContext(Dispatchers.IO) { siapkanFoto(konteks, uri) }
            if (hasil != null) setFoto(hasil.first, hasil.second.asImageBitmap())
        }
    }
    Column(
        Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Isian(judul, ubahJudul, "Judul singkat, mis. AC tidak dingin")
        Isian(ket, ubahKet, "Sejak kapan? Seberapa parah? (opsional)", baris = 4)
        if (pratinjau != null) {
            Box {
                Image(
                    pratinjau,
                    contentDescription = "Foto terpilih",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f).clip(RoundedCornerShape(22.dp)),
                )
                Box(
                    Modifier.align(Alignment.TopEnd).padding(10.dp).size(34.dp).clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.5f)).clickable { setFoto(null, null) },
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Rounded.Close, "Hapus foto", tint = Color.White, modifier = Modifier.size(18.dp)) }
            }
        } else {
            TombolSekunder(
                "Tambah foto",
                ikon = Icons.Rounded.AddAPhoto,
                modifier = Modifier.fillMaxWidth(),
                onClick = { pemilih.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            )
        }
        Text("Foto membantu petugas membawa alat yang tepat.", color = Warna.TintaLembut, fontSize = 13.sp)
        Spacer(Modifier.height(10.dp))
    }
}

@Composable
private fun Ringkas(kategori: Ref?, lokasi: Ref?, judul: String, ket: String, pratinjau: ImageBitmap?) {
    Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 18.dp)) {
        Kartu(Modifier.fillMaxWidth()) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                BarisRingkas("Kategori", kategori?.name.orEmpty())
                BarisRingkas("Lokasi", lokasi?.name.orEmpty())
                BarisRingkas("Judul", judul)
                if (ket.isNotBlank()) BarisRingkas("Keterangan", ket)
                if (pratinjau != null) {
                    Image(pratinjau, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(16.dp)))
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text(
            "Setelah dikirim, semua petugas sarana dapat pesan WhatsApp. Petugas pertama yang mengambil akan menanganinya.",
            color = Warna.TintaLembut,
            fontSize = 13.sp,
            modifier = Modifier.padding(horizontal = 6.dp),
        )
    }
}

@Composable
private fun BarisRingkas(label: String, isi: String) {
    Column {
        Text(label.uppercase(), color = Warna.TintaLembut, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        Spacer(Modifier.height(3.dp))
        Text(isi, fontSize = 16.sp, fontWeight = FontWeight.Medium)
    }
}

/** Layar sukses: lingkaran tergambar, centang muncul, kode laporan memantul masuk. */
@Composable
private fun Terkirim(kode: String, tutup: () -> Unit, lihat: () -> Unit) {
    val gambar = remember { Animatable(0f) }
    val muncul = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        gambar.animateTo(1f, tween(700))
        muncul.animateTo(1f, pegas())
    }
    Column(
        Modifier.fillMaxSize().navigationBarsPadding().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(Modifier.size(132.dp), contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                drawArc(
                    color = Warna.Merah,
                    startAngle = -90f,
                    sweepAngle = 360f * gambar.value,
                    useCenter = false,
                    style = Stroke(10.dp.toPx(), cap = StrokeCap.Round),
                )
                val p = ((gambar.value - 0.5f) * 2).coerceIn(0f, 1f)
                if (p > 0f) {
                    val a = Offset(size.width * 0.3f, size.height * 0.52f)
                    val b = Offset(size.width * 0.45f, size.height * 0.66f)
                    val c = Offset(size.width * 0.72f, size.height * 0.38f)
                    val s1 = (p * 2).coerceAtMost(1f)
                    drawLine(Warna.Merah, a, a + (b - a) * s1, 10.dp.toPx(), StrokeCap.Round)
                    if (p > 0.5f) {
                        val s2 = (p - 0.5f) * 2
                        drawLine(Warna.Merah, b, b + (c - b) * s2, 10.dp.toPx(), StrokeCap.Round)
                    }
                }
            }
        }
        Spacer(Modifier.height(28.dp))
        Column(
            Modifier.graphicsLayer { alpha = muncul.value; translationY = (1 - muncul.value) * 60f },
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Laporan terkirim", style = MaterialTheme.typography.displaySmall, textAlign = TextAlign.Center)
            Spacer(Modifier.height(10.dp))
            Box(Modifier.clip(RoundedCornerShape(50)).background(Warna.Tinta).padding(horizontal = 18.dp, vertical = 10.dp)) {
                Text(kode, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp, letterSpacing = 1.sp)
            }
            Spacer(Modifier.height(14.dp))
            Text(
                "Petugas sarana sudah dikabari lewat WhatsApp. Kamu akan melihat statusnya berubah di sini.",
                color = Warna.TintaLembut,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(30.dp))
            TombolUtama("Lihat laporan saya", lihat, Modifier.fillMaxWidth())
            Spacer(Modifier.height(10.dp))
            TombolSekunder("Kembali ke beranda", tutup, Modifier.fillMaxWidth())
        }
    }
}

/** Mengecilkan foto ke sisi terpanjang 1600 px dan JPEG 80% supaya cepat diunggah. */
private fun siapkanFoto(konteks: Context, uri: Uri): Pair<ByteArray, Bitmap>? = runCatching {
    val batas = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    konteks.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, batas) }
    var sampel = 1
    while (maxOf(batas.outWidth, batas.outHeight) / (sampel * 2) >= 1600) sampel *= 2
    val bmp = konteks.contentResolver.openInputStream(uri)?.use {
        BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sampel })
    } ?: return null
    val keluaran = ByteArrayOutputStream()
    bmp.compress(Bitmap.CompressFormat.JPEG, 80, keluaran)
    keluaran.toByteArray() to bmp
}.getOrNull()
